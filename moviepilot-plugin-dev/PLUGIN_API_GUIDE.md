# MoviePilot 插件 API 开发指南

> 后端 `get_api` / 前端请求封装 / 异常处理 / schemas.Response 规范。

---

## 1. 路由注册（get_api）

```python
def get_api(self) -> List[Dict[str, Any]]:
    return [
        {
            "path": "/stats",
            "endpoint": self.stats,
            "methods": ["GET"],
            "summary": "统计信息",
        },
        {
            "path": "/category/add",
            "endpoint": self.add_category,
            "methods": ["POST"],
            "summary": "新增分类",
        },
        {
            "path": "/tasks/{task_id}",
            "endpoint": self.task_op,
            "methods": ["GET", "PUT", "DELETE"],
            "summary": "任务操作",
        },
    ]
```

- `path` 相对 `/api/v1/plugin/{PluginId}`，无需写前缀；
- `endpoint` 必须是 `self.method`；
- 支持 `{param}` 路径参数，处理方法用同名参数接收。

---

## 2. 处理器：参数从哪取

MP 把 HTTP 请求转为方法参数。常见取法：

```python
# GET 查询参数 / POST body 字段，直接作为方法参数
def stats(self, domain: str = None) -> schemas.Response:
    ...

# POST 整段 JSON body
def add_category(self, data: dict = None) -> schemas.Response:
    name = (data or {}).get("name")
    ...

# 路径参数
def task_op(self, task_id: str = None) -> schemas.Response:
    ...
```

> 若参数取不到（如 body 未解析），可兜底从 `request` 读取，但优先用签名参数。
> DanmuCustom 的 `filter_add_keyword(self, data: dict = None)` 即从 body 取 `data`。

---

## 3. 返回结构：统一 schemas.Response

```python
from app import schemas

# 成功
return schemas.Response(success=True, data={"items": [...]})

# 业务失败（已知错误）
return schemas.Response(success=False, message="分类已存在")

# 异常
try:
    ...
except Exception as e:
    logger.exception(f"xxx失败: {e}")          # ← 必须打 traceback
    return schemas.Response(success=False, message=f"xxx失败: {str(e)}")
```

前端解包：

```js
const res = await requestGet('/stats')
const payload = res?.data ?? res      // 兼容 props.api 与 axios 两种返回
if (payload?.success) {
  list.value = payload.data?.items || []
} else {
  error.value = payload?.message || '请求失败'
}
```

---

## 4. 异常处理铁律：用 logger.exception

| 做法 | 后果 |
|------|------|
| `logger.error(f"失败: {e}")` | MP 日志**只有一行**，无 traceback，排障极难 |
| `logger.exception(f"失败: {e}")` | MP 日志打印**完整堆栈**，定位根因快 |

DanmuCustom 实测：`filter_get_blocked_users` 里
`dm_filter.user_tracker._users` 在 `user_tracker` 为 `None` 时抛 `AttributeError`，
若只用 `logger.error`，运行侧只看到前端 500，无任何线索。改为 `logger.exception` 后
`tail -n 300 /config/logs/moviepilot.log` 即可看到真实堆栈。

> 反例参考：AutoSignIn 的 `get_service` 里用了 `logger.error("定时任务配置错误...")`，
> 这类配置期错误可保留 `logger.error`，但**运行期 API 异常一律 `logger.exception`**。

---

## 5. 前端请求封装（props.api 优先）

```js
const API_PLUGIN_ID = 'DemoPlugin'

const requestGet = async (path, options = {}) => {
  if (props.api?.get) return await props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)
  return res.data
}

const requestPost = async (path, data = {}, options = {}) => {
  if (props.api?.post) return await props.api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  const res = await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options)
  return res.data
}
```

- `props.api` 由 MP 注入，自带鉴权，优先使用；
- 插件**未启用**时自定义 API 可能未注册 → 配置初始化走 `props.initialConfig`，不要强依赖 `/config`。

---

## 6. 接口分类与返回约定

| 类型 | 示例 | 返回 |
|------|------|------|
| 查询 | `/stats`、`/categories` | `success=True, data=结果` |
| 操作 | `/category/add`、`/keyword/remove` | `success=True` 或 `False+message` |
| 分页 | `/list?page=1&size=20` | `data={"items":[], "total": N}` |
| 文件/流 | `/export` | 直接返回文件响应（非 schemas.Response） |

统一返回类型：所有业务接口标注 `-> schemas.Response`（不要有的标 `Dict`，有的标 `schemas.Response`）。

---

## 7. 跨插件 API（register_plugin_api）

部分插件用 `register_plugin_api(plugin_id)` 暴露接口供其它插件调用（如 PluginReInstall、
BrushFlow 在 `PluginReload` 事件里 `register_plugin_api`）。常规插件无需此机制，除非
需要被其它插件依赖。

---

## 8. 自检清单（每个 API）

- [ ] `get_api` 中 `endpoint` 指向真实存在的方法
- [ ] 方法参数名与 `path` 的 `{param}` 一致
- [ ] 返回统一 `schemas.Response`
- [ ] 所有 `except` 用 `logger.exception`
- [ ] 参数取不到时有默认值（`= None`），不崩
- [ ] 前端解包兼容 `props.api` 与 `axios` 两种结构
