"""
弹幕内容过滤系统 - 核心模块 v2

优化点：
1. 关键词库精炼 - 移除B站已处理类别（色情/辱骂），专注低质量弹幕，修复单字误杀
2. 规则匹配引擎 - 组合条件匹配（关键词+长度/模式），替代裸关键词
3. 用户信用评分系统 - 积分制替代二元屏蔽，违规扣分/正常加分，误杀可恢复

核心功能：
1. 关键词屏蔽库（可查询可维护，支持持久化）
2. 规则匹配引擎（关键词+条件组合）
3. 用户信用评分（积分制，误杀可恢复）
4. 同屏弹幕智能删减（按质量比例保留，参数可配置）
5. 弹幕模式屏蔽（顶部/底部/滚动/逆向/高级可配置开关）
6. 用户维度屏蔽（发送频率阈值可配置）
7. 弹幕长度/重复度基础过滤
8. 弹幕模式/颜色质量加权

设计原则：
- 仅屏蔽低质量弹幕（不重复B站已有的内容审核）
- 无需 B 站登录
- 所有规则可配置、可查询、可维护、可持久化
"""
import re
import time
import copy
from collections import defaultdict, Counter
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple
from enum import Enum


# ============================================================
# 违规严重等级
# ============================================================

class ViolationLevel(Enum):
    """违规严重等级——仅用于低质量弹幕场景"""
    TRIVIAL = 1    # 轻微：疑似刷屏但不确定（如短弹幕含「第」）
    MINOR = 2      # 轻度：明确的纯符号、连续重复
    MODERATE = 3   # 中度：明确的无意义打卡、纯情绪刷屏


# ============================================================
# 一、关键词屏蔽库 + 规则匹配引擎
# ============================================================

class KeywordBlocklist:
    """
    低质量弹幕关键词屏蔽库 + 规则匹配引擎
    
    设计原则：
    - 仅屏蔽低质量弹幕（B站已处理色情/辱骂/政治等红线内容，不重复造轮子）
    - 关键词 + 条件组合匹配，避免单字误杀
    - 每种分类独立开关
    - 支持精确匹配、正则匹配、组合条件匹配
    - 支持持久化：用户自定义关键词/规则可保存和恢复
    """
    
    # ---- 内置默认分类（4大类） ----
    CATEGORIES = {
        "刷屏打卡": {
            "desc": "无信息量的刷屏、打卡、签到类弹幕",
            "enabled": True,
            # 精确关键词（高置信度，直接命中即屏蔽）
            "keywords": [
                "打卡", "签到", "到此一游", "来了来了",
                "留名", "合影", "抢前排", "沙发", "板凳", "地板",
                "报道", "报到", "承包了", "我承包", "承包此",
                "空降成功", "空降失败", "计数君",
                "第一!", "第一！",
            ],
            # 组合规则：关键词 + 条件（长度限制），解决单字误杀
            "combo_rules": [
                # (关键词, 弹幕长度≤N) → 才判定为刷屏
                ("前排", 4),      # "前排" 短弹幕→刷屏；"前排提醒xxx"→保留
                ("第一", 5),      # "第一" 短弹幕→刷屏；"第一季的剧情"→保留
                ("第", 3),        # 仅"第一"/"第二季"这种极短弹幕命中
                ("首", 3),        # 同上
                ("承包", 6),      # "承包" 短弹幕→刷屏；"承包了xxx" 已被精确命中
                ("空降", 5),      # "空降" 短弹幕→刷屏；"空降指挥部" 正常
                ("指挥部", 4),    # "指挥部" 短弹幕→刷屏
                ("来了", 5),      # "来了"→刷屏；"终于来了"→保留（长度>5不命中）
                ("有人吗", 5),    # 极短询问
                ("还有人吗", 6),
                ("在看的", 5),
                ("来啦", 4),
            ],
            # 正则规则：(正则字符串, ViolationLevel)
            "regex": [
                # 纯日期打卡："2025.1.1"、"2025/01/01"、"2025年1月1日"
                (r"^(20[2-9]\d)[年/\-\.]?\s*(0?[1-9]|1[0-2])[月/\-\.]?\s*(0?[1-9]|[12]\d|3[01])[日号]?$",
                 ViolationLevel.MODERATE),
                # 带日期+打卡词
                (r"^(打卡|签到|留名).*(20[2-9]\d)", ViolationLevel.MODERATE),
            ],
        },
        "纯情绪刷屏": {
            "desc": "纯情绪表达，无实质内容的刷屏",
            "enabled": True,
            "keywords": [
                "笑死我了", "笑死了", "笑死啦",
                "卧槽卧槽", "握草",
            ],
            "combo_rules": [
                # "哈哈哈哈" + 短弹幕(≤8字) → 纯刷屏
                # 但"哈哈哈哈笑死我了这片段" → 保留（长度>8）
                ("哈哈哈哈", 8),
                ("哈哈哈哈哈", 8),
                ("哈哈哈哈哈哈", 8),
                ("23333", 8),       # 短233
                ("233333", 8),
                ("wwww", 8),        # 短www
                ("hhhh", 8),        # 短hhh
                ("草草草", 8),      # 连续草
                ("草草草草", 8),
                ("啊啊啊", 8),      # 短啊啊
                ("啊啊啊啊", 8),
                ("呜呜呜", 8),
                ("呀呀呀", 8),
            ],
            "regex": [
                (r"^[哈]{5,}$", ViolationLevel.MINOR),
                (r"^[啊]{4,}$", ViolationLevel.MINOR),
                (r"^[呀]{4,}$", ViolationLevel.MINOR),
                (r"^[呜]{4,}$", ViolationLevel.MINOR),
            ],
        },
        "无意义刷屏": {
            "desc": "完全无意义的内容灌水",
            "enabled": True,
            "keywords": [
                "11111", "1111", "111",
                "22222", "2222", "222",
                "dddd", "dddddd",
            ],
            "combo_rules": [
                # 短弹幕中的纯符号
                ("？？？", 6),
                ("？？？？", 6),
                ("！！！", 6),
                ("！！！！", 6),
                ("。。。", 6),
                ("。。。。", 6),
            ],
            "regex": [
                (r"^[1]{3,}$", ViolationLevel.MINOR),
                (r"^[2]{3,}$", ViolationLevel.MINOR),
                (r"^[\?？]{3,}$", ViolationLevel.MINOR),
                (r"^[！!]{3,}$", ViolationLevel.MINOR),
                (r"^[。.]{3,}$", ViolationLevel.MINOR),
                (r"^[dD]{3,}$", ViolationLevel.MINOR),
                (r"^[6]{3,}$", ViolationLevel.MINOR),
                (r"^[9]{3,}$", ViolationLevel.MINOR),
            ],
        },
        "低质弹幕互动": {
            "desc": "对弹幕本身的低质量互动，非对内容的讨论",
            "enabled": True,
            "keywords": [
                "前面的等等", "红色弹幕", "黄色弹幕", "蓝色弹幕", "绿色弹幕", "白色弹幕",
                "同款弹幕", "同款颜色", "挡字幕", "挡脸", "挡到了", "别挡",
                "野生字幕", "空耳君", "空耳字幕",
            ],
            "combo_rules": [
                # "前面的" + 短弹幕(≤6字) → 弹幕互动；"前面的剧情提到" → 保留
                ("前面的", 6),
                ("前面那个", 6),
                ("后面的", 5),
                ("谁说的", 5),
                ("谁发的", 5),
                ("同款", 5),
                ("空耳", 5),
                ("字幕组", 5),
            ],
            "regex": [],
        },
    }
    
    # 白名单：即使匹配黑名单也保留（高价值内容）
    WHITELIST_KEYWORDS: List[str] = []
    
    # ---- 持久化支持 ----
    # 用户自定义的额外分类数据，与内置 CATEGORIES 合并使用
    _user_categories: Dict = {}
    
    @classmethod
    def get_effective_categories(cls) -> Dict:
        """获取生效的分类（内置 + 用户自定义合并）"""
        # 深拷贝内置分类，避免修改原始数据
        result = copy.deepcopy(cls.CATEGORIES)
        # 合并用户自定义分类
        for cat_name, cat_info in cls._user_categories.items():
            if cat_name in result:
                # 已存在的分类：合并 keywords/combo_rules/regex
                existing = result[cat_name]
                for key in ("keywords", "combo_rules", "regex"):
                    if key in cat_info:
                        existing.setdefault(key, [])
                        existing[key].extend(cat_info[key])
                if "enabled" in cat_info:
                    existing["enabled"] = cat_info["enabled"]
            else:
                # 新分类：直接添加
                result[cat_name] = copy.deepcopy(cat_info)
        return result
    
    @classmethod
    def get_categories(cls) -> Dict:
        """获取所有屏蔽分类及其状态摘要"""
        effective = cls.get_effective_categories()
        return {name: {
            "desc": info["desc"],
            "enabled": info["enabled"],
            "keyword_count": len(info.get("keywords", [])),
            "combo_count": len(info.get("combo_rules", [])),
            "regex_count": len(info.get("regex", [])),
            "is_builtin": name in cls.CATEGORIES,
        } for name, info in effective.items()}
    
    @classmethod
    def is_blocked(cls, text: str, enabled_categories: Optional[Set[str]] = None) -> Tuple[bool, str, int]:
        """
        检查弹幕是否应被屏蔽
        
        Args:
            text: 弹幕内容
            enabled_categories: 启用的分类集合，None表示使用默认配置
        
        Returns:
            (是否屏蔽, 命中原因, 违规等级1-3)
        """
        if not text or not text.strip():
            return True, "空弹幕", ViolationLevel.MINOR.value
        
        text_len = len(text)
        categories = cls.get_effective_categories()
        
        # 白名单检查
        for kw in cls.WHITELIST_KEYWORDS:
            if kw in text:
                return False, "", 0
        
        # 确定启用的分类
        if enabled_categories is None:
            enabled_categories = {name for name, info in categories.items() if info.get("enabled", True)}
        
        for cat_name in enabled_categories:
            if cat_name not in categories:
                continue
            info = categories[cat_name]
            
            # 1) 精确关键词匹配（高置信度）
            for kw in info.get("keywords", []):
                if kw in text:
                    return True, f"{cat_name}: 命中「{kw}」", ViolationLevel.MODERATE.value
            
            # 2) 组合规则：关键词 + 长度限制
            for rule in info.get("combo_rules", []):
                if len(rule) < 2:
                    continue
                kw, max_len = rule[0], rule[1]
                if kw in text and text_len <= max_len:
                    return True, f"{cat_name}: 短弹幕含「{kw}」(≤{max_len}字)", ViolationLevel.TRIVIAL.value
            
            # 3) 正则匹配
            for rule in info.get("regex", []):
                if len(rule) < 2:
                    continue
                pattern, level = rule[0], rule[1]
                if isinstance(level, ViolationLevel):
                    level = level.value
                if re.search(pattern, text):
                    return True, f"{cat_name}: 命中正则", level
        
        return False, "", 0
    
    # ---- 维护方法 ----
    
    @classmethod
    def add_keyword(cls, category: str, keyword: str) -> bool:
        """向指定分类添加精确关键词（优先添加到内置分类）"""
        categories = cls.get_effective_categories()
        if category not in categories:
            return False
        if category in cls.CATEGORIES:
            if keyword not in cls.CATEGORIES[category].setdefault("keywords", []):
                cls.CATEGORIES[category]["keywords"].append(keyword)
        else:
            if keyword not in cls._user_categories.setdefault(category, {}).setdefault("keywords", []):
                cls._user_categories[category].setdefault("keywords", []).append(keyword)
        return True
    
    @classmethod
    def add_combo_rule(cls, category: str, keyword: str, max_length: int) -> bool:
        """向指定分类添加组合规则"""
        categories = cls.get_effective_categories()
        if category not in categories:
            return False
        rule = (keyword, max_length)
        if category in cls.CATEGORIES:
            cls.CATEGORIES[category].setdefault("combo_rules", [])
            cls.CATEGORIES[category]["combo_rules"].append(rule)
        else:
            cls._user_categories.setdefault(category, {}).setdefault("combo_rules", []).append(rule)
        return True
    
    @classmethod
    def add_regex_rule(cls, category: str, pattern: str, level: int = 2) -> bool:
        """向指定分类添加正则规则"""
        categories = cls.get_effective_categories()
        if category not in categories:
            return False
        rule = (pattern, level)
        if category in cls.CATEGORIES:
            cls.CATEGORIES[category].setdefault("regex", [])
            cls.CATEGORIES[category]["regex"].append(rule)
        else:
            cls._user_categories.setdefault(category, {}).setdefault("regex", []).append(rule)
        return True
    
    @classmethod
    def remove_keyword(cls, category: str, keyword: str) -> bool:
        """从指定分类移除关键词或规则"""
        # 先从内置分类移除
        if category in cls.CATEGORIES:
            info = cls.CATEGORIES[category]
            if keyword in info.get("keywords", []):
                info["keywords"].remove(keyword)
                return True
            info["combo_rules"] = [(k, l) for k, l in info.get("combo_rules", []) if k != keyword]
            return True
        # 再从用户分类移除
        if category in cls._user_categories:
            info = cls._user_categories[category]
            if keyword in info.get("keywords", []):
                info["keywords"].remove(keyword)
                return True
            info["combo_rules"] = [(k, l) for k, l in info.get("combo_rules", []) if k != keyword]
            return True
        return False
    
    @classmethod
    def set_category_enabled(cls, category: str, enabled: bool) -> bool:
        """启用/禁用某个分类"""
        if category in cls.CATEGORIES:
            cls.CATEGORIES[category]["enabled"] = enabled
            return True
        if category in cls._user_categories:
            cls._user_categories[category]["enabled"] = enabled
            return True
        return False
    
    @classmethod
    def add_category(cls, name: str, desc: str = "") -> bool:
        """添加新分类（仅支持用户分类）"""
        if name in cls.CATEGORIES or name in cls._user_categories:
            return False
        cls._user_categories[name] = {
            "desc": desc or name,
            "enabled": True,
            "keywords": [],
            "combo_rules": [],
            "regex": [],
        }
        return True
    
    @classmethod
    def remove_category(cls, name: str) -> bool:
        """移除用户自定义分类（不可移除内置分类）"""
        if name in cls.CATEGORIES:
            return False  # 内置分类不可移除
        if name in cls._user_categories:
            del cls._user_categories[name]
            return True
        return False
    
    @classmethod
    def query_keywords(cls, keyword: str) -> List[Dict]:
        """查询关键词在哪些分类中"""
        results = []
        categories = cls.get_effective_categories()
        for cat_name, info in categories.items():
            for kw in info.get("keywords", []):
                if keyword in kw or kw in keyword:
                    results.append({"category": cat_name, "keyword": kw, "type": "精确", "enabled": info["enabled"]})
            for kw, ml in info.get("combo_rules", []):
                if keyword in kw or kw in keyword:
                    results.append({"category": cat_name, "keyword": kw, "type": f"组合(≤{ml}字)", "enabled": info["enabled"]})
            for rule in info.get("regex", []):
                if len(rule) >= 2 and keyword in rule[0]:
                    results.append({"category": cat_name, "keyword": rule[0], "type": "正则", "enabled": info["enabled"]})
        return results
    
    @classmethod
    def export_config(cls) -> Dict:
        """导出当前完整配置（用于持久化）"""
        return {
            "categories": cls.get_categories(),
            "user_categories": cls._user_categories,
            "whitelist": cls.WHITELIST_KEYWORDS,
        }
    
    @classmethod
    def import_config(cls, config: Dict):
        """导入配置（从持久化恢复）"""
        if "user_categories" in config:
            cls._user_categories = config["user_categories"]
        if "whitelist" in config:
            cls.WHITELIST_KEYWORDS = config["whitelist"]
        # 恢复内置分类的 enabled 状态
        if "categories" in config:
            for cat_name, cat_info in config["categories"].items():
                if cat_name in cls.CATEGORIES and "enabled" in cat_info:
                    cls.CATEGORIES[cat_name]["enabled"] = cat_info["enabled"]
    
    @classmethod
    def print_status(cls):
        """打印屏蔽库状态"""
        print("\n关键词屏蔽库状态")
        print("=" * 60)
        for name, info in cls.get_categories().items():
            status = "启用" if info["enabled"] else "禁用"
            builtin = "内置" if info.get("is_builtin") else "自定义"
            print(f"  [{status}] [{builtin}] {name}: {info['keyword_count']}精确 + {info['combo_count']}组合 + {info['regex_count']}正则")
            print(f"         {info['desc']}")


# ============================================================
# 二、用户信用评分系统
# ============================================================

@dataclass
class UserRecord:
    """单个用户的弹幕记录 + 信用评分"""
    mid_hash: str
    credit_score: int = 100              # 信用分 0-100，初始100
    total_danmaku: int = 0
    violation_count: int = 0             # 累计违规次数
    violation_reasons: List[str] = field(default_factory=list)
    sample_contents: List[str] = field(default_factory=list)
    first_seen: float = 0.0
    last_seen: float = 0.0
    
    # 屏蔽状态（信用分过低时触发）
    is_blocked: bool = False
    blocked_at: float = 0.0
    
    # 误杀恢复：连续正常弹幕可恢复分数
    consecutive_good: int = 0            # 连续正常弹幕计数
    good_since_blocked: int = 0          # 被屏蔽后的正常弹幕计数（冷却用）
    last_violation_at: float = 0.0       # 最后一次违规时间
    
    # 频率检测（新增）
    timestamps: List[float] = field(default_factory=list)  # 弹幕发送时间列表


class CreditScoreConfig:
    """
    信用评分配置 - 短平快设计
    
    设计理念：
    - 同一个视频/番剧里同一用户弹幕极少（通常1-5条），不需要长周期恢复
    - 追求快速屏蔽、快速恢复，避免误杀
    - 屏蔽门槛低、恢复门槛也低
    """
    INITIAL_SCORE = 100
    BLOCK_THRESHOLD = 40       # 信用分 ≤ 40 进入屏蔽池
    RECOVER_THRESHOLD = 50     # 信用分恢复到 ≥ 50 移出屏蔽池
    
    # 扣分规则（按违规等级）
    PENALTY = {
        ViolationLevel.TRIVIAL.value: 10,     # 轻微违规 -10
        ViolationLevel.MINOR.value: 20,        # 轻度违规 -20
        ViolationLevel.MODERATE.value: 40,     # 中度违规 -40
    }
    
    # 恢复规则
    GOOD_BONUS = 5              # 每条正常弹幕 +5 分
    CONSECUTIVE_BONUS = 5       # 连续正常≥3条后，每条额外 +5
    RECOVER_COOLDOWN = 3        # 被屏蔽后至少再发 3 条正常弹幕即可恢复
    MAX_SCORE = 100
    MIN_SCORE = 0


class UserTracker:
    """
    用户信用评分追踪器
    
    核心理念：
    - 积分制替代二元屏蔽：违规扣分，正常加分
    - 误杀恢复：连续发正常弹幕可恢复信用分，自动跳出屏蔽池
    - 冷却机制：屏蔽后有恢复冷却期，防止反复进出
    - midHash 作为唯一标识（B站UID的CRC32哈希）
    - 支持频率检测：同一用户短时间内大量弹幕触发降权
    """
    
    def __init__(
        self,
        config: Optional[CreditScoreConfig] = None,
        max_sample_store: int = 10,
        # 频率检测参数（可配置）
        freq_window_seconds: float = 30.0,   # 频率检测时间窗口
        freq_max_count: int = 10,             # 窗口内最大弹幕数
    ):
        self.config = config or CreditScoreConfig()
        self.max_sample_store = max_sample_store
        self._users: Dict[str, UserRecord] = {}
        # 频率检测配置
        self.freq_window_seconds = freq_window_seconds
        self.freq_max_count = freq_max_count
    
    def record(self, mid_hash: str, content: str, 
               is_violation: bool = False, violation_level: int = 0, reason: str = ""):
        """
        记录一条弹幕并更新信用分
        
        Args:
            mid_hash: 用户标识
            content: 弹幕内容
            is_violation: 是否违规
            violation_level: 违规等级 1-3（仅违规时有效）
            reason: 违规原因
        """
        if not mid_hash:
            return
        
        now = time.time()
        
        if mid_hash not in self._users:
            self._users[mid_hash] = UserRecord(
                mid_hash=mid_hash,
                credit_score=self.config.INITIAL_SCORE,
                first_seen=now,
            )
        
        user = self._users[mid_hash]
        user.total_danmaku += 1
        user.last_seen = now
        user.timestamps.append(now)
        
        if len(user.sample_contents) < self.max_sample_store:
            user.sample_contents.append(content[:50])
        
        if is_violation and violation_level > 0:
            # === 违规：扣分 ===
            penalty = self.config.PENALTY.get(violation_level, 5)
            user.credit_score = max(self.config.MIN_SCORE, user.credit_score - penalty)
            user.violation_count += 1
            user.consecutive_good = 0
            user.good_since_blocked = 0
            user.last_violation_at = now
            
            if reason and (len(user.violation_reasons) < 20):
                user.violation_reasons.append(f"[扣{penalty}] {reason}")
            
            # 检查是否需要进入屏蔽池
            if not user.is_blocked and user.credit_score <= self.config.BLOCK_THRESHOLD:
                user.is_blocked = True
                user.blocked_at = now
                user.good_since_blocked = 0
        else:
            # === 正常弹幕：加分恢复 ===
            user.consecutive_good += 1
            
            # 被屏蔽用户：记录冷却计数
            if user.is_blocked:
                user.good_since_blocked += 1
            
            # 基础加分
            bonus = self.config.GOOD_BONUS
            # 连续正常 ≥3 条后加速恢复
            if user.consecutive_good >= 3:
                bonus += self.config.CONSECUTIVE_BONUS
            
            user.credit_score = min(self.config.MAX_SCORE, user.credit_score + bonus)
            
            # 检查是否可以从屏蔽池恢复
            if user.is_blocked:
                if user.good_since_blocked >= self.config.RECOVER_COOLDOWN and \
                   user.credit_score >= self.config.RECOVER_THRESHOLD:
                    user.is_blocked = False
                    user.violation_reasons.append(f"[恢复] 信用分恢复至{user.credit_score}，屏蔽后{user.good_since_blocked}条正常弹幕")
    
    def check_frequency(self, mid_hash: str) -> Tuple[bool, str]:
        """
        检查用户发送频率是否过高（频率惩罚检测）
        
        Returns:
            (是否触发频率限制, 原因描述)
        """
        if not mid_hash or mid_hash not in self._users:
            return False, ""
        
        user = self._users[mid_hash]
        now = time.time()
        
        # 清理过期时间戳
        user.timestamps = [t for t in user.timestamps if now - t <= self.freq_window_seconds]
        
        if len(user.timestamps) >= self.freq_max_count:
            return True, f"用户 {mid_hash[:8]}... 在{self.freq_window_seconds}秒内发送{len(user.timestamps)}条弹幕（阈值{self.freq_max_count}）"
        
        return False, ""
    
    def is_user_blocked(self, mid_hash: str) -> bool:
        """检查用户当前是否在屏蔽池中"""
        if not mid_hash or mid_hash not in self._users:
            return False
        return self._users[mid_hash].is_blocked
    
    def get_credit_score(self, mid_hash: str) -> int:
        """获取用户信用分"""
        if not mid_hash or mid_hash not in self._users:
            return CreditScoreConfig.INITIAL_SCORE
        return self._users[mid_hash].credit_score
    
    def get_user_status(self, mid_hash: str) -> str:
        """获取用户状态描述"""
        if not mid_hash or mid_hash not in self._users:
            return "新用户"
        u = self._users[mid_hash]
        if u.is_blocked:
            return f"屏蔽中(信用分{u.credit_score})"
        elif u.credit_score <= 50:
            return f"警告(信用分{u.credit_score})"
        else:
            return f"正常(信用分{u.credit_score})"
    
    def get_user_stats(self, mid_hash: str) -> Optional[Dict]:
        """获取用户详细统计"""
        if not mid_hash or mid_hash not in self._users:
            return None
        u = self._users[mid_hash]
        return {
            "mid_hash": u.mid_hash[:12] + "...",
            "credit_score": u.credit_score,
            "status": self.get_user_status(mid_hash),
            "total": u.total_danmaku,
            "violations": u.violation_count,
            "violation_ratio": f"{u.violation_count/u.total_danmaku:.1%}" if u.total_danmaku > 0 else "0%",
            "consecutive_good": u.consecutive_good,
            "is_blocked": u.is_blocked,
            "recent_reasons": u.violation_reasons[-5:],
            "samples": u.sample_contents[-5:],
        }
    
    def get_stats(self) -> Dict:
        """获取全局统计"""
        total_users = len(self._users)
        blocked_users = sum(1 for u in self._users.values() if u.is_blocked)
        warned_users = sum(1 for u in self._users.values() if not u.is_blocked and u.credit_score <= 50)
        
        # 信用分分布
        score_dist = {"0-30": 0, "31-60": 0, "61-80": 0, "81-99": 0, "100": 0}
        for u in self._users.values():
            s = u.credit_score
            if s <= 30: score_dist["0-30"] += 1
            elif s <= 60: score_dist["31-60"] += 1
            elif s <= 80: score_dist["61-80"] += 1
            elif s <= 99: score_dist["81-99"] += 1
            else: score_dist["100"] += 1
        
        return {
            "total_users": total_users,
            "blocked_users": blocked_users,
            "warned_users": warned_users,
            "blocked_ratio": f"{blocked_users/total_users:.1%}" if total_users > 0 else "0%",
            "score_distribution": score_dist,
        }


# ============================================================
# 三、弹幕质量评分系统
# ============================================================

class DanmakuScorer:
    """
    弹幕质量评分器
    
    根据弹幕的多维特征计算质量分，用于同屏弹幕删减时的排序依据。
    
    评分维度：
    1. 弹幕模式：mode=5(顶部) 通常信息量更高 → +分
    2. 颜色：非白色弹幕往往有特殊用途（科普/强调） → +分
    3. 字号：非默认字号（18=小字/36=大字）通常有意图 → +分
    4. 弹幕长度：中长弹幕信息量更大 → +分
    5. 括号/箭头：科普注释类弹幕常见 → +分
    
    分数范围：0-100
    """
    
    BASE_SCORE = 50
    
    # 模式加分（基于语义分析结论：顶部弹幕科普占比8.4%，滚动弹幕科普占比5.2%）
    MODE_BONUS = {
        1: 0,     # 滚动弹幕（基准）
        4: 10,    # 底部弹幕（较少，通常有特殊用途）
        5: 15,    # 顶部弹幕（科普/注释比例高）
        6: 0,     # 逆向弹幕
        7: 5,     # 高级弹幕
        8: 0,     # 代码弹幕
        9: 5,     # BAS弹幕
    }
    
    @staticmethod
    def color_bonus(color: int) -> int:
        """非白色弹幕加分，纯白=16777215"""
        if color == 16777215:
            return 0
        return 5
    
    @staticmethod
    def size_bonus(size: int) -> int:
        """非默认字号加分"""
        if size == 25:  # 标准字号
            return 0
        if size == 18:  # 小字（通常用于注释、吐槽）
            return 5
        if size == 36:  # 大字（通常用于强调）
            return 3
        return 3
    
    @staticmethod
    def length_bonus(text: str) -> int:
        """弹幕长度质量加分"""
        l = len(text)
        if l <= 2:
            return -10
        elif l <= 4:
            return -5
        elif l <= 7:
            return 0
        elif l <= 15:
            return 5
        elif l <= 30:
            return 10
        else:
            return 12
    
    @staticmethod
    def content_bonus(text: str) -> int:
        """根据内容特征加分"""
        score = 0
        
        # 括号内容 → 注释/科普特征
        if "（" in text or "(" in text:
            score += 8
        
        # 箭头 → 指向/解释
        if "→" in text or "←" in text or "↑" in text or "↓" in text:
            score += 5
        
        # 问号 → 提问/互动
        if "？" in text or "?" in text:
            score += 2
        
        # 科普类关键词
        science_kw = ["科普", "补充", "说明", "注意", "其实", "原本", 
                      "小说里", "原作", "原作中", "设定", "设定上",
                      "翻译", "原文", "细节", "伏笔", "暗示", "彩蛋",
                      "这里", "这个"]
        for kw in science_kw:
            if kw in text:
                score += 3
                break
        
        return score
    
    @classmethod
    def score(cls, danmaku: Dict) -> int:
        """
        计算弹幕质量分
        
        Args:
            danmaku: 弹幕字典，需包含 mode, color, size, content 字段
        
        Returns:
            质量分 0-100
        """
        score = cls.BASE_SCORE
        
        # 模式加分
        mode = danmaku.get("mode", 1)
        score += cls.MODE_BONUS.get(mode, 0)
        
        # 颜色加分
        color = danmaku.get("color", 16777215)
        score += cls.color_bonus(color)
        
        # 字号加分
        size = danmaku.get("size", 25)
        score += cls.size_bonus(size)
        
        # 长度加分
        content = danmaku.get("content", "")
        score += cls.length_bonus(content)
        
        # 内容特征加分
        score += cls.content_bonus(content)
        
        return max(0, min(100, score))


# ============================================================
# 四、同屏弹幕智能删减（参数可配置）
# ============================================================

class ScreenDensityFilter:
    """
    同屏弹幕智能删减器
    
    原理：
    - 将视频按时间窗口切分（默认每5秒一个窗口）
    - 每个窗口内的弹幕数量超过阈值时，按质量分排序删减
    - 保留策略：
      1. 优先保留高质量分弹幕（科普、注释等）
      2. 保留弹幕模式多样性（顶部/底部/滚动各保留一定比例）
      3. 保留颜色多样性（非白色弹幕优先）
    
    所有参数均可配置，有推荐默认值。
    """
    
    # ---- 推荐默认值 ----
    DEFAULT_WINDOW_SECONDS = 5.0        # 时间窗口：5秒（推荐范围 3-10秒）
    DEFAULT_MAX_PER_WINDOW = 15         # 每窗口最大弹幕数（推荐范围 10-30）
    DEFAULT_TOP_RESERVE_RATIO = 0.25    # 顶部弹幕保留比例（推荐范围 0.15-0.35）
    DEFAULT_BOTTOM_RESERVE_RATIO = 0.10 # 底部弹幕保留比例（推荐范围 0.05-0.20）
    DEFAULT_SCROLL_RESERVE_RATIO = 0.65 # 滚动弹幕保留比例（推荐范围 0.50-0.80）
    DEFAULT_COLORED_PRIORITY = True     # 彩色弹幕是否优先
    
    def __init__(
        self,
        window_seconds: float = DEFAULT_WINDOW_SECONDS,
        max_per_window: int = DEFAULT_MAX_PER_WINDOW,
        top_reserve_ratio: float = DEFAULT_TOP_RESERVE_RATIO,
        bottom_reserve_ratio: float = DEFAULT_BOTTOM_RESERVE_RATIO,
        scroll_reserve_ratio: float = DEFAULT_SCROLL_RESERVE_RATIO,
        colored_priority: bool = DEFAULT_COLORED_PRIORITY,
    ):
        """
        初始化同屏密度过滤器
        
        Args:
            window_seconds: 时间窗口大小（秒），默认5秒，推荐3-10秒
            max_per_window: 每窗口最大弹幕数，默认15条，推荐10-30条
            top_reserve_ratio: 顶部弹幕保留比例，默认0.25，推荐0.15-0.35
            bottom_reserve_ratio: 底部弹幕保留比例，默认0.10，推荐0.05-0.20
            scroll_reserve_ratio: 滚动弹幕保留比例，默认0.65，推荐0.50-0.80
            colored_priority: 彩色弹幕是否优先保留，默认True
        """
        self.window_seconds = window_seconds
        self.max_per_window = max_per_window
        self.top_reserve_ratio = top_reserve_ratio
        self.bottom_reserve_ratio = bottom_reserve_ratio
        self.scroll_reserve_ratio = scroll_reserve_ratio
        self.colored_priority = colored_priority
    
    def filter(self, danmakus: List[Dict]) -> List[Dict]:
        """
        按同屏密度智能删减弹幕
        
        Args:
            danmakus: 弹幕列表，每条需包含 progress(秒) 字段
        
        Returns:
            删减后的弹幕列表
        """
        if len(danmakus) <= self.max_per_window:
            return danmakus
        
        # 按时间窗口分组
        windows = defaultdict(list)
        for dm in danmakus:
            progress = dm.get("progress", 0)
            if isinstance(progress, int) and progress > 1000:  # 毫秒转秒
                progress = progress / 1000
            window_key = int(progress // self.window_seconds)
            windows[window_key].append(dm)
        
        # 对每个窗口内的弹幕进行删减
        result = []
        for window_key in sorted(windows.keys()):
            window_dms = windows[window_key]
            
            if len(window_dms) <= self.max_per_window:
                result.extend(window_dms)
                continue
            
            # 按模式分类
            by_mode = defaultdict(list)
            for dm in window_dms:
                mode = dm.get("mode", 1)
                by_mode[mode].append(dm)
            
            # 每种模式内部按质量分排序（彩色弹幕优先）
            def sort_key(d):
                score = DanmakuScorer.score(d)
                if self.colored_priority and d.get("color", 16777215) != 16777215:
                    score += 10  # 彩色弹幕加权
                return score
            
            for mode in by_mode:
                by_mode[mode].sort(key=sort_key, reverse=True)
            
            # 计算每种模式应保留的数量
            top_count = max(1, int(self.max_per_window * self.top_reserve_ratio))
            bottom_count = max(1, int(self.max_per_window * self.bottom_reserve_ratio))
            scroll_count = self.max_per_window - top_count - bottom_count
            
            # 按模式取 top N
            selected = []
            
            # 顶部弹幕（mode=5）
            top_dms = by_mode.get(5, [])
            selected.extend(top_dms[:top_count])
            
            # 底部弹幕（mode=4）
            bottom_dms = by_mode.get(4, [])
            selected.extend(bottom_dms[:bottom_count])
            
            # 滚动弹幕（mode=1 及其他）
            scroll_dms = []
            for mode, dms in by_mode.items():
                if mode not in (4, 5):
                    scroll_dms.extend(dms)
            scroll_dms.sort(key=sort_key, reverse=True)
            selected.extend(scroll_dms[:scroll_count])
            
            # 如果还有剩余名额，按质量分补充
            if len(selected) < self.max_per_window:
                remaining = []
                for mode, dms in by_mode.items():
                    if mode == 5:
                        remaining.extend(dms[top_count:])
                    elif mode == 4:
                        remaining.extend(dms[bottom_count:])
                remaining.extend(scroll_dms[scroll_count:])
                remaining.sort(key=sort_key, reverse=True)
                selected.extend(remaining[:self.max_per_window - len(selected)])
            
            # 按原始时间排序
            selected.sort(key=lambda d: d.get("progress", 0))
            result.extend(selected)
        
        return result
    
    def get_filter_stats(self, original: List[Dict], filtered: List[Dict]) -> Dict:
        """获取删减统计"""
        removed = len(original) - len(filtered)
        
        # 统计各模式保留率
        orig_by_mode = Counter(d.get("mode", 1) for d in original)
        filt_by_mode = Counter(d.get("mode", 1) for d in filtered)
        
        mode_stats = {}
        for mode in sorted(set(list(orig_by_mode.keys()) + list(filt_by_mode.keys()))):
            orig = orig_by_mode.get(mode, 0)
            filt = filt_by_mode.get(mode, 0)
            mode_name = {1: "滚动", 4: "底部", 5: "顶部", 6: "逆向", 7: "高级"}.get(mode, f"mode{mode}")
            mode_stats[mode_name] = {
                "original": orig,
                "kept": filt,
                "removed": orig - filt,
                "keep_ratio": f"{filt/orig:.1%}" if orig > 0 else "-",
            }
        
        return {
            "total_original": len(original),
            "total_filtered": len(filtered),
            "removed": removed,
            "remove_ratio": f"{removed/len(original):.1%}" if original else "0%",
            "mode_stats": mode_stats,
        }


# ============================================================
# 五、额外优化功能
# ============================================================

class AdvancedFilters:
    """
    额外优化过滤器集合
    
    1. 短时间区间重复弹幕检测：不同用户在短时间内发送相同内容 → 跟风刷屏
    2. 相似弹幕过滤：基于编辑距离+字符集的文本相似度，替代全量精确重复过滤
    3. 连续重复字符检测：如"哈哈哈哈哈哈"、"2333333"
    4. 弹幕时间密度检测：高密度区域提高过滤强度
    5. 纯符号弹幕过滤
    6. 弹幕长度过滤
    """
    
    # ---- 文本相似度计算 ----
    
    # 弹幕尾部常见标点/语气符号（相似比较时忽略）
    _TRAILING_NOISE = re.compile(r'[！!？?。.…~～]+$')
    
    @staticmethod
    def _normalize(text: str) -> str:
        """标准化弹幕文本：去除尾部重复标点/语气符号，用于相似度比较"""
        return AdvancedFilters._TRAILING_NOISE.sub('', text).strip()
    
    @staticmethod
    def _text_similarity(text1: str, text2: str) -> float:
        """
        计算两条弹幕的文本相似度（0.0 ~ 1.0）
        
        采用组合算法：
        1. 标准化后完全相同 → 1.0
        2. 原始完全相同 → 1.0
        3. 如果标准化后长度差超过较短文本的80% → 直接返回 0
        4. 对短文本（≤8字）：使用编辑距离（Levenshtein）+ 字符集Jaccard 加权
        5. 对长文本（>8字）：使用 2-gram Jaccard 相似度
        
        返回 0.0 ~ 1.0，1.0 表示完全相同
        """
        if text1 == text2:
            return 1.0
        
        len1, len2 = len(text1), len(text2)
        if len1 == 0 or len2 == 0:
            return 0.0
        
        # 标准化后比较（去除尾部标点）
        norm1 = AdvancedFilters._normalize(text1)
        norm2 = AdvancedFilters._normalize(text2)
        if norm1 == norm2:
            return 1.0  # 标准化后相同，视为相同弹幕
        
        norm_len1, norm_len2 = len(norm1), len(norm2)
        if norm_len1 == 0 or norm_len2 == 0:
            return 0.0
        
        # 标准化后长度差距过大直接判定不相似（放宽到80%）
        norm_min_len = min(norm_len1, norm_len2)
        if abs(norm_len1 - norm_len2) > norm_min_len * 0.8:
            return 0.0
        
        # 使用标准化后的文本计算相似度
        if norm_min_len <= 8:
            # 短文本：编辑距离相似度（权重 0.6）+ 字符集 Jaccard（权重 0.4）
            lev_sim = AdvancedFilters._levenshtein_similarity(norm1, norm2)
            set_sim = AdvancedFilters._char_jaccard(norm1, norm2)
            return lev_sim * 0.6 + set_sim * 0.4
        else:
            # 长文本：2-gram Jaccard（权重 0.5）+ 编辑距离（权重 0.3）+ 字符集 Jaccard（权重 0.2）
            bigram_sim = AdvancedFilters._bigram_jaccard(norm1, norm2)
            lev_sim = AdvancedFilters._levenshtein_similarity(norm1, norm2)
            set_sim = AdvancedFilters._char_jaccard(norm1, norm2)
            return bigram_sim * 0.5 + lev_sim * 0.3 + set_sim * 0.2
    
    @staticmethod
    def _levenshtein_similarity(text1: str, text2: str) -> float:
        """
        基于编辑距离（Levenshtein Distance）的相似度
        返回 0.0 ~ 1.0，1.0 表示完全相同
        """
        len1, len2 = len(text1), len(text2)
        if len1 == 0 and len2 == 0:
            return 1.0
        if len1 == 0 or len2 == 0:
            return 0.0
        
        # 优化：只使用两行（O(n*m)时间，O(min(n,m))空间）
        if len1 < len2:
            text1, text2 = text2, text1
            len1, len2 = len2, len1
        
        prev = list(range(len2 + 1))
        curr = [0] * (len2 + 1)
        
        for i in range(1, len1 + 1):
            curr[0] = i
            for j in range(1, len2 + 1):
                cost = 0 if text1[i - 1] == text2[j - 1] else 1
                curr[j] = min(
                    prev[j] + 1,        # 删除
                    curr[j - 1] + 1,    # 插入
                    prev[j - 1] + cost  # 替换
                )
            prev, curr = curr, prev
        
        distance = prev[len2]
        max_len = max(len1, len2)
        return 1.0 - distance / max_len
    
    @staticmethod
    def _char_jaccard(text1: str, text2: str) -> float:
        """
        字符集合 Jaccard 相似度
        用于捕捉"用词相近"的弹幕（如"前方高能" vs "前方高能预警"）
        """
        set1 = set(text1)
        set2 = set(text2)
        if not set1 and not set2:
            return 1.0
        if not set1 or not set2:
            return 0.0
        intersection = set1 & set2
        union = set1 | set2
        return len(intersection) / len(union)
    
    @staticmethod
    def _bigram_jaccard(text1: str, text2: str) -> float:
        """
        2-gram（双字符组合）Jaccard 相似度
        用于捕捉语序和词组相似的弹幕（如"这个角色好帅" vs "这个角色太帅了"）
        """
        def get_bigrams(s: str) -> set:
            return {s[i:i+2] for i in range(len(s) - 1)} if len(s) >= 2 else {s}
        
        bigrams1 = get_bigrams(text1)
        bigrams2 = get_bigrams(text2)
        if not bigrams1 and not bigrams2:
            return 1.0
        if not bigrams1 or not bigrams2:
            return 0.0
        intersection = bigrams1 & bigrams2
        union = bigrams1 | bigrams2
        return len(intersection) / len(union)
    
    # ---- 相似弹幕过滤 ----
    
    @staticmethod
    def filter_similar_content(
        danmakus: List[Dict],
        similarity_threshold: float = 0.8,
        min_cluster_size: int = 3,
        keep_count: int = 1,
    ) -> List[Dict]:
        """
        相似弹幕过滤：将相似度≥阈值的弹幕聚类，每个簇只保留指定条数
        
        相比原来的 filter_duplicate_content（仅精确匹配），此方法：
        - "前方高能" 和 "前方高能！！！" → 相似度 0.85+ → 视为同一簇
        - "这个角色好帅" 和 "这个角色太帅了" → 相似度 0.75+ → 视为同一簇
        - "23333" 和 "233333" → 相似度 0.83+ → 视为同一簇
        
        Args:
            danmakus: 弹幕列表
            similarity_threshold: 相似度阈值（0.6~1.0，默认 0.8）
            min_cluster_size: 最小簇大小，簇内弹幕数 ≥ 此值才触发过滤
            keep_count: 每个簇保留的弹幕数（默认保留 1 条质量最高的）
        
        Returns:
            过滤后的弹幕列表（保留质量最高的弹幕）
        """
        if len(danmakus) < min_cluster_size:
            return danmakus
        
        n = len(danmakus)
        
        # 使用并查集（Union-Find）进行相似聚类
        parent = list(range(n))
        
        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        
        def union(x: int, y: int):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
        
        # 两两比较相似度，构建簇
        # 优化：只比较长度相近的弹幕对（长度差 ≤ 较短文本的 50%）
        # 按长度排序后，只需和附近长度的弹幕比较
        indexed = [(i, dm) for i, dm in enumerate(danmakus)]
        indexed.sort(key=lambda x: len(x[1].get("content", "")))
        
        for a in range(n):
            i_a, dm_a = indexed[a]
            content_a = dm_a.get("content", "")
            len_a = len(content_a)
            if len_a == 0:
                continue
            
            # 只和长度差在 50% 以内的弹幕比较
            for b in range(a + 1, n):
                i_b, dm_b = indexed[b]
                content_b = dm_b.get("content", "")
                len_b = len(content_b)
                
                # 长度差过大，且由于已排序，后面的更大 → 可以跳出
                if len_b > len_a * 1.5:
                    break
                
                if content_a == content_b:
                    # 完全相同直接合并
                    union(i_a, i_b)
                    continue
                
                # 计算相似度
                sim = AdvancedFilters._text_similarity(content_a, content_b)
                if sim >= similarity_threshold:
                    union(i_a, i_b)
        
        # 按簇分组
        clusters: Dict[int, List[int]] = defaultdict(list)
        for i in range(n):
            root = find(i)
            clusters[root].append(i)
        
        # 对每个簇：如果簇大小≥阈值，只保留质量最高的 keep_count 条
        to_keep: Set[int] = set()
        for root, indices in clusters.items():
            if len(indices) < min_cluster_size:
                # 簇太小，全部保留
                to_keep.update(indices)
            else:
                # 簇内按质量分排序，保留 top keep_count
                scored = [(DanmakuScorer.score(danmakus[i]), i) for i in indices]
                scored.sort(reverse=True)
                for _, i in scored[:keep_count]:
                    to_keep.add(i)
        
        # 按原始顺序返回
        return [danmakus[i] for i in range(n) if i in to_keep]
    
    @staticmethod
    def filter_repetitive_char(text: str, max_repeat: int = 4) -> bool:
        """
        检测连续重复字符
        "哈哈哈哈哈哈" → 屏蔽
        "哈哈笑死" → 保留
        """
        if not text:
            return True
        
        # 检测连续重复的中文字符
        for i in range(len(text) - max_repeat + 1):
            if len(set(text[i:i+max_repeat])) == 1:
                return True
        
        return False
    
    @staticmethod
    def detect_burst_duplicates(
        danmakus: List[Dict],
        time_window: float = 30.0,       # 时间窗口（秒）
        min_unique_users: int = 2,        # 最少不同用户数才触发
        min_occurrence: int = 3,          # 窗口内最少出现次数
    ) -> Set[int]:
        """
        检测短时间区间内不同用户发送的相同弹幕（跟风刷屏）
        
        逻辑：
        - 将弹幕按时间窗口分组
        - 同一窗口内，相同内容由 ≥min_unique_users 个不同用户发送，且出现 ≥min_occurrence 次
        - 命中条件 → 视为跟风刷屏，应屏蔽（但不扣信用分）
        
        Returns:
            应屏蔽的弹幕索引集合
        """
        if len(danmakus) < min_occurrence:
            return set()
        
        # 按时间窗口分组弹幕索引
        windows = defaultdict(list)
        for i, dm in enumerate(danmakus):
            progress = dm.get("progress", 0)
            if isinstance(progress, int) and progress > 1000:
                progress = progress / 1000
            window_key = int(progress // time_window)
            windows[window_key].append(i)
        
        blocked_indices = set()
        
        for window_key, indices in windows.items():
            if len(indices) < min_occurrence:
                continue
            
            # 统计窗口内每条内容的出现情况
            content_map = defaultdict(lambda: {"users": set(), "indices": []})
            for idx in indices:
                dm = danmakus[idx]
                content = dm.get("content", "")
                mid_hash = dm.get("midHash", "")
                if content and mid_hash:
                    content_map[content]["users"].add(mid_hash)
                    content_map[content]["indices"].append(idx)
            
            # 命中条件：不同用户数≥阈值 且 出现次数≥阈值
            for content, info in content_map.items():
                if len(info["users"]) >= min_unique_users and len(info["indices"]) >= min_occurrence:
                    blocked_indices.update(info["indices"])
        
        return blocked_indices
    
    @staticmethod
    def filter_duplicate_content(danmakus: List[Dict], max_occurrence: int = 3) -> List[Dict]:
        """过滤同一视频中重复出现超过阈值的弹幕（全量统计，非时间窗口）"""
        content_count = Counter(d.get("content", "") for d in danmakus)
        return [d for d in danmakus 
                if content_count.get(d.get("content", ""), 0) <= max_occurrence]
    
    @staticmethod
    def filter_pure_symbols(text: str) -> bool:
        """检测是否为纯符号弹幕"""
        # 去除所有空格
        cleaned = text.replace(" ", "").replace("\u3000", "")
        if not cleaned:
            return True
        
        # 如果非中文字符比例超过80%，且总长度≤6，视为纯符号
        non_chinese = sum(1 for c in cleaned if not ('\u4e00' <= c <= '\u9fff'))
        if len(cleaned) <= 6 and non_chinese / len(cleaned) > 0.8:
            return True
        
        return False
    
    @staticmethod
    def filter_min_length(text: str, min_length: int = 2) -> bool:
        """过滤过短的弹幕"""
        # 计算实际有意义的内容长度（排除标点）
        meaningful = re.sub(r'[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ffa-zA-Z0-9]', '', text)
        return len(meaningful) < min_length
    
    @staticmethod
    def get_density_penalty(danmakus: List[Dict], window_size: float = 30.0) -> Dict[int, float]:
        """
        计算每个时间窗口的弹幕密度，返回惩罚系数
        
        高密度区域（>50条/30秒）→ 惩罚系数高
        低密度区域（<10条/30秒）→ 惩罚系数低
        """
        windows = defaultdict(int)
        
        for dm in danmakus:
            progress = dm.get("progress", 0)
            if isinstance(progress, int) and progress > 1000:
                progress = progress / 1000
            window_key = int(progress // window_size)
            windows[window_key] += 1
        
        # 计算每个窗口的惩罚系数
        penalties = {}
        for wk, count in windows.items():
            if count <= 10:
                penalties[wk] = 0.0      # 低密度，不惩罚
            elif count <= 30:
                penalties[wk] = 0.3      # 中密度
            elif count <= 50:
                penalties[wk] = 0.5      # 中高密度
            else:
                penalties[wk] = 0.7      # 高密度，大幅惩罚
        
        return penalties


# ============================================================
# 六、弹幕模式屏蔽过滤器（新增）
# ============================================================

class DanmakuModeFilter:
    """
    弹幕模式屏蔽过滤器
    
    按弹幕显示模式（位置/类型）进行屏蔽，每种模式独立开关。
    
    弹幕模式对照：
    - mode=1: 滚动弹幕（最常见）
    - mode=4: 底部弹幕
    - mode=5: 顶部弹幕（科普/注释常用）
    - mode=6: 逆向弹幕
    - mode=7: 高级弹幕（特殊效果）
    - mode=8: 代码弹幕
    - mode=9: BAS弹幕
    """
    
    MODE_NAMES = {
        1: "滚动弹幕",
        4: "底部弹幕",
        5: "顶部弹幕",
        6: "逆向弹幕",
        7: "高级弹幕",
        8: "代码弹幕",
        9: "BAS弹幕",
    }
    
    def __init__(self, blocked_modes: Optional[Set[int]] = None):
        """
        初始化模式过滤器
        
        Args:
            blocked_modes: 要屏蔽的弹幕模式集合，默认空（不屏蔽任何模式）
        """
        self.blocked_modes: Set[int] = blocked_modes or set()
    
    def is_blocked(self, danmaku: Dict) -> Tuple[bool, str]:
        """
        检查弹幕是否因模式被屏蔽
        
        Returns:
            (是否屏蔽, 原因)
        """
        mode = danmaku.get("mode", 1)
        if mode in self.blocked_modes:
            mode_name = self.MODE_NAMES.get(mode, f"未知模式{mode}")
            return True, f"弹幕模式屏蔽: {mode_name}"
        return False, ""
    
    def set_blocked_modes(self, modes: Set[int]):
        """设置要屏蔽的模式集合"""
        self.blocked_modes = modes
    
    def add_blocked_mode(self, mode: int) -> bool:
        """添加屏蔽模式"""
        if mode in self.MODE_NAMES:
            self.blocked_modes.add(mode)
            return True
        return False
    
    def remove_blocked_mode(self, mode: int) -> bool:
        """移除屏蔽模式"""
        self.blocked_modes.discard(mode)
        return True
    
    def get_status(self) -> Dict:
        """获取所有模式屏蔽状态"""
        return {
            str(mode): {
                "name": name,
                "blocked": mode in self.blocked_modes,
            }
            for mode, name in self.MODE_NAMES.items()
        }


# ============================================================
# 七、主过滤器 - 组合所有功能
# ============================================================

class DanmakuFilter:
    """
    弹幕质量过滤器 - 主入口
    
    整合所有过滤功能，提供统一的过滤接口。
    过滤流程（七阶段）：
    1. 弹幕模式屏蔽 → 按显示模式过滤
    2. 基础文本过滤 → 长度/纯符号/重复字符
    3. 用户频率检测 → 同一用户短时间内大量弹幕
    4. 短时重复检测 → 不同用户跟风刷屏
    5. 关键词+信用评分 → 内容违规检测+用户屏蔽池
    6. 相似弹幕过滤 → 基于编辑距离+字符集的文本相似度聚类去重（替代精确匹配）
    7. 同屏密度删减 → 按时间窗口智能删减
    """
    
    def __init__(self, config: Optional[Dict] = None):
        """
        初始化过滤器
        
        Args:
            config: 配置字典，支持以下键：
                - enabled_categories: 启用的关键词分类集合
                - blocked_modes: 屏蔽的弹幕模式集合 {1,4,5,...}
                - screen_max_per_window: 同屏每窗口最大弹幕数（默认15）
                - screen_window_seconds: 同屏时间窗口大小秒（默认5.0）
                - screen_top_reserve_ratio: 顶部弹幕保留比例（默认0.25）
                - screen_bottom_reserve_ratio: 底部弹幕保留比例（默认0.10）
                - screen_scroll_reserve_ratio: 滚动弹幕保留比例（默认0.65）
                - screen_colored_priority: 彩色弹幕优先（默认True）
                - similarity_threshold: 相似弹幕阈值 0.6~1.0（默认0.8，即80%）
                - similarity_enabled: 是否启用相似弹幕过滤（默认True）
                - similarity_min_cluster_size: 最小簇大小（默认3）
                - similarity_keep_count: 每个相似簇保留条数（默认1）
                - min_content_length: 最短内容长度（默认2）
                - freq_window_seconds: 频率检测时间窗口秒（默认30）
                - freq_max_count: 频率检测窗口内最大弹幕数（默认10）
                - credit_block_threshold: 信用分屏蔽阈值（默认40）
                - credit_recover_threshold: 信用分恢复阈值（默认50）
        """
        config = config or {}
        
        # 关键词分类
        self.enabled_categories = config.get("enabled_categories", None)
        
        # 弹幕模式屏蔽
        blocked_modes = config.get("blocked_modes", set())
        if isinstance(blocked_modes, list):
            blocked_modes = set(blocked_modes)
        self.mode_filter = DanmakuModeFilter(blocked_modes)
        
        # 用户追踪器（含频率检测配置）
        self.user_tracker = UserTracker(
            freq_window_seconds=config.get("freq_window_seconds", 30.0),
            freq_max_count=config.get("freq_max_count", 10),
        )
        # 信用分配置可覆盖
        if "credit_block_threshold" in config:
            self.user_tracker.config.BLOCK_THRESHOLD = config["credit_block_threshold"]
        if "credit_recover_threshold" in config:
            self.user_tracker.config.RECOVER_THRESHOLD = config["credit_recover_threshold"]
        
        # 同屏密度过滤器（参数可配置）
        self.screen_filter = ScreenDensityFilter(
            window_seconds=config.get("screen_window_seconds", 5.0),
            max_per_window=config.get("screen_max_per_window", 15),
            top_reserve_ratio=config.get("screen_top_reserve_ratio", 0.25),
            bottom_reserve_ratio=config.get("screen_bottom_reserve_ratio", 0.10),
            scroll_reserve_ratio=config.get("screen_scroll_reserve_ratio", 0.65),
            colored_priority=config.get("screen_colored_priority", True),
        )
        
        # 相似弹幕过滤参数
        self.similarity_enabled = config.get("similarity_enabled", True)
        self.similarity_threshold = max(0.6, min(1.0, config.get("similarity_threshold", 0.8)))
        self.similarity_min_cluster = config.get("similarity_min_cluster_size", 3)
        self.similarity_keep_count = config.get("similarity_keep_count", 1)
        
        # 其他过滤参数
        self.min_length = config.get("min_content_length", 2)
        
        # 统计
        self.stats = {
            "total_input": 0,
            "mode_blocked": 0,              # 模式屏蔽数
            "keyword_blocked": 0,
            "user_blocked": 0,
            "frequency_blocked": 0,         # 频率屏蔽数
            "length_blocked": 0,
            "symbol_blocked": 0,
            "repeat_char_blocked": 0,
            "burst_duplicate_blocked": 0,
            "similarity_blocked": 0,        # 相似弹幕过滤数（替代 duplicate_blocked）
            "density_removed": 0,
            "total_output": 0,
        }
    
    def filter(self, danmakus: List[Dict], verbose: bool = False) -> List[Dict]:
        """
        执行完整过滤流程（七阶段）
        
        Args:
            danmakus: 弹幕列表，每条需包含 content, midHash, mode, color, size, progress
            verbose: 是否打印详细过滤信息
        
        Returns:
            过滤后的弹幕列表
        """
        self.stats["total_input"] = len(danmakus)
        
        # ===== 第一阶段：弹幕模式屏蔽 =====
        stage0 = []
        for dm in danmakus:
            is_blocked, reason = self.mode_filter.is_blocked(dm)
            if is_blocked:
                self.stats["mode_blocked"] += 1
                continue
            stage0.append(dm)
        
        if verbose:
            print(f"  模式屏蔽: {len(danmakus)} → {len(stage0)} (移除{len(danmakus)-len(stage0)}条)")
        
        # ===== 第二阶段：基础文本过滤 =====
        stage1 = []
        for dm in stage0:
            content = dm.get("content", "")
            mid_hash = dm.get("midHash", "")
            
            # 2.1 空弹幕
            if not content or not content.strip():
                continue
            
            # 2.2 弹幕长度过滤
            if AdvancedFilters.filter_min_length(content, self.min_length):
                self.stats["length_blocked"] += 1
                continue
            
            # 2.3 纯符号过滤
            if AdvancedFilters.filter_pure_symbols(content):
                self.stats["symbol_blocked"] += 1
                continue
            
            # 2.4 连续重复字符过滤 → 记录为违规
            if AdvancedFilters.filter_repetitive_char(content):
                self.stats["repeat_char_blocked"] += 1
                self.user_tracker.record(mid_hash, content, 
                    is_violation=True, violation_level=ViolationLevel.MINOR.value, 
                    reason="连续重复字符")
                continue
            
            stage1.append(dm)
        
        if verbose:
            print(f"  基础过滤: {len(stage0)} → {len(stage1)} (移除{len(stage0)-len(stage1)}条)")
        
        # ===== 第三阶段：用户频率检测 =====
        stage1_freq = []
        for dm in stage1:
            mid_hash = dm.get("midHash", "")
            content = dm.get("content", "")
            
            # 频率检测（先记录再检查，因为 record 会更新时间戳）
            is_freq_limit, freq_reason = self.user_tracker.check_frequency(mid_hash)
            if is_freq_limit:
                self.stats["frequency_blocked"] += 1
                # 频率过高也记录为轻度违规
                self.user_tracker.record(mid_hash, content,
                    is_violation=True, violation_level=ViolationLevel.TRIVIAL.value,
                    reason=freq_reason)
                continue
            stage1_freq.append(dm)
        
        if verbose:
            print(f"  频率检测: {len(stage1)} → {len(stage1_freq)} (移除{len(stage1)-len(stage1_freq)}条)")
        
        # ===== 第四阶段：短时间区间重复弹幕检测（跟风刷屏，不扣信用分）=====
        burst_blocked = AdvancedFilters.detect_burst_duplicates(
            stage1_freq,
            time_window=30.0,
            min_unique_users=2,
            min_occurrence=3,
        )
        self.stats["burst_duplicate_blocked"] = len(burst_blocked)
        
        if burst_blocked:
            stage2 = [dm for i, dm in enumerate(stage1_freq) if i not in burst_blocked]
        else:
            stage2 = stage1_freq
        
        if verbose:
            print(f"  短时重复: {len(stage1_freq)} → {len(stage2)} (移除{len(stage1_freq)-len(stage2)}条，不扣信用分)")
        
        # ===== 第五阶段：关键词屏蔽 + 用户信用评分 =====
        stage3 = []
        for dm in stage2:
            content = dm.get("content", "")
            mid_hash = dm.get("midHash", "")
            
            # 5.1 检查用户是否在屏蔽池中（信用分过低）
            if self.user_tracker.is_user_blocked(mid_hash):
                self.stats["user_blocked"] += 1
                continue
            
            # 5.2 关键词屏蔽检查
            is_blocked, reason, violation_level = KeywordBlocklist.is_blocked(
                content, self.enabled_categories)
            
            if is_blocked:
                # 记录违规（扣分）
                self.user_tracker.record(mid_hash, content,
                    is_violation=True, violation_level=violation_level, reason=reason)
                self.stats["keyword_blocked"] += 1
                continue
            else:
                # 记录正常弹幕（加分恢复）
                self.user_tracker.record(mid_hash, content,
                    is_violation=False)
            
            stage3.append(dm)
        
        if verbose:
            print(f"  关键词+用户: {len(stage2)} → {len(stage3)} (移除{len(stage2)-len(stage3)}条)")
        
        # ===== 第六阶段：相似弹幕过滤 =====
        if self.similarity_enabled:
            stage4 = AdvancedFilters.filter_similar_content(
                stage3,
                similarity_threshold=self.similarity_threshold,
                min_cluster_size=self.similarity_min_cluster,
                keep_count=self.similarity_keep_count,
            )
        else:
            stage4 = stage3
        self.stats["similarity_blocked"] = len(stage3) - len(stage4)
        
        if verbose:
            print(f"  相似过滤: {len(stage3)} → {len(stage4)} (移除{len(stage3)-len(stage4)}条, 阈值{self.similarity_threshold:.0%})")
        
        # ===== 第七阶段：同屏密度删减 =====
        stage5 = self.screen_filter.filter(stage4)
        self.stats["density_removed"] = len(stage4) - len(stage5)
        
        if verbose:
            print(f"  密度删减: {len(stage4)} → {len(stage5)} (移除{len(stage4)-len(stage5)}条)")
        
        self.stats["total_output"] = len(stage5)
        
        return stage5
    
    def get_filter_report(self) -> Dict:
        """获取过滤报告"""
        total_in = self.stats["total_input"]
        total_out = self.stats["total_output"]
        
        return {
            "input": total_in,
            "output": total_out,
            "removed_total": total_in - total_out,
            "remove_ratio": f"{(total_in - total_out)/total_in:.1%}" if total_in > 0 else "0%",
            "breakdown": {
                "弹幕模式屏蔽": self.stats["mode_blocked"],
                "关键词屏蔽": self.stats["keyword_blocked"],
                "用户屏蔽池": self.stats["user_blocked"],
                "用户频率限制": self.stats["frequency_blocked"],
                "弹幕过短": self.stats["length_blocked"],
                "纯符号": self.stats["symbol_blocked"],
                "连续重复字符": self.stats["repeat_char_blocked"],
                "短时重复刷屏(不扣分)": self.stats["burst_duplicate_blocked"],
                "相似弹幕过滤": self.stats["similarity_blocked"],
                "密度删减": self.stats["density_removed"],
            },
            "user_stats": self.user_tracker.get_stats(),
            "mode_filter_status": self.mode_filter.get_status(),
            "screen_filter_config": {
                "window_seconds": self.screen_filter.window_seconds,
                "max_per_window": self.screen_filter.max_per_window,
                "top_reserve_ratio": self.screen_filter.top_reserve_ratio,
                "bottom_reserve_ratio": self.screen_filter.bottom_reserve_ratio,
                "scroll_reserve_ratio": self.screen_filter.scroll_reserve_ratio,
            },
        }
    
    def print_report(self):
        """打印过滤报告"""
        report = self.get_filter_report()
        print(f"\n{'='*60}")
        print(f"弹幕过滤报告")
        print(f"{'='*60}")
        print(f"  输入弹幕: {report['input']}")
        print(f"  输出弹幕: {report['output']}")
        print(f"  移除总数: {report['removed_total']} ({report['remove_ratio']})")
        print(f"\n  过滤明细:")
        for reason, count in report["breakdown"].items():
            bar = "█" * max(1, int(count / max(1, report['removed_total']) * 30))
            print(f"    {reason:14s}: {count:5d} {bar}")
        
        us = report["user_stats"]
        print(f"\n  用户信用评分:")
        print(f"    追踪用户: {us['total_users']}")
        print(f"    屏蔽池中: {us['blocked_users']} ({us['blocked_ratio']})")
        print(f"    警告状态: {us['warned_users']}")
        if "score_distribution" in us:
            print(f"    信用分分布:")
            for k, v in us["score_distribution"].items():
                print(f"      {k}: {v}")
        
        mfs = report.get("mode_filter_status", {})
        if mfs:
            print(f"\n  弹幕模式屏蔽状态:")
            for mode, info in mfs.items():
                status = "屏蔽" if info["blocked"] else "允许"
                print(f"    mode{mode} {info['name']}: {status}")
    
    def query_blocked_users(self) -> List[Dict]:
        """查询屏蔽池中的用户"""
        return [
            self.user_tracker.get_user_stats(mh)
            for mh, u in self.user_tracker._users.items()
            if u.is_blocked
        ]
    
    def query_warned_users(self) -> List[Dict]:
        """查询警告状态的用户（信用分≤50但未屏蔽）"""
        return [
            self.user_tracker.get_user_stats(mh)
            for mh, u in self.user_tracker._users.items()
            if not u.is_blocked and u.credit_score <= 50
        ]


# ============================================================
# 八、工具函数
# ============================================================

def format_danmaku_sample(danmakus: List[Dict], n: int = 10) -> str:
    """格式化弹幕样本用于展示"""
    lines = []
    for dm in danmakus[:n]:
        content = dm.get("content", "")[:50]
        mode = dm.get("mode", 1)
        mode_name = {1: "滚动", 4: "底部", 5: "顶部"}.get(mode, f"mode{mode}")
        score = DanmakuScorer.score(dm)
        lines.append(f"  [{mode_name}] (分{score}) {content}")
    return "\n".join(lines)


if __name__ == "__main__":
    # 独立运行：展示屏蔽库状态
    KeywordBlocklist.print_status()
    
    print(f"\nDanmakuScorer 评分示例:")
    test_dms = [
        {"content": "哈哈哈哈哈哈", "mode": 1, "color": 16777215, "size": 25},
        {"content": "前方高能！！！", "mode": 1, "color": 16777215, "size": 25},
        {"content": "小说里这里其实是骨王故意演戏给守护者看，让他们以为自己早有安排", "mode": 5, "color": 0x00FF00, "size": 18},
        {"content": "骨王", "mode": 1, "color": 16777215, "size": 25},
        {"content": "这集真的神回，打斗分镜太强了", "mode": 1, "color": 0xFF6600, "size": 25},
        {"content": "（科普）这里的魔法设定参考了DND的九环法术体系", "mode": 5, "color": 0xFFFF00, "size": 18},
        {"content": "233333", "mode": 1, "color": 16777215, "size": 25},
        {"content": "打卡打卡打卡打卡", "mode": 1, "color": 16777215, "size": 25},
    ]
    for dm in test_dms:
        score = DanmakuScorer.score(dm)
        is_blocked, reason, _ = KeywordBlocklist.is_blocked(dm["content"])
        block_mark = f"BLOCKED {reason}" if is_blocked else "OK"
        print(f"  {block_mark} | 分{score:3d} | {dm['content'][:40]}")
