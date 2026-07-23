"""
MoviePilot V2 插件最小可运行模板（纯后端，无前端）。

使用方式：
1. 修改类名、plugin_* 元信息、plugin_config_prefix。
2. 实现 init_plugin / stop_service / get_state / get_form / get_page / get_api。
3. py_compile 自检，打包（含 package.v2.json）分发。
"""
from typing import Dict, List, Any, Optional, Tuple

from app.plugins import _PluginBase
from app.log import logger
from app.core.event import eventmanager, Event
from app.schemas.types import EventType
from app import schemas


class DemoMinimal(_PluginBase):
    # ===== 元信息（必填）=====
    plugin_name = "演示最小插件"
    plugin_desc = "MoviePilot V2 插件最小可运行模板（纯后端）"
    plugin_icon = "mdi-puzzle-outline"
    plugin_version = "1.0.0"
    plugin_author = "you"
    plugin_config_prefix = "demo_"

    # ===== 实例状态 =====
    _enabled: bool = False
    _scheduler = None

    # ===== 生命周期 =====
    def init_plugin(self, config: dict = None) -> None:
        """MP 加载/重载时调用，解析配置、初始化服务。"""
        self._enabled = self._get_enabled(config)
        # 解析其它配置：self._xxx = config.get("xxx")

    def stop_service(self) -> None:
        """MP 停止/卸载时调用，清理资源。"""
        self._scheduler_shutdown()

    def get_state(self) -> bool:
        return self._enabled

    # ===== 配置表单（VForm JSON + 默认配置）=====
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

    # ===== 页面（无页面返回 []）=====
    def get_page(self) -> List[dict]:
        return []

    # ===== 自定义 API =====
    def get_api(self) -> List[Dict[str, Any]]:
        return [{
            "path": "/hello",
            "endpoint": self.hello,
            "methods": ["GET"],
            "summary": "示例接口",
        }]

    def hello(self, name: str = None) -> schemas.Response:
        try:
            return schemas.Response(success=True, data={"msg": f"hello {name or 'world'}"})
        except Exception as e:
            logger.exception(f"hello失败: {e}")
            return schemas.Response(success=False, message=f"hello失败: {str(e)}")

    # ===== 事件监听示例（可选）=====
    @eventmanager.register(EventType.TransferComplete)
    def on_transfer(self, event: Event):
        if not self._enabled:
            return
        info = event.event_data
        if not info:
            return
        logger.info(f"DemoMinimal 收到入库事件: {info.get('transferinfo')}")

    # ===== 工具方法 =====
    @staticmethod
    def _get_enabled(config: dict) -> bool:
        if not config:
            return False
        if "enabled" in config:
            return bool(config.get("enabled"))
        if "enable" in config:
            return bool(config.get("enable"))
        return False

    def _scheduler_shutdown(self):
        if self._scheduler:
            self._scheduler.remove_all_jobs()
            if self._scheduler.running:
                self._scheduler.shutdown()
            self._scheduler = None
