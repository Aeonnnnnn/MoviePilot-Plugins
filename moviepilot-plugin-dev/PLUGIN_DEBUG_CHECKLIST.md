# MoviePilot 插件调试检查清单

> 开发侧（你）做离线自检；运行侧（MP 机器）做安装后验证。
> 你通常**看不到** MP 日志 / 容器 / 浏览器控制台，所以严格区分两者。

---

## 一、问题归类（先判断属于哪类）

1. 安装/市场元数据（package.v2.json、plugin_version 不一致）
2. 后端导入失败（SyntaxError、ImportError → 插件不出现在"我的插件"）
3. 配置页 `get_form`（VForm JSON 渲染异常）
4. Vue 联邦组件（remoteEntry 缺失/未 expose、缓存）
5. `get_page` / 侧栏入口（返回 `[]` 导致页面不出现）
6. `get_api` / 接口 500（后端异常）
7. 定时任务（不执行 / 重复 / 不停止）
8. 事件监听（不触发 / 数据解析错）
9. 下载器/站点/媒体库交互（Helper 调用失败）
10. 文件路径/权限
11. 浏览器缓存（旧 remoteEntry / 旧插件版本）

---

## 二、开发侧静态检查（每次交付前必做）

```bash
# 1. 文件是否存在、目录结构正确
ls plugins.v2/<plugin>/__init__.py
ls plugins.v2/<plugin>/package.v2.json

# 2. 元信息一致：plugin_version == package.v2.json version
grep plugin_version plugins.v2/<plugin>/__init__.py
grep '"version"' plugins.v2/<plugin>/package.v2.json

# 3. 关键方法存在
grep -n "def get_render_mode\|def get_form\|def get_page\|def get_api\|def init_plugin\|def get_state\|def stop_service" \
  plugins.v2/<plugin>/__init__.py

# 4. Vue exposes 与 get_page/get_render_mode 一致
grep -n "exposes" plugins.v2/<plugin>/frontend/vite.config.js
```

## 三、离线编译检查（每次交付前必做）

```bash
# Python 语法
python3 -m py_compile plugins.v2/<plugin>/__init__.py
python3 -m py_compile plugins.v2/<plugin>/*.py          # 有额外 .py 时

# 更稳：AST 解析（不依赖 import 环境）
python3 - <<'PY'
import ast
from pathlib import Path
for f in Path("plugins.v2/<plugin>").glob("*.py"):
    ast.parse(f.read_text(encoding="utf-8"))
    print("OK ast:", f)
PY

# 前端构建
cd plugins.v2/<plugin>/frontend
npm install
npm run build

# remoteEntry 存在 + 暴露完整
ls -la ../dist/assets/remoteEntry.js
grep -o '"\./[^"]*"' ../dist/assets/remoteEntry.js | sort -u
```

## 四、交付说明模板（给运行侧用户）

```
已完成开发侧离线自检：
1. Python py_compile / ast 解析通过。
2. 前端 npm run build 通过，dist/assets/remoteEntry.js 已生成。
3. remoteEntry.js 暴露组件完整（./Config ./Page ./AppPage ...）。
4. 已递增插件版本到 x.y.z-custom.N。

请在 MP 机器：重新安装/更新插件 → 重载插件 → 浏览器硬刷新（Cmd+Shift+R）。
如仍异常，请提供：
1. /config/logs/moviepilot.log 相关 traceback（必须含堆栈）
2. 浏览器控制台错误
3. Network 中失败接口的响应体
```

> **红线**：没有运行侧验证证据时，不要声称"已在你的 MP 上验证正常"。

---

## 五、运行侧验证步骤（指导用户）

1. 重新安装/更新插件（市场或本地上传）；
2. 重启 MP / 重载插件（避免旧进程）；
3. 浏览器硬刷新（绕过 remoteEntry / 插件缓存）；
4. 打开"我的插件"确认插件出现（不出现=后端导入失败，看日志 SyntaxError）；
5. 打开插件配置 / 页面，复现问题；
6. 贴出日志 traceback 与 Network 失败响应。

---

## 六、常见症状 → 根因速查

| 症状 | 最可能根因 | 排查点 |
|------|-----------|--------|
| 插件不在"我的插件" | 后端导入失败 | `py_compile`；日志 SyntaxError/ImportError |
| 配置页空白 | `get_form` 返回异常 | VForm JSON 结构；`([], {})` 两元组 |
| 页面入口不出现 | `get_page` 返回 `[]` | 应返回 `{"component": "AppPage"}` |
| 组件加载失败 | exposes 缺失 / 缓存 | `grep exposes`；递增版本 + 硬刷新 |
| 接口 500 | 后端异常 | `tail` 日志看 traceback；`logger.exception` |
| 仅改 Vue 无变化 | 没构建 / 没递增版本 | `npm run build`；递增 `plugin_version` |
| 定时任务不跑 | `stop_service` 未清理 / `get_service` 未声明 | 检查 scheduler 注册 |
| 事件不触发 | 未启用 / 事件类型错 | `self._enabled` 判断；`EventType` 枚举 |

---

## 七、DanmuCustom 专项检查清单（每次改它都过一遍）

后端：
- [ ] `__init__.py` 能 `py_compile`
- [ ] `danmaku_filter.py` 能 `py_compile`
- [ ] `danmu_generator.py` 能 `py_compile`
- [ ] `_get_filter_module()` 导入正常
- [ ] `get_api()` 注册完整（含 `/filter/*`）
- [ ] `/filter/categories` 正常（返回数组）
- [ ] `/filter/blocked_users`、`/filter/warned_users` 防御 `user_tracker` 为空
- [ ] 所有 API 异常用 `logger.exception`

前端：
- [ ] `Config.vue` 含词库管理页签
- [ ] `FilterManager.vue` 请求路径正确
- [ ] 响应解包正确（兼容数组/对象）
- [ ] 并发用 `Promise.allSettled`
- [ ] 非核心接口失败不阻断主页面
- [ ] `vite.config.js` exposes 完整
- [ ] `npm run build` 成功

联邦：
- [ ] `remoteEntry.js` 存在
- [ ] 暴露 `./Config ./Page ./AppPage ./AppPageFilter ./AppPageScrape`

元数据：
- [ ] `plugin_version` 已递增
- [ ] `package.v2.json` version 已递增、history 已添加
