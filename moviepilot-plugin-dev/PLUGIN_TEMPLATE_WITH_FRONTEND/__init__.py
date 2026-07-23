"""
MoviePilot V2 插件模板（带 Vue 联邦前端：Config / Page / AppPage）。

关键点：
- get_render_mode 声明 vue 模式
- get_form 在 Vue 模式下返回 ([], 默认配置)
- get_page 返回组件名（与 vite exposes 一致）
- 前端通过 props.api 优先请求，axios fallback
- 改完前端必须 npm run build 并递增版本
"""
from typing import Dict, List, Any, Optional, Tuple

from app.plugins import _PluginBase
from app.log import logger
from app import schemas


class DemoFrontend(_PluginBase):
    plugin_name = "演示前端插件"
    plugin_desc = "MoviePilot V2 插件模板（Vue 联邦：Config/Page/AppPage）"
    plugin_icon = "mdi-puzzle-outline"
    plugin_version = "1.0.0"
    plugin_author = "you"
    plugin_config_prefix = "demofe_"

    _enabled: bool = False

    def init_plugin(self, config: dict = None) -> None:
        self._enabled = self._get_enabled(config)

    def stop_service(self) -> None:
        pass

    def get_state(self) -> bool:
        return self._enabled

    @staticmethod
    def get_render_mode() -> Tuple[str, Optional[str]]:
        """声明 Vue 联邦渲染模式。"""
        return "vue", "dist/assets"

    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        """Vue 模式下返回空表单 + 默认配置。"""
        return [], {
            "enabled": False,
            "message": "hello",
        }

    def get_page(self) -> List[dict]:
        """侧栏/详情页入口；component 必须与 vite exposes 的 key 对应。"""
        if not self.get_state():
            return []
        return [
            {"name": "演示主页", "component": "AppPage"},
        ]

    def get_api(self) -> List[Dict[str, Any]]:
        return [{
            "path": "/message",
            "endpoint": self.get_message,
            "methods": ["GET"],
            "summary": "获取配置消息",
        }]

    def get_message(self) -> schemas.Response:
        try:
            # 实际应从 self._config 读取；此处示例
            return schemas.Response(success=True, data={"message": "hello"})
        except Exception as e:
            logger.exception(f"获取消息失败: {e}")
            return schemas.Response(success=False, message=f"获取消息失败: {str(e)}")

    @staticmethod
    def _get_enabled(config: dict) -> bool:
        if not config:
            return False
        if "enabled" in config:
            return bool(config.get("enabled"))
        if "enable" in config:
            return bool(config.get("enable"))
        return False
