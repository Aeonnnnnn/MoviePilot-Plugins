# MoviePilot V2 插件通用模式总结

> 来源：基于 10 个真实 V2 插件（`plugins.v2/` 下、继承 `app.plugins._PluginBase`）的源码研读
> + 本次 DanmuCustom 插件调试实战。
> 适用对象：开发侧 AI / 插件开发者。不能直接运行 MP 机器时的离线开发与排障。

---

## 0. 先分清 V1 与 V2

| 维度 | V1 插件 | V2 插件 |
|------|---------|---------|
| 目录 | `plugins/`（市场 monorepo 里） | `plugins.v2/`（市场 monorepo 里） |
| 基类 | 旧基类（如 `PluginBase`）或 `_PluginBase` 但无 Vue | 继承 `from app.plugins import _PluginBase` |
| 前端 | 无 / 仅 `get_form` 的 Vuetify JSON | 可选 Vue 联邦（`get_render_mode` 返回 `"vue", "dist/assets"`） |
| 页面 | `get_page` 返回 Vuetify 组件 JSON | 可选返回联邦组件名；或 `get_page` 仍走 VForm |
| API | `get_api` 返回路由字典 | 同左（完全一致） |

判断清单（严格）：
1. 在 `plugins.v2/` 目录下；
2. 含 `package.v2.json`（独立分发插件放在插件目录内；市场 monorepo 集中在仓库根）；
3. 类继承 `from app.plugins import _PluginBase`。

> 本次市场仓库实测：每个插件目录本身**没有**独立 `package.v2.json`，元信息集中在仓库根 `package.v2.json`（以插件 id 为键）。独立分发插件（如 DanmuCustom）才有自己的 `package.v2.json`。

---

## 1. 插件类骨架（所有 V2 插件一致）

```python
from typing import Dict, List, Any, Optional, Tuple
from app.plugins import _PluginBase
from app.log import logger
from app.core.event import eventmanager, Event
from app.schemas.types import EventType
from app.core.config import settings
from app import schemas


class DemoPlugin(_PluginBase):
    # 类属性：基本元信息
    plugin_name = "演示插件"
    plugin_desc = "一句话描述"
    plugin_icon = "mdi-help-circle-outline"
    plugin_version = "1.0.0"
    plugin_author = "you"
    plugin_config_prefix = "demo_"

    # 实例状态（不要依赖 __init__，用 init_plugin 初始化）
    _enabled: bool = False
    _scheduler = None

    def init_plugin(self, config: dict = None) -> None:
        """MP 加载/重载插件时调用，务必在此解析配置、初始化服务。"""
        self._enabled = self._get_enabled(config)
        # 解析其它配置...
        self._setup_scheduler()

    def stop_service(self) -> None:
        """MP 停止/卸载插件时调用，必须清理调度器/监听/线程。"""
        self._scheduler_shutdown()

    def get_state(self) -> bool:
        return self._enabled

    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        """返回 (VForm 配置 JSON, 默认配置 dict)。Vue 联邦模式下可返回 ([], {})。"""
        return [...], {...}

    def get_page(self) -> List[dict]:
        """返回详情页/侧栏页面。无页面返回 []；Vue 联邦返回组件名。"""
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        """返回自定义 API 路由列表。"""
        return [...]

    # 推荐：把配置读取封装，避免 {"enabled": False} 被误读成 True
    @staticmethod
    def _get_enabled(config: dict) -> bool:
        if not config:
            return False
        if "enabled" in config:
            return bool(config.get("enabled"))
        if "enable" in config:
            return bool(config.get("enable"))
        return False
```

关键点：
- **不要在 `__init__` 里做重活**，MP 用 `init_plugin(config)` 注入配置。
- `get_form` 必须返回 `(list, dict)` 两元组；Vue 联邦下返回 `([], self._default_config())`。
- `get_state` 决定插件是否启用（影响侧栏、API 注册、事件监听是否生效）。

---

## 2. 配置模式（get_form / 读取 / 保存）

### 2.1 表单：Vuetify JSON（VForm 协议）

MP 前端用 `component: 'VForm'` 渲染配置页，配置项用 `model` 绑定字段名：

```python
def get_form(self):
    return [{
        'component': 'VForm',
        'content': [
            {'component': 'VRow', 'content': [
                {'component': 'VCol', 'props': {'cols': 12, 'md': 6}, 'content': [
                    {'component': 'VSwitch', 'props': {'model': 'enabled', 'label': '启用插件'}}
                ]}
            ]},
            {'component': 'VRow', 'content': [
                {'component': 'VCol', 'props': {'cols': 12}, 'content': [
                    {'component': 'VTextField', 'props': {'model': 'cron', 'label': '执行周期', 'placeholder': '0 0 * * *'}}
                ]}
            ]},
        ]
    }], {
        'enabled': False,
        'cron': '0 0 * * *',
    }
```

支持组件：`VSwitch / VTextField / VSelect / VTextarea / VSlider / VCombobox / VCard / VTabs` 等。
`VSelect` 的 `items` 可由后端动态生成（如 `MediaServerHelper().get_configs()`）。

### 2.2 读取：兼容旧字段、防御 None

```python
self._cron = config.get("cron") or "0 0 * * *"
self._enabled = self._get_enabled(config)
```

### 2.3 保存：用 MP 注入的 `update_config`

插件配置保存走 MP 框架（前端 Vue 用 `emit('save', {...})` 或传统表单自动保存）。后端如需主动写：

```python
from app.helper.plugin import PluginHelper
PluginHelper().update_config(self.__class__.__name__, {"enabled": True, ...})
```

### 2.4 敏感字段

密码、Cookie、Token 不要明文出现在 `get_form` label 以外的地方；如必须，使用 `VTextField` 的 `type: 'password'` 并避免写日志。

---

## 3. API 模式（get_api）

### 3.1 路由声明

```python
def get_api(self):
    return [
        {
            "path": "/signin_by_domain",
            "endpoint": self.signin_by_domain,
            "methods": ["GET"],
            "summary": "按域名签到",
            "description": "刷新对应域名的站点数据",
        },
        {
            "path": "/tasks/{task_id}",
            "endpoint": self.task_detail,
            "methods": ["GET", "PUT", "DELETE"],
            "summary": "任务详情",
        },
    ]
```

- `path` 相对 `/api/v1/plugin/{PluginId}`；
- `endpoint` 必须是 `self.xxx` 可调用方法；
- 支持路径参数 `{task_id}`，处理方法用 `task_id: str` 接收。

### 3.2 处理器签名与返回

```python
def signin_by_domain(self, domain: str = None) -> schemas.Response:
    try:
        if not domain:
            return schemas.Response(success=False, message="缺少 domain 参数")
        result = self._do_signin(domain)
        return schemas.Response(success=True, data=result)
    except Exception as e:
        logger.exception(f"签到失败: {e}")   # 必须 logger.exception 打 traceback
        return schemas.Response(success=False, message=f"签到失败: {str(e)}")
```

统一约定：
- 成功：`schemas.Response(success=True, data=...)`
- 失败：`schemas.Response(success=False, message=...)`
- 异常：`logger.exception(...)` 后返回失败响应（**不要只 `logger.error`**，否则 MP 日志无 traceback）。

> 前端请求路径：`/api/v1/plugin/{PluginId}/signin_by_domain?domain=xxx`
> Vue 联邦组件优先用注入的 `props.api`，fallback 用 `axios`。

---

## 4. 定时任务模式（get_service + scheduler）

两种方式：

### 方式 A：自带 `BackgroundScheduler`（autosignin / cloudlinkmonitor 风格）

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

def init_plugin(self, config=None):
    ...
    self._scheduler = BackgroundScheduler(timezone=settings.TZ)
    self._scheduler.add_job(func=self._tick, trigger='interval', seconds=300)
    self._scheduler.add_job(func=self._daily, trigger=CronTrigger.from_crontab(self._cron))
    if self._scheduler.get_jobs():
        self._scheduler.start()

def stop_service(self):
    if self._scheduler:
        self._scheduler.remove_all_jobs()
        if self._scheduler.running:
            self._scheduler.shutdown()
        self._scheduler = None
```

### 方式 B：交给 MP 调度（brushflow 风格，`get_service` 声明作业）

```python
from app.scheduler import Scheduler

def get_service(self) -> List[Dict[str, Any]]:
    if not self._enabled:
        return []
    return [{
        "id": f"{self.__class__.__name__}|task1",
        "name": "刷流任务1",
        "trigger": CronTrigger.from_crontab(self._cron) if self._cron else "interval",
        "func": self._run_task,
        "kwargs": {"task_id": "task1"},
    }]

def stop_service(self):
    # MP 在插件停止时会自动移除 get_service 声明的作业，这里无需手动 shutdown
    pass
```

- 方式 A 自己管理生命周期，务必在 `stop_service` 清理；
- 方式 B 由 MP `Scheduler` 统一管理，刷新作业调用 `Scheduler().update_or_refresh` 即可；
- 防重复：作业 `id` 唯一；重载插件时先 `remove_all_jobs` 再重建。

---

## 5. 事件监听模式（eventmanager）

```python
@eventmanager.register(EventType.TransferComplete)
def on_transfer(self, event: Event):
    if not self._enabled:
        return
    event_info: dict = event.event_data
    if not event_info:
        return
    transferinfo = event_info.get("transferinfo")   # 类型化对象
    if not transferinfo or not transferinfo.target_diritem:
        return
    path = Path(transferinfo.target_diritem.path)
    # ... 业务逻辑
```

常用事件：`TransferComplete`（入库完成）、`DownloadAdded`（下载添加）、`SiteRefreshed`、`SiteDeleted`、`PluginAction`（命令/动作）、`PluginReload`、`SubscribeAdded`（订阅添加）。

- 装饰器直接加在方法上，`@eventmanager.register(EventType.XXX)`；
- 回调签名 `def handler(self, event: Event)`；
- 数据在 `event.event_data`（dict），可含类型化对象（如 `TransferInfo`、`MediaInfo`）；
- 先判 `self._enabled` 与 `event_data` 空值，避免无效执行。

---

## 6. 外部系统交互模式

| 交互对象 | 推荐 Helper | 示例 |
|---------|------------|------|
| 站点信息/签到 | `SitesHelper()`、`SiteChain` | `SitesHelper().get_indexer(domain)` |
| 媒体服务器 | `MediaServerHelper()` | `MediaServerHelper().get_services(name_filters=...)` |
| 下载器 | `DownloaderHelper()` | `DownloaderHelper().get_service(name=...)` |
| 媒体识别 | `MediaInfo`、`MediaBean` | 事件里取 `event_info.get("mediainfo")` |
| 文件系统 | `pathlib.Path`、`os`、`watchdog` | `Path(x).exists()`；`FileSystemEventHandler` |
| 数据库 | `app.db` 的 `XXXOper` | `SiteOper().xxx()` |
| 网络请求 | `requests` / `httpx` | 站点签到 HTTP 调用 |

要点：
- 优先用 MP 内置 Helper，不要重复造轮子；
- 文件系统操作做好存在性/权限判断与防抖动（如入库刷新加 `debounce`）；
- `watchdog` 监听目录时，`FileSystemEventHandler` 子类 + `Observer`，停止时 `observer.stop()`。

---

## 7. 10 个插件学习要点速查

| 插件 | 仓库 | 重点模式 |
|------|------|---------|
| SiteStatistic | jxxghp | 仪表盘数据、站点统计、事件 `SiteRefreshed` |
| AutoSignIn | thsrite | 站点 Cookie 签到、随机调度、`logger.error` 反例 |
| BrushFlow | jxxghp | 多任务独立调度、`get_service` 声明、下载器控制、`get_render_mode` |
| RssSubscribe | jxxghp | RSS 拉取、媒体识别、订阅/下载链路 |
| MediaServerRefresh | jxxghp | `TransferComplete` 事件、`MediaServerHelper` 刷新、防抖 |
| CloudLinkMonitor（替 LinkMonitor） | thsrite | `watchdog` 目录监听、`BackgroundScheduler` interval/cron |
| DownloadSiteTag | jxxghp | `DownloadAdded` 事件、下载器任务标签/分类 |
| PluginReInstall | thsrite | 插件重装/重载、`register_plugin_api`、调试辅助 |
| CloudStrm（cloudstrmcompanion） | thsrite | 云盘 STRM、路径映射、任务调度、文件扫描 |
| SubscribeGroup | thsrite | `SubscribeAdded`/`DownloadAdded` 事件、订阅规则组合 |

> 详见 `PLUGIN_STUDY_NOTES.md`（10 个插件结构化笔记）。
