# MoviePilot V2 插件开发技能（SKILL）

> 开发侧 AI 插件开发/排障技能。你通常不能直接访问 MP 运行环境，必须区分
> **开发侧离线自检** 与 **运行侧安装后验证**。

---

## 何时使用本技能
- 开发/修改 MoviePilot V2 插件（后端 `_PluginBase`、前端 Vue 联邦）
- 排障：插件不显示、配置页空白、页面入口缺失、接口 500、定时任务不跑、事件不触发
- 涉及下载器/站点/媒体库交互、文件系统、Vue 联邦组件、配置/侧栏/详情页

---

## 核心原则（红线）
1. **区分环境**：不声称在 MP 机器验证过，除非看到真实日志/页面。
2. **每次改完递增版本**：`plugin_version` 与 `package.v2.json` version 同步，否则缓存旧资源。
3. **改 Vue 必须构建**：`npm install && npm run build`，否则 `remoteEntry.js` 不更新。
4. **异常用 `logger.exception`**：运行侧才能看到 traceback，只 `logger.error` 会吞堆栈。
5. **防御 None**：访问嵌套属性用 `getattr(x, "y", None)` 链式取值。
6. **前端并发用 `Promise.allSettled`**：非核心接口失败不阻断主页面。
7. **统一响应**：API 返回 `schemas.Response(success=..., data/message=...)`。

---

## 标准工作流（每次任务）

### Step 1 归类问题
安装/元数据 → 后端导入 → get_form → Vue 联邦 → get_page/侧栏 → get_api/500 → 定时任务 → 事件 → 外部交互 → 文件权限 → 浏览器缓存

### Step 2 静态检查
```bash
ls plugins.v2/<p>/__init__.py plugins.v2/<p>/package.v2.json
grep plugin_version plugins.v2/<p>/__init__.py
grep '"version"' plugins.v2/<p>/package.v2.json
grep -n "def get_render_mode\|def get_form\|def get_page\|def get_api\|def init_plugin\|def get_state\|def stop_service" plugins.v2/<p>/__init__.py
grep -n "exposes" plugins.v2/<p>/frontend/vite.config.js
```

### Step 3 离线编译
```bash
python3 -m py_compile plugins.v2/<p>/__init__.py
python3 -m py_compile plugins.v2/<p>/*.py
cd plugins.v2/<p>/frontend && npm install && npm run build
ls -la ../dist/assets/remoteEntry.js
grep -o '"\./[^"]*"' ../dist/assets/remoteEntry.js | sort -u
```

### Step 4 给运行侧验证步骤
重新安装/更新 → 重载插件 → 硬刷新；要日志 traceback + 控制台 + Network 失败响应。

---

## 关键模式速查

### 类骨架
```python
from app.plugins import _PluginBase
from app.log import logger
from app import schemas

class XxxPlugin(_PluginBase):
    plugin_name = "..."; plugin_desc = "..."; plugin_icon = "mdi-..."
    plugin_version = "1.0.0"; plugin_author = "..."; plugin_config_prefix = "xxx_"
    _enabled = False; _scheduler = None

    def init_plugin(self, config=None):
        self._enabled = self._get_enabled(config)
    def stop_service(self): ...
    def get_state(self): return self._enabled
    def get_form(self): return [], {}
    def get_page(self): return []
    def get_api(self): return []
```

### API 路由 + 处理器
```python
def get_api(self):
    return [{"path":"/stats","endpoint":self.stats,"methods":["GET"],"summary":"统计"}]

def stats(self, domain: str = None) -> schemas.Response:
    try:
        return schemas.Response(success=True, data=...)
    except Exception as e:
        logger.exception(f"stats失败: {e}")
        return schemas.Response(success=False, message=f"stats失败: {str(e)}")
```

### Vue 请求封装（props.api 优先）
```js
const requestGet = async (p, o={}) => props.api?.get
  ? await props.api.get(`plugin/${ID}${p}`, o)
  : (await axios.get(`/api/v1/plugin/${ID}${p}`, o)).data
```

### 事件监听
```python
@eventmanager.register(EventType.TransferComplete)
def on_event(self, event: Event):
    if not self._enabled: return
    info = event.event_data
    ...
```

---

## 交付物（本目录）
- `MOVIEPILOT_PLUGIN_PATTERNS.md` — 通用模式总览
- `PLUGIN_FRONTEND_FEDERATION_GUIDE.md` — Vue 联邦/Config/Page/AppPage/vite/remoteEntry/缓存
- `PLUGIN_API_GUIDE.md` — get_api/schemas.Response/异常/请求封装
- `PLUGIN_DEBUG_CHECKLIST.md` — 离线自检 + 运行侧验证流程
- `DANMUCUSTOM_LESSONS.md` — 本次调试经验
- `PLUGIN_STUDY_NOTES.md` — 10 插件结构化笔记
- `PLUGIN_TEMPLATE_MINIMAL/` — 最小可运行后端插件
- `PLUGIN_TEMPLATE_WITH_FRONTEND/` — 带 Vue Config/Page/API
- `PLUGIN_TEMPLATE_SCHEDULER_EVENT/` — 带定时任务 + 事件监听
