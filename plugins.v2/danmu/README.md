# 弹幕刮削 - 内容过滤增强版 v3.0

原始插件来源: [HankunYu/MoviePilot-Plugins](https://github.com/HankunYu/MoviePilot-Plugins) v1.9.0

## 版本历史

- **v3.0.0** - 集成七阶段弹幕内容过滤系统、相似弹幕屏蔽、批量分季匹配下载
- v2.0.0 - B站用户等级过滤
- v1.9.0 - 原始版本

## 核心能力

### 原始功能（全部保留）
- 弹幕刮削（弹弹play API → ASS文件）
- TMDB媒体识别匹配
- 手动番剧匹配（目录/文件级别，支持集数偏移）
- 批量刮削、多线程并发
- 自动刮削触发（传输完成后）
- 重试机制（弹幕数量不足自动重试）
- .strm流媒体文件支持
- 定时任务服务
- Vue前端配置界面

### 新增功能（v3.0 弹幕内容过滤系统）

#### 七阶段过滤流程
1. **弹幕模式屏蔽** - 可配置屏蔽顶部/底部/滚动/逆向/高级弹幕
2. **基础文本过滤** - 长度/纯符号/连续重复字符检测
3. **用户频率检测** - 同一用户短时间内大量弹幕自动限制（时间窗口/最大弹幕数可配置）
4. **短时重复检测** - 不同用户跟风刷屏检测（不扣信用分）
5. **关键词+信用评分** - 内容违规检测 + 用户信用积分制（误杀可恢复）
6. **相似弹幕过滤** - 基于编辑距离+字符集的文本相似度聚类（可配置阈值 60%~100%）
7. **同屏密度删减** - 按时间窗口智能删减（各模式保留比例可配置）

#### 可配置参数
| 参数 | 默认值 | 说明 |
|------|--------|------|
| `filter_enabled` | `true` | 是否启用过滤系统 |
| `filter_blocked_modes` | `[]` | 屏蔽的弹幕模式列表（1=滚动,4=底部,5=顶部） |
| `filter_similarity_threshold` | `0.8` | 相似弹幕阈值（0.6~1.0） |
| `filter_similarity_enabled` | `true` | 是否启用相似弹幕过滤 |
| `filter_freq_window` | `30` | 用户频率检测时间窗口（秒） |
| `filter_freq_max` | `10` | 频率检测窗口内最大弹幕数 |
| `filter_screen_max` | `15` | 同屏每窗口最大弹幕数 |
| `filter_screen_window` | `5` | 同屏密度时间窗口（秒） |
| `filter_screen_top_ratio` | `0.25` | 顶部弹幕保留比例 |
| `filter_screen_bottom_ratio` | `0.10` | 底部弹幕保留比例 |
| `filter_screen_scroll_ratio` | `0.65` | 滚动弹幕保留比例 |

#### 屏蔽库维护 API
| API 路径 | 方法 | 说明 |
|----------|------|------|
| `/filter/categories` | GET | 获取所有过滤分类及状态 |
| `/filter/keywords/add` | POST | 添加屏蔽关键词 |
| `/filter/keywords/remove` | POST | 移除关键词 |
| `/filter/keywords/query` | GET | 查询关键词所属分类 |
| `/filter/category/enable` | POST | 启用/禁用分类 |
| `/filter/category/add` | POST | 添加自定义分类 |
| `/filter/category/remove` | POST | 移除自定义分类 |
| `/filter/blocked_users` | GET | 获取屏蔽用户列表 |
| `/filter/warned_users` | GET | 获取警告用户列表 |

#### 批量分季匹配下载
- API: `/batch_season_scrape` - 扫描子文件夹，每个子文件夹独立匹配弹幕并分别下载
- 适用于动画目录下有 Season 1/Season 2/OVA 等多季子文件夹的场景
