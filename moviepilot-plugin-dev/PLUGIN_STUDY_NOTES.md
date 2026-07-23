# 10 个 V2 插件结构化学习笔记

> 全部位于对应仓库 `plugins.v2/` 下，继承 `from app.plugins import _PluginBase`。
> 仓库：jxxghp-MoviePilot-Plugins、thsrite-MoviePilot-Plugins（市场 monorepo，package.v2.json 集中在根）。
> LinkMonitor 无 V2 版 → 用同仓库同类型 `cloudlinkmonitor` 替代。

---

## 1. SiteStatistic（jxxghp）
- **类型**：站点数据统计 / 仪表盘
- **后端**：`class SiteStatistic(_PluginBase)`
- **API**：`get_api` 返回 `/refresh_by_domain`（GET，刷新站点数据）
- **事件**：`@eventmanager.register(EventType.SiteRefreshed)`
- **配置**：`get_form` 返回 VForm（站点选择等）
- **外部**：`SitesHelper().get_indexer(domain)`、`SiteChain`、`SiteOper`、`SiteUserData`
- **可复用**：站点统计数据组织、仪表盘数据接口、`SiteRefreshed` 事件刷新

## 2. AutoSignIn（thsrite，plugins.v2）
- **类型**：站点自动签到 / Cookie
- **后端**：`class AutoSignIn(_PluginBase)`
- **调度**：`BackgroundScheduler(timezone=settings.TZ)`，`add_job(trigger='date'/'interval')`，`get_service` 返回 cron/interval 作业；`stop_service` `remove_all_jobs`+`shutdown`
- **API**：`/signin_by_domain`（GET）；`get_command` 提供 `/site_signin` 命令
- **事件**：`PluginAction`、`SiteDeleted`
- **外部**：站点 HTTP 请求（签到），失败重试
- **注意（反例）**：`get_service` 里用 `logger.error("定时任务配置错误...")`，配置期可保留，但运行期 API 异常应 `logger.exception`
- **可复用**：随机调度 `TimerUtils.random_scheduler`、cron 解析、`signin` 重试

## 3. BrushFlow（jxxghp，plugins.v2）
- **类型**：多站点刷流 / 复杂调度 / 下载器控制
- **后端**：`class BrushFlow(_PluginBase)`；含 `BrushTaskConfig` 等数据类
- **Vue**：唯一含 `get_render_mode` 的候选（v5 用 Vue 重构工作台）
- **调度**：`from app.scheduler import Scheduler`，`get_service` 返回每个任务的 `CronTrigger.from_crontab(task.cron)` 作业
- **API**：丰富路由 `/status` `/settings` `/tasks` `/tasks/{task_id}`（GET/POST/PUT/DELETE/state/run/check/clear）
- **事件**：`PluginReload` 里 `register_plugin_api(plugin_id=self.__class__.__name__)`
- **外部**：`DownloaderHelper().get_service(name=task.downloader)`
- **可复用**：多任务独立调度、RESTful 风格 API、下载器控制、运行状态诊断

## 4. RssSubscribe（jxxghp，plugins.v2）
- **类型**：RSS 拉取 / 媒体识别 / 订阅下载
- **后端**：`class RssSubscribe(_PluginBase)`
- **API**：`/delete_history`（GET）等
- **外部**：RSS 解析、媒体识别（`MediaInfo`）、订阅/下载链路
- **可复用**：外部 RSS 数据 → MP 媒体对象转换链路

## 5. MediaServerRefresh（jxxghp，plugins.v2）
- **类型**：入库后刷新媒体库
- **后端**：`class MediaServerRefresh(_PluginBase)`
- **API**：`get_api` 为 `pass`（纯事件驱动，无自定义 API）
- **事件**：`@eventmanager.register(EventType.TransferComplete)`，回调 `def refresh(self, event: Event)`，`event_info = event.event_data`，取 `transferinfo: TransferInfo`，`transferinfo.target_diritem.path`
- **外部**：`MediaServerHelper().get_services(name_filters=self._mediaservers)`
- **细节**：刷新加 `debounce_delay` 防抖；`Path(transferinfo.target_diritem.path)`
- **可复用**：`TransferComplete` 事件解析、媒体服务器刷新、防抖

## 6. CloudLinkMonitor（thsrite，替 LinkMonitor）
- **类型**：云盘目录监听 / 硬链软链
- **后端**：`class FileMonitorHandler(FileSystemEventHandler)`（另有主插件类）
- **调度**：`BackgroundScheduler`，`add_job(trigger='interval', seconds=15)` 与 `CronTrigger.from_crontab(self._cron)`；`get_service` 返回作业；`stop_service` 清理
- **外部**：`from watchdog.events import FileSystemEventHandler`、`os`/`pathlib`、云盘 API
- **可复用**：`watchdog` 监听、文件变动防重复/防误处理、云盘路径映射

## 7. DownloadSiteTag（jxxghp，plugins.v2）
- **类型**：下载任务分类与标签
- **后端**：`class DownloadSiteTag(_PluginBase)`
- **API**：`get_api` 注册路由（标签/分类操作）
- **事件**：`@eventmanager.register(EventType.DownloadAdded)`，`def download_added(self, event: Event)`
- **外部**：下载器任务查询与修改（站点识别、标签前缀）
- **可复用**：`DownloadAdded` 事件、下载器任务标签/分类管理

## 8. PluginReInstall（thsrite，plugins.v2）
- **类型**：插件重装/重载/调试辅助
- **后端**：`class PluginReInstall(_PluginBase)`
- **API**：`get_api` 注册；含 `register_plugin_api(plugin_id)` 静态方法（`router.add_api_route(**api)`），`get_api` 也用 `self.register_plugin_api`
- **事件**：`PluginAction`
- **可复用**：**调试 DanmuCustom 最有用**——如何重装/重载插件、`register_plugin_api` 暴露接口

## 9. CloudStrm（cloudstrmcompanion，thsrite，plugins.v2）
- **类型**：云盘 STRM / 路径映射
- **后端**：`class FileMonitorHandler(...)`（主类另有），`get_api` 注册路由
- **事件**：`PluginAction`（多个，用于触发扫描/生成）
- **外部**：云盘 API、`pathlib.Path`、STRM 内容生成（`json={"path":..., "type":"add"}`）
- **可复用**：云盘路径映射、STRM 生成、任务调度、文件扫描

## 10. SubscribeGroup（thsrite，plugins.v2）
- **类型**：订阅规则自动填充 / 过滤 / 二级分类
- **后端**：`class SubscribeGroup(_PluginBase)`
- **事件**：`@eventmanager.register(EventType.SubscribeAdded)`、`DownloadAdded`
- **外部**：订阅数据结构、规则组合
- **可复用**：订阅规则组合、过滤条件、二级分类组织

---

## 跨插件规律
- 类均继承 `_PluginBase`，元信息用类属性；
- `get_api` 统一返回路由字典列表；
- 调度二选一：`BackgroundScheduler` 自管 或 `app.scheduler.Scheduler` + `get_service`；
- 事件均用 `@eventmanager.register(EventType.X)`，回调取 `event.event_data`；
- 外部交互优先用 MP Helper（`SitesHelper`/`MediaServerHelper`/`DownloaderHelper`）；
- 仅 BrushFlow 涉及 Vue 联邦，其余纯后端——Vue 联邦模式以 DanmuCustom 实战为准。
