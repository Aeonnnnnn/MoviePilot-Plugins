# DanmuCustom 调试经验总结（DANMUCUSTOM_LESSONS）

> 插件：DanmuCustom（MoviePilot V2 弹幕刮削/过滤定制插件）
> 版本跨度：1.9.1-custom.5 → custom.9
> 环境：开发侧（本机）无法直接访问 MP 运行环境。

---

## 一、踩过的坑（按时间线）

### 坑 1：配置按钮点了没反应
- **现象**：详情页"配置"按钮 `@click="$emit('open-config')"` 无反应。
- **根因**：MP 联邦插件不识别 `open-config` 事件。
- **修复**：`const emit = defineEmits(['switch','close','action'])` + `@click="emit('switch')"`。
- **教训**：配置按钮必须用 MP 标准 `switch` 事件。

### 坑 2：设置弹窗看不到词库配置
- **现象**：点"设置"只有 基本设置/显示参数/过滤设置/高级选项。
- **根因**：词库管理在侧栏 `AppPageFilter`，`Config.vue` 没集成。
- **修复**（方案 B）：抽公共 `FilterManager.vue`，`Config.vue` 与 `AppPageFilter.vue` 共用；`Config.vue` 新增"词库管理"页签。

### 坑 3：插件不在"我的插件"列表
- **现象**：安装后插件完全不出现。
- **根因**：`get_sidebar_nav()` 中 `return [` 下多套了一层 `{`，`SyntaxError` → 整个插件无法 import。
- **修复**：删掉多余 `{`，恢复 `section: "organize"`，语法检查通过。
- **教训**：后端语法错误会让插件彻底不加载（不是功能缺失，是加载失败）。

### 坑 4：词库管理页签显示但接口 500
- **现象**：页面加载后 `获取数据失败: Request failed with status code 500`。
- **根因**：`filter_get_blocked_users` 里
  `if dm_filter is None or not hasattr(dm_filter,'user_tracker') or not dm_filter.user_tracker._users:`
  当 `dm_filter.user_tracker` 为 `None` 时，访问 `._users` 抛 `AttributeError`。
- **修复**（防御式）：
  ```python
  user_tracker = getattr(dm_filter, "user_tracker", None) if dm_filter else None
  users = getattr(user_tracker, "_users", None) if user_tracker else None
  if not users:
      return schemas.Response(success=True, data={"blocked_users": [], "warned_users": []})
  ```
- **连带修复**：
  - `filter_get_categories` 改为**返回数组**（含 `name` 字段），不再返回 `{categories: {...}}`；
  - 9 处 filter 异常 `logger.error` → `logger.exception`（让 MP 日志有 traceback）；
  - `filter_get_stats` 同样防御 `user_tracker` 空值。

### 坑 5：一个接口失败拖垮整个页面
- **现象**：`blocked_users` 接口异常，分类词库也显示不出。
- **根因**：前端用 `Promise.all`，任一 reject 抛到 catch 显示"获取失败"。
- **修复**：改用 `Promise.allSettled`，分类失败才阻断，用户信用数据失败仅置空。

---

## 二、关键代码模式（已验证）

### 后端：安全获取嵌套属性
```python
dm_filter = get_last_filter() if get_last_filter else None
user_tracker = getattr(dm_filter, "user_tracker", None) if dm_filter else None
users = getattr(user_tracker, "_users", None) if user_tracker else None
if not users:
    return schemas.Response(success=True, data={"blocked_users": [], "warned_users": []})
```

### 后端：统一响应 + 异常
```python
def some_api(self) -> schemas.Response:
    try:
        ...
        return schemas.Response(success=True, data=result)
    except Exception as e:
        logger.exception(f"xxx失败: {e}")
        return schemas.Response(success=False, message=f"xxx失败: {str(e)}")
```

### 前端：allSettled 容错
```js
const [catR, userR] = await Promise.allSettled([
  requestGet('/filter/categories'),
  requestGet('/filter/blocked_users'),
])
if (catR.status === 'fulfilled') { /* 渲染分类 */ }
else { error.value = `获取分类失败: ${catR.reason?.message}` }
if (userR.status === 'fulfilled') { /* 赋值用户数据 */ }
else { blockedUsers.value = [] }   // 非核心，置空不阻断
```

---

## 三、根因归类（沉淀为检查清单）

1. **联邦组件/前端缓存**：只改 Vue 不构建、只构建不递增版本 → 旧资源被加载。
2. **后端导入失败**：语法错误 → 插件不出现在列表（最隐蔽，靠 `py_compile`）。
3. **接口 500**：嵌套属性 `None` 访问、未防御空值 → `AttributeError`。
4. **异常被吞**：`logger.error` 无 traceback → 运行侧只能看到前端 500。
5. **返回结构不一致**：后端返回 `{categories:{}}` 而前端当数组 → 显示异常。
6. **并发脆弱**：`Promise.all` 让非核心接口拖垮主页面。

---

## 四、后续避免方式

- 每次改动后端：`python3 -m py_compile` 必须通过（防坑 3）。
- 所有 API `except` 用 `logger.exception`（防坑 4）。
- 访问可能为 `None` 的嵌套对象，一律 `getattr(x, "y", None)` 链式防御（防坑 3/5）。
- 后端返回结构变更时，同步改前端解包逻辑，并兼容两种结构（防坑 5）。
- 前端并发用 `Promise.allSettled`，区分核心/非核心数据（防坑 6）。
- 改前端必须 `npm run build`，且递增 `plugin_version` + `package.v2.json`（防坑 1）。
- 交付时明确：重新安装 → 重载插件 → 浏览器硬刷新。
- 不声称已在 MP 运行侧验证，除非看到真实日志/页面结果。

---

## 五、版本变更记录

| 版本 | 变更 |
|------|------|
| custom.5 | AppPage 路由修复、解除封禁/重置信用分 API |
| custom.6 | 配置按钮 emit('switch')、Config 词库管理 tab、共享 FilterManager、AppPage 透传 api |
| custom.7 | 紧急修复 get_sidebar_nav 语法错误（多余 `{`） |
| custom.9 | 修复词库管理 API 500：user_tracker 空值防御 + categories 返回数组 + allSettled 容错 + logger.exception |
