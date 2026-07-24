"""
弹幕刮削插件 - 原始版本（纯净副本）
基于 HankunYu/MoviePilot-Plugins 弹幕刮削 v1.9.0
来源: https://github.com/HankunYu/MoviePilot-Plugins/blob/main/plugins.v2/danmu/__init__.py

===== 功能列表（参见 FUNCTION_LIST.md） =====
此文件是原始代码的纯净副本，后续所有修改基于此文件进行。
"""
# MoviePilot library
from app.log import logger
from app.plugins import _PluginBase
from app.core.event import eventmanager
from app.schemas.types import EventType
from app.utils.system import SystemUtils
from app.chain.media import MediaChain
from app.core.metainfo import MetaInfo
from app.core.config import settings
from app import schemas
from app.schemas.types import MediaType, EventType, SystemConfigKey
from datetime import datetime

from typing import Any, List, Dict, Tuple, Optional
import subprocess
import os
import threading
import time
import json
import copy
import requests
from app.plugins.danmucustom import danmu_generator as generator
from app.plugins.danmucustom.task_manager import (
    DanmuTaskManager,
    STATUS_PENDING, STATUS_RUNNING, STATUS_SUCCESS, STATUS_FAILED,
    STATUS_SKIPPED, STATUS_INTERRUPTED,
    safe_json,
)

# 节流落盘间隔：避免每个文件都写库造成 SQLite 争用（这是导致 MP 卡顿/变慢的根因之一）
RETRY_SAVE_INTERVAL = 30.0
FILTER_SAVE_INTERVAL = 30.0
   

class DanmuCustom(_PluginBase):
    """
    弹幕刮削定制版插件，基于原版 Danmu 重构为独立插件 DanmuCustom，可与原版共存。
    
    核心功能：
    - 弹幕生成与刮削：使用弹弹play平台 API 生成 .ass 弹幕字幕文件
    - 批量处理：支持目录刮削、批量分季匹配下载、失败重试队列
    - 手动匹配：通过关键词搜索番剧，手动绑定目录/文件与番剧的对应关系
    - 七阶段过滤：模式屏蔽 / 关键词屏蔽 / 用户信用评分 / 相似弹幕过滤 /
      同屏密度删减 / 频率检测 / 区域控制
    - 词库管理：Vue 前端自定义过滤分类、关键词、正则规则、组合规则
    - 用户管理：封禁/解除封禁/重置信用分/查看过滤统计，状态持久化不丢失
    - Vue 联邦 UI：三个管理页面（弹幕刮削、弹幕过滤、配置）通过 remoteEntry.js 加载
    """
    # 插件名称
    plugin_name = "弹幕刮削定制版"
    # 插件描述
    plugin_desc = "使用弹弹play平台生成弹幕的字幕文件，实现弹幕播放。基于HankunYu原版插件增强的AI定制自用版本，不保障质量。"
    # 插件图标
    plugin_icon =  "https://raw.githubusercontent.com/Aeonnnnnn/MoviePilot-Plugins/main/icons/danmu.png"
    # 主题色
    plugin_color = "#3B5E8E"
    # 插件版本
    plugin_version = "3.4.0"
    # 插件作者
    plugin_author = "Aeonnnnnn"
    # 作者主页
    author_url = "https://github.com/Aeonnnnnn"
    # 插件配置项ID前缀
    plugin_config_prefix = "danmucustom_"
    # 加载顺序
    plugin_order = 1
    # 可使用的用户级别
    auth_level = 1

    # 私有属性
    _enabled = True
    _width = 1920
    _height = 1080
    # 搞字体太复杂 以后再说
    # _fontface = 'Arial'
    _fontsize = 50
    _alpha = 0.8
    _duration = 15
    _path = ''
    _max_threads = 10
    _worker_count = 2  # 后台刮削 worker 数（建议 2，可在配置中调整）
    _onlyFromBili = False
    _useTmdbID = True
    _auto_scrape = True
    _chConvert = 0  # 0=不转换(默认), 1=转简体, 2=转繁体（让弹弹play 服务端处理）
    # 批量刮削时由 /match/batch 预匹配结果缓存：file_path -> comment_id
    _pre_matched_cache: Dict[str, str] = {}
    _screen_area = 'full'  # full(全屏), half(半屏), quarter(1/4屏)
    _enable_strm = True  # 是否启用.strm文件刮削
    # 弹幕内容过滤配置
    _filter_enabled = True
    _filter_blocked_modes = []  # 屏蔽的弹幕模式列表
    _filter_similarity_threshold = 0.8  # 相似弹幕阈值
    _filter_similarity_enabled = True
    _filter_freq_window = 30.0  # 用户频率检测时间窗口（秒）
    _filter_freq_max = 10  # 用户频率检测窗口内最大弹幕数
    _filter_screen_max = 15  # 同屏每窗口最大弹幕数
    _filter_screen_window = 5.0  # 同屏时间窗口（秒）
    _filter_screen_top_ratio = 0.25  # 顶部弹幕保留比例
    _filter_screen_bottom_ratio = 0.10  # 底部弹幕保留比例
    _filter_screen_scroll_ratio = 0.65  # 滚动弹幕保留比例
    # 过滤统计累计持久化 Key（跨实例/跨重启累计）
    _FILTER_CUMULATIVE_KEY = "filter_cumulative_stats"
    # 新增重试相关配置
    _min_danmu_count = 100  # 最小弹幕数量要求 - 硬编码
    _max_retry_times = 10  # 最大重试次数 - 硬编码
    _enable_retry_task = True  # 是否启用重试任务
    
    # 重试任务列表 - 存储格式: {file_path: {"retry_count": int, "last_attempt": datetime, "file_path": str}}
    _retry_tasks = {}
    # 重试任务并发保护；批量刮削期间将逐文件的配置保存合并为最后一次
    _retry_lock = threading.Lock()
    _retry_save_deferred = False
    _retry_save_pending = False
    _retry_last_save = 0.0
    _filter_state_last_save = 0.0
    # 正在刮削中的文件集合，防止同一文件被并发刮削写坏弹幕文件
    _inflight_lock = threading.Lock()
    _inflight_files: set = set()
    # 批量刮削进度状态（含全局定时刮削与目录刮削）
    _scrape_lock = threading.Lock()
    _scrape_progress: Dict[str, Any] = {
        "running": False,
        "total": 0,
        "processed": 0,
        "success": 0,
        "failed": 0,
        "current_file": None,
        "started_at": None,
        "duration": 0
    }
    _manual_matches: Dict[str, Dict[str, Any]] = {}
    _manual_file_matches: Dict[str, Dict[str, Any]] = {}
    # Negative cache: directories confirmed to have no manual match (avoids repeated disk checks while browsing)
    _manual_match_misses: set = set()
    # Danmu line-count cache: {ass_path: (mtime_ns, size, count)} — skip re-reading unchanged files
    _danmu_count_cache: Dict[str, Tuple[int, int, int]] = {}
    _manual_match_storage_key = "manual_matches"

    media_chain = MediaChain()

    def _get_enabled_from_config(self, config: dict) -> bool:
        """从配置中读取启用状态，兼容 enabled 和旧版 enable 字段。"""
        if not config:
            return False
        if "enabled" in config:
            return bool(config.get("enabled"))
        if "enable" in config:
            return bool(config.get("enable"))
        return False

    @property
    def _manual_match_filename(self) -> str:
        """手动匹配 JSON 文件名（来自 DanmuAPI.MANUAL_MATCH_FILE），用于目录级持久化。"""
        return generator.DanmuAPI.MANUAL_MATCH_FILE

    def _normalize_path(self, path: Optional[str]) -> Optional[str]:
        """规范化路径，去除冗余分隔符和相对路径符号，用于路径去重和安全校验。"""
        if not path:
            return None
        return os.path.normpath(path)

    def _manual_json_path(self, directory: str) -> str:
        """获取目录下手动匹配 JSON 文件路径（{目录}/danmu_custom_manual_matches.json），用于原子保存匹配状态。"""
        return os.path.join(directory, self._manual_match_filename)

    def _save_manual_state(self):
        """将内存中的手动匹配状态持久化到 MP 插件数据，重启不丢失。"""
        try:
            payload = {
                "directories": self._manual_matches,
                "files": self._manual_file_matches
            }
            self.save_data(self._manual_match_storage_key, payload)
        except Exception as e:
            logger.warning(f"保存手动匹配状态失败: {e}")

    def _load_manual_matches(self):
        """从 MP 插件数据加载手动匹配缓存（目录级和文件级），兼容旧版仅存储目录映射的结构。"""
        stored = self.get_data(self._manual_match_storage_key)
        if not isinstance(stored, dict):
            stored = {}

        # 兼容旧版本仅存储目录映射的结构
        if "directories" in stored or "files" in stored:
            dir_data = stored.get("directories", {})
            file_data = stored.get("files", {})
        else:
            dir_data = stored
            file_data = {}

        self._manual_matches = {}
        self._manual_file_matches = {}
        self._manual_match_misses = set()

        for raw_path, info in dir_data.items():
            norm = self._normalize_path(raw_path)
            if not norm:
                continue
            payload = self._normalize_manual_entry(info, scope="directory")
            if payload:
                self._manual_matches[norm] = payload

        for raw_path, info in file_data.items():
            norm = self._normalize_path(raw_path)
            if not norm:
                continue
            payload = self._normalize_manual_entry(info, scope="file")
            if payload:
                self._manual_file_matches[norm] = payload

    @staticmethod
    def _normalize_manual_entry(data: Any, scope: str) -> Optional[Dict[str, Any]]:
        """规范化手动匹配条目：校验 animeId、清理冗余字段、补充时间戳，返回标准格式或 None。"""
        if not isinstance(data, dict):
            return None
        anime_id = data.get("animeId") or data.get("anime_id")
        if anime_id is None:
            return None
        try:
            anime_id = int(anime_id)
        except (TypeError, ValueError):
            return None
        payload = dict(data)
        payload["animeId"] = anime_id
        payload.pop("anime_id", None)
        payload["scope"] = scope
        offset = payload.get("episodeOffset")
        if offset is not None:
            try:
                payload["episodeOffset"] = int(offset)
            except (TypeError, ValueError):
                payload.pop("episodeOffset", None)
        payload.setdefault("updatedAt", datetime.now().isoformat(timespec="seconds"))
        return payload

    @staticmethod
    def _clone_manual_match(data: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """深拷贝手动匹配数据，避免调用方意外修改缓存中的原始数据。"""
        if not data:
            return None
        return copy.deepcopy(data)

    def _convert_legacy_id_file(self, directory: str) -> Optional[Dict[str, Any]]:
        """将旧版 .id 文件转换为手动匹配 JSON 格式，并写入新文件。返回转换后的匹配信息或 None。"""
        try:
            for entry in os.listdir(directory):
                if not entry.endswith('.id'):
                    continue
                legacy_path = os.path.join(directory, entry)
                try:
                    anime_id = int(os.path.splitext(entry)[0])
                except (TypeError, ValueError):
                    logger.warning(f"忽略无法解析的ID文件: {legacy_path}")
                    continue
                match_info = {
                    "animeId": int(anime_id),
                    "source": "legacy-id-file",
                    "updatedAt": datetime.now().isoformat(timespec="seconds")
                }
                self._write_manual_match_file(directory, match_info)
                try:
                    os.remove(legacy_path)
                    logger.info(f"已转换旧的ID文件并删除: {legacy_path}")
                except Exception as e:
                    logger.warning(f"删除旧ID文件失败: {e}")
                return match_info
        except FileNotFoundError:
            return None
        except Exception as e:
            logger.warning(f"转换旧ID文件失败: {e}")
        return None

    def _write_manual_match_file(self, directory: str, data: Dict[str, Any]):
        """将手动匹配数据原子写入目录下的 JSON 文件，失败时记录日志但不抛出异常。"""
        if not directory:
            return
        try:
            generator.DanmuAPI._write_manual_mapping(directory, data)
        except AttributeError:
            # 回退写入逻辑
            try:
                os.makedirs(directory, exist_ok=True)
                anime_id = data.get("animeId") or data.get("anime_id")
                if anime_id is None:
                    return
                payload = dict(data)
                payload["animeId"] = int(anime_id)
                payload.pop("anime_id", None)
                payload["scope"] = "directory"
                payload.setdefault("updatedAt", datetime.now().isoformat(timespec="seconds"))
                with open(self._manual_json_path(directory), 'w', encoding='utf-8') as f:
                    json.dump(payload, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.exception(f"写入手动匹配文件失败: {e}")

    def _update_manual_match_cache(self, directory: str, data: Optional[Dict[str, Any]]):
        """更新目录级手动匹配缓存：规范化条目后写入内存并持久化到 MP 插件数据。"""
        norm = self._normalize_path(directory)
        if not norm:
            return
        if data:
            payload = self._normalize_manual_entry(data, scope="directory")
            if not payload:
                return
            self._manual_matches[norm] = payload
        else:
            self._manual_matches.pop(norm, None)
        self._manual_match_misses.discard(norm)
        self._save_manual_state()

    def _update_manual_file_match_cache(self, file_path: str, data: Optional[Dict[str, Any]]):
        """更新文件级手动匹配缓存：规范化条目后写入内存并持久化到 MP 插件数据。"""
        norm = self._normalize_path(file_path)
        if not norm:
            return
        if data:
            payload = self._normalize_manual_entry(data, scope="file")
            if not payload:
                return
            self._manual_file_matches[norm] = payload
        else:
            self._manual_file_matches.pop(norm, None)
        self._save_manual_state()

    def _get_manual_match(self, directory: str, check_legacy: bool = True) -> Optional[Dict[str, Any]]:
        """
        获取目录的手动匹配信息
        :param directory: 目录路径
        :param check_legacy: 是否检查旧版.id文件（需要列目录，浏览场景应关闭）
        """
        if not directory:
            return None
        norm = self._normalize_path(directory)
        cached = self._manual_matches.get(norm)
        if cached:
            return self._clone_manual_match(cached)
        if norm in self._manual_match_misses:
            return None
        if not os.path.isdir(directory):
            return None

        manual_path = self._manual_json_path(directory)
        if os.path.exists(manual_path):
            try:
                with open(manual_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self._update_manual_match_cache(directory, data)
                return self._clone_manual_match(self._manual_matches.get(norm))
            except Exception as e:
                logger.warning(f"读取手动匹配文件失败: {e}")

        if check_legacy:
            legacy = self._convert_legacy_id_file(directory)
            if legacy:
                self._update_manual_match_cache(directory, legacy)
                return self._clone_manual_match(self._manual_matches.get(norm))

        self._manual_match_misses.add(norm)
        return None

    def _get_manual_file_match(self, file_path: str) -> Optional[Dict[str, Any]]:
        """获取单个文件的手动匹配信息（仅从缓存读取，不检查旧版 .id 文件）。"""
        norm = self._normalize_path(file_path)
        if not norm:
            return None
        cached = self._manual_file_matches.get(norm)
        if cached:
            return self._clone_manual_match(cached)
        return None

    def _resolve_manual_directory(self, file_path: Optional[str] = None, directory_path: Optional[str] = None) -> Optional[str]:
        """解析手动匹配目录：优先使用 directory_path，否则从 file_path 提取父目录并规范化路径。"""
        if directory_path:
            return self._normalize_path(directory_path)
        if file_path:
            return self._normalize_path(os.path.dirname(file_path))
        return None
    
    def _is_supported_file(self, file_path: str) -> bool:
        """检查文件是否支持处理"""
        if file_path.endswith(('.mp4', '.mkv')):
            return True
        elif file_path.endswith('.strm'):
            return self._enable_strm
        return False
    
    def init_plugin(self, config: dict = None):
        """初始化插件：读取配置参数、注册重试/搜索/手动匹配/过滤等 API，
        加载持久化状态（手动匹配缓存、过滤词库配置、用户信用/封禁状态），
        并根据 enabled 字段决定是否启用弹幕刮削和过滤功能。"""
        if config:
            self._enabled = self._get_enabled_from_config(config)
            self._max_threads = config.get("max_threads", 10)
            self._worker_count = config.get("worker_count", 2)
            self._width = config.get("width", 1920)
            self._height = config.get("height", 1080)
            # self._fontface = config.get("fontface")
            self._fontsize = config.get("fontsize", 50)
            self._alpha = config.get("alpha", 0.8)
            self._duration = config.get("duration", 15)
            self._path = config.get("path", "")
            self._onlyFromBili = config.get("onlyFromBili", False)
            self._useTmdbID = config.get("useTmdbID", True)
            self._auto_scrape = config.get("auto_scrape", False)
            self._chConvert = config.get("chConvert", 0)
            self._enable_retry_task = config.get("enable_retry_task", True)
            self._screen_area = config.get("screen_area", "full")
            self._enable_strm = config.get("enable_strm", True)
            # 弹幕内容过滤配置
            self._filter_enabled = config.get("filter_enabled", True)
            self._filter_blocked_modes = config.get("filter_blocked_modes", [])
            self._filter_similarity_threshold = config.get("filter_similarity_threshold", 0.8)
            # 相似弹幕过滤由开关控制（默认开启，可在配置中关闭）
            self._filter_similarity_enabled = config.get("filter_similarity_enabled", True)
            self._filter_freq_window = config.get("filter_freq_window", 30.0)
            self._filter_freq_max = config.get("filter_freq_max", 10)
            self._filter_screen_max = config.get("filter_screen_max", 15)
            self._filter_screen_window = config.get("filter_screen_window", 5.0)
            self._filter_screen_top_ratio = config.get("filter_screen_top_ratio", 0.25)
            self._filter_screen_bottom_ratio = config.get("filter_screen_bottom_ratio", 0.10)
            self._filter_screen_scroll_ratio = config.get("filter_screen_scroll_ratio", 0.65)
            # 加载重试任务列表
            retry_tasks_str = config.get("retry_tasks", "{}")
            try:
                loaded_tasks = json.loads(retry_tasks_str)
                # 将字符串日期转换为datetime对象，并添加缺失字段的默认值
                parsed_tasks = {}
                for file_path, task_info in loaded_tasks.items():
                    try:
                        parsed_tasks[file_path] = {
                            "retry_count": task_info.get("retry_count", 1),
                            "last_attempt": datetime.fromisoformat(task_info.get("last_attempt", datetime.now().isoformat())),
                            "file_path": task_info.get("file_path", file_path),
                            "last_danmu_count": task_info.get("last_danmu_count", 0)
                        }
                    except (ValueError, TypeError) as e:
                        logger.warning(f"跳过无效的重试任务 {file_path}: {e}")
                        continue
                with self._retry_lock:
                    self._retry_tasks = parsed_tasks
                logger.info(f"加载了 {len(parsed_tasks)} 个重试任务")
            except (json.JSONDecodeError, ValueError, TypeError) as e:
                logger.warning(f"加载重试任务失败，使用空列表: {e}")
                with self._retry_lock:
                    self._retry_tasks = {}
        # 加载手动匹配缓存
        self._load_manual_matches()
        # 加载已保存的过滤词库配置（用户自定义分类/正则/组合规则/启用状态，重启不丢）
        self._load_filter_config()
        # 注入持久化恢复的过滤用户状态（信用分/封禁）；下次 DanmakuFilter 初始化时自动加载
        self._inject_restored_filter_user_state()
        # 注入持久化恢复的累计统计（跨实例/跨重启累计，避免单实例覆盖）
        self._inject_restored_cumulative_stats()
        # 初始化后台任务管理器（受控 worker 队列 + 任务状态持久化，重启不归零）
        if not hasattr(self, "_task_manager"):
            self._task_manager = DanmuTaskManager(
                log=logger,
                save_data=self.save_data,
                get_data=self.get_data,
                process_one=self._task_process,
                compute_config_hash=self._compute_config_hash,
                default_worker_count=self._worker_count,
            )
        else:
            self._task_manager._default_worker_count = max(1, int(self._worker_count))
        if self._enabled:
            logger.info("弹幕加载插件已启用")

    def get_state(self) -> bool:
        """返回插件启用状态，供 MoviePilot 框架检查。"""
        return self._enabled
    
    def get_service(self) -> List[Dict[str, Any]]:
        """
        注册插件公共服务
        [{
            "id": "服务ID",
            "name": "服务名称",
            "trigger": "触发器：cron/interval/date/CronTrigger.from_crontab()",
            "func": self.xxx,
            "kwargs": {} # 定时器参数
        }]
        """
        if self._enabled and self._enable_retry_task:
            return [{
                "id": "DanmuCustomRetryTask",
                "name": "弹幕重试任务",
                "trigger": "cron",
                "func": self.auto_process_retry_tasks,
                "kwargs": {
                    "minute": 0,
                    "hour": "*/3",  # 每3小时执行一次
                    "day": "*",
                    "month": "*",
                    "day_of_week": "*"
                }
            }]
        return []
        
    @staticmethod
    def get_command() -> List[Dict[str, Any]]:
        """返回插件命令列表。"""
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        """
        获取插件API
        [{
            "path": "/xx",
            "endpoint": self.xxx,
            "methods": ["GET", "POST"],
            "summary": "API说明"
        }]
        """
        logger.info("获取插件API")
        return [{
            "path": "/generate_danmu_with_path",
            "endpoint": self.generate_danmu_global,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "刮削弹幕",
            "description": "根据设定的路径刮削弹幕" 
        },{
            "path": "/update_path",
            "endpoint": self.update_path,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "更新路径",
            "description": "更新刮削路径"
        },
        {
            "path": "/config",
            "endpoint": self._get_config,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取配置",
            "description": "获取插件配置"
        },
        {
            "path": "/config",
            "endpoint": self._save_config,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "保存配置",
            "description": "保存插件配置"
        },
        {
            "path": "/status",
            "endpoint": self._get_status,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取状态",
            "description": "获取当前刮削状态"
        },
        {
            "path": "/scan_path",
            "endpoint": self.scan_path,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "扫描路径",
            "description": "扫描路径下的媒体文件和弹幕信息，支持current_dir参数进行点击式导航"
        },
        {
            "path": "/scan_subfolder",
            "endpoint": self.scan_subfolder,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "扫描子文件夹",
            "description": "扫描指定子文件夹的内容"
        },
        {
            "path": "/generate_danmu",
            "endpoint": self.generate_danmu_single,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "生成单个文件弹幕",
            "description": "为指定文件生成弹幕"
        },
        {
            "path": "/scrape_directory",
            "endpoint": self.scrape_directory,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "刮削整个目录",
            "description": "后台批量刮削指定目录下所有媒体文件，需要directory_path参数"
        },
        {
            "path": "/batch_season_scrape",
            "endpoint": self.batch_season_scrape,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "批量分季刮削",
            "description": "扫描子文件夹，每个子文件夹独立匹配弹幕并分别下载，需要directory_path参数"
        },
        {
            "path": "/retry_tasks",
            "endpoint": self.get_retry_tasks,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取重试任务列表",
            "description": "获取当前待重试的弹幕文件列表"
        },
        {
            "path": "/process_retry_tasks",
            "endpoint": self.process_retry_tasks,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "处理重试任务",
            "description": "对重试任务列表中的文件进行弹幕刮削"
        },
        {
            "path": "/clear_retry_tasks",
            "endpoint": self.clear_retry_tasks,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "清空重试任务",
            "description": "清空所有重试任务"
        },
        {
            "path": "/remove_retry_task",
            "endpoint": self.remove_retry_task,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "移除重试任务",
            "description": "移除指定的重试任务，需要file_path参数"
        },
        {
            "path": "/search_anime",
            "endpoint": self.search_anime,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "搜索弹弹番剧",
            "description": "根据关键字搜索手动匹配候选"
        },
        {
            "path": "/manual_match",
            "endpoint": self.set_manual_match,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "保存手动匹配",
            "description": "为目录保存手动匹配的弹弹作品"
        },
        {
            "path": "/remove_manual_match",
            "endpoint": self.remove_manual_match,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "移除手动匹配",
            "description": "移除指定目录的手动匹配"
        },
        {
            "path": "/tmdb_match",
            "endpoint": self.tmdb_match_file,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "TMDB匹配文件",
            "description": "根据文件名通过TMDB搜索弹弹Play，需要file_path参数"
        },
        # ===== 弹幕过滤系统 API =====
        {
            "path": "/filter/categories",
            "endpoint": self.filter_get_categories,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取过滤分类",
            "description": "获取所有屏蔽分类及其状态"
        },
        {
            "path": "/filter/keywords/add",
            "endpoint": self.filter_add_keyword,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "添加关键词",
            "description": "向指定分类添加屏蔽关键词"
        },
        {
            "path": "/filter/keywords/remove",
            "endpoint": self.filter_remove_keyword,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "移除关键词",
            "description": "从指定分类移除关键词"
        },
        {
            "path": "/filter/keywords/query",
            "endpoint": self.filter_query_keywords,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "查询关键词",
            "description": "查询关键词在哪些分类中"
        },
        {
            "path": "/filter/category/enable",
            "endpoint": self.filter_set_category,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "启用/禁用分类",
            "description": "启用或禁用某个过滤分类"
        },
        {
            "path": "/filter/category/add",
            "endpoint": self.filter_add_category,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "添加自定义分类",
            "description": "添加用户自定义过滤分类"
        },
        {
            "path": "/filter/category/remove",
            "endpoint": self.filter_remove_category,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "移除自定义分类",
            "description": "移除用户自定义过滤分类"
        },
        {
            "path": "/filter/regex/add",
            "endpoint": self.filter_add_regex,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "添加正则规则",
            "description": "向指定分类添加屏蔽正则规则"
        },
        {
            "path": "/filter/regex/remove",
            "endpoint": self.filter_remove_regex,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "移除正则规则",
            "description": "从指定分类移除正则规则"
        },
        {
            "path": "/filter/combo/add",
            "endpoint": self.filter_add_combo,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "添加组合规则",
            "description": "向指定分类添加组合规则（关键词 + 长度限制）"
        },
        {
            "path": "/filter/combo/remove",
            "endpoint": self.filter_remove_combo,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "移除组合规则",
            "description": "从指定分类移除组合规则"
        },
        {
            "path": "/filter/blocked_users",
            "endpoint": self.filter_get_blocked_users,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取屏蔽用户列表",
            "description": "获取被屏蔽的用户及信用分详情"
        },
        {
            "path": "/filter/warned_users",
            "endpoint": self.filter_get_warned_users,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取警告用户列表",
            "description": "获取处于警告状态的用户"
        },
        {
            "path": "/filter/users/unblock",
            "endpoint": self.filter_unblock_user,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "解除用户封禁",
            "description": "解除指定用户的封禁状态，恢复信用分"
        },
        {
            "path": "/filter/users/reset",
            "endpoint": self.filter_reset_user,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "重置用户信用分",
            "description": "重置指定用户的信用分数"
        },
        {
            "path": "/filter/stats",
            "endpoint": self.filter_get_stats,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取过滤统计",
            "description": "获取弹幕过滤系统的统计数据（含跨实例累计统计）"
        },
        {
            "path": "/filter/reset_stats",
            "endpoint": self.filter_reset_stats,
            "methods": ["POST"],
            "auth": "bear",
            "summary": "重置累计过滤统计",
            "description": "清空跨实例累计统计数字（不影响已封禁/警告的用户状态）"
        },
        {
            "path": "/history",
            "endpoint": self.get_scrape_history,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "获取刮削历史",
            "description": "从持久化 file_status 读取刮削历史（分页 ?page=1&page_size=50，可加 &status=success 过滤）"
        },
        # ===== 后台任务控制 API（受控 worker 队列 + 持久化）=====
        {
            "path": "/task/status",
            "endpoint": self.task_status,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "后台任务状态",
            "description": "获取后台刮削任务的持久化状态（含各状态计数，重启不归零）"
        },
        {
            "path": "/task/pause",
            "endpoint": self.task_pause,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "暂停任务",
            "description": "暂停后台刮削（已入队任务暂缓处理）"
        },
        {
            "path": "/task/resume",
            "endpoint": self.task_resume,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "继续任务",
            "description": "继续后台刮削"
        },
        {
            "path": "/task/cancel",
            "endpoint": self.task_cancel,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "取消任务",
            "description": "取消后台刮削，未完成标记为 interrupted"
        },
        {
            "path": "/task/clear",
            "endpoint": self.task_clear,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "清空记录",
            "description": "清空所有任务记录与历史"
        },
        {
            "path": "/task/continue",
            "endpoint": self.task_continue,
            "methods": ["GET"],
            "auth": "bear",
            "summary": "继续未完成",
            "description": "把未完成任务（pending/interrupted/失败）重新入队并启动"
        },
        ]
     
    # 插件配置页面
    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        """返回插件配置表单与默认配置。Vue 模式下表单由 Config 组件渲染。"""
        return None, self._get_config()
    
    def _get_config(self) -> Dict[str, Any]:
        """获取配置"""
        return {
            "enabled": self._enabled,
            "max_threads": self._max_threads,
            "worker_count": self._worker_count,
            "width": self._width,
            "height": self._height,
            "fontsize": self._fontsize,
            "alpha": self._alpha,
            "duration": self._duration,
            "path": self._path,
            "onlyFromBili": self._onlyFromBili,
            "useTmdbID": self._useTmdbID,
            "auto_scrape": self._auto_scrape,
            "chConvert": self._chConvert,
            "enable_retry_task": self._enable_retry_task,
            "screen_area": self._screen_area,
            "enable_strm": self._enable_strm,
            # 弹幕内容过滤配置
            "filter_enabled": self._filter_enabled,
            "filter_blocked_modes": self._filter_blocked_modes,
            "filter_similarity_threshold": self._filter_similarity_threshold,
            "filter_similarity_enabled": self._filter_similarity_enabled,
            "filter_freq_window": self._filter_freq_window,
            "filter_freq_max": self._filter_freq_max,
            "filter_screen_max": self._filter_screen_max,
            "filter_screen_window": self._filter_screen_window,
            "filter_screen_top_ratio": self._filter_screen_top_ratio,
            "filter_screen_bottom_ratio": self._filter_screen_bottom_ratio,
            "filter_screen_scroll_ratio": self._filter_screen_scroll_ratio,
        }
        
    def _save_config(self, config: dict) -> schemas.Response:
        """保存配置"""
        try:
            self._enabled = self._get_enabled_from_config(config)
            self._max_threads = config.get("max_threads", 10)
            self._worker_count = config.get("worker_count", 2)
            self._width = config.get("width", 1920)
            self._height = config.get("height", 1080)
            self._fontsize = config.get("fontsize", 50)
            self._alpha = config.get("alpha", 0.8)
            self._duration = config.get("duration", 15)
            self._path = config.get("path", "")
            self._onlyFromBili = config.get("onlyFromBili", False)
            self._useTmdbID = config.get("useTmdbID", True)
            self._auto_scrape = config.get("auto_scrape", False)
            self._chConvert = config.get("chConvert", 0)
            self._enable_retry_task = config.get("enable_retry_task", True)
            self._screen_area = config.get("screen_area", "full")
            self._enable_strm = config.get("enable_strm", True)
            # 弹幕内容过滤配置
            self._filter_enabled = config.get("filter_enabled", True)
            self._filter_blocked_modes = config.get("filter_blocked_modes", [])
            self._filter_similarity_threshold = config.get("filter_similarity_threshold", 0.8)
            # 相似弹幕过滤由开关控制（默认开启，可在配置中关闭）
            self._filter_similarity_enabled = config.get("filter_similarity_enabled", True)
            self._filter_freq_window = config.get("filter_freq_window", 30.0)
            self._filter_freq_max = config.get("filter_freq_max", 10)
            self._filter_screen_max = config.get("filter_screen_max", 15)
            self._filter_screen_window = config.get("filter_screen_window", 5.0)
            self._filter_screen_top_ratio = config.get("filter_screen_top_ratio", 0.25)
            self._filter_screen_bottom_ratio = config.get("filter_screen_bottom_ratio", 0.10)
            self._filter_screen_scroll_ratio = config.get("filter_screen_scroll_ratio", 0.65)
            
            # 准备重试任务数据
            retry_tasks_for_save = {}
            with self._retry_lock:
                for file_path, task_info in self._retry_tasks.items():
                    retry_tasks_for_save[file_path] = {
                        "retry_count": task_info["retry_count"],
                        "last_attempt": task_info["last_attempt"].isoformat(),
                        "file_path": task_info["file_path"],
                        "last_danmu_count": task_info.get("last_danmu_count", 0)
                    }
            
            # 保存到系统配置
            save_config = {
                "enabled": self._enabled,
                "max_threads": self._max_threads,
                "width": self._width,
                "height": self._height,
                "fontsize": self._fontsize,
                "alpha": self._alpha,
                "duration": self._duration,
                "path": self._path,
                "onlyFromBili": self._onlyFromBili,
                "useTmdbID": self._useTmdbID,
                "auto_scrape": self._auto_scrape,
                "enable_retry_task": self._enable_retry_task,
                "screen_area": self._screen_area,
                "enable_strm": self._enable_strm,
                "filter_enabled": self._filter_enabled,
                "filter_blocked_modes": self._filter_blocked_modes,
                "filter_similarity_threshold": self._filter_similarity_threshold,
                "filter_similarity_enabled": self._filter_similarity_enabled,
                "filter_freq_window": self._filter_freq_window,
                "filter_freq_max": self._filter_freq_max,
                "filter_screen_max": self._filter_screen_max,
                "filter_screen_window": self._filter_screen_window,
                "filter_screen_top_ratio": self._filter_screen_top_ratio,
                "filter_screen_bottom_ratio": self._filter_screen_bottom_ratio,
                "filter_screen_scroll_ratio": self._filter_screen_scroll_ratio,
                "retry_tasks": json.dumps(retry_tasks_for_save)
            }
            self.update_config(save_config)
            # 重新初始化以确保运行状态与保存的配置一致
            self.init_plugin(save_config)
            
            return schemas.Response(success=True, message="配置已保存")
        except Exception as e:
            logger.exception(f"保存配置失败: {e}")
            return schemas.Response(success=False, message=f"保存配置失败: {str(e)}")
    
    # V2 Vue 模式下页面入口由 get_render_mode + get_sidebar_nav 驱动，
    # 不再实现 V1 的 get_page（返回 component 列表），否则会与
    # get_sidebar_nav 重复注册侧栏入口，导致"弹幕刮削/弹幕过滤"出现两次。
    # 侧栏 nav_key(scrape/filter) 由 AppPage.vue 按 navKey 切到
    # AppPageScrape / AppPageFilter。
    def get_page(self) -> List[dict]:
        """Vue mode doesn't use Vuetify page definitions."""
        return None

    # --- V2 Vue Interface Methods ---
    @staticmethod
    def get_render_mode() -> Tuple[str, Optional[str]]:
        """Declare Vue rendering mode and assets path."""
        return "vue", "dist/assets"
    
    def get_sidebar_nav(self) -> List[Dict[str, Any]]:
        """
        侧栏导航入口
        仅在 Vue 模式下生效，提供插件主界面和过滤管理的侧栏入口
        """
        if not self.get_state():
            return []

        return [
            {
                "nav_key": "scrape",
                "title": "弹幕刮削",
                "icon": "mdi-movie-open-star",
                "section": "organize",
                "permission": "manage",
                "order": 10,
            },
            {
                "nav_key": "filter",
                "title": "弹幕过滤",
                "icon": "mdi-filter-variant",
                "section": "organize",
                "permission": "manage",
                "order": 11,
            },
        ]
    
    def get_dashboard(self, key: str = None, **kwargs) -> Optional[Tuple[Dict, Dict, List]]:
        """
        仪表板数据
        提供弹幕刮削概览卡片
        """
        col_config = {"cols": 12, "md": 6}
        global_config = {"title": "弹幕刮削", "refresh": 30, "border": True}
        status = self._get_status()
        page = [
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "sm": 6, "md": 3},
                        "content": [{
                            "component": "VCard",
                            "props": {"variant": "tonal", "color": "primary"},
                            "content": [
                                {
                                    "component": "VCardItem",
                                    "content": [
                                        {
                                            "component": "VCardTitle",
                                            "props": {"text": "刮削状态"},
                                        },
                                        {
                                            "component": "VCardSubtitle",
                                            "props": {"text": "运行中" if status.get("running") else "空闲"},
                                        },
                                    ],
                                },
                            ],
                        }],
                    },
                ],
            },
        ]
        return col_config, global_config, page
    
    def _get_status(self) -> Dict[str, Any]:
        """获取当前状态（来自持久化的后台任务管理器，Docker 重启不归零）。"""
        try:
            status = self._task_manager.get_status()
        except Exception:
            status = {"state": {"status": "idle", "counts": {}}}
        state = status.get("state", {})
        counts = state.get("counts", {})
        running = state.get("status") in ("running", "paused")
        return {
            "enabled": self._enabled,
            "running": running,
            "status": state.get("status"),
            "total": state.get("total", 0),
            "processed": state.get("processed", 0),
            "success": counts.get("success", 0),
            "skipped": counts.get("skipped", 0),
            "failed": counts.get("failed", 0),
            "interrupted": counts.get("interrupted", 0),
            "pending": counts.get("pending", 0),
            "current_file": (state.get("current_files") or [None])[0],
        }

    def generate_danmu(
        self, file_path: str, pre_matched_comment_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        生成弹幕文件（同一文件同时只允许一个刮削，防止并发写坏弹幕文件）
        :param pre_matched_comment_id: 预批量匹配结果，由 _populate_pre_match_cache 注入，命中后跳过单文件 match
        :param file_path: 视频文件路径
        :return: dict {"result": ..., "counts": {"received","blocked","actual"}}，失败返回 dict with result 为错误信息
        """
        norm = self._normalize_path(file_path) or file_path
        with self._inflight_lock:
            if norm in self._inflight_files:
                logger.info(f"文件正在刮削中，跳过重复请求: {file_path}")
                return {"result": "文件正在刮削中，跳过重复请求", "counts": {"received": 0, "blocked": 0, "actual": 0}}
            self._inflight_files.add(norm)
        try:
            return self._generate_danmu_impl(file_path, pre_matched_comment_id)
        finally:
            with self._inflight_lock:
                self._inflight_files.discard(norm)

    def _generate_danmu_impl(
        self, file_path: str, pre_matched_comment_id: Optional[str] = None
    ) -> Optional[Dict]:
        """弹幕生成核心实现：解析元数据、匹配番剧、调用 DanmuAPI 刮削弹幕、转换并写入文件。
        返回 dict {"result": str_or_none, "counts": {"received","blocked","actual"}}。"""
        meta = MetaInfo(file_path)
        tmdb_id = None
        episode = None
        tmdb_id_type = 0
        release_date = None
        use_short_cache_ttl = False
        if self._useTmdbID:
            media_info = self.media_chain.recognize_media(meta=meta)
            if media_info:
                tmdb_id = media_info.tmdb_id
                # Matches dandanplay upstream tmdbIdType: 0 = TV series, 1 = movie
                if media_info.type == MediaType.MOVIE:
                    tmdb_id_type = 1
                    logger.info(f"识别为电影，使用电影类型TMDB匹配: {tmdb_id}")
                if meta.episode:
                    try:
                        episode = meta.episode.split('E')[-1]
                    except Exception:
                        episode = None
                release_date = media_info.release_date
                if release_date:
                    try:
                        release_datetime = datetime.strptime(release_date, '%Y-%m-%d')
                        is_recent = (datetime.now() - release_datetime).days < 90
                        if is_recent:
                            logger.info(f"媒体 {tmdb_id} 是最近90天内发布的内容,使用短缓存")
                            use_short_cache_ttl = True
                    except ValueError:
                        logger.warning(f"无效的发布日期格式: {release_date},使用默认缓存时间")
    
        manual_comment_id = None
        manual_file_match = self._get_manual_file_match(file_path)
        if manual_file_match:
            manual_episode = generator.DanmuAPI._apply_episode_offset(
                episode, manual_file_match.get("episodeOffset")
            )
            manual_comment_id = generator.DanmuAPI._compose_comment_id(
                manual_file_match.get("animeId"),
                manual_episode
            )
            if manual_comment_id:
                logger.info(f"使用单文件手动匹配ID: {manual_comment_id}")
            else:
                logger.warning(f"单文件手动匹配生成弹幕ID失败: {manual_file_match}")

        # 构建过滤配置
        filter_config = None
        if self._filter_enabled:
            filter_config = {
                "enabled_categories": None,  # 启用所有关键词分类
                "blocked_modes": self._filter_blocked_modes,
                "similarity_threshold": self._filter_similarity_threshold,
                "similarity_enabled": self._filter_similarity_enabled,
                "freq_window_seconds": self._filter_freq_window,
                "freq_max_count": self._filter_freq_max,
                "screen_window_seconds": self._filter_screen_window,
                "screen_max_per_window": self._filter_screen_max,
                "screen_top_reserve_ratio": self._filter_screen_top_ratio,
                "screen_bottom_reserve_ratio": self._filter_screen_bottom_ratio,
                "screen_scroll_reserve_ratio": self._filter_screen_scroll_ratio,
            }

        try:
            result_dict = generator.danmu_generator(
                file_path,
                self._width,
                self._height,
                'Arial',
                self._fontsize,
                self._alpha,
                self._duration,
                self._onlyFromBili,
                self._useTmdbID,
                tmdb_id,
                episode,
                60 if use_short_cache_ttl else None,
                self._screen_area,
                manual_comment_id=manual_comment_id,
                tmdb_id_type=tmdb_id_type,
                filter_config=filter_config,
                ch_convert=self._chConvert,
                pre_matched_comment_id=pre_matched_comment_id,
            )
            
            # 提取结果和统计
            if isinstance(result_dict, dict):
                result = result_dict.get("result")
                danmu_counts = {
                    "received": result_dict.get("received", 0),
                    "blocked": result_dict.get("blocked", 0),
                    "actual": result_dict.get("actual", 0),
                }
            else:
                result = result_dict
                danmu_counts = {"received": 0, "blocked": 0, "actual": 0}
            
            # 检查弹幕生成结果
            ass_file = f"{os.path.splitext(file_path)[0]}.danmu.ass"
            danmu_count = 0
            
            # 如果返回字符串且包含弹幕数量为0，说明是失败原因
            if isinstance(result, str) and result.startswith('弹幕数量为0'):
                logger.info(result)
                self._add_to_retry_if_needed(file_path, 0)
                return {"result": result, "counts": danmu_counts}
            
            # 检查生成的弹幕文件
            if os.path.exists(ass_file):
                danmu_count = self._count_danmu_lines_cached(ass_file)
                logger.info(f"弹幕生成完成，弹幕数量: {danmu_count}")
                
                # 检查弹幕数量是否满足要求
                if self._enable_retry_task and danmu_count < self._min_danmu_count:
                    logger.warning(f"弹幕数量 ({danmu_count}) 少于最小要求 ({self._min_danmu_count})，添加到重试任务")
                    self._add_to_retry_if_needed(file_path, danmu_count)
                else:
                    # 弹幕数量满足要求，如果之前在重试列表中则移除
                    with self._retry_lock:
                        removed = self._retry_tasks.pop(file_path, None)
                    if removed:
                        logger.info(f"弹幕数量满足要求，从重试任务中移除: {file_path}")
                        self._save_retry_tasks()
            else:
                logger.warning(f"弹幕文件不存在: {ass_file}")
                # 没有生成弹幕文件，添加到重试任务
                self._add_to_retry_if_needed(file_path, 0)

            # 持久化过滤用户状态（信用分/封禁/违规统计）
            if self._filter_enabled:
                self._save_filter_user_state()
                
            return {"result": result, "counts": danmu_counts}
        except Exception as e:
            logger.exception(f"生成弹幕失败: {e}")
            # 生成失败，添加到重试任务
            self._add_to_retry_if_needed(file_path, 0)
            # 即使失败也持久化过滤状态（可能已有部分过滤数据）
            if self._filter_enabled:
                self._save_filter_user_state()
            return {"result": f"生成弹幕失败: {str(e)}", "counts": {"received": 0, "blocked": 0, "actual": 0}}

    def _add_to_retry_if_needed(self, file_path: str, danmu_count: int):
        """
        根据弹幕数量判断是否需要添加到重试任务
        :param file_path: 文件路径
        :param danmu_count: 弹幕数量
        """
        if not self._enable_retry_task:
            return

        with self._retry_lock:
            # 检查文件是否已在重试列表中
            if file_path in self._retry_tasks:
                # 更新重试次数和最后尝试时间
                self._retry_tasks[file_path]["retry_count"] += 1
                self._retry_tasks[file_path]["last_attempt"] = datetime.now()

                # 检查是否达到最大重试次数
                if self._retry_tasks[file_path]["retry_count"] >= self._max_retry_times:
                    logger.warning(f"文件 {file_path} 达到最大重试次数 ({self._max_retry_times})，从重试列表中移除")
                    del self._retry_tasks[file_path]
                else:
                    logger.info(f"更新重试任务: {file_path}，重试次数: {self._retry_tasks[file_path]['retry_count']}")
            else:
                # 添加新的重试任务
                if danmu_count < self._min_danmu_count:
                    self._retry_tasks[file_path] = {
                        "retry_count": 1,
                        "last_attempt": datetime.now(),
                        "file_path": file_path,
                        "last_danmu_count": danmu_count
                    }
                    logger.info(f"添加新的重试任务: {file_path}，当前弹幕数量: {danmu_count}")

        # 保存重试任务到配置
        self._save_retry_tasks()

    def _save_retry_tasks(self):
        """
        保存重试任务列表到配置（批量刮削期间只标记待保存，结束时统一落盘一次）
        """
        try:
            with self._retry_lock:
                if self._retry_save_deferred:
                    self._retry_save_pending = True
                    return
                # 将datetime对象转换为字符串以便JSON序列化
                retry_tasks_for_save = {}
                for file_path, task_info in self._retry_tasks.items():
                    retry_tasks_for_save[file_path] = {
                        "retry_count": task_info["retry_count"],
                        "last_attempt": task_info["last_attempt"].isoformat(),
                        "file_path": task_info["file_path"],
                        "last_danmu_count": task_info.get("last_danmu_count", 0)
                    }

            # 获取当前配置
            current_config = self._get_config()
            current_config["retry_tasks"] = json.dumps(retry_tasks_for_save)

            # 更新配置
            self.update_config(current_config)
            logger.debug("重试任务列表已保存到配置")
        except Exception as e:
            logger.exception(f"保存重试任务失败: {e}")

    def update_path(self, path: str):
        """
        更新路径
        """
        self._path = path
        logger.info(f"更新路径: {self._path}")
        
    def _collect_media_files(self, path: str) -> List[str]:
        """
        收集路径下所有支持的媒体文件（目录则递归）
        """
        collected = []
        if os.path.isfile(path):
            if self._is_supported_file(path):
                collected.append(path)
            return collected
        for root, _, files in os.walk(path):
            for file in files:
                file_path = os.path.join(root, file)
                if self._is_supported_file(file_path):
                    collected.append(file_path)
        return collected

    def _get_ass_output_path(self, media_path: str) -> str:
        """获取媒体文件对应的 .danmu.ass 输出路径。"""
        dir_name = os.path.dirname(media_path)
        base_name = os.path.splitext(os.path.basename(media_path))[0]
        return os.path.join(dir_name, f"{base_name}.danmu.ass")

    def _count_scraped_in_path(self, path: str) -> Tuple[int, int]:
        """统计目录下媒体文件总数和已刮削（有 .danmu.ass）的文件数。
        返回 (total_media, scraped_count)。
        """
        all_files = self._collect_media_files(path)
        total = len(all_files)
        if total == 0:
            return 0, 0
        current_hash = self._compute_config_hash()
        scraped = 0
        for f in all_files:
            out_path = self._get_ass_output_path(f)
            if os.path.exists(out_path):
                # 检查 config_hash 是否匹配，避免配置变更导致误判
                existing_hash = self._task_manager.get_config_hash_for_file(f)
                if existing_hash and existing_hash == current_hash:
                    scraped += 1
                elif not existing_hash and os.path.getsize(out_path) > 0:
                    # 无哈希记录但文件存在且有内容，也视为已刮削
                    scraped += 1
        return total, scraped

    def _start_scrape_batch(self, files: List[str], label: str) -> Dict:
        """把批量刮削提交到后台受控 worker 队列（不在 API 请求线程里执行大批量）。

        v3.4.0: 在入队前先用 /match/batch 预匹配，把 comment_id 缓存到 _pre_matched_cache，
        worker 处理时直接消费缓存，避免每文件都走单文件 match（百文件批量时请求数从 100 → 4）。

        返回 dict {
            "queued": int, "skipped_existing": int,
            "pre_match": {"total": int, "matched": int, "elapsed": float, "source": str},
            "started": bool, "label": str,
        }
        """
        if not files:
            logger.warning(f"没有需要刮削的文件（{label}）")
            return {"queued": 0, "skipped_existing": 0, "pre_match": {
                "total": 0, "matched": 0, "elapsed": 0.0, "source": "",
            }, "started": False, "label": label}
        # 1) 预批量匹配：仅对 .strm 之外、无手动映射、且未走 TMDB 路径的文件
        self._pre_matched_cache.clear()
        pm_total = 0
        pm_matched = 0
        pm_elapsed = 0.0
        pm_source = ""
        try:
            t0 = time.time()
            self._populate_pre_match_cache(files)
            pm_elapsed = round(time.time() - t0, 2)
            pm_matched = len(self._pre_matched_cache)
            # 从最后一次 _match_batch_with_fallback 调用中无法直接读 source，记录到上下文
            pm_source = getattr(self, "_last_pre_match_source", "")
        except Exception as e:
            logger.warning(f"[预匹配] 异常（非阻塞）: {e}")
        # 2) 批量期间延迟写库，结束统一落盘一次（避免每文件 update_config 拖慢 MP）
        self._retry_save_deferred = True
        # 3) 扫描时若 .danmu.ass 已存在且 config_hash 未变，默认跳过避免重复跑
        queued, skipped = self._task_manager.enqueue(files, skip_existing=True)
        started = self._task_manager.start(self._worker_count, on_finish=self._on_batch_finish)
        # 计算 pm_total: 预匹配时跳过了 .strm + 手动映射，这里给出"理论上能预匹配的文件数"
        pm_total = self._last_pre_match_total if hasattr(self, "_last_pre_match_total") else 0
        logger.info(
            f"已提交批量刮削（{label}）：入队 {queued} 个，跳过 {skipped} 个已存在产物"
            + (f"，预匹配命中 {pm_matched}/{pm_total} 个（{pm_elapsed}s, 来源={pm_source}）"
               if pm_total > 0 else "")
            + ("" if started else "（worker 已在运行）")
        )
        return {
            "queued": queued,
            "skipped_existing": skipped,
            "pre_match": {
                "total": pm_total,
                "matched": pm_matched,
                "elapsed": pm_elapsed,
                "source": pm_source,
            },
            "started": started,
            "label": label,
        }

    def _populate_pre_match_cache(self, files: List[str]) -> None:
        """用 /match/batch 批量预匹配需要单文件 match 的视频，结果写入 _pre_matched_cache。
        跳过：.strm 文件（走 TMDB 路径）、有手动映射的目录。
        """
        to_match: List[Tuple[str, generator.VideoInfo]] = []
        for fp in files:
            try:
                # 跳过 .strm
                if StrmProcessor.is_strm_file(fp):
                    continue
                # 跳过有手动映射的目录
                video_dir = os.path.dirname(fp)
                manual_mapping = generator.DanmuAPI._load_manual_mapping(video_dir)
                if manual_mapping:
                    continue
                # 构建 VideoInfo（吃单文件 match 同样的 4 个字段）
                file_size = generator.DanmuAPI.get_file_size(fp)
                file_hash = generator.DanmuAPI.calculate_md5_of_first_16MB(fp)
                video_duration = int(generator.DanmuAPI.get_video_duration(fp) or 0)
                vi = generator.VideoInfo(
                    file_name=os.path.basename(fp),
                    file_hash=file_hash,
                    file_size=file_size,
                    video_duration=video_duration,
                    match_mode="hashAndFileName",
                )
                to_match.append((fp, vi))
            except Exception as e:
                logger.debug(f"[预匹配] 构造 VideoInfo 失败 {fp}: {e}")
                continue
        # 记录"可参与预匹配"的文件数到实例属性，供 _start_scrape_batch 上报
        self._last_pre_match_total = len(to_match)
        if not to_match:
            self._last_pre_match_source = ""
            return
        # 分批每 32 个一次
        BATCH = 32
        matched = 0
        source = ""
        for i in range(0, len(to_match), BATCH):
            chunk_paths = [p for p, _ in to_match[i:i + BATCH]]
            chunk_vis = [v for _, v in to_match[i:i + BATCH]]
            results, src = generator.DanmuAPI._match_batch_with_fallback(chunk_vis)
            source = src or source
            if results is None:
                logger.warning(
                    f"[预匹配] 本批 {len(chunk_vis)} 个匹配失败，后续单文件时再回退"
                )
                continue
            for fp, res in zip(chunk_paths, results):
                if res and res.get("isMatched") and res.get("matches"):
                    cid = str(res["matches"][0]["episodeId"])
                    self._pre_matched_cache[fp] = cid
                    matched += 1
        self._last_pre_match_source = source
        logger.info(
            f"[预匹配] 完成 {matched}/{len(to_match)} 个（来源={source}），"
            f"加速约 {matched/32:.1f} 倍"
        )

    # ------------------------------------------------------------------
    # 后台任务处理回调与配置指纹（供 DanmuTaskManager 调用）
    # ------------------------------------------------------------------
    def _task_process(self, file_path: str) -> Tuple[bool, str, Optional[Dict]]:
        """worker 队列的单文件处理回调：调用 generate_danmu 并返回 (成功, 消息, 弹幕统计)。"""
        try:
            # 消费预批量匹配缓存（命中则跳过单文件 match）
            pre_matched = self._pre_matched_cache.pop(file_path, None)
            result = self.generate_danmu(file_path, pre_matched_comment_id=pre_matched)
            if isinstance(result, dict):
                msg = result.get("result", "")
                counts = result.get("counts", {})
                if isinstance(msg, str) and msg.endswith('.danmu.ass'):
                    return True, msg, counts
                return False, msg if isinstance(msg, str) else "生成失败", counts
            return False, "生成失败", None
        except Exception as e:
            logger.exception(f"后台刮削文件失败: {file_path}: {e}")
            return False, str(e), None

    def _compute_config_hash(self) -> str:
        """计算影响 .danmu.ass 输出的配置指纹，用于跳过判断与状态恢复。"""
        return DanmuTaskManager.hash_config(
            self._width, self._height, self._fontsize, self._alpha,
            self._duration, self._screen_area, self._onlyFromBili,
            self._useTmdbID, self._chConvert, self._filter_enabled,
            self._filter_similarity_threshold, self._filter_similarity_enabled,
            self._filter_blocked_modes, self._filter_freq_window,
            self._filter_freq_max, self._filter_screen_window,
            self._filter_screen_max, self._filter_screen_top_ratio,
            self._filter_screen_bottom_ratio, self._filter_screen_scroll_ratio,
        )

    def _on_batch_finish(self) -> None:
        """后台批量刮削结束（所有 worker 退出）：把延迟的写库统一落盘一次。"""
        try:
            self._retry_save_deferred = False
            self._save_retry_tasks(force=True)
            self._save_filter_user_state(force=True)
            logger.info("批量刮削结束，已统一落盘重试任务与过滤用户状态")
        except Exception as e:
            logger.exception(f"批量结束落盘失败: {e}")

    def scrape_directory(self, directory_path: str = None) -> schemas.Response:
        """
        刮削指定目录下所有媒体文件
        """
        if not directory_path:
            return schemas.Response(success=False, message="缺少目录路径")
        if not os.path.isdir(directory_path):
            return schemas.Response(success=False, message="目录不存在")
        files = self._collect_media_files(directory_path)
        if not files:
            return schemas.Response(success=False, message="目录下没有支持的媒体文件")
        _, scraped = self._count_scraped_in_path(directory_path)
        msg = f"已开始刮削，共 {len(files)} 个文件"
        if scraped > 0:
            msg += f"（其中 {scraped} 个已刮削将跳过）"
        batch_info = self._start_scrape_batch(files, f"目录 {directory_path}")
        # 仅当有文件但 worker 已在运行时才算"已在进行中"
        if files and not batch_info.get("started", False):
            return schemas.Response(success=False, message="已有刮削任务进行中，请稍后再试")
        return schemas.Response(
            success=True,
            message=msg,
            data={
                "total": len(files),
                "skipped_existing": scraped,
                "pre_match": batch_info["pre_match"],
            }
        )

    def batch_season_scrape(self, directory_path: str = None) -> schemas.Response:
        """
        批量分季刮削：扫描子文件夹，每个子文件夹独立匹配弹幕并分别下载
        
        适用场景：动画目录下有 Season 1/Season 2/OVA 等子文件夹，
        每个子文件夹需要分别匹配不同的番剧ID
        
        工作流程：
        1. 扫描 directory_path 下的所有直接子文件夹
        2. 对每个子文件夹，查找其手动匹配（.dandan.anime.json）
        3. 收集该子文件夹下所有媒体文件
        4. 按子文件夹分组，依次刮削（每个子文件夹内的文件共享同一匹配ID）
        """
        if not directory_path:
            return schemas.Response(success=False, message="缺少目录路径")
        if not os.path.isdir(directory_path):
            return schemas.Response(success=False, message="目录不存在")
        
        # 扫描直接子文件夹
        try:
            subdirs = []
            with os.scandir(directory_path) as it:
                for entry in it:
                    if entry.is_dir() and not entry.name.startswith('.'):
                        subdirs.append(entry.path)
            subdirs.sort()
        except Exception as e:
            logger.exception(f"扫描子文件夹失败: {e}")
            return schemas.Response(success=False, message=f"扫描子文件夹失败: {str(e)}")
        
        if not subdirs:
            return schemas.Response(success=False, message="目录下没有子文件夹，请使用目录刮削")
        
        # 统计每个子文件夹的媒体文件数和匹配状态
        season_info = []
        total_files = 0
        skipped_dirs = []
        for subdir in subdirs:
            files = self._collect_media_files(subdir)
            total_media, scraped = self._count_scraped_in_path(subdir)
            manual = self._get_manual_match(subdir, check_legacy=True)
            all_done = total_media > 0 and scraped >= total_media
            info = {
                "name": os.path.basename(subdir),
                "path": subdir,
                "file_count": len(files),
                "has_manual_match": manual is not None,
                "anime_id": manual.get("animeId") if manual else None,
                "anime_title": manual.get("animeTitle") if manual else None,
                "scraped_count": scraped,
                "all_scraped": all_done,
            }
            season_info.append(info)
            if all_done:
                skipped_dirs.append(os.path.basename(subdir))
                continue  # 全部已刮削，跳过此文件夹
            total_files += len(files)
        
        if total_files == 0:
            msg = "子文件夹中没有需要刮削的媒体文件"
            if skipped_dirs:
                msg += f"（{len(skipped_dirs)} 个子文件夹已全部刮削完成）"
            return schemas.Response(success=False, message=msg)
        
        # 启动批量刮削
        all_files = []
        for subdir in subdirs:
            info_match = next((s for s in season_info if s["path"] == subdir), None)
            if info_match and info_match.get("all_scraped"):
                continue
            all_files.extend(self._collect_media_files(subdir))
        
        batch_info = self._start_scrape_batch(all_files, f"分季批量 ({len(subdirs)}个子文件夹)")
        if all_files and not batch_info.get("started", False):
            return schemas.Response(success=False, message="已有刮削任务进行中，请稍后再试")
        
        msg = f"已开始分季批量刮削，共 {len(subdirs)} 个子文件夹，{total_files} 个文件"
        if skipped_dirs:
            msg += f"（{len(skipped_dirs)} 个子文件夹已全部刮削完成跳过）"
        return schemas.Response(
            success=True,
            message=msg,
            data={
                "total_files": total_files,
                "subdirectories": len(subdirs),
                "seasons": season_info,
                "skipped_dirs": skipped_dirs,
                "pre_match": batch_info["pre_match"],
            }
        )

    def generate_danmu_global(self) -> schemas.Response:
        """
        全局刮削弹幕
        """
        if not self._path:
            logger.warning("未设置刮削路径，跳过刮削")
            return schemas.Response(success=False, message="没有设定路径")

        logger.info("开始弹幕刮削")
        paths = [path.strip() for path in self._path.split('\n') if path.strip()]

        files = []
        total_scraped = 0
        for path in paths:
            if not os.path.exists(path):
                logger.warning(f"路径不存在: {path}")
                return schemas.Response(success=False, message=f"路径不存在: {path}")
            files.extend(self._collect_media_files(path))
            _, scraped = self._count_scraped_in_path(path)
            total_scraped += scraped

        if not files:
            return schemas.Response(success=False, message="未找到支持的媒体文件")

        expect_skip = total_scraped
        msg = f"已开始刮削，共 {len(files)} 个文件"
        if expect_skip > 0:
            msg += f"（其中 {expect_skip} 个已刮削将跳过）"

        batch_info = self._start_scrape_batch(files, "全局")
        if files and not batch_info.get("started", False):
            return schemas.Response(success=False, message="已有刮削任务进行中")
        return schemas.Response(
            success=True,
            message=msg,
            data={
                "total": len(files),
                "skipped_existing": expect_skip,
                "pre_match": batch_info["pre_match"],
            }
        )
    
    @eventmanager.register(EventType.TransferComplete)
    def generate_danmu_after_transfer(self, event):
        """
        传输完成后生成弹幕
        """
        if not self._enabled or not self._auto_scrape:
            return

        def __to_dict(_event):
            """
            递归将对象转换为字典
            """
            if isinstance(_event, dict):
                return {k: __to_dict(v) for k, v in _event.items()}
            elif isinstance(_event, list):
                return [__to_dict(item) for item in _event]
            elif isinstance(_event, tuple):
                return tuple(__to_dict(list(_event)))
            elif isinstance(_event, set):
                return set(__to_dict(list(_event)))
            elif hasattr(_event, 'to_dict'):
                return __to_dict(_event.to_dict())
            elif hasattr(_event, '__dict__'):
                return __to_dict(_event.__dict__)
            elif isinstance(_event, (int, float, str, bool, type(None))):
                return _event
            else:
                return str(_event)

        try:
            if not event or not getattr(event, "event_data", None):
                logger.warning("传输完成事件数据为空，跳过弹幕生成")
                return
            raw_data = __to_dict(event.event_data) or {}
            target_file = raw_data.get("transferinfo", {}).get("file_list_new", [None])[0]
            
            if not target_file:
                logger.warning("未找到目标文件")
                return

            logger.info(f"开始生成弹幕文件：{target_file}")
            thread = threading.Thread(
                target=self.generate_danmu,
                args=(target_file,)
            )
            thread.start()
        except Exception as e:
            logger.exception(f"处理传输完成事件失败: {e}")

    def stop_service(self):
        """
        退出插件：停止后台 worker，并把运行中的任务标记为 interrupted（下次启动可继续）。
        """
        try:
            if hasattr(self, "_task_manager"):
                self._task_manager.cancel()
        except Exception:
            pass

    def _count_danmu_lines_cached(self, ass_file: str, stat_result: Optional[os.stat_result] = None) -> int:
        """
        带缓存的弹幕数量统计，文件未变化时直接返回缓存值，避免重复整文件读取
        :param ass_file: 弹幕文件路径
        :param stat_result: 已有的stat结果（来自os.scandir时避免重复stat）
        :return: 弹幕数量
        """
        try:
            st = stat_result or os.stat(ass_file)
        except OSError:
            return 0
        cached = self._danmu_count_cache.get(ass_file)
        if cached and cached[0] == st.st_mtime_ns and cached[1] == st.st_size:
            return cached[2]
        count = self.count_danmu_lines(ass_file)
        self._danmu_count_cache[ass_file] = (st.st_mtime_ns, st.st_size, count)
        return count

    def count_danmu_lines(self, ass_file: str) -> int:
        """
        计算弹幕文件中的弹幕数量
        :param ass_file: 弹幕文件路径
        :return: 弹幕数量
        """
        try:
            if not os.path.exists(ass_file):
                return 0
            count = 0
            with open(ass_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('Dialogue:'):
                        count += 1
            return count
        except Exception as e:
            logger.exception(f"计算弹幕数量失败: {e}")
            return 0

    def scan_path(self, path: str = None, current_dir: str = None) -> schemas.Response:
        """
        扫描路径下的媒体文件和弹幕信息
        :param path: 配置的根路径
        :param current_dir: 当前浏览的目录（用于点击式导航）
        :return: 目录结构信息
        """
        logger.debug(f"开始扫描路径: {path if path else self._path}, 当前目录: {current_dir}")
        
        # 如果有current_dir，直接扫描该目录
        if current_dir:
            return self.scan_subfolder(current_dir)
        
        # 否则使用配置的路径
        if not path:
            path = self._path
            
        if not path:
            logger.debug("未设置扫描路径，返回错误")
            return schemas.Response(success=False, message="未配置刮削路径")
        
        # 处理多路径情况
        paths = [p.strip() for p in path.split('\n') if p.strip()]
        logger.debug(f"解析到 {len(paths)} 个有效路径")
        
        if len(paths) > 1:
            # 多路径情况，返回多个根目录
            logger.debug("处理多路径情况")
            result = {
                "name": "根目录",
                "path": "",
                "type": "root",
                "is_root": True,
                "children": []
            }
            
            for single_path in paths:
                logger.debug(f"处理子路径: {single_path}")
                if os.path.exists(single_path):
                    child_result = self._scan_current_directory(single_path)
                    result["children"].append(child_result)
                else:
                    logger.warning(f"路径不存在: {single_path}")
                    
            logger.debug(f"多路径扫描完成，共 {len(result['children'])} 个有效路径")
            return schemas.Response(success=True, data=result)
        elif len(paths) == 1:
            # 单路径情况
            single_path = paths[0]
            logger.debug(f"处理单路径: {single_path}")
            if not os.path.exists(single_path):
                logger.warning(f"路径不存在: {single_path}")
                return schemas.Response(success=False, message=f"路径不存在: {single_path}")
            
            result = self._scan_current_directory(single_path, is_root=True)
            logger.debug("单路径扫描完成")
            return schemas.Response(success=True, data=result)
        else:
            logger.debug("没有提供有效路径")
            return schemas.Response(success=False, message="未提供有效路径")

    def _scan_current_directory(self, path: str, is_root: bool = False) -> Dict[str, Any]:
        """
        扫描当前目录的直接内容（不递归）
        :param path: 要扫描的目录路径
        :param is_root: 是否为根目录
        :return: 目录结构信息
        """
        logger.debug(f"开始扫描当前目录: {path}, 是否为根目录: {is_root}")
        result = {
            "name": os.path.basename(path) or path,
            "path": path,
            "type": "directory",
            "is_root": is_root,
            "children": []
        }
        if os.path.isdir(path):
            manual_dir_match = self._get_manual_match(path, check_legacy=False)
            result["manual_match"] = manual_dir_match
            result["manual_scope"] = manual_dir_match.get("scope") if manual_dir_match else None
            result["directory_path"] = path
        else:
            manual_file_match = self._get_manual_file_match(path)
            if manual_file_match:
                result["manual_match"] = manual_file_match
                result["manual_scope"] = manual_file_match.get("scope")
            else:
                parent_manual = self._get_manual_match(os.path.dirname(path), check_legacy=False)
                result["manual_match"] = parent_manual
                result["manual_scope"] = parent_manual.get("scope") if parent_manual else None
            result["directory_path"] = os.path.dirname(path)

        try:
            # 如果是文件，直接返回文件信息
            if os.path.isfile(path):
                logger.debug(f"{path} 是文件")
                if self._is_supported_file(path):
                    logger.debug(f"{path} 是媒体文件")
                    result["type"] = "media"
                    result["manual_match"] = self._get_manual_match(os.path.dirname(path), check_legacy=False)
                    # 检查是否存在对应的弹幕文件
                    ass_file = f"{os.path.splitext(path)[0]}.danmu.ass"
                    result["danmu_count"] = self._count_danmu_lines_cached(ass_file)
                return result

            # 扫描目录的直接子项
            logger.debug(f"{path} 是目录，开始扫描直接子项")

            try:
                # 单次scandir同时拿到名称和类型，避免每个条目重复stat
                with os.scandir(path) as it:
                    # 跳过隐藏文件和系统文件
                    entries = [e for e in it if not e.name.startswith('.')]
                logger.debug(f"{path} 目录中共有 {len(entries)} 个项目")
            except PermissionError:
                logger.warning(f"无权限访问目录: {path}")
                result["error"] = "无权限访问该目录"
                return result
            except Exception as e:
                logger.warning(f"列出目录内容失败: {path}, 错误: {str(e)}")
                result["error"] = f"列出目录内容失败: {str(e)}"
                return result

            # 先处理目录，再处理文件
            entry_map = {e.name: e for e in entries}
            directories = []
            files = []

            for entry in entries:
                try:
                    if entry.is_dir():
                        directories.append(entry)
                    elif entry.is_file() and self._is_supported_file(entry.path):
                        files.append(entry)
                except OSError:
                    continue

            # 子文件的目录级手动匹配就是当前目录的匹配，直接复用，不再逐文件查询
            current_dir_manual = result.get("manual_match")
            current_dir_scope = result.get("manual_scope")

            # 添加目录到结果
            for entry in sorted(directories, key=lambda e: e.name):
                child = {
                    "name": entry.name,
                    "path": entry.path,
                    "type": "directory",
                    "children": []
                }
                manual_dir_match = self._get_manual_match(entry.path, check_legacy=False)
                child["manual_match"] = manual_dir_match
                child["manual_scope"] = manual_dir_match.get("scope") if manual_dir_match else None
                child["directory_path"] = entry.path
                # 快速扫描子目录内媒体与弹幕状态（仅一层，用于展示刮削状态）
                self._add_directory_scrape_info(child, entry.path)
                result["children"].append(child)

            # 添加媒体文件到结果
            for entry in sorted(files, key=lambda e: e.name):
                child = {
                    "name": entry.name,
                    "path": entry.path,
                    "type": "media",
                    "children": []
                }
                file_manual = self._get_manual_file_match(entry.path)
                if file_manual:
                    child["manual_match"] = file_manual
                    child["manual_scope"] = file_manual.get("scope")
                else:
                    child["manual_match"] = current_dir_manual
                    child["manual_scope"] = current_dir_scope
                child["directory_path"] = path
                # 弹幕文件与媒体同目录，用本次scandir结果判断存在性，避免逐文件stat
                ass_name = f"{os.path.splitext(entry.name)[0]}.danmu.ass"
                ass_entry = entry_map.get(ass_name)
                if ass_entry is not None:
                    try:
                        child["danmu_count"] = self._count_danmu_lines_cached(ass_entry.path, ass_entry.stat())
                    except OSError:
                        child["danmu_count"] = 0
                else:
                    child["danmu_count"] = 0
                result["children"].append(child)

            logger.debug(f"目录 {path} 扫描完成，发现 {len(files)} 个媒体文件，{len(directories)} 个子目录")
            return result
        except Exception as e:
            logger.exception(f"扫描路径失败: {path}, 错误: {e}")
            # 出错时返回基本信息，不中断整个扫描
            result["error"] = str(e)
            return result

    def _add_directory_scrape_info(self, child: Dict[str, Any], dir_path: str) -> None:
        """为目录条目添加刮削状态信息（仅一层快速扫描，兼顾性能）。
        填充字段：scraped_count、total_media_count、is_bottom_dir。
        """
        try:
            with os.scandir(dir_path) as sub_it:
                sub_entries = list(sub_it)
            media_files = []
            danmu_names = set()
            sub_dirs = []
            has_subtitle_files = False
            for se in sub_entries:
                if se.is_dir() and not se.name.startswith('.'):
                    sub_dirs.append(se)
                elif se.is_file(follow_symlinks=False):
                    if se.name.endswith('.danmu.ass'):
                        danmu_names.add(se.name[:-10])  # 去掉 .danmu.ass 后缀
                    elif se.name.lower().endswith(('.ass', '.ssa', '.srt', '.vtt')):
                        has_subtitle_files = True
                    elif self._is_supported_file(se.path):
                        media_files.append(se)
            total_media = len(media_files)
            if total_media > 0:
                scraped = sum(
                    1 for mf in media_files
                    if os.path.splitext(mf.name)[0] in danmu_names
                )
                child["scraped_count"] = scraped
                child["total_media_count"] = total_media
                # 是否为底层目录：有媒体文件 且 没有子目录或所有子目录都是空/纯目录
                child["is_bottom_dir"] = True
                if has_subtitle_files:
                    child["has_subtitle_files"] = True
            elif has_subtitle_files and not sub_dirs:
                # 可能只有字幕文件没有媒体文件，也是底层目录
                child["is_bottom_dir"] = True
                child["has_subtitle_files"] = True
                child["scraped_count"] = 0
                child["total_media_count"] = 0
        except (OSError, PermissionError):
            pass  # 无权限或 IO 错误则跳过，不影响主扫描流程

    def generate_danmu_single(self, file_path: str) -> schemas.Response:
        """
        为单个文件生成弹幕
        :param file_path: 媒体文件路径
        :return: 生成结果
        """
        if not file_path or not os.path.exists(file_path):
            return schemas.Response(success=False, message="文件不存在")
            
        if not self._is_supported_file(file_path):
            if file_path.endswith('.strm') and not self._enable_strm:
                return schemas.Response(success=False, message=".strm文件刮削功能未启用")
            else:
                return schemas.Response(success=False, message="不支持的文件格式")
            
        try:
            result = self.generate_danmu(file_path)
            # 单文件刮削结束，立即落盘（批量刮削由 _on_batch_finish 统一落盘）
            self._save_retry_tasks(force=True)
            self._save_filter_user_state(force=True)
            if result is None:
                return schemas.Response(success=False, message="弹幕生成失败")
            # 提取实际结果字符串（兼容 dict 返回）
            if isinstance(result, dict):
                msg = result.get("result", "")
                counts = result.get("counts", {})
            else:
                msg = result
                counts = {}
            # 如果是字符串且不是弹幕文件路径，说明是失败原因
            if isinstance(msg, str) and not msg.endswith('.ass'):
                return schemas.Response(success=False, message=msg)
            # 正常生成
            ass_file = f"{os.path.splitext(file_path)[0]}.danmu.ass"
            danmu_count = self._count_danmu_lines_cached(ass_file)
            logger.info(f"生成弹幕成功，弹幕数量: {danmu_count}")
            if danmu_count == 0:
                return schemas.Response(success=False, message="弹幕数量为0 跳过生成")
            return schemas.Response(
                success=True,
                message="弹幕生成成功",
                data={
                    "danmu_count": danmu_count,
                    "file_path": file_path,
                    "danmu_counts": counts,
                }
            )
        except Exception as e:
            logger.exception(f"生成弹幕失败: {e}")
            return schemas.Response(success=False, message=f"生成弹幕失败: {str(e)}")

    def search_anime(self, keyword: Optional[str] = None, type: Optional[str] = None) -> schemas.Response:
        """
        搜索弹弹动漫
        """
        keyword = keyword.strip() if keyword else ""
        if not keyword:
            return schemas.Response(success=False, message="搜索关键字不能为空")

        params = {"keyword": keyword}
        if type and type != "all":
            params["type"] = type

        try:
            response = requests.get(
                f"{generator.DanmuAPI.BASE_URL}/search/anime",
                params=params,
                headers=generator.DanmuAPI.HEADERS,
                timeout=15
            )
            if response.status_code != 200:
                logger.error(f"搜索弹弹失败，HTTP {response.status_code}: {response.text}")
                return schemas.Response(success=False, message=f"搜索失败: HTTP {response.status_code}")

            data = response.json()
            if not data.get("success", False):
                message = data.get("errorMessage") or "搜索失败"
                logger.warning(f"弹弹搜索返回失败: {message}")
                # 429 配额耗尽时给出明确指引
                if response.status_code == 429 or data.get("errorCode") == 429:
                    return schemas.Response(
                        success=False,
                        message="搜索接口配额已耗尽（通常每日重置）。请改用「目录刮削」通过文件 hash 匹配，不受配额影响。"
                    )
                return schemas.Response(success=False, message=message)

            # 外部 API 搜索结果在 "animes" 字段中，直接提取数组返回
            animes = data.get("animes") or []
            logger.info(f"搜索番剧 '{keyword}' 共命中 {len(animes)} 条结果")
            return schemas.Response(success=True, data=animes)
        except Exception as e:
            logger.exception(f"搜索弹弹动漫失败: {e}")
            return schemas.Response(success=False, message=f"搜索失败: {str(e)}")

    def set_manual_match(self, data: Dict[str, Any]) -> schemas.Response:
        """
        保存手动匹配结果
        """
        if not isinstance(data, dict):
            return schemas.Response(success=False, message="请求数据无效")

        file_path = data.get("file_path")
        directory_path = data.get("directory")
        scope = (data.get("scope") or "").lower()
        anime = data.get("anime") or {}

        if scope not in {"file", "directory"}:
            scope = "directory" if directory_path or (file_path and data.get("directory")) else "file"

        if scope == "file":
            if not file_path:
                return schemas.Response(success=False, message="缺少文件路径")
        manual_dir = self._resolve_manual_directory(file_path=file_path, directory_path=directory_path)
        if scope == "directory":
            if not manual_dir:
                return schemas.Response(success=False, message="无法确定手动匹配目录")
            if not os.path.isdir(manual_dir):
                return schemas.Response(success=False, message="匹配目录不存在，请刷新后重试")

        anime_id = anime.get("animeId") or anime.get("anime_id")
        if anime_id is None:
            return schemas.Response(success=False, message="缺少animeId")

        try:
            anime_id = int(anime_id)
        except (TypeError, ValueError):
            return schemas.Response(success=False, message="animeId格式无效")

        episode_offset = data.get("episodeOffset", data.get("episode_offset"))
        if episode_offset in (None, ""):
            episode_offset = 0
        try:
            episode_offset = int(episode_offset)
        except (TypeError, ValueError):
            return schemas.Response(success=False, message="集数偏移必须为整数")

        manual_info = {
            "animeId": anime_id,
            "animeTitle": anime.get("animeTitle"),
            "imageUrl": anime.get("imageUrl"),
            "type": anime.get("type"),
            "typeDescription": anime.get("typeDescription"),
            "episodeCount": anime.get("episodeCount"),
            "rating": anime.get("rating"),
            "startDate": anime.get("startDate"),
            "source": "manual_file" if scope == "file" else "manual",
            "updatedAt": datetime.now().isoformat(timespec="seconds")
        }
        if episode_offset:
            manual_info["episodeOffset"] = episode_offset

        try:
            if scope == "file":
                manual_info["scope"] = "file"
                self._update_manual_file_match_cache(file_path, manual_info)
                logger.info(f"单文件手动匹配已保存: {file_path} -> {anime_id}")
            else:
                manual_info["scope"] = "directory"
                self._write_manual_match_file(manual_dir, manual_info)
                self._update_manual_match_cache(manual_dir, manual_info)
                logger.info(f"目录手动匹配已保存: {manual_dir} -> {anime_id}")
            return schemas.Response(
                success=True,
                message="手动匹配已保存",
                data={
                    "directory": manual_dir if scope == "directory" else self._resolve_manual_directory(file_path=file_path),
                    "file_path": file_path if scope == "file" else None,
                    "manual_match": manual_info
                }
            )
        except Exception as e:
            logger.exception(f"保存手动匹配失败: {e}")
            return schemas.Response(success=False, message=f"保存失败: {str(e)}")

    def remove_manual_match(self, file_path: Optional[str] = None, directory: Optional[str] = None,
                             scope: Optional[str] = None) -> schemas.Response:
        """
        移除手动匹配
        """
        scope = (scope or "").lower()
        if scope not in {"file", "directory"}:
            scope = "file" if file_path and not directory else "directory"

        if scope == "file":
            norm = self._normalize_path(file_path)
            if not norm:
                return schemas.Response(success=False, message="未提供有效文件路径")
            removed = self._manual_file_matches.pop(norm, None)
            if removed:
                self._save_manual_state()
            return schemas.Response(success=True, message="单文件手动匹配已移除", data={"file_path": file_path})

        manual_dir = self._resolve_manual_directory(file_path=file_path, directory_path=directory)
        if not manual_dir:
            return schemas.Response(success=False, message="未提供有效目录")

        json_path = self._manual_json_path(manual_dir)
        try:
            if os.path.exists(json_path):
                os.remove(json_path)
                logger.info(f"已删除手动匹配文件: {json_path}")
        except Exception as e:
            logger.warning(f"删除手动匹配文件失败: {e}")

        self._update_manual_match_cache(manual_dir, None)
        return schemas.Response(success=True, message="目录手动匹配已移除", data={"directory": manual_dir})

    def tmdb_match_file(self, file_path: str = None) -> schemas.Response:
        """
        根据文件名 → TMDB搜索 → 弹弹Play匹配
        适用于 hash 失效（如转码/压缩后）但文件名仍包含番剧信息的场景
        """
        if not file_path:
            return schemas.Response(success=False, message="file_path 参数必填")

        file_name = os.path.basename(file_path)
        logger.info(f"[TMDB匹配] 开始处理文件: {file_name}")

        # 1. 从文件名提取元数据
        try:
            meta = MetaInfo(file_path)
        except Exception as e:
            return schemas.Response(success=False, message=f"无法解析文件名: {str(e)}")

        title = meta.name or meta.cn_name or ""
        season = meta.season
        episode_num = meta.episode
        logger.info(f"[TMDB匹配] 解析结果: name={title}, season={season}, episode={episode_num}")

        if not title:
            return schemas.Response(success=False, message="无法从文件名提取作品名称")

        # 2. 使用 MoviePilot 内置 TMDB 搜索获取 TMDB ID
        try:
            media_info = self.media_chain.recognize_media(meta=meta)
        except Exception as e:
            logger.warning(f"[TMDB匹配] MoviePilot 媒体识别异常: {e}")
            return schemas.Response(success=False, message=f"媒体识别失败: {str(e)}")

        if not media_info or not media_info.tmdb_id:
            return schemas.Response(
                success=False,
                message=f"MoviePilot 无法识别「{title}」的 TMDB ID，建议尝试手动搜索匹配"
            )

        tmdb_id = media_info.tmdb_id
        tmdb_id_type = 1 if media_info.type == MediaType.MOVIE else 0
        media_type_label = "电影" if tmdb_id_type == 1 else "电视剧"

        logger.info(f"[TMDB匹配] TMDB: id={tmdb_id}, type={media_type_label}, "
                     f"title={media_info.title or '?'}")

        # 3. 用 TMDB ID 去弹弹Play搜索（先官方 v2，失败后中转站 v1 兜底）
        try:
            episode_for_api = 1
            if episode_num:
                try:
                    episode_for_api = int(episode_num)
                except (ValueError, TypeError):
                    episode_for_api = 1

            logger.info(f"[TMDB匹配] 请求弹弹Play: tmdb_id={tmdb_id} episode={episode_for_api}")
            result, source = generator.DanmuAPI._search_tmdb_with_fallback(
                tmdb_id=tmdb_id,
                episode=episode_for_api,
                tmdb_id_type=tmdb_id_type,
            )
            if result is None:
                return schemas.Response(
                    success=False,
                    message="弹弹Play 官方接口和中转站均不可用，请稍后再试"
                )
            logger.info(f"[TMDB匹配] 弹弹Play响应 (来源={source}): {json.dumps(result, ensure_ascii=False)[:500]}")

            animes = result.get("animes", [])
            if not animes:
                return schemas.Response(
                    success=False,
                    message=f"弹弹Play 没有收录 TMDB ID={tmdb_id} 的弹幕数据"
                )

            # 4. 组装返回结果
            matches = []
            for anime in animes:
                anime_info = {
                    "animeId": anime.get("animeId"),
                    "animeTitle": anime.get("animeTitle"),
                    "type": anime.get("type"),
                    "typeDescription": anime.get("typeDescription"),
                    "episodes": []
                }
                for ep in anime.get("episodes", []):
                    anime_info["episodes"].append({
                        "episodeId": ep.get("episodeId"),
                        "episodeTitle": ep.get("episodeTitle"),
                    })
                matches.append(anime_info)

            return schemas.Response(
                success=True,
                message=f"匹配成功! TMDB ID={tmdb_id} ({media_type_label}: {media_info.title or title})",
                data={
                    "file_path": file_path,
                    "file_name": file_name,
                    "tmdb_id": tmdb_id,
                    "tmdb_id_type": tmdb_id_type,
                    "tmdb_type_label": media_type_label,
                    "tmdb_title": media_info.title or title,
                    "parsed_name": title,
                    "parsed_season": season,
                    "parsed_episode": episode_num,
                    "matches": matches,
                }
            )

        except requests.exceptions.Timeout:
            return schemas.Response(success=False, message="弹弹Play API 请求超时")
        except requests.exceptions.ConnectionError:
            return schemas.Response(success=False, message="无法连接弹弹Play API")
        except Exception as e:
            logger.error(f"[TMDB匹配] 异常: {e}", exc_info=True)
            return schemas.Response(success=False, message=f"TMDB匹配异常: {str(e)}")

    def scan_subfolder(self, subfolder_path: str = None) -> schemas.Response:
        """
        专门用于扫描子文件夹的内容（点击式导航）
        :param subfolder_path: 子文件夹路径
        :return: 该子文件夹的内容
        """
        logger.debug(f"扫描子文件夹: {subfolder_path}")
        
        if not subfolder_path:
            logger.warning("未提供子文件夹路径")
            return schemas.Response(success=False, message="未提供子文件夹路径")
        
        if not os.path.exists(subfolder_path):
            logger.warning(f"子文件夹不存在: {subfolder_path}")
            return schemas.Response(success=False, message="文件夹不存在")
        
        if not os.path.isdir(subfolder_path):
            logger.warning(f"指定路径不是文件夹: {subfolder_path}")
            return schemas.Response(success=False, message="指定路径不是文件夹")
        
        try:
            # 检查当前路径是否为用户配置的根路径之一
            is_root = False
            if self._path:
                root_paths = [p.strip() for p in self._path.split('\n') if p.strip()]
                is_root = subfolder_path in root_paths
            
            # 直接扫描这个子文件夹的内容
            result = self._scan_current_directory(subfolder_path, is_root=is_root)
            logger.debug("子文件夹扫描完成")
            return schemas.Response(success=True, data=result)
        except Exception as e:
            logger.exception(f"扫描子文件夹失败: {subfolder_path}, 错误: {e}")
            return schemas.Response(success=False, message=f"扫描子文件夹失败: {str(e)}")

    def get_retry_tasks(self) -> schemas.Response:
        """
        获取重试任务列表
        :return: 重试任务列表
        """
        # 转换datetime对象为字符串以便前端显示
        display_tasks = {}
        with self._retry_lock:
            for file_path, task_info in self._retry_tasks.items():
                last_attempt = task_info.get("last_attempt")
                display_tasks[file_path] = {
                    "retry_count": task_info["retry_count"],
                    "last_attempt": (last_attempt.strftime("%Y-%m-%d %H:%M:%S")
                                     if isinstance(last_attempt, datetime)
                                     else str(last_attempt or "")),
                    "file_path": task_info["file_path"],
                    "last_danmu_count": task_info.get("last_danmu_count", 0)
                }
        
        return schemas.Response(
            success=True,
            message=f"获取到 {len(display_tasks)} 个重试任务",
            data={
                "tasks": display_tasks,
                "total": len(display_tasks),
                "min_danmu_count": self._min_danmu_count,
                "max_retry_times": self._max_retry_times
            }
        )

    def process_retry_tasks(self) -> schemas.Response:
        """
        处理重试任务
        :return: 处理结果
        """
        if not self._retry_tasks:
            return schemas.Response(success=True, message="没有待处理的重试任务")
        
        logger.info(f"开始处理 {len(self._retry_tasks)} 个重试任务")
        processed_count = 0
        success_count = 0
        failed_count = 0
        removed_count = 0
        
        # 创建副本以避免在迭代时修改字典
        with self._retry_lock:
            tasks_to_process = list(self._retry_tasks.items())

        for file_path, task_info in tasks_to_process:
            # 检查文件是否仍然存在
            if not os.path.exists(file_path):
                logger.warning(f"重试任务文件不存在，移除: {file_path}")
                with self._retry_lock:
                    self._retry_tasks.pop(file_path, None)
                removed_count += 1
                continue

            # 检查是否达到最大重试次数
            if task_info["retry_count"] >= self._max_retry_times:
                logger.warning(f"文件 {file_path} 已达到最大重试次数 ({self._max_retry_times})，移除")
                with self._retry_lock:
                    self._retry_tasks.pop(file_path, None)
                removed_count += 1
                continue
            
            logger.info(f"处理重试任务: {file_path} (第 {task_info['retry_count'] + 1} 次尝试)")
            
            try:
                # 生成弹幕（这会自动更新重试任务状态）
                result = self.generate_danmu(file_path)
                processed_count += 1
                
                # 检查结果
                if result and not (isinstance(result, str) and result.startswith('弹幕数量为0')):
                    # 检查弹幕文件是否满足要求
                    ass_file = f"{os.path.splitext(file_path)[0]}.danmu.ass"
                    if os.path.exists(ass_file):
                        danmu_count = self._count_danmu_lines_cached(ass_file)
                        if danmu_count >= self._min_danmu_count:
                            success_count += 1
                            logger.info(f"重试成功: {file_path}，弹幕数量: {danmu_count}")
                        else:
                            failed_count += 1
                            logger.info(f"重试失败: {file_path}，弹幕数量仍不足: {danmu_count}")
                    else:
                        failed_count += 1
                        logger.warning(f"重试失败: {file_path}，弹幕文件不存在")
                else:
                    failed_count += 1
                    logger.warning(f"重试失败: {file_path}，{result}")
                    
            except Exception as e:
                logger.exception(f"处理重试任务失败: {file_path}，错误: {e}")
                failed_count += 1
        
        # 保存更新后的重试任务列表
        self._save_retry_tasks()
        
        result_message = f"重试任务处理完成。处理: {processed_count}, 成功: {success_count}, 失败: {failed_count}, 移除: {removed_count}, 剩余: {len(self._retry_tasks)}"
        logger.info(result_message)
        
        return schemas.Response(
            success=True,
            message=result_message,
            data={
                "processed": processed_count,
                "success": success_count,
                "failed": failed_count,
                "removed": removed_count,
                "remaining": len(self._retry_tasks)
            }
        )

    def clear_retry_tasks(self) -> schemas.Response:
        """
        清空重试任务
        :return: 清空结果
        """
        with self._retry_lock:
            task_count = len(self._retry_tasks)
            self._retry_tasks = {}
        self._save_retry_tasks()
        
        logger.info(f"已清空 {task_count} 个重试任务")
        return schemas.Response(
            success=True,
            message=f"已清空 {task_count} 个重试任务"
        )

    def remove_retry_task(self, file_path: str) -> schemas.Response:
        """
        移除重试任务
        :param file_path: 要移除的重试任务的文件路径
        :return: 移除结果
        """
        if not file_path:
            return schemas.Response(success=False, message="文件路径不能为空")
            
        with self._retry_lock:
            removed = self._retry_tasks.pop(file_path, None)
        if removed:
            self._save_retry_tasks()
            logger.info(f"重试任务已移除: {file_path}")
            return schemas.Response(
                success=True,
                message=f"重试任务已移除: {file_path}"
            )
        else:
            return schemas.Response(
                success=False,
                message=f"未找到重试任务: {file_path}"
            )

    def auto_process_retry_tasks(self):
        """
        定时自动处理重试任务
        """
        try:
            if not self._enabled or not self._enable_retry_task:
                logger.debug("弹幕插件或重试任务功能未启用，跳过定时处理")
                return
                
            if not self._retry_tasks:
                logger.debug("没有待处理的重试任务")
                return
                
            logger.info(f"定时任务开始处理 {len(self._retry_tasks)} 个重试任务")
            
            # 调用现有的处理重试任务方法
            result = self.process_retry_tasks()
            
            if result.success:
                logger.info(f"定时任务完成，{result.message}")
            else:
                logger.warning(f"定时任务处理失败: {result.message}")
                
        except Exception as e:
            logger.exception(f"定时处理重试任务失败: {e}")

    # ===== 弹幕过滤系统 API 实现 =====

    def _get_filter_module(self):
        """延迟导入过滤模块"""
        try:
            from app.plugins.danmucustom.danmaku_filter import KeywordBlocklist, DanmakuFilter, get_last_filter
            return KeywordBlocklist, DanmakuFilter, get_last_filter
        except ImportError as e:
            logger.exception(f"导入过滤模块失败: {e}")
            return None, None, None

    # ===== 过滤词库配置持久化 =====
    _FILTER_CONFIG_KEY = "danmucustom_filter_config"

    def _save_filter_config(self):
        """将当前过滤词库配置（用户自定义分类、正则/组合规则、分类启用状态）持久化到 MP 插件数据，重启不丢。"""
        try:
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return
            self.save_data(self._FILTER_CONFIG_KEY, KeywordBlocklist.export_config())
        except Exception as e:
            logger.exception(f"保存过滤词库配置失败: {e}")

    def _load_filter_config(self):
        """从 MP 插件数据加载已保存的过滤词库配置（若存在）。"""
        try:
            cfg = self.get_data(self._FILTER_CONFIG_KEY)
            if not cfg:
                return
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return
            KeywordBlocklist.import_config(cfg)
            logger.info("已加载已保存的过滤词库配置")
        except Exception as e:
            logger.exception(f"加载过滤词库配置失败: {e}")

    # ===== 过滤用户状态持久化（信用分/封禁/违规统计，重启不丢） =====
    _FILTER_USER_STATE_KEY = "danmucustom_filter_user_state"

    def _save_filter_user_state(self, force: bool = False):
        """将当前 DanmakuFilter 中的用户信用/封禁/违规状态持久化到 MP 插件数据。
        节流落盘：非强制时至少间隔 FILTER_SAVE_INTERVAL 秒，避免每个文件都写库拖慢 MP。"""
        if not force and (time.time() - self._filter_state_last_save) < FILTER_SAVE_INTERVAL:
            return
        try:
            _, _, get_last_filter = self._get_filter_module()
            if get_last_filter is None:
                return
            last_filter = get_last_filter()
            if last_filter is None:
                return
            state = last_filter.export_filter_state()
            if state:
                self.save_data(self._FILTER_USER_STATE_KEY, state)
                logger.debug(f"已持久化 {len(state)} 个用户过滤状态")
            # 保存跨实例累计统计（与用户状态一起，重启不丢、批量累计）
            from app.plugins.danmucustom.danmaku_filter import get_cumulative_stats
            cum = get_cumulative_stats()
            if cum.get("scrapes", 0) > 0 or cum.get("stats"):
                self.save_data(self._FILTER_CUMULATIVE_KEY, cum)
                logger.debug(f"已持久化累计统计（刮削{cum.get('scrapes', 0)}次）")
            self._filter_state_last_save = time.time()
        except Exception as e:
            logger.exception(f"保存过滤用户状态失败: {e}")

    def _load_filter_user_state(self) -> Optional[Dict[str, dict]]:
        """从 MP 插件数据加载已保存的用户过滤状态。"""
        try:
            state = self.get_data(self._FILTER_USER_STATE_KEY)
            if state:
                logger.info(f"已加载 {len(state)} 个用户过滤状态（持久化恢复）")
            return state
        except Exception as e:
            logger.exception(f"加载过滤用户状态失败: {e}")
            return None

    def _inject_restored_filter_user_state(self):
        """将持久化的用户过滤状态注入 danmaku_filter 模块，供下次 DanmakuFilter 初始化时自动加载。"""
        try:
            state = self._load_filter_user_state()
            if state:
                from app.plugins.danmucustom import danmaku_filter as filter_mod
                filter_mod.set_pending_restored_users(state)
        except Exception as e:
            logger.exception(f"注入过滤用户状态失败: {e}")

    def _inject_restored_cumulative_stats(self):
        """将持久化的跨实例累计统计注入 danmaku_filter 模块（非一次性），供 API 查询全局累计。"""
        try:
            cum = self.get_data(self._FILTER_CUMULATIVE_KEY)
            if cum:
                from app.plugins.danmucustom.danmaku_filter import set_pending_cumulative_stats
                set_pending_cumulative_stats(cum)
                logger.debug(f"已注入累计统计（刮削{cum.get('scrapes', 0)}次）")
        except Exception as e:
            logger.exception(f"注入累计统计失败: {e}")

    def filter_get_categories(self) -> schemas.Response:
        """获取所有过滤分类。"""
        try:
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")

            raw_categories = KeywordBlocklist.get_categories() or {}

            categories = []
            for name, item in raw_categories.items():
                item = item or {}
                categories.append({
                    "name": name,
                    "desc": item.get("desc", ""),
                    "enabled": item.get("enabled", True),
                    "keyword_count": item.get("keyword_count", 0),
                    "combo_count": item.get("combo_count", 0),
                    "regex_count": item.get("regex_count", 0),
                    "is_builtin": item.get("is_builtin", False),
                    "keywords": item.get("keywords", []),
                    "combos": item.get("combos", []),
                    "regexes": item.get("regexes", []),
                })

            return schemas.Response(success=True, data=categories)
        except Exception as e:
            logger.exception(f"获取过滤分类失败: {e}")
            return schemas.Response(success=False, message=f"获取失败: {str(e)}")

    def filter_add_keyword(self, data: Dict[str, Any]) -> schemas.Response:
        """添加关键词，限制分类名64字符、关键词256字符。"""
        try:
            category = (data.get("category", "") or "").strip()
            keyword = (data.get("keyword", "") or "").strip()
            if not category or not keyword:
                return schemas.Response(success=False, message="分类和关键词不能为空")
            if len(category) > 64:
                return schemas.Response(success=False, message="分类名过长（最大64字符）")
            if len(keyword) > 256:
                return schemas.Response(success=False, message="关键词过长（最大256字符）")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.add_keyword(category, keyword)
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message="添加成功" if ok else "添加失败，分类不存在")
        except Exception as e:
            logger.exception(f"添加关键词失败: {e}")
            return schemas.Response(success=False, message=f"添加失败: {str(e)}")

    def filter_remove_keyword(self, data: Dict[str, Any]) -> schemas.Response:
        """移除关键词"""
        try:
            category = data.get("category", "")
            keyword = data.get("keyword", "")
            if not category or not keyword:
                return schemas.Response(success=False, message="分类和关键词不能为空")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.remove_keyword(category, keyword)
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message="移除成功" if ok else "移除失败，未找到该关键词")
        except Exception as e:
            logger.exception(f"移除关键词失败: {e}")
            return schemas.Response(success=False, message=f"移除失败: {str(e)}")

    def filter_query_keywords(self, keyword: str = None) -> schemas.Response:
        """查询关键词"""
        try:
            if not keyword:
                return schemas.Response(success=False, message="请提供查询关键词")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            results = KeywordBlocklist.query_keywords(keyword)
            return schemas.Response(success=True, data={"results": results})
        except Exception as e:
            logger.exception(f"查询关键词失败: {e}")
            return schemas.Response(success=False, message=f"查询失败: {str(e)}")

    def filter_set_category(self, data: Dict[str, Any]) -> schemas.Response:
        """启用/禁用分类"""
        try:
            category = data.get("category", "")
            enabled = data.get("enabled", True)
            if not category:
                return schemas.Response(success=False, message="分类不能为空")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.set_category_enabled(category, enabled)
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message=f"已{'启用' if enabled else '禁用'}分类 {category}" if ok else "操作失败，分类不存在")
        except Exception as e:
            logger.exception(f"设置分类状态失败: {e}")
            return schemas.Response(success=False, message=f"操作失败: {str(e)}")

    def filter_add_category(self, data: Dict[str, Any]) -> schemas.Response:
        """添加自定义分类，限制名称64字符、描述256字符。"""
        try:
            name = (data.get("name", "") or "").strip()
            desc = (data.get("desc", "") or "").strip()
            if not name:
                return schemas.Response(success=False, message="分类名称不能为空")
            if len(name) > 64:
                return schemas.Response(success=False, message="分类名过长（最大64字符）")
            if len(desc) > 256:
                return schemas.Response(success=False, message="描述过长（最大256字符）")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.add_category(name, desc)
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message=f"已添加分类 {name}" if ok else "添加失败，分类已存在")
        except Exception as e:
            logger.exception(f"添加分类失败: {e}")
            return schemas.Response(success=False, message=f"添加失败: {str(e)}")

    def filter_remove_category(self, data: Dict[str, Any]) -> schemas.Response:
        """移除自定义分类"""
        try:
            name = data.get("name", "")
            if not name:
                return schemas.Response(success=False, message="分类名称不能为空")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.remove_category(name)
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message=f"已移除分类 {name}" if ok else "移除失败，内置分类不可移除")
        except Exception as e:
            logger.exception(f"移除分类失败: {e}")
            return schemas.Response(success=False, message=f"移除失败: {str(e)}")

    def filter_add_regex(self, data: Dict[str, Any]) -> schemas.Response:
        """添加正则规则，保存前先 compile 验证正则有效性。"""
        try:
            category = (data.get("category", "") or "").strip()
            pattern = (data.get("pattern", "") or "").strip()
            level = data.get("level", 2)
            if not category or not pattern:
                return schemas.Response(success=False, message="分类和正则表达式不能为空")
            if len(category) > 64:
                return schemas.Response(success=False, message="分类名过长（最大64字符）")
            if len(pattern) > 512:
                return schemas.Response(success=False, message="正则表达式过长（最大512字符）")
            # 编译验证正则
            try:
                re.compile(pattern)
            except re.error as regex_err:
                return schemas.Response(success=False, message=f"无效的正则表达式: {regex_err}")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.add_regex_rule(category, pattern, int(level))
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message="添加成功" if ok else "添加失败，分类不存在")
        except Exception as e:
            logger.exception(f"添加正则规则失败: {e}")
            return schemas.Response(success=False, message=f"添加失败: {str(e)}")

    def filter_remove_regex(self, data: Dict[str, Any]) -> schemas.Response:
        """移除正则规则"""
        try:
            category = data.get("category", "")
            pattern = data.get("pattern", "")
            if not category or not pattern:
                return schemas.Response(success=False, message="分类和正则表达式不能为空")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.remove_regex_rule(category, pattern)
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message="移除成功" if ok else "移除失败，未找到该正则规则")
        except Exception as e:
            logger.exception(f"移除正则规则失败: {e}")
            return schemas.Response(success=False, message=f"移除失败: {str(e)}")

    def filter_add_combo(self, data: Dict[str, Any]) -> schemas.Response:
        """添加组合规则"""
        try:
            category = data.get("category", "")
            keyword = data.get("keyword", "")
            max_len = data.get("max_len", 0)
            if not category or not keyword:
                return schemas.Response(success=False, message="分类和关键词不能为空")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.add_combo_rule(category, keyword, int(max_len))
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message="添加成功" if ok else "添加失败，分类不存在")
        except Exception as e:
            logger.exception(f"添加组合规则失败: {e}")
            return schemas.Response(success=False, message=f"添加失败: {str(e)}")

    def filter_remove_combo(self, data: Dict[str, Any]) -> schemas.Response:
        """移除组合规则"""
        try:
            category = data.get("category", "")
            keyword = data.get("keyword", "")
            if not category or not keyword:
                return schemas.Response(success=False, message="分类和关键词不能为空")
            KeywordBlocklist, _, _ = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")
            ok = KeywordBlocklist.remove_combo_rule(category, keyword)
            if ok:
                self._save_filter_config()
            return schemas.Response(success=ok, message="移除成功" if ok else "移除失败，未找到该组合规则")
        except Exception as e:
            logger.exception(f"移除组合规则失败: {e}")
            return schemas.Response(success=False, message=f"移除失败: {str(e)}")

    def filter_get_blocked_users(self) -> schemas.Response:
        """获取屏蔽用户列表，优先使用内存实例，无实例时从持久化数据恢复。"""
        try:
            _, DanmakuFilter, get_last_filter = self._get_filter_module()
            if DanmakuFilter is None:
                return schemas.Response(success=False, message="过滤模块不可用")

            dm_filter = get_last_filter() if get_last_filter else None
            user_tracker = getattr(dm_filter, "user_tracker", None) if dm_filter else None
            users = getattr(user_tracker, "_users", None) if user_tracker else None

            # 若无内存实例，尝试从持久化数据构造结果
            if not users:
                persisted = self._load_filter_user_state()
                if persisted:
                    blocked = [{"mid_hash": mh, **{k: v for k, v in d.items() if k != "mid_hash"}}
                               for mh, d in persisted.items() if d.get("is_blocked")]
                    warned = [{"mid_hash": mh, **{k: v for k, v in d.items() if k != "mid_hash"}}
                              for mh, d in persisted.items()
                              if not d.get("is_blocked") and d.get("credit_score", 100) <= 50]
                    return schemas.Response(success=True, data={
                        "blocked_users": blocked,
                        "warned_users": warned,
                        "note": "数据来自持久化存储（上次运行保留）",
                    })
                return schemas.Response(
                    success=True, message="暂无用户数据，执行弹幕刮削后即可看到",
                    data={"blocked_users": [], "warned_users": []},
                )

            blocked = dm_filter.query_blocked_users() if hasattr(dm_filter, "query_blocked_users") else []
            warned = dm_filter.query_warned_users() if hasattr(dm_filter, "query_warned_users") else []
            return schemas.Response(success=True, data={
                "blocked_users": blocked or [], "warned_users": warned or [],
            })
        except Exception as e:
            logger.exception(f"获取屏蔽用户失败: {e}")
            return schemas.Response(success=False, message=f"获取失败: {str(e)}")

    def filter_unblock_user(self, data: Dict[str, Any]) -> schemas.Response:
        """解除用户封禁。内存实例和持久化数据同步更新。"""
        try:
            mid_hash = (data.get("mid_hash", "") or "").strip()
            if not mid_hash:
                return schemas.Response(success=False, message="缺少用户 mid_hash 参数")
            _, DanmakuFilter, get_last_filter = self._get_filter_module()
            if DanmakuFilter is None:
                return schemas.Response(success=False, message="过滤模块不可用")

            dm_filter = get_last_filter() if get_last_filter else None
            live_ok = False
            if dm_filter is not None:
                live_ok = dm_filter.unblock_user(mid_hash)
                if live_ok:
                    self._save_filter_user_state()

            # 同时更新持久化数据
            persisted = self._load_filter_user_state()
            if persisted and mid_hash in persisted:
                persisted[mid_hash]["is_blocked"] = False
                persisted[mid_hash]["blocked_at"] = 0.0
                persisted[mid_hash]["credit_score"] = max(persisted[mid_hash].get("credit_score", 50), 50)
                self.save_data(self._FILTER_USER_STATE_KEY, persisted)
                live_ok = True

            return schemas.Response(
                success=live_ok,
                message=f"已解除封禁用户 {mid_hash}" if live_ok else f"未找到用户 {mid_hash}"
            )
        except Exception as e:
            logger.exception(f"解除封禁失败: {e}")
            return schemas.Response(success=False, message=f"解除封禁失败: {str(e)}")

    def filter_reset_user(self, data: Dict[str, Any]) -> schemas.Response:
        """重置用户信用分。内存实例和持久化数据同步更新。"""
        try:
            mid_hash = (data.get("mid_hash", "") or "").strip()
            score = data.get("score", None)
            if not mid_hash:
                return schemas.Response(success=False, message="缺少用户 mid_hash 参数")
            _, DanmakuFilter, get_last_filter = self._get_filter_module()
            if DanmakuFilter is None:
                return schemas.Response(success=False, message="过滤模块不可用")

            dm_filter = get_last_filter() if get_last_filter else None
            live_ok = False
            if dm_filter is not None:
                live_ok = dm_filter.reset_user_credit(mid_hash, score)
                if live_ok:
                    self._save_filter_user_state()

            # 同时更新持久化数据
            persisted = self._load_filter_user_state()
            if persisted and mid_hash in persisted:
                new_score = score if score is not None else 100
                persisted[mid_hash]["credit_score"] = new_score
                persisted[mid_hash]["violation_count"] = 0
                persisted[mid_hash]["violation_reasons"] = []
                persisted[mid_hash]["is_blocked"] = False
                persisted[mid_hash]["blocked_at"] = 0.0
                self.save_data(self._FILTER_USER_STATE_KEY, persisted)
                live_ok = True

            return schemas.Response(
                success=live_ok,
                message=f"已重置用户 {mid_hash} 信用分" if live_ok else f"未找到用户 {mid_hash}"
            )
        except Exception as e:
            logger.exception(f"重置信用分失败: {e}")
            return schemas.Response(success=False, message=f"重置失败: {str(e)}")

    def filter_get_warned_users(self) -> schemas.Response:
        """获取警告用户列表，优先使用内存实例，无实例时从持久化数据恢复。"""
        try:
            _, DanmakuFilter, get_last_filter = self._get_filter_module()
            if DanmakuFilter is None:
                return schemas.Response(success=False, message="过滤模块不可用")

            dm_filter = get_last_filter() if get_last_filter else None
            user_tracker = getattr(dm_filter, "user_tracker", None) if dm_filter else None
            users = getattr(user_tracker, "_users", None) if user_tracker else None

            if not users:
                persisted = self._load_filter_user_state()
                if persisted:
                    warned = [{"mid_hash": mh, **{k: v for k, v in d.items() if k != "mid_hash"}}
                              for mh, d in persisted.items()
                              if not d.get("is_blocked") and d.get("credit_score", 100) <= 50]
                    return schemas.Response(success=True, data={"warned_users": warned})
                return schemas.Response(success=True, data={"warned_users": []})

            warned = dm_filter.query_warned_users() if hasattr(dm_filter, "query_warned_users") else []
            return schemas.Response(success=True, data={"warned_users": warned or []})
        except Exception as e:
            logger.exception(f"获取警告用户失败: {e}")
            return schemas.Response(success=False, message=f"获取失败: {str(e)}")

    def filter_get_stats(self) -> schemas.Response:
        """获取过滤系统统计数据，优先使用内存实例，无实例时从持久化数据恢复。"""
        try:
            KeywordBlocklist, DanmakuFilter, get_last_filter = self._get_filter_module()
            if KeywordBlocklist is None:
                return schemas.Response(success=False, message="过滤模块不可用")

            categories = KeywordBlocklist.get_categories() or {}
            dm_filter = get_last_filter() if get_last_filter else None
            user_tracker = getattr(dm_filter, "user_tracker", None) if dm_filter else None
            has_users = bool(getattr(user_tracker, "_users", None)) if user_tracker else False
            blocked_count = len(dm_filter.query_blocked_users()) if (dm_filter and has_users and hasattr(dm_filter, 'query_blocked_users')) else 0

            if blocked_count == 0 and not has_users:
                persisted = self._load_filter_user_state()
                if persisted:
                    blocked_count = sum(1 for d in persisted.values() if d.get("is_blocked"))

            # 累计统计优先（跨实例/跨重启），避免仅反映最后一个过滤实例
            from app.plugins.danmucustom.danmaku_filter import get_cumulative_stats
            cum = get_cumulative_stats()
            return schemas.Response(
                success=True,
                data={
                    "category_count": len(categories),
                    "keyword_count": sum(c.get("keyword_count", 0) for c in categories.values()),
                    "enabled_category_count": sum(1 for c in categories.values() if c.get("enabled")),
                    "blocked_count": blocked_count,
                    "scrapes": cum.get("scrapes", 0),
                    "cumulative_stats": cum.get("stats", {}),
                    "is_cumulative": True,
                }
            )
        except Exception as e:
            logger.exception(f"获取过滤统计失败: {e}")
            return schemas.Response(success=False, message=f"获取失败: {str(e)}")

    def filter_reset_stats(self) -> schemas.Response:
        """重置累计过滤统计（仅清空统计数字，不影响已封禁/警告的用户状态）。"""
        try:
            from app.plugins.danmucustom.danmaku_filter import reset_cumulative_stats
            reset_cumulative_stats()
            self.save_data(self._FILTER_CUMULATIVE_KEY, {"scrapes": 0, "stats": {}})
            return schemas.Response(success=True, message="累计统计已重置")
        except Exception as e:
            logger.exception(f"重置统计失败: {e}")
            return schemas.Response(success=False, message=f"重置失败: {str(e)}")

    # ------------------------------------------------------------------
    # 后台任务控制：暂停 / 继续 / 取消 / 清空 / 继续未完成 / 状态查询
    # ------------------------------------------------------------------
    def task_pause(self) -> schemas.Response:
        """暂停后台刮削（worker 空闲，已入队任务暂缓处理）。"""
        try:
            self._task_manager.pause()
            return schemas.Response(success=True, message="已暂停")
        except Exception as e:
            return schemas.Response(success=False, message=f"暂停失败: {e}")

    def task_resume(self) -> schemas.Response:
        """继续后台刮削。"""
        try:
            self._task_manager.resume()
            self._task_manager.start(self._worker_count)
            return schemas.Response(success=True, message="已继续")
        except Exception as e:
            return schemas.Response(success=False, message=f"继续失败: {e}")

    def task_cancel(self) -> schemas.Response:
        """取消后台刮削（停止 worker，未完成标记为 interrupted）。"""
        try:
            self._task_manager.cancel()
            return schemas.Response(success=True, message="已取消")
        except Exception as e:
            return schemas.Response(success=False, message=f"取消失败: {e}")

    def task_clear(self) -> schemas.Response:
        """清空任务记录与历史（不删除已生成的 .danmu.ass 文件）。"""
        try:
            self._task_manager.clear()
            return schemas.Response(success=True, message="已清空任务记录")
        except Exception as e:
            return schemas.Response(success=False, message=f"清空失败: {e}")

    def task_continue(self) -> schemas.Response:
        """把未完成任务（pending/interrupted，含失败）重新入队并启动。"""
        try:
            self._retry_save_deferred = True
            n = self._task_manager.requeue_unfinished(include_failed=True)
            self._task_manager.start(self._worker_count, on_finish=self._on_batch_finish)
            return schemas.Response(success=True, message=f"已重新提交 {n} 个未完成任务")
        except Exception as e:
            return schemas.Response(success=False, message=f"继续失败: {e}")

    def task_status(self) -> schemas.Response:
        """返回后台任务持久化状态（用于前端轮询）。
        只返回安全可序列化的精简字段，避免把整个 file_status 大对象交给
        schemas.Response 序列化而触发的 500。首页统计来自持久化的 file_status 聚合。"""
        try:
            full = self._task_manager.get_status()
            state = full.get("state") or {}
            counts = state.get("counts") or {}
            safe = {
                "status": state.get("status"),
                "total": state.get("total", 0),
                "processed": state.get("processed", 0),
                "success": counts.get("success", 0),
                "skipped": counts.get("skipped", 0),
                "failed": counts.get("failed", 0),
                "interrupted": counts.get("interrupted", 0),
                "pending": counts.get("pending", 0),
                "running": counts.get("running", 0),
                "current_file": (state.get("current_files") or [None])[0],
                "worker_count": full.get("worker_count", 0),
            }
            return schemas.Response(success=True, data=safe_json(safe))
        except Exception as e:
            logger.exception(f"获取任务状态失败: {e}")
            return schemas.Response(success=False, message=f"获取状态失败: {e}")

    def get_scrape_history(self, page: int = 1, page_size: int = 50,
                           status: Optional[str] = None) -> schemas.Response:
        """获取刮削历史记录（统一从持久化的 file_status 读取，重启不归零）。
        支持分页 ?page=1&page_size=50，字段缺失容错，绝不因单条记录异常而 500。"""
        try:
            page = int(page) if page else 1
            page_size = int(page_size) if page_size else 50
            data = self._task_manager.get_history(page=page, page_size=page_size, status_filter=status)
            return schemas.Response(success=True, data=data)
        except Exception as e:
            logger.exception(f"获取刮削历史失败: {e}")
            return schemas.Response(
                success=False, message=f"获取失败: {str(e)}",
                data={"items": [], "total": 0, "page": 1, "page_size": 50, "total_pages": 0},
            )
