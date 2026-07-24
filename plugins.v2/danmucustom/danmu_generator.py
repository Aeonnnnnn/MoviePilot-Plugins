"""
弹幕生成器 - 原始版本
基于 HankunYu/MoviePilot-Plugins 弹幕刮削 v1.9.0
来源: https://github.com/HankunYu/MoviePilot-Plugins/blob/main/plugins.v2/danmu/danmu_generator.py

===== 功能列表（参见 FUNCTION_LIST.md） =====
此文件是原始代码的纯净副本，后续修改基于此文件进行。
"""
import chardet
import requests
import os
import re
import time
import hashlib
import subprocess
import json
from datetime import datetime
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass

from app.log import logger

# 导入弹幕过滤系统
try:
    from app.plugins.danmucustom.danmaku_filter import DanmakuFilter
    _FILTER_AVAILABLE = True
except ImportError:
    _FILTER_AVAILABLE = False


@dataclass
class VideoInfo:
    """弹弹Play 视频匹配请求数据结构。"""
    file_name: str
    file_hash: str
    file_size: int
    video_duration: int
    match_mode: str = "hashAndFileName"


class StrmProcessor:
    """STRM 文件处理器：检测 .strm 文件、提取流媒体 URL、构造 VideoInfo 用于弹幕匹配。"""
    @staticmethod
    def is_strm_file(file_path: str) -> bool:
        """检查是否为.strm文件"""
        return file_path.lower().endswith('.strm')

    @staticmethod
    def get_strm_url(file_path: str) -> Optional[str]:
        """读取.strm文件获取流媒体URL"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                url = f.read().strip()
            logger.info(f"从.strm文件读取到URL: {url}")
            return url if url else None
        except Exception as e:
            logger.error(f"读取.strm文件失败: {e}")
            return None

    @staticmethod
    def create_fake_video_info(file_path: str) -> VideoInfo:
        """为.strm文件创建虚拟的VideoInfo对象，用于TMDB匹配"""
        file_name = os.path.basename(file_path)
        # 使用文件名作为hash（确保唯一性）
        fake_hash = hashlib.md5(file_name.encode()).hexdigest()
        return VideoInfo(
            file_name=file_name,
            file_hash=fake_hash,
            file_size=0,  # .strm文件大小通常很小，设为0
            video_duration=0,  # 无法获取时长，设为0
            match_mode="hashAndFileName"
        )


class DanmuAPI:
    """弹弹Play API 客户端：封装番剧匹配、弹幕获取、手动匹配文件读写等接口。

    接入策略：官方 v2 接口 (api.dandanplay.net) 为主，中转站 v1 (dandanapi.hankun.online) 兜底。
    所有外部请求统一通过 *_with_fallback 类方法发起，先官方后中转站，单点失败不影响整体。
    """
    # ===== 官方 v2（主）=====
    BASE_URL_OFFICIAL = "https://api.dandanplay.net/api/v2"
    # 从 https://dev.dandanplay.com 申请的应用凭证（用户提供）
    # 一个 AppId 对应两个 AppSecret，任一可用；轮换/失效时编辑此处即可
    APP_ID = "ucghni9y97"
    APP_SECRETS = [
        "itYDA3pkBmFTbyYGjV4FEDrmHD789vZG",
        "3PxjZcL3kcfeXCXLaWLXQKGeudjrnGL4",
    ]
    # 当前选用的 secret 索引（两个之间手动轮换；运行中修改后下次请求生效）
    _active_secret_idx = 0
    HEADERS_OFFICIAL = {
        "Accept": "application/json",
        "User-Agent": "Moviepilot/plugins 1.9.0",
        "X-AppId": APP_ID,
        "X-AppSecret": APP_SECRETS[0],
    }

    # ===== 中转站 v1（兜底）=====
    BASE_URL_PROXY = "https://dandanapi.hankun.online/api/v1"
    HEADERS_PROXY = {
        "Accept": "application/json",
        "User-Agent": "Moviepilot/plugins 1.9.0",
    }

    # 兼容旧代码：保留 BASE_URL/HEADERS 名称，默认指向中转站
    BASE_URL = BASE_URL_PROXY
    HEADERS = HEADERS_PROXY

    MANUAL_MATCH_FILE = ".dandan.anime.json"
    # (connect, read) timeout for all dandan API calls; without this a hung
    # request blocks a worker thread forever and stalls batch scraping
    TIMEOUT = (10, 60)

    @classmethod
    def _refresh_active_headers(cls) -> None:
        """根据 _active_secret_idx 重新生成 HEADERS_OFFICIAL，供运行中切换密钥。"""
        cls.HEADERS_OFFICIAL = {
            "Accept": "application/json",
            "User-Agent": "Moviepilot/plugins 1.9.0",
            "X-AppId": cls.APP_ID,
            "X-AppSecret": cls.APP_SECRETS[cls._active_secret_idx],
        }

    @classmethod
    def rotate_app_secret(cls) -> None:
        """切换到另一个 AppSecret 并刷新 header。供运维/限流时手动调用。"""
        cls._active_secret_idx = (cls._active_secret_idx + 1) % len(cls.APP_SECRETS)
        cls._refresh_active_headers()
        logger.info(f"[DanmuAPI] 切换到 AppSecret #{cls._active_secret_idx + 1}")

    # ========================================================================
    # 官方 v2 ↔ 中转站 v1 兜底机制
    # 三组方法分别对应：match / comment/{id} / search/tmdb 三个外网端点
    # 公共约定：返回 (result_dict_or_None, source) ，source ∈ {"official", "proxy", ""}
    # ========================================================================

    @classmethod
    def _try_match_official(cls, video_info: "VideoInfo") -> Optional[Dict]:
        """调用官方 v2 /match（camelCase 字段，X-AppId/X-AppSecret 凭证）。"""
        try:
            payload = {
                "fileName": video_info.file_name,
                "fileHash": video_info.file_hash,
                "fileSize": video_info.file_size,
                "videoDuration": video_info.video_duration,
                "matchMode": video_info.match_mode,
            }
            resp = requests.post(
                f"{cls.BASE_URL_OFFICIAL}/match",
                json=payload,
                headers=cls.HEADERS_OFFICIAL,
                timeout=cls.TIMEOUT,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(
                f"[match] 官方 HTTP {resp.status_code} "
                f"{resp.headers.get('X-Error-Message', '')}"
            )
        except Exception as e:
            logger.warning(f"[match] 官方异常: {e}")
        return None

    @classmethod
    def _try_match_proxy(cls, video_info: "VideoInfo") -> Optional[Dict]:
        """调用中转站 v1 /match（snake_case 字段，无认证）。"""
        try:
            resp = requests.post(
                f"{cls.BASE_URL_PROXY}/match",
                json=video_info.__dict__,
                headers=cls.HEADERS_PROXY,
                timeout=cls.TIMEOUT,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"[match] 中转站 HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"[match] 中转站异常: {e}")
        return None

    @classmethod
    def _match_with_fallback(cls, video_info: "VideoInfo") -> Tuple[Optional[Dict], str]:
        """文件匹配：先官方 v2，失败后中转站 v1。返回 (响应 dict, 来源)。"""
        result = cls._try_match_official(video_info)
        if result is not None:
            return result, "official"
        result = cls._try_match_proxy(video_info)
        if result is not None:
            return result, "proxy"
        return None, ""

    @classmethod
    def _try_match_batch_official(cls, video_infos: List["VideoInfo"]) -> Optional[List[Optional[Dict]]]:
        """官方 v2 /api/v2/match/batch：一次最多 32 个文件，返回与请求一一对应的 results 列表。
        响应字段是 results（不是单文件版的 matches），每个 item 是 {"success", "isMatched", "matches"}。
        """
        if not video_infos:
            return []
        if len(video_infos) > 32:
            logger.warning(
                f"[match/batch] 官方单次最多 32 个文件，实际 {len(video_infos)}，将被截断"
            )
            video_infos = video_infos[:32]
        try:
            payload = {
                "requests": [
                    {
                        "fileName": v.file_name,
                        "fileHash": v.file_hash,
                        "fileSize": v.file_size,
                        "videoDuration": v.video_duration,
                        "matchMode": v.match_mode,
                    }
                    for v in video_infos
                ]
            }
            resp = requests.post(
                f"{cls.BASE_URL_OFFICIAL}/match/batch",
                json=payload,
                headers=cls.HEADERS_OFFICIAL,
                timeout=cls.TIMEOUT,
            )
            if resp.status_code == 200:
                body = resp.json()
                results = body.get("results") or []
                # 补齐短结果（API 行为：某项失败可能不返回对应 item）
                if len(results) < len(video_infos):
                    results = list(results) + [None] * (len(video_infos) - len(results))
                return results
            logger.warning(
                f"[match/batch] 官方 HTTP {resp.status_code} "
                f"{resp.headers.get('X-Error-Message', '')}"
            )
        except Exception as e:
            logger.warning(f"[match/batch] 官方异常: {e}")
        return None

    @classmethod
    def _try_match_batch_proxy(cls, video_infos: List["VideoInfo"]) -> Optional[List[Optional[Dict]]]:
        """中转站 v1 没有 batch 接口：循环单文件 /match（最多 32 个），全部成功后返回结果列表。"""
        if not video_infos:
            return []
        results: List[Optional[Dict]] = []
        try:
            for v in video_infos:
                resp = requests.post(
                    f"{cls.BASE_URL_PROXY}/match",
                    json=v.__dict__,
                    headers=cls.HEADERS_PROXY,
                    timeout=cls.TIMEOUT,
                )
                if resp.status_code == 200:
                    results.append(resp.json())
                else:
                    logger.warning(f"[match/batch] 中转站单文件 HTTP {resp.status_code}")
                    return None
            return results
        except Exception as e:
            logger.warning(f"[match/batch] 中转站异常: {e}")
        return None

    @classmethod
    def _match_batch_with_fallback(cls, video_infos: List["VideoInfo"]) -> Tuple[Optional[List[Optional[Dict]]], str]:
        """批量匹配：先官方 v2 /match/batch，失败/部分失败时中转站 v1 循环兜底。
        返回 (results 列表, 来源 'official'/'proxy'/'')。"""
        result = cls._try_match_batch_official(video_infos)
        if result is not None:
            return result, "official"
        result = cls._try_match_batch_proxy(video_infos)
        if result is not None:
            return result, "proxy"
        return None, ""

    @classmethod
    def _try_get_comments_official(
        cls, comment_id: str, cache_ttl: Optional[int], ch_convert: int = 0
    ) -> Optional[Dict]:
        """调用官方 v2 /comment/{id}（?withRelated=true&chConvert=0/1/2）。
        :param ch_convert: 0=不转换, 1=转简体, 2=转繁体（弹弹play 服务端处理）"""
        try:
            url = f"{cls.BASE_URL_OFFICIAL}/comment/{comment_id}"
            params = {"withRelated": "true", "chConvert": ch_convert}
            if cache_ttl is not None:
                params["cache_ttl"] = cache_ttl
            resp = requests.get(
                url,
                params=params,
                headers=cls.HEADERS_OFFICIAL,
                timeout=cls.TIMEOUT,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(
                f"[comment] 官方 HTTP {resp.status_code} "
                f"{resp.headers.get('X-Error-Message', '')}"
            )
        except Exception as e:
            logger.warning(f"[comment] 官方异常: {e}")
        return None

    @classmethod
    def _try_get_comments_proxy(
        cls, comment_id: str, cache_ttl: Optional[int], ch_convert: int = 0
    ) -> Optional[Dict]:
        """调用中转站 v1 /{id}（?from_id=0&with_related=true&ch_convert=0/1/2）。"""
        try:
            params = {"from_id": 0, "with_related": "true", "ch_convert": ch_convert}
            if cache_ttl is not None:
                params["cache_ttl"] = cache_ttl
            resp = requests.get(
                f"{cls.BASE_URL_PROXY}/{comment_id}",
                params=params,
                headers=cls.HEADERS_PROXY,
                timeout=cls.TIMEOUT,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"[comment] 中转站 HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"[comment] 中转站异常: {e}")
        return None

    @classmethod
    def _get_comments_with_fallback(
        cls, comment_id: str, cache_ttl: Optional[int], ch_convert: int = 0
    ) -> Tuple[Optional[Dict], str]:
        """拉取弹幕：先官方 v2，失败后中转站 v1。返回 (弹幕数据, 来源)。"""
        result = cls._try_get_comments_official(comment_id, cache_ttl, ch_convert)
        if result is not None:
            return result, "official"
        result = cls._try_get_comments_proxy(comment_id, cache_ttl, ch_convert)
        if result is not None:
            return result, "proxy"
        return None, ""

    @classmethod
    def _try_search_tmdb_official(
        cls, tmdb_id: int, episode: Optional[int], tmdb_id_type: int
    ) -> Optional[Dict]:
        """官方 v2 /api/v2/search/episodes 支持 TMDB ID 反查（带 v2=true 走新版搜索引擎）。
        注意：/api/v2/search/tmdb 只支持 keyword，不支持 tmdbId。
        """
        try:
            params = {
                "tmdbId": tmdb_id,
                "tmdbIdType": tmdb_id_type,
                "v2": "true",
            }
            if episode is not None:
                params["episode"] = episode
            resp = requests.get(
                f"{cls.BASE_URL_OFFICIAL}/search/episodes",
                params=params,
                headers=cls.HEADERS_OFFICIAL,
                timeout=cls.TIMEOUT,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(
                f"[search/episodes?tmdbId] 官方 HTTP {resp.status_code} "
                f"{resp.headers.get('X-Error-Message', '')}"
            )
        except Exception as e:
            logger.warning(f"[search/episodes?tmdbId] 官方异常: {e}")
        return None

    @classmethod
    def _try_search_tmdb_proxy(
        cls, tmdb_id: int, episode: Optional[int], tmdb_id_type: int
    ) -> Optional[Dict]:
        """调用中转站 v1 /search/tmdb（snake_case 字段）。"""
        try:
            payload = {
                "tmdb_id": tmdb_id,
                "tmdb_id_type": tmdb_id_type,
                "episode": episode if episode is not None else 1,
            }
            resp = requests.post(
                f"{cls.BASE_URL_PROXY}/search/tmdb",
                json=payload,
                headers=cls.HEADERS_PROXY,
                timeout=cls.TIMEOUT,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"[search/tmdb] 中转站 HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"[search/tmdb] 中转站异常: {e}")
        return None

    @classmethod
    def _search_tmdb_with_fallback(
        cls, tmdb_id: int, episode: Optional[int], tmdb_id_type: int
    ) -> Tuple[Optional[Dict], str]:
        """TMDB 搜索：先官方 v2，失败后中转站 v1。返回 (响应, 来源)。"""
        result = cls._try_search_tmdb_official(tmdb_id, episode, tmdb_id_type)
        if result is not None:
            return result, "official"
        result = cls._try_search_tmdb_proxy(tmdb_id, episode, tmdb_id_type)
        if result is not None:
            return result, "proxy"
        return None, ""

    @classmethod
    def _manual_file_path(cls, directory: str) -> str:
        """返回目录内手动匹配信息 JSON 文件的绝对路径。"""
        return os.path.join(directory, cls.MANUAL_MATCH_FILE)

    @staticmethod
    def _normalize_episode(episode: Optional[int]) -> int:
        """将集数归一化为 >=1 的整数：无法解析或 <=0 时回退为 1。"""
        try:
            value = int(episode)
        except (TypeError, ValueError):
            value = 1
        return value if value > 0 else 1

    @staticmethod
    def _apply_episode_offset(episode: Optional[int], offset: Any) -> Optional[int]:
        """
        Shift local episode number to the dandanplay-side numbering.
        Local episode + offset = dandanplay episode, clamped to >= 1.
        """
        try:
            offset_int = int(offset)
        except (TypeError, ValueError):
            return episode
        if offset_int == 0:
            return episode
        try:
            episode_int = int(episode)
        except (TypeError, ValueError):
            episode_int = 1
        return max(1, episode_int + offset_int)

    @classmethod
    def _compose_comment_id(cls, anime_id: Any, episode: Optional[int]) -> Optional[str]:
        """将 anime_id 与集数组合为弹弹Play comment_id（animeId*10000+episode）；anime_id 非法返回 None。"""
        try:
            anime_id_int = int(anime_id)
        except (TypeError, ValueError):
            return None
        episode_int = cls._normalize_episode(episode)
        return str(anime_id_int * 10000 + episode_int)

    @classmethod
    def _write_manual_mapping(cls, directory: str, data: Dict[str, Any]) -> None:
        """将手动匹配数据（含规范化的 animeId 与时间戳）原子写入目录内 JSON 文件。"""
        if not directory:
            return
        anime_id = data.get("animeId") or data.get("anime_id")
        if anime_id is None:
            return
        try:
            anime_id_int = int(anime_id)
        except (TypeError, ValueError):
            logger.warning(f"手动匹配数据中的animeId无效: {anime_id}")
            return
        payload = dict(data)
        payload["animeId"] = anime_id_int
        payload.pop("anime_id", None)
        payload.setdefault("updatedAt", datetime.now().isoformat(timespec="seconds"))
        manual_path = cls._manual_file_path(directory)
        try:
            with open(manual_path, 'w', encoding='utf-8') as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            logger.info(f"已写入手动匹配文件: {manual_path}")
        except Exception as e:
            logger.error(f"写入手动匹配文件失败: {e}")

    @classmethod
    def _load_manual_mapping(cls, directory: str) -> Optional[Dict[str, Any]]:
        """
        从文件所在目录向上递归查找手动匹配信息，最多向上2层父目录。
        遇到 tvshow.nfo 则停止向上（防止跨番剧串位），兼容旧版 .id 文件。
        """
        if not directory or not os.path.isdir(directory):
            return None

        current = os.path.abspath(directory)
        for depth in range(3):  # 当前目录 + 向上2层父目录
            result = cls._try_read_manual_json(current, depth)
            if result is not None:
                return result

            # 兼容旧版 .id 文件（仅检查最初的目录）
            if depth == 0:
                result = cls._try_convert_legacy_id(current)
                if result is not None:
                    return result

            # 硬边界：当前目录是番剧根，不再向上
            # tvshow.nfo（Kodi/Emby/Jellyfin 标准）或存在 Season X 子目录
            if cls._is_show_root(current):
                break

            # 向上一级，已到根目录则停止
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent

        return None

    @staticmethod
    def _is_show_root(directory: str) -> bool:
        """
        判断目录是否为番剧根目录。
        信号1: 存在 tvshow.nfo（Kodi/Emby/Jellyfin 标准）
        信号2: 存在 Season X / Specials 子目录（无 NFO 时的兜底）
        """
        if not os.path.isdir(directory):
            return False
        # 信号1: tvshow.nfo
        if os.path.exists(os.path.join(directory, "tvshow.nfo")):
            return True
        # 信号2: Season X 或 Specials 子目录
        try:
            for name in os.listdir(directory):
                low = name.lower()
                if low.startswith("season") or low == "specials":
                    sub = os.path.join(directory, name)
                    if os.path.isdir(sub):
                        return True
        except OSError:
            pass
        return False

    @classmethod
    def _try_read_manual_json(cls, directory: str, depth: int) -> Optional[Dict[str, Any]]:
        """尝试从指定目录读取 .dandan.anime.json 匹配信息。"""
        manual_path = cls._manual_file_path(directory)
        if not os.path.exists(manual_path):
            return None
        try:
            with open(manual_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            anime_id = data.get("animeId") or data.get("anime_id")
            if anime_id is not None:
                if depth > 0:
                    logger.info(f"在父目录找到手动匹配: {directory} (向上{depth}层)")
                return data
        except Exception as e:
            logger.warning(f"读取手动匹配文件失败: {e}")
        return None

    @classmethod
    def _try_convert_legacy_id(cls, directory: str) -> Optional[Dict[str, Any]]:
        """兼容旧版 .id 文件，读取后自动转换为 .dandan.anime.json 并删除旧文件。"""
        try:
            if not os.path.isdir(directory):
                return None
            for file in os.listdir(directory):
                if not file.endswith('.id'):
                    continue
                legacy_path = os.path.join(directory, file)
                try:
                    anime_id = int(os.path.splitext(file)[0])
                except (TypeError, ValueError):
                    logger.warning(f"忽略无法解析的ID文件: {legacy_path}")
                    continue
                data = {
                    "animeId": anime_id,
                    "source": "legacy-id-file",
                    "updatedAt": datetime.now().isoformat(timespec="seconds")
                }
                cls._write_manual_mapping(directory, data)
                try:
                    os.remove(legacy_path)
                    logger.info(f"已转换旧的ID文件并移除: {legacy_path}")
                except Exception as err:
                    logger.warning(f"移除旧ID文件失败: {err}")
                return data
        except Exception as e:
            logger.warning(f"检查手动匹配目录失败: {e}")
        return None

    @staticmethod
    def calculate_md5_of_first_16MB(file_path: str) -> str:
        """计算文件前 16MB 的 MD5 哈希（弹弹Play 匹配用），读取失败返回空字符串。"""
        md5 = hashlib.md5()
        size_16MB = 16 * 1024 * 1024
        try:
            with open(file_path, 'rb') as f:
                data = f.read(size_16MB)
            md5.update(data)
            return md5.hexdigest()
        except Exception as e:
            logger.error(f"计算MD5失败: {e}")
            return ""

    @staticmethod
    def get_video_duration(file_path: str) -> Optional[float]:
        """通过 ffmpeg 探测视频时长（秒，浮点），超时或失败返回 None。"""
        try:
            process = subprocess.Popen(
                ['ffmpeg', '-i', file_path],
                stderr=subprocess.PIPE,
                stdout=subprocess.PIPE
            )
            try:
                _, stderr = process.communicate(timeout=120)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
                logger.error(f"获取视频时长超时(120s): {file_path}")
                return None
            stderr = stderr.decode('utf-8', errors='ignore')
            duration_match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", stderr)
            if duration_match:
                hours, minutes, seconds = map(float, duration_match.groups())
                return hours * 3600 + minutes * 60 + seconds
            return None
        except Exception as e:
            logger.error(f"获取视频时长失败: {e}")
            return None

    @staticmethod
    def get_file_size(file_path: str) -> int:
        """返回文件字节大小，失败返回 0。"""
        try:
            return os.path.getsize(file_path)
        except Exception as e:
            logger.error(f"获取文件大小失败: {e}")
            return 0

    @staticmethod
    def search_by_tmdb_id(tmdb_id: int, episode: Optional[int] = None, tmdb_id_type: int = 0) -> Optional[str]:
        """
        使用TMDB ID搜索弹幕（先官方 v2，失败后中转站 v1 兜底）
        :param tmdb_id: TMDB ID
        :param episode: 集数
        :param tmdb_id_type: TMDB ID类型，0=电视剧，1=电影
        :return: 弹幕ID
        """
        result, source = DanmuAPI._search_tmdb_with_fallback(tmdb_id, episode, tmdb_id_type)
        if result is None:
            logger.error(f"[search_by_tmdb_id] 官方和中转站均失败: tmdb_id={tmdb_id}")
            return None
        # 官方和中转站响应结构基本一致（均含 success / hasMore / animes / episodes）
        if result.get("success") and not result.get("hasMore"):
            animes = result.get("animes", [])
            if animes and len(animes) > 0:
                episodes = animes[0].get("episodes", [])
                if episodes and len(episodes) > 0:
                    logger.info(f"[search_by_tmdb_id] 来源={source} tmdb_id={tmdb_id}")
                    return str(episodes[0].get("episodeId"))
        return None

    @staticmethod
    def get_comment_id(
        file_path: str,
        use_tmdb_id: bool = False,
        tmdb_id: Optional[int] = None,
        episode: Optional[int] = None,
        cache_ttl: Optional[int] = None,
        tmdb_id_type: int = 0
    ) -> Optional[str]:
        """
        获取弹幕ID
        :param file_path: 视频文件路径
        :param use_tmdb_id: 是否使用TMDB ID
        :param tmdb_id: TMDB ID
        :param episode: 集数
        :param tmdb_id_type: TMDB ID类型，0=电视剧，1=电影
        :return: 弹幕ID
        """
        try:
            # 检查是否为.strm文件
            if StrmProcessor.is_strm_file(file_path):
                logger.info(f"检测到.strm文件: {file_path}")
                # 读取.strm文件内容
                strm_url = StrmProcessor.get_strm_url(file_path)
                if strm_url:
                    logger.info(f"STRM文件指向: {strm_url}")
                # 对于.strm文件，强制使用TMDB ID匹配
                if tmdb_id is not None:
                    logger.info(f"为.strm文件使用TMDB ID匹配: {tmdb_id}")
                    comment_id = DanmuAPI.search_by_tmdb_id(tmdb_id, episode, tmdb_id_type)
                    if comment_id:
                        return comment_id
                else:
                    logger.warning(f".strm文件未提供TMDB ID，无法进行弹幕匹配: {file_path}")
                # .strm文件如果没有TMDB ID，直接返回None
                return None

            # 普通视频文件的处理逻辑
            file_name = os.path.basename(file_path)
            file_size = DanmuAPI.get_file_size(file_path)
            file_hash = DanmuAPI.calculate_md5_of_first_16MB(file_path)
            video_info = VideoInfo(
                file_name=file_name,
                file_hash=file_hash,
                file_size=file_size,
                video_duration=int(DanmuAPI.get_video_duration(file_path) or 0)
            )

            video_dir = os.path.dirname(file_path)
            manual_mapping = DanmuAPI._load_manual_mapping(video_dir)
            if manual_mapping:
                manual_episode = DanmuAPI._apply_episode_offset(
                    episode, manual_mapping.get("episodeOffset")
                )
                manual_comment = DanmuAPI._compose_comment_id(
                    manual_mapping.get("animeId") or manual_mapping.get("anime_id"),
                    manual_episode
                )
                if manual_comment:
                    logger.info(f"使用目录手动匹配ID: {manual_comment}")
                    return manual_comment

            # 使用 match API：先官方 v2，失败后中转站 v1 兜底
            result, source = DanmuAPI._match_with_fallback(video_info)
            if result is not None and result.get("isMatched") and result.get("matches"):
                logger.info(f"[get_comment_id] 来源={source} file={os.path.basename(file_path)}")
                return str(result["matches"][0]["episodeId"])

            # 如果使用TMDB ID且提供了TMDB ID，尝试使用TMDB ID匹配
            if use_tmdb_id and tmdb_id is not None:
                comment_id = DanmuAPI.search_by_tmdb_id(tmdb_id, episode, tmdb_id_type)
                if comment_id:
                    return comment_id

            return None
        except Exception as e:
            logger.error(f"获取弹幕ID失败: {e}")
            return None

    @staticmethod
    def get_title_from_nfo(file_path: str) -> Optional[str]:
        """从同路径 .nfo 文件中解析 <title> 作为番剧名称，未找到或失败返回 None。"""
        nfo_file = os.path.splitext(file_path)[0] + '.nfo'
        try:
            with open(nfo_file, 'r', encoding='utf-8') as f:
                nfo_content = f.read()
            title_match = re.search(r'<title>(.*)</title>', nfo_content)
            if title_match:
                logger.info(f'从nfo文件中获取标题 - {title_match.group(1)}')
                return title_match.group(1)
            logger.error('未找到标题信息')
            return None
        except Exception as e:
            logger.error(f'读取nfo文件失败: {e}')
            return None

    @classmethod
    def get_comments(
        cls,
        comment_id: str,
        cache_ttl: Optional[int] = None,
        ch_convert: int = 0,
    ) -> Optional[Dict]:
        """
        获取弹幕内容（先官方 v2，失败后中转站 v1 兜底）
        :param comment_id: 弹幕ID
        :param cache_ttl: 缓存时间（分钟），仅中转站接收；官方 v2 客户端自行缓存
        :param ch_convert: 0=不转换(默认), 1=转简体, 2=转繁体（弹弹play 服务端处理，不消耗本地资源）
        :return: 弹幕数据
        """
        result, source = cls._get_comments_with_fallback(comment_id, cache_ttl, ch_convert)
        if result is not None:
            logger.info(f"[get_comments] 来源={source} comment_id={comment_id} ch_convert={ch_convert}")
            return result
        logger.error(f"[get_comments] 官方和中转站均失败: comment_id={comment_id}")
        return None


class DanmuConverter:
    """弹幕格式转换器：将弹幕 JSON 数据转换为 ASS 字幕格式并写入文件。"""

    @staticmethod
    def convert_timestamp(timestamp: float) -> str:
        """将弹幕时间轴（秒，浮点）转换为 ASS 时间码 H:MM:SS.CC。"""
        timestamp = round(timestamp * 100.0)
        hour, minute = divmod(timestamp, 360000)
        minute, second = divmod(minute, 6000)
        second, centsecond = divmod(second, 100)
        return f'{int(hour)}:{int(minute):02d}:{int(second):02d}.{int(centsecond):02d}'

    @staticmethod
    def write_ass_head(f, width: int, height: int, fontface: str, fontsize: float, alpha: float, styleid: str):
        """写入 ASS 文件头（Script Info + 样式定义），根据 alpha 计算 ASS 透明度并反转。"""
        # 将透明度从0-1转换为0-255，并反转（因为ASS中0是完全不透明，255是完全透明）
        alpha_value = int((1 - alpha) * 255)
        f.write(
            f'''[Script Info]
; Script generated by Hankun
; Super thanks to https://github.com/m13253/danmaku2ass
; and https://www.dandanplay.com/
Script Updated By: MoviePilot Danmu Plugin
https://github.com/HankunYu/MoviePilot-Plugins
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
Aspect Ratio: {width}:{height}
Collisions: Normal
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: {styleid}, {fontface}, {fontsize:.0f}, &H{alpha_value:02X}FFFFFF, &H{alpha_value:02X}FFFFFF, &H{alpha_value:02X}000000, &H{alpha_value:02X}000000, 0, 0, 0, 0, 100, 100, 0.00, 0.00, 1, {max(fontsize / 25.0, 1):.0f}, 0, 7, 0, 0, 0, 0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
        )

    @staticmethod
    def find_non_overlapping_track(tracks: Dict[int, float], current_time: float, max_tracks: int) -> Optional[int]:
        """在弹幕轨道中查找当前时间空闲的轨道；全部占用时返回 None 以避免重叠。"""
        for track in range(1, max_tracks + 1):
            if track not in tracks or current_time >= tracks[track]:
                return track
        # 所有轨道都被占用时返回None，避免强行使用忙碌轨道导致重叠
        return None

    @classmethod
    def convert_comments_to_ass(
        cls,
        comments: List[Dict],
        output_file: str,
        width: int,
        height: int,
        fontface: str,
        fontsize: float,
        alpha: float,
        duration: float,
        screen_area: str = 'full'
    ):
        """将弹幕评论列表转换为 ASS 字幕文件：按屏幕区域计算轨道数，滚动/顶部/底部弹幕分别分配空闲轨道以避免重叠。"""
        styleid = 'Danmu'

        # 根据屏幕区域计算有效高度和轨道数
        if screen_area == 'half':
            effective_height = height // 2  # 上半屏
            logger.info(f"使用半屏弹幕模式，有效高度: {effective_height}")
        elif screen_area == 'quarter':
            effective_height = height // 4  # 上1/4屏
            logger.info(f"使用1/4屏弹幕模式，有效高度: {effective_height}")
        else:  # full
            effective_height = height
            logger.info(f"使用全屏弹幕模式，有效高度: {effective_height}")

        max_tracks = int(effective_height) // int(fontsize)
        logger.info(f"最大弹幕轨道数: {max_tracks}")

        scrolling_tracks = {}
        top_tracks = {}
        bottom_tracks = {}

        logger.info(f"{output_file} - 共匹配到{len(comments)}条弹幕。")

        with open(output_file, 'w', encoding='utf-8') as f:
            cls.write_ass_head(f, width, height, fontface, fontsize, alpha, styleid)

            for comment in comments:
                try:
                    p = comment.get('p', '').split(',')
                    if len(p) < 3:
                        logger.warning(f"弹幕数据格式不正确: {comment}")
                        continue

                    timeline = float(p[0])
                    pos = int(p[1])
                    color = int(p[2])
                    text = comment.get('m', '')
                    user = str(p[3])

                    if not text:
                        continue

                    start_time = cls.convert_timestamp(timeline)
                    end_time = cls.convert_timestamp(timeline + duration)

                    gap = 1
                    text_width = len(text) * fontsize * 0.6
                    velocity = (width + text_width) / duration
                    leave_time = text_width / velocity + gap

                    color_hex = f'&H{color & 0xFFFFFF:06X}'
                    styles = ''

                    if pos == 1:  # 滚动弹幕
                        track_id = cls.find_non_overlapping_track(scrolling_tracks, timeline, max_tracks)
                        if track_id is None:
                            continue  # 全部轨道占用，跳过避免重叠
                        scrolling_tracks[track_id] = timeline + leave_time
                        initial_y = (track_id - 1) * fontsize + 10
                        styles = f'\\move({width}, {initial_y}, {-len(text)*fontsize}, {initial_y})'
                    elif pos == 4:  # 底部弹幕
                        track_id = cls.find_non_overlapping_track(bottom_tracks, timeline, max_tracks)
                        if track_id is None:
                            continue  # 全部轨道占用，跳过避免重叠
                        bottom_tracks[track_id] = timeline + duration
                        # 底部弹幕需要根据屏幕区域调整位置
                        if screen_area == 'half':
                            bottom_y = effective_height - 10 - (track_id - 1) * fontsize
                        elif screen_area == 'quarter':
                            bottom_y = effective_height - 10 - (track_id - 1) * fontsize
                        else:
                            bottom_y = height - 50 - (track_id - 1) * fontsize
                        styles = f'\\an2\\pos({width/2}, {bottom_y})'
                    elif pos == 5:  # 顶部弹幕
                        track_id = cls.find_non_overlapping_track(top_tracks, timeline, max_tracks)
                        if track_id is None:
                            continue  # 全部轨道占用，跳过避免重叠
                        top_tracks[track_id] = timeline + duration
                        styles = f'\\an8\\pos({width/2}, {50 + (track_id - 1) * fontsize})'
                    else:
                        styles = f'\\move(0, 0, {width}, 0)'

                    f.write(f'Dialogue: 0,{start_time},{end_time},{styleid},,0,0,0,,{{\\c{color_hex}{styles}}}{text}\n')

                except Exception as e:
                    logger.error(f"处理弹幕数据失败: {e}, 弹幕数据: {comment}")
                    continue

        logger.info('弹幕生成成功 - ' + output_file)


class SubtitleProcessor:
    """字幕文件处理器：通过 ffprobe 分析视频流、提取/合并字幕轨道。"""

    @staticmethod
    def get_video_streams(file_path: str) -> Dict:
        """通过 ffprobe 获取视频流/格式信息 JSON，失败返回空字典。"""
        try:
            result = subprocess.run(
                ['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            return json.loads(result.stdout) if result.returncode == 0 else {}
        except Exception as e:
            logger.error(f"获取视频流信息失败: {e}")
            return {}

    @staticmethod
    def get_video_resolution(file_path: str) -> Tuple[int, int]:
        """
        获取视频的真实分辨率
        :param file_path: 视频文件路径
        :return: (宽度, 高度) 元组
        """
        try:
            # .strm文件无法直接获取视频分辨率，使用默认值
            if StrmProcessor.is_strm_file(file_path):
                logger.info(f".strm文件使用默认分辨率: 1920x1080")
                return 1920, 1080

            streams_info = SubtitleProcessor.get_video_streams(file_path)
            for stream in streams_info.get('streams', []):
                if stream.get('codec_type') == 'video':
                    width = stream.get('width', 1920)
                    height = stream.get('height', 1080)
                    logger.info(f"检测到视频分辨率: {width}x{height}")
                    return width, height
            logger.warning(f"未找到视频流，使用默认分辨率: 1920x1080")
            return 1920, 1080
        except Exception as e:
            logger.error(f"获取视频分辨率失败: {e}，使用默认分辨率: 1920x1080")
            return 1920, 1080

    @staticmethod
    def extract_subtitles(file_path: str, output_file: str, stream_index: int) -> bool:
        """使用 ffmpeg 将指定字幕流提取为 ASS 文件，成功返回 True。"""
        try:
            result = subprocess.run(
                ['ffmpeg', '-i', file_path, '-map', f'0:{stream_index}', '-c:s', 'ass', output_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"提取字幕失败: {e}")
            return False

    @classmethod
    def try_extract_sub(cls, file_path: str):
        """尝试从视频中提取中文内嵌字幕并保存为 .ass；成功提取一个即停止。"""
        streams_info = cls.get_video_streams(file_path)
        for stream in streams_info.get('streams', []):
            if stream.get('codec_type') == 'subtitle':
                stream_index = stream['index']
                base_name = os.path.splitext(file_path)[0]
                language = stream.get('tags', {}).get('language', 'unknown')
                if language not in ['zh', 'zho', 'chi', 'chs', 'cht', 'cn']:
                    continue
                output_file = f"{base_name}.{language}.ass"
                if os.path.exists(output_file):
                    os.remove(output_file)
                if cls.extract_subtitles(file_path, output_file, stream_index):
                    logger.info(f'成功提取内嵌字幕 - {output_file}')
                    break

    # 字幕查找结果缓存：避免每次刮削都全目录 os.walk 扫描。
    # key = 视频文件路径，value = (目录 mtime, 查找结果或 None)。
    # 当目录内容变化（新增字幕）导致 mtime 改变时自动失效，从而支持“补齐原字幕后重新合并”。
    _subtitle_cache: Dict[str, Tuple[float, Optional[str]]] = {}

    @classmethod
    def find_subtitle_file(cls, file_path: str) -> Optional[str]:
        """在视频同目录递归查找匹配的同名字幕文件，优先返回 .ass/.ssa，其次 .srt。
        结果按目录缓存，避免批量刮削时重复全目录扫描。"""
        directory = os.path.dirname(file_path)
        try:
            dir_mtime = os.path.getmtime(directory)
        except OSError:
            dir_mtime = 0.0
        cached = cls._subtitle_cache.get(file_path)
        if cached is not None and cached[0] == dir_mtime:
            return cached[1]
        result = cls._scan_subtitle_file(file_path)
        cls._subtitle_cache[file_path] = (dir_mtime, result)
        return result

    @classmethod
    def clear_subtitle_cache(cls):
        """清空字幕查找缓存（重新合并或目录变更时调用）。"""
        cls._subtitle_cache.clear()

    @classmethod
    def _scan_subtitle_file(cls, file_path: str) -> Optional[str]:
        """实际执行目录扫描查找字幕文件（被 find_subtitle_file 以缓存方式调用）。"""
        filename = os.path.splitext(os.path.basename(file_path))[0]
        ass_candidates = []
        srt_candidates = []
        for root, _, files in os.walk(os.path.dirname(file_path)):
            for file in files:
                if 'danmu' in file or not file.startswith(filename):
                    continue
                full_path = os.path.join(root, file)
                if file.endswith(('.ass', '.ssa')):
                    ass_candidates.append(full_path)
                elif file.endswith('.srt'):
                    srt_candidates.append(full_path)
        # Prefer .ass/.ssa over .srt for richer style information
        if ass_candidates:
            logger.info(f"找到字幕文件 - {ass_candidates[0]}")
            return ass_candidates[0]
        if srt_candidates:
            logger.info(f"找到字幕文件 - {srt_candidates[0]}")
            return srt_candidates[0]
        logger.debug("没找到字幕文件（原生字幕缺失，将仅生成纯弹幕 ASS）")
        return None

    @staticmethod
    def can_extract_subtitles(file_path: str) -> bool:
        """检查是否可以从文件中提取字幕"""
        # .strm文件无法提取内嵌字幕
        return not StrmProcessor.is_strm_file(file_path)

    @staticmethod
    def _convert_srt_timestamp_to_ass(srt_ts: str) -> str:
        """Convert SRT timestamp HH:MM:SS,mmm to ASS H:MM:SS.CC"""
        srt_ts = srt_ts.strip().replace(',', '.')
        parts = srt_ts.split(':')
        if len(parts) != 3:
            return '0:00:00.00'
        hours = int(parts[0])
        minutes = int(parts[1])
        sec_parts = parts[2].split('.')
        seconds = int(sec_parts[0])
        ms_str = sec_parts[1] if len(sec_parts) > 1 else '0'
        ms_str = ms_str.ljust(3, '0')[:3]  # Normalize to exactly 3 digits
        centiseconds = int(ms_str) // 10
        return f'{hours}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}'

    @staticmethod
    def _parse_srt_to_ass_events(srt_content: str, style_name: str) -> List[str]:
        """Parse SRT content into ASS Dialogue lines"""
        # Strip HTML tags commonly found in SRT
        html_tag_re = re.compile(r'<[^>]+>')
        timestamp_re = re.compile(
            r'(\d+:\d{2}:\d{2}[,.]\d+)\s*-->\s*(\d+:\d{2}:\d{2}[,.]\d+)'
        )
        # Normalize line endings (handles \r\n and \r)
        srt_content = srt_content.replace('\r\n', '\n').replace('\r', '\n')
        blocks = re.split(r'\n\s*\n', srt_content.strip())
        lines = []
        for block in blocks:
            block_lines = block.strip().splitlines()
            if len(block_lines) < 2:
                continue
            ts_match = None
            text_start = 0
            for i, line in enumerate(block_lines):
                ts_match = timestamp_re.search(line)
                if ts_match:
                    text_start = i + 1
                    break
            if not ts_match or text_start >= len(block_lines):
                continue
            start = SubtitleProcessor._convert_srt_timestamp_to_ass(ts_match.group(1))
            end = SubtitleProcessor._convert_srt_timestamp_to_ass(ts_match.group(2))
            # Join multiline text with ASS line break \N and strip HTML tags
            text_parts = []
            for tl in block_lines[text_start:]:
                cleaned = html_tag_re.sub('', tl.strip())
                if cleaned:
                    text_parts.append(cleaned)
            text = r'\N'.join(text_parts)
            if text:
                lines.append(
                    f'Dialogue: 0,{start},{end},{style_name},,0,0,0,,{text}'
                )
        return lines

    @staticmethod
    def _generate_srt_ass_style(width: int, fontface: str, fontsize: float) -> str:
        """Generate an ASS style line for SRT subtitles (white text, black border, bottom center)"""
        return (
            f'Style: SubtitleSRT, {fontface}, {fontsize:.0f}, '
            f'&H00FFFFFF, &H00FFFFFF, &H00000000, &H80000000, '
            f'0, 0, 0, 0, 100, 100, 0.00, 0.00, 1, '
            f'{max(fontsize / 25.0, 1):.0f}, 0, 2, 20, 20, 20, 0'
        )

    @staticmethod
    def _scale_ass_events(events_text: str, ratio_x: float, ratio_y: float) -> str:
        """
        Scale absolute coordinates and inline font sizes in ASS Dialogue lines.
        Handles: \\pos, \\org, \\move (first 4 coords), rectangular \\clip/\\iclip,
        and inline \\fs overrides. Does NOT touch vector clips or \\p drawing paths.
        """
        def _scale_coord_pair(m: re.Match) -> str:
            """Scale a 2-arg tag like \\pos(x,y) or \\org(x,y)"""
            tag = m.group(1)
            x = float(m.group(2)) * ratio_x
            y = float(m.group(3)) * ratio_y
            return f'\\{tag}({x:.2f},{y:.2f})'

        def _scale_move(m: re.Match) -> str:
            """Scale \\move(x1,y1,x2,y2[,t1,t2]) — only scale the first 4 coords"""
            x1 = float(m.group(1)) * ratio_x
            y1 = float(m.group(2)) * ratio_y
            x2 = float(m.group(3)) * ratio_x
            y2 = float(m.group(4)) * ratio_y
            rest = m.group(5)  # optional ",t1,t2" or empty
            return f'\\move({x1:.2f},{y1:.2f},{x2:.2f},{y2:.2f}{rest})'

        def _scale_rect_clip(m: re.Match) -> str:
            """Scale rectangular \\clip(x1,y1,x2,y2) or \\iclip(...)"""
            tag = m.group(1)  # "clip" or "iclip"
            x1 = float(m.group(2)) * ratio_x
            y1 = float(m.group(3)) * ratio_y
            x2 = float(m.group(4)) * ratio_x
            y2 = float(m.group(5)) * ratio_y
            return f'\\{tag}({x1:.2f},{y1:.2f},{x2:.2f},{y2:.2f})'

        def _scale_fs(m: re.Match) -> str:
            """Scale inline \\fs (but not \\fsp, \\fscx, \\fscy)"""
            size = float(m.group(1)) * ratio_y
            return f'\\fs{size:.0f}'

        # Pre-compile patterns
        # \\pos(x,y) or \\org(x,y) — closing ')' is optional for malformed ASS
        re_coord_pair = re.compile(
            r'\\(pos|org)\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?'
        )
        # \\move(x1,y1,x2,y2[,t1,t2]) — closing ')' is optional
        re_move = re.compile(
            r'\\move\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,'
            r'\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*((?:,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*)?)\)?'
        )
        # Rectangular \\clip / \\iclip with exactly 4 numeric args — closing ')' is optional
        re_rect_clip = re.compile(
            r'\\(i?clip)\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,'
            r'\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?'
        )
        # Inline \\fs followed by digits (not \\fsp, \\fscx, \\fscy)
        re_fs = re.compile(r'\\fs(\d+(?:\.\d+)?)(?![a-zA-Z])')

        result_lines = []
        for line in events_text.splitlines():
            if not line.startswith('Dialogue:'):
                result_lines.append(line)
                continue

            # Scale Dialogue margins (parts[5]=MarginL, [6]=MarginR, [7]=MarginV)
            parts = line.split(',', 9)
            if len(parts) >= 10:
                for idx, ratio in ((5, ratio_x), (6, ratio_x), (7, ratio_y)):
                    val = parts[idx].strip()
                    if val and int(val) != 0:
                        parts[idx] = str(int(int(val) * ratio))
                line = ','.join(parts)

            # Scale override tags in the Text field
            line = re_coord_pair.sub(_scale_coord_pair, line)
            line = re_move.sub(_scale_move, line)
            line = re_rect_clip.sub(_scale_rect_clip, line)
            line = re_fs.sub(_scale_fs, line)
            result_lines.append(line)

        return '\n'.join(result_lines)

    # Style-name keywords that mark effect/sign subtitles (never blurred)
    _EFFECT_STYLE_KEYWORDS = (
        'sign', 'title', 'op', 'ed', 'screen', 'note',
        'comment', 'insert', 'overlap', 'flashback', 'song',
        'karaoke', 'staff', 'logo'
    )
    # Inline tags that mark positioned/transformed lines.
    # \\fad/\\fade are common in plain dialogue and intentionally NOT listed.
    _EFFECT_TEXT_TAGS = (
        '\\pos', '\\move', '\\org', '\\clip', '\\iclip',
        '\\fr', '\\fax', '\\fay', '\\t('
    )
    _RE_DRAWING_TAG = re.compile(r'\\p\d')  # \\p1 drawing mode (\\pos not matched: needs a digit)
    _RE_KARAOKE_TAG = re.compile(r'\\[kK][fo]?\d')

    @classmethod
    def _is_effect_dialogue(cls, style_name: str, text: str) -> bool:
        """
        判断是否为特效字幕行（定位/旋转/变换/绘图/卡拉OK等），特效行不加blur
        :param style_name: 样式名
        :param text: 事件文本字段
        """
        style_lower = style_name.lower()
        for keyword in cls._EFFECT_STYLE_KEYWORDS:
            if keyword in style_lower:
                return True
        for tag in cls._EFFECT_TEXT_TAGS:
            if tag in text:
                return True
        if cls._RE_DRAWING_TAG.search(text) or cls._RE_KARAOKE_TAG.search(text):
            return True
        # \\an non-bottom alignment (1,2,3 are bottom)
        an_match = re.search(r'\\an(\d)', text)
        if an_match and int(an_match.group(1)) > 3:
            return True
        # Legacy \\a non-bottom alignment
        a_match = re.search(r'\\a(\d+)', text)
        if a_match and int(a_match.group(1)) not in (1, 2, 3):
            return True
        return False

    @staticmethod
    def _resolve_playres(content: str) -> Tuple[Optional[int], Optional[int]]:
        """从ASS内容中解析PlayResX/PlayResY，缺失的返回None"""
        mx = re.search(r"PlayResX:\s*(\d+)", content)
        my = re.search(r"PlayResY:\s*(\d+)", content)
        return (int(mx.group(1)) if mx else None, int(my.group(1)) if my else None)

    @staticmethod
    def combine_sub_ass(sub1: str, sub2: str, video_file_path: str = None) -> bool:
        """将弹幕 ASS 与原字幕合并：弹幕坐标重缩放到原字幕空间并写入，返回是否合并成功。"""
        if not sub1 or not sub2:
            return False
        try:
            # If sub2 is already a merged file, use the original subtitle instead
            sub2_base, sub2_ext = os.path.splitext(sub2)
            if sub2_base.endswith('.withDanmu'):
                original_sub2 = sub2_base[:-len('.withDanmu')] + sub2_ext
                if os.path.exists(original_sub2):
                    logger.info(f"检测到已合并字幕，使用原始字幕: {original_sub2}")
                    sub2 = original_sub2
                else:
                    logger.warning(f"已合并字幕的原始文件不存在: {original_sub2}")
                    return False

            with open(sub1, 'r', encoding='utf-8-sig') as f:
                sub1_content = f.read()
            with open(sub2, 'rb') as f:
                raw_data = f.read()
            result = chardet.detect(raw_data)
            file_encoding = result['encoding']
            with open(sub2, 'r', encoding=file_encoding) as f:
                sub2_content = f.read()

            if os.path.splitext(sub2)[1].lower() in ['.ass', '.ssa']:
                # Reverse-merge: the original subtitle is the base and is kept
                # byte-identical (header, styles, events untouched except the
                # optional blur tag on plain bottom dialogue). The danmu events
                # are rescaled INTO the original subtitle's coordinate space —
                # danmu is machine-generated (one style + \\move/\\pos only), so
                # scaling it is fully reliable, unlike scaling hand-authored
                # effect subtitles.
                # Danmu resolution: we always write PlayRes into the danmu header
                d_x, d_y = SubtitleProcessor._resolve_playres(sub1_content)
                d_x, d_y = d_x or 1920, d_y or 1080
                # Original resolution per ASS spec: both missing -> 384x288,
                # one missing -> derived from the other at 4:3
                s_x, s_y = SubtitleProcessor._resolve_playres(sub2_content)
                if s_x is None and s_y is None:
                    s_x, s_y = 384, 288
                elif s_x is None:
                    s_x = round(s_y * 4 / 3)
                elif s_y is None:
                    s_y = round(s_x * 3 / 4)
                ratio_x = s_x / d_x
                ratio_y = s_y / d_y
                need_scale = not (ratio_x == 1.0 and ratio_y == 1.0)
                if need_scale:
                    logger.info(
                        f"弹幕坐标缩放: danmu {d_x}x{d_y} -> 原字幕 {s_x}x{s_y}, "
                        f"ratio={ratio_x:.4f}x{ratio_y:.4f}"
                    )

                # Extract the danmu style line and dialogue events
                danmu_style_match = re.search(r'^Style:.*$', sub1_content, re.MULTILINE)
                if not danmu_style_match:
                    logger.error(f"弹幕文件中未找到样式行: {sub1}")
                    return False
                danmu_style_line = danmu_style_match.group()
                danmu_event_lines = [
                    line for line in sub1_content.splitlines()
                    if line.startswith('Dialogue:')
                ]

                if need_scale:
                    # Danmu style: Fontsize (idx 2) and Outline (idx 16) follow Y axis
                    fields = danmu_style_line.split(',')
                    if len(fields) >= 17:
                        fields[2] = f'{max(float(fields[2]) * ratio_y, 1):.0f}'
                        fields[16] = f'{max(float(fields[16]) * ratio_y, 0.5):.2f}'
                    danmu_style_line = ','.join(fields)
                    danmu_event_lines = SubtitleProcessor._scale_ass_events(
                        '\n'.join(danmu_event_lines), ratio_x, ratio_y
                    ).splitlines()

                # Rename the danmu style if it collides with an original style name
                danmu_style_name = danmu_style_line.split(':', 1)[1].split(',')[0].strip()
                sub2_style_names = {
                    line.split(':', 1)[1].split(',')[0].strip()
                    for line in re.findall(r'^Style:.*$', sub2_content, re.MULTILINE)
                }
                if danmu_style_name in sub2_style_names:
                    new_name = danmu_style_name
                    while new_name in sub2_style_names:
                        new_name += '_MP'
                    fields = danmu_style_line.split(',')
                    fields[0] = f'Style: {new_name}'
                    danmu_style_line = ','.join(fields)
                    renamed = []
                    for line in danmu_event_lines:
                        parts = line.split(',', 9)
                        if len(parts) >= 10:
                            parts[3] = new_name
                            renamed.append(','.join(parts))
                        else:
                            renamed.append(line)
                    danmu_event_lines = renamed
                    logger.info(f"弹幕样式名与原字幕冲突，重命名为: {new_name}")

                # Locate the original subtitle's sections to find insertion
                # points and collect per-style alignment for the blur filter
                sub2_lines = sub2_content.splitlines()
                section = None
                styles_format_idx = None  # v4+ styles Format line (danmu style goes after it)
                events_format_idx = None  # events Format line (danmu events go after it)
                events_fields = None  # parsed events Format fields, lowercased
                styles_fields = None
                style_alignments = {}  # style name -> Alignment value

                for i, raw in enumerate(sub2_lines):
                    line = raw.strip()
                    if line.startswith('[') and line.endswith(']'):
                        section = line.lower()
                        continue
                    lower = line.lower()
                    if section in ('[v4+ styles]', '[v4 styles]', '[v4++ styles]'):
                        if lower.startswith('format:'):
                            styles_fields = [f.strip().lower() for f in line.split(':', 1)[1].split(',')]
                            # Only insert our v4+ style line into a v4+ section
                            if section != '[v4 styles]' and styles_format_idx is None:
                                styles_format_idx = i
                        elif lower.startswith('style:') and styles_fields:
                            values = line.split(':', 1)[1].split(',')
                            try:
                                name_i = styles_fields.index('name')
                                align_i = styles_fields.index('alignment')
                                style_alignments[values[name_i].strip()] = int(float(values[align_i]))
                            except (ValueError, IndexError):
                                pass
                    elif section == '[events]':
                        if lower.startswith('format:') and events_format_idx is None:
                            events_fields = [f.strip().lower() for f in line.split(':', 1)[1].split(',')]
                            events_format_idx = i

                # Danmu events use the standard v4+ field order; if the original
                # declares a different one, fall back to a separate [Events] section
                standard_events = ['layer', 'start', 'end', 'style', 'name',
                                   'marginl', 'marginr', 'marginv', 'effect', 'text']
                events_insertable = events_fields == standard_events

                def _blur_dialogue(raw_line: str) -> str:
                    """为无特效的底部对白追加柔和模糊，提升纯白字幕在亮背景下的可读性"""
                    if not events_fields or events_fields[-1] != 'text':
                        return raw_line
                    text_i = len(events_fields) - 1
                    body = raw_line.split(':', 1)[1]
                    parts = body.split(',', text_i)
                    if len(parts) <= text_i:
                        return raw_line
                    style_name = parts[events_fields.index('style')].strip() \
                        if 'style' in events_fields else ''
                    effect_val = parts[events_fields.index('effect')].strip() \
                        if 'effect' in events_fields else ''
                    text = parts[text_i]
                    # Skip: Banner/Scroll effects, non-bottom styles, effect lines
                    if effect_val:
                        return raw_line
                    if style_alignments.get(style_name) not in (None, 1, 2, 3):
                        return raw_line
                    if SubtitleProcessor._is_effect_dialogue(style_name, text):
                        return raw_line
                    if text.startswith('{'):
                        parts[text_i] = '{\\blur10' + text[1:]
                    else:
                        parts[text_i] = '{\\blur10}' + text
                    return 'Dialogue:' + ','.join(parts)

                # Assemble: original lines pass through untouched (blur aside),
                # danmu style/events are inserted right after the Format lines
                output_lines = []
                in_events = False
                style_inserted = False
                events_inserted = False

                for i, raw in enumerate(sub2_lines):
                    stripped = raw.strip()
                    if stripped.startswith('[') and stripped.endswith(']'):
                        in_events = stripped.lower() == '[events]'

                    if in_events and raw.startswith('Dialogue:'):
                        output_lines.append(_blur_dialogue(raw))
                    else:
                        output_lines.append(raw)

                    if i == styles_format_idx:
                        output_lines.append(danmu_style_line)
                        style_inserted = True
                    if i == events_format_idx and events_insertable:
                        output_lines.extend(danmu_event_lines)
                        events_inserted = True

                # Fallbacks for non-standard structures: append separate
                # sections at the end (renderers merge same-named sections)
                if not style_inserted:
                    output_lines += [
                        '',
                        '[V4+ Styles]',
                        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, '
                        'OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, '
                        'ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, '
                        'Alignment, MarginL, MarginR, MarginV, Encoding',
                        danmu_style_line
                    ]
                if not events_inserted:
                    output_lines += [
                        '',
                        '[Events]',
                        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
                    ]
                    output_lines += danmu_event_lines

                output = os.path.splitext(sub2)[0] + ".withDanmu.ass"
                with open(output, 'w', encoding='utf-8-sig') as f:
                    f.write('\n'.join(output_lines))
                    f.write('\n')
                logger.info(f"字幕合并完成（原字幕保持原样）: {output}")
                return True

            elif os.path.splitext(sub2)[1].lower() == '.srt':
                # Parse SRT and convert to ASS events
                dialogue_lines = SubtitleProcessor._parse_srt_to_ass_events(
                    sub2_content, 'SubtitleSRT'
                )
                if not dialogue_lines:
                    logger.warning(f"SRT字幕解析为空: {sub2}")
                    return False

                # Get resolution from danmu file for style generation
                sub1ResX = re.search(r"PlayResX:\s*(\d+)", sub1_content)
                width = int(sub1ResX.group(1)) if sub1ResX else 1920

                srt_style = SubtitleProcessor._generate_srt_ass_style(
                    width, 'Arial', 50
                )

                # Apply blur to SRT dialogue lines
                blurred_lines = []
                for line in dialogue_lines:
                    parts = line.split(',', 9)
                    if len(parts) >= 10:
                        text = parts[9]
                        parts[9] = '{\\blur10}' + text
                    blurred_lines.append(','.join(parts))

                output = os.path.splitext(sub2)[0] + ".withDanmu.ass"
                with open(output, 'w', encoding='utf-8-sig') as f:
                    f.write(sub1_content)
                    f.write('\n[V4+ Styles]\n')
                    f.write('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, '
                            'OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, '
                            'ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, '
                            'Alignment, MarginL, MarginR, MarginV, Encoding\n')
                    f.write(srt_style)
                    f.write('\n[Events]\n')
                    f.write('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n')
                    f.write('\n'.join(blurred_lines))
                logger.info(f"SRT字幕合并完成: {output}")
                return True

            return False
        except Exception as e:
            logger.error(f"合并字幕失败: {e}")
            return False


# ==================== 主入口函数 ====================

def danmu_generator(
    file_path: str,
    width: int = 1920,
    height: int = 1080,
    fontface: str = 'Arial',
    fontsize: float = 50,
    alpha: float = 0.8,
    duration: float = 6,
    onlyFromBili: bool = False,
    use_tmdb_id: bool = False,
    tmdb_id: Optional[int] = None,
    episode: Optional[int] = None,
    cache_ttl: Optional[int] = None,
    screen_area: str = 'full',
    manual_comment_id: Optional[str] = None,
    tmdb_id_type: int = 0,
    filter_config: Optional[Dict] = None,
    ch_convert: int = 0,
    pre_matched_comment_id: Optional[str] = None,
) -> Optional[Dict]:
    """弹幕生成主入口：匹配番剧、获取弹幕、可选过滤、转换 ASS、嵌入视频字幕。

    流程：预匹配/手动匹配/TMDB 匹配/单文件 match → 获取弹幕 JSON → 可选 DanmakuFilter 过滤 → 转换 ASS → 嵌入视频。
    返回 dict: {"result": str_or_none, "received": int, "blocked": int, "actual": int}，失败时返回 None。
    """
    try:
        # 优先级: 预批量匹配 > 手动匹配 > TMDB 匹配 > 单文件 match
        if pre_matched_comment_id:
            comment_id = pre_matched_comment_id
            logger.debug(f"使用预批量匹配 comment_id={comment_id} - {file_path}")
        else:
            comment_id = manual_comment_id or DanmuAPI.get_comment_id(
                file_path, use_tmdb_id, tmdb_id, episode, cache_ttl, tmdb_id_type
            )
        if not comment_id:
            logger.info(f"未找到对应弹幕 - {file_path}")
            return {"result": "未找到对应弹幕", "received": 0, "blocked": 0, "actual": 0}

        comments_data = DanmuAPI.get_comments(comment_id, cache_ttl=cache_ttl, ch_convert=ch_convert)
        if not comments_data:
            return {"result": "未获取到弹幕数据", "received": 0, "blocked": 0, "actual": 0}

        comments = sorted(comments_data["comments"], key=lambda x: float(x['p'].split(',')[0]))
        if len(comments) == 0:
            logger.info(f"弹幕数量为0，跳过生成 - {file_path}")
            return {"result": f"弹幕数量为0，跳过生成 - {file_path}", "received": 0, "blocked": 0, "actual": 0}

        # 记录 API 接收到的弹幕总数（过滤前）
        received_count = len(comments)

        # 过滤B站弹幕
        if onlyFromBili:
            comments = [comment for comment in comments if '[BiliBili]' in comment['p'].split(',')[3]]
            logger.info(f"过滤后剩余{len(comments)}条B站弹幕")

        # ===== 弹幕内容过滤系统（七阶段过滤）=====
        if _FILTER_AVAILABLE and filter_config:
            original_count = len(comments)
            # 转换弹幕格式：{"p": "time,mode,color,midHash", "m": "content"}
            # → {"content": ..., "midHash": ..., "mode": ..., "color": ..., "progress": ...}
            danmakus_for_filter = []
            for c in comments:
                p_parts = c.get('p', '').split(',')
                if len(p_parts) >= 4:
                    danmakus_for_filter.append({
                        "content": c.get('m', ''),
                        "midHash": p_parts[3],
                        "mode": int(p_parts[1]) if len(p_parts) > 1 else 1,
                        "color": int(p_parts[2]) if len(p_parts) > 2 else 16777215,
                        "size": 25,  # 默认字号
                        "progress": float(p_parts[0]) if p_parts[0] else 0.0,
                    })

            # 创建过滤器并执行过滤
            dm_filter = DanmakuFilter(filter_config)
            filtered = dm_filter.filter(danmakus_for_filter, verbose=False)

            # 根据过滤结果重建 comments 列表（保留原始弹幕中的其他字段）
            filtered_contents = {(d['content'], d['midHash'], d['progress']) for d in filtered}
            comments = [
                c for c in comments
                if (c.get('m', ''), c.get('p', '').split(',')[3] if ',' in c.get('p', '') else '', float(c.get('p', '').split(',')[0]) if c.get('p', '') else 0.0) in filtered_contents
            ]

            removed_count = original_count - len(comments)
            logger.info(f"弹幕内容过滤: {original_count} → {len(comments)} (移除{removed_count}条)")
            if removed_count > 0:
                report = dm_filter.get_filter_report()
                logger.info(f"过滤明细: {report['breakdown']}")

        output_file = os.path.splitext(file_path)[0] + '.danmu.ass'
        _t_ass = time.perf_counter()
        DanmuConverter.convert_comments_to_ass(
            comments, output_file,
            width=int(width), height=int(height),
            fontface=fontface, fontsize=float(fontsize),
            alpha=float(alpha), duration=float(duration),
            screen_area=screen_area
        )
        logger.info(f"ASS 渲染耗时: {(time.perf_counter() - _t_ass) * 1000:.1f}ms - {output_file}")

        # 处理字幕合并
        sub2 = SubtitleProcessor.find_subtitle_file(file_path)
        # 只有非.strm文件才尝试提取内嵌字幕
        if not sub2 and SubtitleProcessor.can_extract_subtitles(file_path):
            SubtitleProcessor.try_extract_sub(file_path)
            sub2 = SubtitleProcessor.find_subtitle_file(file_path)

        if sub2:
            SubtitleProcessor.combine_sub_ass(output_file, sub2, file_path)
        else:
            if StrmProcessor.is_strm_file(file_path):
                logger.info(f'.strm文件未找到外部字幕，仅生成弹幕文件 - {file_path}')
            else:
                logger.info(f'未找到原生字幕，仅生成纯弹幕 ASS（补齐字幕后重新刮削即可合并） - {file_path}')

        return {
            "result": output_file,
            "received": received_count,
            "blocked": received_count - len(comments),
            "actual": len(comments),
        }
    except Exception as e:
        logger.error(f"生成弹幕失败: {e}")
        return {"result": f"生成弹幕失败: {str(e)}", "received": 0, "blocked": 0, "actual": 0}
