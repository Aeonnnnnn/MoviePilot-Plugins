"""
MoviePilot V2 插件模板（带定时任务 + 事件监听）。

两种方式二选一：
A. BackgroundScheduler 自管（init_plugin 创建，stop_service 清理）
B. app.scheduler.Scheduler + get_service 声明（MP 统一管理，推荐）

本模板演示方式 A（更直观可控）。
"""
from typing import Dict, List, Any, Optional, Tuple

from app.plugins import _PluginBase
from app.log import logger
from app.core.event import eventmanager, Event
from app.schemas.types import EventType
from app.core.config import settings
from app import schemas

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger


class DemoScheduler(_PluginBase):
    plugin_name = "演示调度事件插件"
    plugin_desc = "MoviePilot V2 插件模板（定时任务 + 事件监听）"
    plugin_icon = "mdi-clock-outline"
    plugin_version = "1.0.0"
    plugin_author = "you"
    plugin_config_prefix = "demose_"

    _enabled: bool = False
    _cron: str = "0 0 * * *"
    _scheduler = None

    def init_plugin(self, config: dict = None) -> None:
        self._enabled = self._get_enabled(config)
        self._cron = config.get("cron") or "0 0 * * *"
        self._setup_scheduler()

    def stop_service(self) -> None:
        self._scheduler_shutdown()

    def get_state(self) -> bool:
        return self._enabled

    # ===== 方式 A：自带 BackgroundScheduler =====
    def _setup_scheduler(self):
        if not self._enabled:
            return
        try:
            self._scheduler = BackgroundScheduler(timezone=settings.TZ)
            self._scheduler.add_job(
                func=self._tick,
                trigger=CronTrigger.from_crontab(self._cron),
                id=f"{self.__class__.__name__}|tick",
                replace_existing=True,
            )
            if self._scheduler.get_jobs():
                self._scheduler.start()
                logger.info(f"{self.plugin_name} 调度器已启动，周期 {self._cron}")
        except Exception as e:
            logger.exception(f"调度器启动失败: {e}")

    def _tick(self):
        if not self._enabled:
            return
        try:
            logger.info(f"{self.plugin_name} 定时任务执行")
            # 业务逻辑...
        except Exception as e:
            logger.exception(f"定时任务执行失败: {e}")

    def _scheduler_shutdown(self):
        if self._scheduler:
            try:
                self._scheduler.remove_all_jobs()
                if self._scheduler.running:
                    self._scheduler.shutdown()
            except Exception as e:
                logger.exception(f"调度器停止失败: {e}")
            self._scheduler = None

    # ===== 方式 B 备选：交给 MP Scheduler 管理（取消注释可用）=====
    # from app.scheduler import Scheduler
    # def get_service(self) -> List[Dict[str, Any]]:
    #     if not self._enabled:
    #         return []
    #     return [{
    #         "id": f"{self.__class__.__name__}|tick",
    #         "name": "演示定时任务",
    #         "trigger": CronTrigger.from_crontab(self._cron),
    #         "func": self._tick,
    #         "kwargs": {},
    #     }]

    # ===== 事件监听 =====
    @eventmanager.register(EventType.TransferComplete)
    def on_transfer(self, event: Event):
        if not self._enabled:
            return
        info = event.event_data
        if not info:
            return
        transferinfo = info.get("transferinfo")
        if not transferinfo or not transferinfo.target_diritem:
            return
        logger.info(f"收到入库事件，路径: {transferinfo.target_diritem.path}")

    @eventmanager.register(EventType.PluginAction)
    def on_action(self, event: Event):
        if not self._enabled:
            return
        info = event.event_data or {}
        if info.get("action") == "demo_run":
            self._tick()

    # ===== 配置 / 页面 / API =====
    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
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
                        {'component': 'VTextField',
                         'props': {'model': 'cron', 'label': '执行周期', 'placeholder': '0 0 * * *'}}
                    ]}
                ]},
            ]
        }], {
            'enabled': False,
            'cron': '0 0 * * *',
        }

    def get_page(self) -> List[dict]:
        return []

    def get_api(self) -> List[Dict[str, Any]]:
        return [{
            "path": "/run",
            "endpoint": self.run_now,
            "methods": ["POST"],
            "summary": "立即执行一次",
        }]

    def run_now(self) -> schemas.Response:
        try:
            self._tick()
            return schemas.Response(success=True, message="已执行")
        except Exception as e:
            logger.exception(f"执行失败: {e}")
            return schemas.Response(success=False, message=f"执行失败: {str(e)}")

    @staticmethod
    def _get_enabled(config: dict) -> bool:
        if not config:
            return False
        if "enabled" in config:
            return bool(config.get("enabled"))
        if "enable" in config:
            return bool(config.get("enable"))
        return False
