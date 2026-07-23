"""
DanmuCustom 后台任务管理器
========================

职责：
- 把“批量刮削”从 API 请求线程 / MoviePilot 主调度线程中剥离出来，
  交由受控 worker 队列在后台执行，避免大批量刮削阻塞主线程。
- 任务状态（每个文件的处理记录）实时持久化，Docker 重启 / 插件重载后不归零。
- 支持暂停 / 继续 / 取消 / 清空记录。
- 启动时自动恢复：success/skipped 保留；running 标记为 interrupted；
  pending/failed 可由用户选择继续。

持久化 key（通过 save_data / get_data 注入，由 MoviePilot 负责落盘）：
- danmucustom_file_status   : {file_path: 单文件记录}
- danmucustom_task_state    : 整体队列状态（total/processed/success/failed/skipped/interrupted/status）
- danmucustom_scrape_history: 最近刮削历史（用于首页/前端展示）
- danmucustom_running_queue : 剩余待处理文件列表
- danmucustom_failed_files  : 失败文件列表

该模块只依赖标准库，不导入任何 MoviePilot 全局服务，便于纯函数化测试。
"""

import os
import time
import threading
import hashlib
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple, Any
from queue import Queue, Empty

KEY_FILE_STATUS = "danmucustom_file_status"
KEY_TASK_STATE = "danmucustom_task_state"
KEY_SCRAPE_HISTORY = "danmucustom_scrape_history"
KEY_RUNNING_QUEUE = "danmucustom_running_queue"
KEY_FAILED_FILES = "danmucustom_failed_files"

STATUS_PENDING = "pending"
STATUS_RUNNING = "running"
STATUS_SUCCESS = "success"
STATUS_FAILED = "failed"
STATUS_SKIPPED = "skipped"
STATUS_INTERRUPTED = "interrupted"
STATUS_CANCELLED = "cancelled"

# 单文件记录字段（需求二.2）
FILE_RECORD_FIELDS = (
    "file_path", "file_size", "file_mtime", "output_ass_path", "output_size",
    "status", "error_message", "started_at", "finished_at", "config_hash",
)


def safe_time(value: Any) -> Optional[str]:
    """把不稳定的时间字段统一归一化为 ISO 字符串，任何异常都返回 None。

    兼容以下输入，避免 fromtimestamp/isoformat 抛错导致接口 500：
    - int/float 时间戳（秒）
    - 毫秒时间戳（>1e12 自动按毫秒处理）
    - datetime 对象
    - 已经是 ISO / 普通字符串（原样返回，去除首尾空白）
    - None / 空 / 非法值 -> None
    """
    if value is None:
        return None
    try:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, bool):  # bool 是 int 子类，需先排除
            return None
        if isinstance(value, (int, float)):
            ts = float(value)
            if ts <= 0:
                return None
            # 毫秒时间戳兜底（13 位）
            if ts > 1e12:
                ts = ts / 1000.0
            return datetime.fromtimestamp(ts).isoformat()
        if isinstance(value, str):
            s = value.strip()
            if not s:
                return None
            # 纯数字字符串按时间戳处理
            try:
                return safe_time(float(s)) if s.replace(".", "", 1).isdigit() else s
            except Exception:
                return s
    except Exception:
        return None
    return None


def _epoch(value: Any) -> Optional[float]:
    """把不稳定时间字段归一化为「秒」浮点数，用于排序 / 计算耗时；失败返回 None。"""
    if value is None or isinstance(value, bool):
        return None
    try:
        if isinstance(value, datetime):
            return value.timestamp()
        if isinstance(value, (int, float)):
            ts = float(value)
            if ts <= 0:
                return None
            return ts / 1000.0 if ts > 1e12 else ts
        if isinstance(value, str):
            s = value.strip()
            if s.replace(".", "", 1).isdigit():
                return _epoch(float(s))
            try:
                return datetime.fromisoformat(s).timestamp()
            except Exception:
                return None
    except Exception:
        return None
    return None


def safe_json(value: Any) -> Any:
    """递归确保对象可被 JSON 序列化，无法处理的值降级为 str，绝不抛错。"""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): safe_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [safe_json(v) for v in value]
    try:
        return str(value)
    except Exception:
        return None


def make_file_record(file_path: str) -> Dict[str, Any]:
    """构造一条空的单文件处理记录。"""
    return {
        "file_path": file_path,
        "file_size": None,
        "file_mtime": None,
        "output_ass_path": None,
        "output_size": None,
        "status": STATUS_PENDING,
        "error_message": None,
        "started_at": None,
        "finished_at": None,
        "config_hash": None,
    }


class DanmuTaskManager:
    """受控后台 worker 队列 + 任务状态持久化。"""

    def __init__(
        self,
        log,
        save_data: Callable[[str, Any], None],
        get_data: Callable[[str], Any],
        process_one: Callable[[str], Tuple[bool, str, Optional[Dict]]],
        compute_config_hash: Callable[[], str],
        default_worker_count: int = 2,
    ):
        """
        Args:
            log: 日志器（module-level logger）
            save_data: MoviePilot 的 self.save_data(key, value)
            get_data: MoviePilot 的 self.get_data(key)
            process_one: 处理单个文件，返回 (是否成功, 消息, 弹幕统计dict)
            compute_config_hash: 计算影响输出的配置 hash
            default_worker_count: 默认 worker 数（建议 2）
        """
        self.log = log
        self._save_data = save_data
        self._get_data = get_data
        self._process_one = process_one
        self._compute_config_hash = compute_config_hash
        self._default_worker_count = max(1, int(default_worker_count))

        self._lock = threading.RLock()
        self._queue: "Queue[str]" = Queue()
        self._workers: List[threading.Thread] = []
        self._pause_event = threading.Event()
        self._stop_event = threading.Event()
        self._running = False

        self._file_status: Dict[str, Dict] = {}
        self._task_state: Dict[str, Any] = {
            "status": "idle", "total": 0, "processed": 0,
            "success": 0, "failed": 0, "skipped": 0,
            "interrupted": 0, "current_files": [],
        }
        self._scrape_history: List[Dict] = []
        self._running_queue: List[str] = []
        self._failed_files: List[str] = []

        self._restore()

    # ---------------------------------------------------------------- 持久化
    def _persist(self) -> None:
        try:
            with self._lock:
                self._save_data(KEY_FILE_STATUS, self._file_status)
                self._save_data(KEY_TASK_STATE, self._task_state)
                self._save_data(KEY_SCRAPE_HISTORY, self._scrape_history[-200:])
                self._save_data(KEY_RUNNING_QUEUE, self._running_queue)
                self._save_data(KEY_FAILED_FILES, self._failed_files)
        except Exception as e:  # pragma: no cover - 持久化失败不应中断任务
            self.log.exception(f"持久化任务状态失败: {e}")

    def _restore(self) -> None:
        try:
            self._file_status = self._get_data(KEY_FILE_STATUS) or {}
            self._task_state = self._get_data(KEY_TASK_STATE) or {
                "status": "idle", "total": 0, "processed": 0,
                "success": 0, "failed": 0, "skipped": 0,
                "interrupted": 0, "current_files": [],
            }
            self._scrape_history = self._get_data(KEY_SCRAPE_HISTORY) or []
            self._running_queue = self._get_data(KEY_RUNNING_QUEUE) or []
            self._failed_files = self._get_data(KEY_FAILED_FILES) or []

            # 启动时恢复：running -> interrupted；pending/failed 保留由用户选择继续
            recovered = 0
            for _path, rec in self._file_status.items():
                if rec.get("status") == STATUS_RUNNING:
                    rec["status"] = STATUS_INTERRUPTED
                    rec["error_message"] = rec.get("error_message") or "Docker 重启 / 插件重载导致中断"
                    recovered += 1
            if recovered:
                self.log.info(f"任务状态恢复: {recovered} 个运行中的任务标记为 interrupted")

            # 上次正在运行 -> 标记为 interrupted（等待用户继续 / 清空）
            if self._task_state.get("status") in (STATUS_RUNNING, "paused"):
                self._task_state["status"] = STATUS_INTERRUPTED

            self._persist()
        except Exception as e:  # pragma: no cover
            self.log.exception(f"恢复任务状态失败: {e}")

    # ---------------------------------------------------------------- 入队
    def enqueue(self, paths: List[str], skip_existing: bool = True) -> Tuple[int, int]:
        """
        批量入队。返回 (实际入队数, 跳过数)。
        扫描时若 .danmu.ass 已存在且 config_hash 未变，默认跳过避免重复跑。
        """
        cfg_hash = self._compute_config_hash()
        queued = 0
        skipped = 0
        with self._lock:
            self._task_state["total"] = len(paths)
            self._task_state["processed"] = 0
            self._task_state["success"] = 0
            self._task_state["failed"] = 0
            self._task_state["skipped"] = 0
            self._task_state["interrupted"] = 0

        for p in paths:
            rec = self._file_status.get(p) or make_file_record(p)
            rec["file_path"] = p
            try:
                st = os.stat(p)
                rec["file_size"] = st.st_size
                rec["file_mtime"] = st.st_mtime
            except OSError:
                pass
            output_ass = f"{os.path.splitext(p)[0]}.danmu.ass"
            if (skip_existing and os.path.exists(output_ass)
                    and rec.get("config_hash") == cfg_hash
                    and rec.get("status") in (STATUS_SUCCESS, STATUS_SKIPPED)):
                rec["status"] = STATUS_SKIPPED
                rec["output_ass_path"] = output_ass
                rec["config_hash"] = cfg_hash
                skipped += 1
            else:
                rec["status"] = STATUS_PENDING
                rec["config_hash"] = cfg_hash
                self._queue.put(p)
                queued += 1
            self._file_status[p] = rec

        with self._lock:
            self._running_queue = list(paths)
            self._task_state["skipped"] = skipped

        self._persist()
        return queued, skipped

    def requeue_unfinished(self, include_failed: bool = False) -> int:
        """把未完成的任务（pending / interrupted，可选 failed）重新入队。"""
        targets = (STATUS_PENDING, STATUS_INTERRUPTED)
        if include_failed:
            targets = targets + (STATUS_FAILED,)
        with self._lock:
            paths = [p for p, r in self._file_status.items()
                     if r.get("status") in targets]
        for p in paths:
            self._queue.put(p)
        with self._lock:
            self._task_state["total"] = len(self._file_status)
        self._persist()
        return len(paths)

    # ---------------------------------------------------------------- worker
    def start(self, worker_count: Optional[int] = None,
              on_finish: Optional[Callable[[], None]] = None) -> bool:
        """启动 worker 线程池（若已运行则忽略）。on_finish 在所有 worker 退出后回调一次。"""
        with self._lock:
            if self._running:
                return False
            self._running = True
            self._stop_event.clear()
            self._pause_event.clear()
            n = max(1, int(worker_count or self._default_worker_count))
            self._workers = []
            for _ in range(n):
                t = threading.Thread(target=self._worker_loop, daemon=True)
                t.start()
                self._workers.append(t)
            self._task_state["status"] = STATUS_RUNNING
        self._persist()
        if on_finish:
            def _monitor() -> None:
                for t in self._workers:
                    t.join()
                try:
                    on_finish()
                except Exception as e:  # noqa: BLE001
                    self.log.exception(f"on_finish 回调异常: {e}")
            threading.Thread(target=_monitor, daemon=True).start()
        return True

    def _worker_loop(self) -> None:
        while not self._stop_event.is_set():
            if self._pause_event.is_set():
                time.sleep(0.3)
                continue
            try:
                path = self._queue.get(timeout=0.3)
            except Empty:
                # 队列空且整体已无任务则退出循环（正常完成 -> idle；
                # running 状态仅在 Docker 重启/插件重载的恢复逻辑中才会变 interrupted）
                with self._lock:
                    if self._queue.empty():
                        self._running = False
                        if self._task_state.get("status") == STATUS_RUNNING:
                            self._task_state["status"] = "idle"
                        self._persist()
                        break
                continue
            if path is None:
                self._queue.task_done()
                break
            self._process_path(path)
            self._queue.task_done()

    def _process_path(self, path: str) -> None:
        output_ass = f"{os.path.splitext(path)[0]}.danmu.ass"
        cfg_hash = self._compute_config_hash()

        # 处理前再次判断是否可跳过（config_hash 未变且产物已存在）
        with self._lock:
            rec = self._file_status.get(path) or make_file_record(path)
            if (os.path.exists(output_ass) and rec.get("config_hash") == cfg_hash
                    and rec.get("status") in (STATUS_SUCCESS, STATUS_SKIPPED)):
                rec["status"] = STATUS_SKIPPED
                rec["output_ass_path"] = output_ass
                self._file_status[path] = rec
                self._task_state["skipped"] = self._task_state.get("skipped", 0) + 1
                self._task_state["processed"] = self._task_state.get("processed", 0) + 1
                self._persist()
                return

            rec["status"] = STATUS_RUNNING
            rec["started_at"] = time.time()
            rec["config_hash"] = cfg_hash
            rec["file_path"] = path
            self._file_status[path] = rec
            self._task_state["current_files"] = [path]
            self._persist()

        try:
            ok, message, counts = self._process_one(path)
            # 容错：旧版 callback 或异常时 counts 可能为 None
            if counts is None:
                counts = {}
        except Exception as e:  # pragma: no cover
            ok, message, counts = False, str(e), {}

        with self._lock:
            rec = self._file_status.get(path) or make_file_record(path)
            rec["finished_at"] = time.time()
            rec["output_ass_path"] = output_ass if os.path.exists(output_ass) else None
            rec["output_size"] = os.path.getsize(output_ass) if os.path.exists(output_ass) else None
            if ok:
                rec["status"] = STATUS_SUCCESS
                rec["error_message"] = None
                rec["danmu_counts"] = counts
                self._task_state["success"] = self._task_state.get("success", 0) + 1
            else:
                rec["status"] = STATUS_FAILED
                rec["error_message"] = message
                if path not in self._failed_files:
                    self._failed_files.append(path)
                self._task_state["failed"] = self._task_state.get("failed", 0) + 1
            self._task_state["processed"] = self._task_state.get("processed", 0) + 1
            self._task_state["current_files"] = []
            self._scrape_history.append({
                "file_path": path,
                "status": rec["status"],
                "time": rec["finished_at"],
                "message": message,
            })
            self._file_status[path] = rec
            self._persist()

    # ---------------------------------------------------------------- 控制
    def pause(self) -> None:
        self._pause_event.set()
        with self._lock:
            if self._task_state.get("status") == STATUS_RUNNING:
                self._task_state["status"] = "paused"
        self._persist()

    def resume(self) -> None:
        self._pause_event.clear()
        with self._lock:
            if self._task_state.get("status") in ("paused", STATUS_INTERRUPTED, STATUS_CANCELLED):
                self._task_state["status"] = STATUS_RUNNING
        self._persist()

    def cancel(self) -> None:
        """停止所有 worker，将未完成（pending/running）标记为 interrupted。"""
        self._stop_event.set()
        with self._lock:
            # 清空队列
            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                    self._queue.task_done()
                except Empty:
                    break
            for p, rec in self._file_status.items():
                if rec.get("status") in (STATUS_PENDING, STATUS_RUNNING):
                    rec["status"] = STATUS_INTERRUPTED
                    rec["error_message"] = rec.get("error_message") or "用户取消"
            self._task_state["status"] = STATUS_CANCELLED
            self._task_state["current_files"] = []
        for t in self._workers:
            t.join(timeout=2)
        self._workers = []
        self._running = False
        self._persist()

    def clear(self) -> None:
        """清空所有任务记录与历史（保留已生成的 .danmu.ass 文件本身）。"""
        self._stop_event.set()
        with self._lock:
            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                    self._queue.task_done()
                except Empty:
                    break
        for t in self._workers:
            t.join(timeout=2)
        self._workers = []
        self._running = False
        self._pause_event.clear()
        self._stop_event.clear()

        self._file_status = {}
        self._task_state = {
            "status": "idle", "total": 0, "processed": 0,
            "success": 0, "failed": 0, "skipped": 0,
            "interrupted": 0, "current_files": [],
        }
        self._scrape_history = []
        self._running_queue = []
        self._failed_files = []
        self._persist()

    # ---------------------------------------------------------------- 查询
    def get_status(self) -> Dict[str, Any]:
        """返回整体队列状态 + 各状态计数（首页统计直接来自持久化）。"""
        with self._lock:
            counts = {
                STATUS_SUCCESS: 0, STATUS_SKIPPED: 0,
                STATUS_FAILED: 0, STATUS_INTERRUPTED: 0,
                STATUS_RUNNING: 0, STATUS_PENDING: 0,
            }
            for _p, rec in self._file_status.items():
                s = rec.get("status")
                if s in counts:
                    counts[s] += 1
            state = dict(self._task_state)
            state["counts"] = counts
            return {
                "state": state,
                "file_status": dict(self._file_status),
                "scrape_history": list(self._scrape_history),
                "running_queue": list(self._running_queue),
                "failed_files": list(self._failed_files),
                "worker_count": self._default_worker_count,
            }

    # ---------------------------------------------------------------- 历史查询
    def get_history(self, page: int = 1, page_size: int = 50,
                    status_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        从持久化的 file_status 读取刮削历史（统一数据源，重启不归零）。
        对字段做容错，任何单条记录异常都不会导致整个接口 500。
        返回 {items, total, page, page_size, total_pages}。
        """
        with self._lock:
            records = list(self._file_status.values())
        # 按完成时间倒序（时间字段用 _epoch 归一化，无/非法值排最后）
        records.sort(key=lambda r: (_epoch(r.get("finished_at")) or 0), reverse=True)

        if status_filter:
            records = [r for r in records if r.get("status") == status_filter]

        total = len(records)
        page = max(1, int(page))
        page_size = max(1, min(int(page_size), 200))
        total_pages = max(1, (total + page_size - 1) // page_size)
        start = (page - 1) * page_size
        page_items = records[start:start + page_size]

        items = []
        for rec in page_items:
            try:
                sa_epoch = _epoch(rec.get("started_at"))
                fa_epoch = _epoch(rec.get("finished_at"))
                duration_ms = (
                    int((fa_epoch - sa_epoch) * 1000)
                    if sa_epoch is not None and fa_epoch is not None and fa_epoch >= sa_epoch
                    else None
                )
                items.append({
                    "file_path": rec.get("file_path"),
                    "file_name": os.path.basename(rec.get("file_path") or "") or "未知",
                    "status": rec.get("status") or "unknown",
                    "error_message": rec.get("error_message"),
                    "output_ass_path": rec.get("output_ass_path"),
                    "started_at": safe_time(rec.get("started_at")),
                    "finished_at": safe_time(rec.get("finished_at")),
                    "duration_ms": duration_ms,
                    "config_hash": rec.get("config_hash"),
                    "danmu_counts": rec.get("danmu_counts", {}),
                })
            except Exception as e:  # 单条异常不影响整体
                self.log.warning(f"历史记录序列化跳过: {rec.get('file_path')}: {e}")
                continue
        # 出口再统一 safe_json，确保任何残留不可序列化值降级为 str
        return safe_json({
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        })

    @staticmethod
    def hash_config(*parts: Any) -> str:
        """根据若干配置片段计算稳定的 config_hash。"""
        h = hashlib.sha256()
        for p in parts:
            h.update(str(p).encode("utf-8"))
            h.update(b"\x00")
        return h.hexdigest()

    def get_config_hash_for_file(self, file_path: str) -> Optional[str]:
        """获取文件中已记录的 config_hash，没有则返回 None。"""
        with self._lock:
            rec = self._file_status.get(file_path)
            return rec.get("config_hash") if rec else None
