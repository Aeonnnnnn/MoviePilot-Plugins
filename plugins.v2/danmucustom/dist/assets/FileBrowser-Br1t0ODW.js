import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { a as axios } from './index-vUEH2SzA.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,renderList:_renderList,Fragment:_Fragment,openBlock:_openBlock,createElementBlock:_createElementBlock,toDisplayString:_toDisplayString,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,withModifiers:_withModifiers,withKeys:_withKeys} = await importShared('vue');


const _hoisted_1 = {
  key: 0,
  class: "text-center pa-6"
};
const _hoisted_2 = {
  key: 0,
  class: "d-flex align-center gap-1 flex-wrap mt-1"
};
const _hoisted_3 = {
  key: 1,
  class: "mt-1"
};
const _hoisted_4 = {
  key: 0,
  class: "text-caption text-success mr-2"
};
const _hoisted_5 = { class: "text-subtitle-2 mb-2" };
const _hoisted_6 = {
  key: 0,
  class: "text-center pa-6"
};
const _hoisted_7 = { class: "text-subtitle-1 mb-2" };
const _hoisted_8 = { key: 0 };

const {ref,reactive,onMounted,nextTick} = await importShared('vue');

const API_PLUGIN_ID = 'DanmuCustom';


const _sfc_main = {
  __name: 'FileBrowser',
  props: ['pluginId', 'api'],
  setup(__props) {



// API 插件 ID
const requestGet = async (path, options = {}) => {
  if (__props.api?.get) {
    return await __props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  return await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options)
};

const requestPost = async (path, data = {}, options = {}) => {
  if (__props.api?.post) {
    return await __props.api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  }
  return await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options)
};

// 解析响应
const unwrap = (res) => {
  const d = res?.data ?? res;
  if (d && typeof d === 'object' && 'success' in d) {
    return d.success ? (d.data ?? d) : d
  }
  return d
};

const loading = ref(false);
const error = ref('');
const actionMsg = ref(null);
const currentData = ref(null);
const scrapingItem = ref(null);

// 面包屑
const breadcrumbs = reactive([]);

// 手动匹配
const showMatchDialog = ref(false);
const matchTarget = ref(null);
const searchKeyword = ref('');
const searchResults = ref([]);
const searchDone = ref(false);
const selectedAnime = ref(null);
const episodeOffset = ref(0);
const savingMatch = ref(false);

// TMDB 匹配
const tmdbMatchingItem = ref(null);
const showTmdbDialog = ref(false);
const tmdbTarget = ref(null);
const tmdbTargetName = ref('');
const tmdbResult = ref(null);
const tmdbLoading = ref(false);

// 加载根目录
const loadRoot = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await requestGet('/scan_path');
    const data = unwrap(res);
    if (data?.message && !data?.success) {
      error.value = data.message;
      return
    }
    currentData.value = data;
    breadcrumbs.length = 0;
    if (data?.name) {
      breadcrumbs.push({ name: data.name, path: data.path, data: data });
    }
  } catch (err) {
    error.value = err?.response?.data?.message || `扫描失败: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// 进入子目录
const enterDirectory = async (item) => {
  loading.value = true;
  error.value = '';
  try {
    const res = await requestGet('/scan_subfolder', { params: { subfolder_path: item.path } });
    const data = unwrap(res);
    if (data?.message && !data?.success) {
      error.value = data.message;
      return
    }
    currentData.value = data;
    breadcrumbs.push({ name: item.name, path: item.path, data });
  } catch (err) {
    error.value = `进入目录失败: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// 面包屑导航
const navigateTo = (index) => {
  if (index === 0) {
    loadRoot();
    return
  }
  breadcrumbs.splice(index + 1);
  currentData.value = breadcrumbs[index].data;
};

// 刮削目录
const scrapeDirectory = async (item) => {
  scrapingItem.value = item.path;
  actionMsg.value = null;
  try {
    const res = await requestGet('/scrape_directory', { params: { directory_path: item.path } });
    const d = unwrap(res);
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || '目录刮削已启动',
    };
  } catch (err) {
    actionMsg.value = { type: 'error', text: `请求失败: ${err.message}` };
  } finally {
    scrapingItem.value = null;
  }
};

// 刮削单个文件
const scrapeFile = async (item) => {
  scrapingItem.value = item.path;
  actionMsg.value = null;
  try {
    const res = await requestGet('/generate_danmu', { params: { file_path: item.path } });
    const d = unwrap(res);
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || `弹幕生成完成`,
    };
    // 刷新当前目录
    if (d?.success !== false) {
      setTimeout(refreshCurrent, 1500);
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `请求失败: ${err.message}` };
  } finally {
    scrapingItem.value = null;
  }
};

// 刷新当前目录
const refreshCurrent = async () => {
  const last = breadcrumbs[breadcrumbs.length - 1];
  if (!last) {
    await loadRoot();
    return
  }
  loading.value = true;
  try {
    const path = last.path;
    let res;
    if (breadcrumbs.length === 1) {
      res = await requestGet('/scan_path');
    } else {
      res = await requestGet('/scan_subfolder', { params: { subfolder_path: path } });
    }
    const data = unwrap(res);
    if (data && !data.message) {
      currentData.value = data;
      breadcrumbs[breadcrumbs.length - 1].data = data;
    }
  } catch (err) {
    // ignore
  } finally {
    loading.value = false;
  }
};

// 从路径中提取可能的番剧名
const extractAnimeName = (path) => {
  // 获取最后一级目录名或文件名
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  let name = parts[parts.length - 1] || '';
  // 去掉文件扩展名
  name = name.replace(/\.[^.]*$/, '');
  // 去掉常见标记
  name = name
    .replace(/[Ss]\d{1,2}[Ee]\d{1,2}(?:[+&][Ee]\d{1,2})*/g, '') // S01E02, S01E02+E03
    .replace(/[Ee][Pp]?\d{1,3}(?:[+&]E?\d{1,3})*/g, '')           // E01, EP01, E01+02
    .replace(/第\d+[集话期]|[#＃]\d{1,3}/g, '')                      // 第01集, #01
    .replace(/\[\d{2,}\]/g, '')                                     // [01], [1080P]
    .replace(/\d{3,4}[PpXx]?(?:\d+)?(?:[Hh]265|[Hh]264|[Hh]evc)?/g, '') // 1080P, 4K, 265
    .replace(/[\[\(〈【](?:BD|WEB|TV|DVD|BDRip|HDR|AT-X|OVA|SP|NC)[^\]\)〉】]*[\]\)〉】]/gi, '') // [BD], (WEB) etc
    .replace(/[\[\(〈【][^\]\)〉】]*[\]\)〉】]/g, '')                   // 剩余括号
    .replace(/[-_\.~]/g, ' ')                                       // 分隔符转空格
    .replace(/\s+/g, ' ')                                           // 合并空格
    .trim();
  return name.length >= 2 ? name : ''
};

// 目录手动匹配
const openManualMatch = (item) => {
  matchTarget.value = item;
  const guessedName = extractAnimeName(item.path || item.name);
  searchKeyword.value = guessedName;
  searchResults.value = [];
  searchDone.value = false;
  selectedAnime.value = null;
  episodeOffset.value = 0;
  showMatchDialog.value = true;
  if (guessedName) {
    // 自动搜索提取的名称
    nextTick(() => { searchAnime(); });
  }
};

// 文件手动匹配
const openFileManualMatch = (item) => {
  matchTarget.value = item;
  const guessedName = extractAnimeName(item.path || item.name);
  searchKeyword.value = guessedName;
  searchResults.value = [];
  searchDone.value = false;
  selectedAnime.value = null;
  episodeOffset.value = 0;
  showMatchDialog.value = true;
  if (guessedName) {
    nextTick(() => { searchAnime(); });
  }
};

// 搜索番剧
const searchAnime = async () => {
  if (!searchKeyword.value.trim()) return
  try {
    const res = await requestGet('/search_anime', { params: { keyword: searchKeyword.value } });
    const d = unwrap(res);
    // 后端已规范化返回 animes 数组，同时兼容旧版 {data: [...], animes: [...]} 格式
    searchResults.value = Array.isArray(d) ? d : (d?.animes || d?.data || []);
    searchDone.value = true;
  } catch (err) {
    actionMsg.value = { type: 'error', text: `搜索失败: ${err.message}` };
  }
};

// 选择番剧
const selectAnime = (anime) => {
  selectedAnime.value = anime;
};

// 保存匹配
const saveMatch = async () => {
  if (!selectedAnime.value || !matchTarget.value) return
  savingMatch.value = true;
  try {
    const res = await requestPost('/manual_match', {
      anime_id: selectedAnime.value.anime_id || selectedAnime.value.id,
      anime_title: selectedAnime.value.anime_title || selectedAnime.value.title,
      file_path: matchTarget.value.path,
      episode_offset: episodeOffset.value || 0,
    });
    const d = unwrap(res);
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || '匹配已保存',
    };
    if (d?.success !== false) {
      showMatchDialog.value = false;
      selectedAnime.value = null;
      searchKeyword.value = '';
      searchResults.value = [];
      searchDone.value = false;
      episodeOffset.value = 0;
      setTimeout(refreshCurrent, 500);
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `保存失败: ${err.message}` };
  } finally {
    savingMatch.value = false;
  }
};

// TMDB 匹配文件
const matchByTmdb = async (item) => {
  tmdbMatchingItem.value = item.path;
  tmdbTarget.value = item;
  tmdbTargetName.value = item.path || item.name;
  tmdbResult.value = null;
  tmdbLoading.value = true;
  showTmdbDialog.value = true;

  try {
    const res = await requestGet('/tmdb_match', { params: { file_path: item.path } });
    const d = unwrap(res);
    tmdbResult.value = d;
  } catch (err) {
    tmdbResult.value = { success: false, message: `TMDB匹配请求失败: ${err.message}` };
  } finally {
    tmdbMatchingItem.value = null;
    tmdbLoading.value = false;
  }
};

// 应用 TMDB 匹配结果
const applyTmdbMatch = async (anime) => {
  if (!tmdbTarget.value || !anime) return
  savingMatch.value = true;
  try {
    const res = await requestPost('/manual_match', {
      anime_id: anime.animeId,
      anime_title: anime.animeTitle,
      file_path: tmdbTarget.value.path,
      episode_offset: 0,
    });
    const d = unwrap(res);
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || `TMDB匹配已保存: ${anime.animeTitle}`,
    };
    if (d?.success !== false) {
      showTmdbDialog.value = false;
      setTimeout(refreshCurrent, 500);
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `保存TMDB匹配失败: ${err.message}` };
  } finally {
    savingMatch.value = false;
  }
};

// TMDB匹配后直接刮削
const scrapeTargetAfterTmdb = async () => {
  if (!tmdbTarget.value) return
  showTmdbDialog.value = false;
  scrapingItem.value = tmdbTarget.value.path;
  actionMsg.value = null;
  try {
    const res = await requestGet('/generate_danmu', { params: { file_path: tmdbTarget.value.path } });
    const d = unwrap(res);
    actionMsg.value = {
      type: d?.success !== false ? 'success' : 'error',
      text: d?.message || '弹幕生成完成',
    };
    if (d?.success !== false) {
      setTimeout(refreshCurrent, 1500);
    }
  } catch (err) {
    actionMsg.value = { type: 'error', text: `请求失败: ${err.message}` };
  } finally {
    scrapingItem.value = null;
  }
};

onMounted(() => {
  loadRoot();
});

return (_ctx, _cache) => {
  const _component_VIcon = _resolveComponent("VIcon");
  const _component_VCardTitle = _resolveComponent("VCardTitle");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VCardItem = _resolveComponent("VCardItem");
  const _component_VBreadcrumbsItem = _resolveComponent("VBreadcrumbsItem");
  const _component_VBreadcrumbs = _resolveComponent("VBreadcrumbs");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VProgressCircular = _resolveComponent("VProgressCircular");
  const _component_VChip = _resolveComponent("VChip");
  const _component_VListItem = _resolveComponent("VListItem");
  const _component_VList = _resolveComponent("VList");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VCardSubtitle = _resolveComponent("VCardSubtitle");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VDialog = _resolveComponent("VDialog");
  const _component_VListItemTitle = _resolveComponent("VListItemTitle");
  const _component_VListItemSubtitle = _resolveComponent("VListItemSubtitle");

  return (_openBlock(), _createElementBlock(_Fragment, null, [
    _createVNode(_component_VCard, {
      variant: "outlined",
      class: "mt-4"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_VCardItem, { class: "pb-0" }, {
          prepend: _withCtx(() => [
            _createVNode(_component_VIcon, {
              icon: "mdi-folder-multiple",
              color: "primary",
              size: "28"
            })
          ]),
          append: _withCtx(() => [
            _createVNode(_component_VBtn, {
              icon: "mdi-refresh",
              size: "small",
              variant: "text",
              loading: loading.value,
              onClick: loadRoot
            }, null, 8, ["loading"])
          ]),
          default: _withCtx(() => [
            _createVNode(_component_VCardTitle, null, {
              default: _withCtx(() => [...(_cache[8] || (_cache[8] = [
                _createTextVNode("文件浏览", -1)
              ]))]),
              _: 1
            })
          ]),
          _: 1
        }),
        (breadcrumbs.length > 0)
          ? (_openBlock(), _createBlock(_component_VCardText, {
              key: 0,
              class: "pb-0"
            }, {
              default: _withCtx(() => [
                _createVNode(_component_VBreadcrumbs, {
                  density: "compact",
                  divider: "›"
                }, {
                  default: _withCtx(() => [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(breadcrumbs, (item, i) => {
                      return (_openBlock(), _createBlock(_component_VBreadcrumbsItem, {
                        key: i,
                        onClick: $event => (navigateTo(i))
                      }, {
                        default: _withCtx(() => [
                          _createTextVNode(_toDisplayString(item.name), 1)
                        ]),
                        _: 2
                      }, 1032, ["onClick"]))
                    }), 128))
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }))
          : _createCommentVNode("", true),
        (error.value)
          ? (_openBlock(), _createBlock(_component_VAlert, {
              key: 1,
              type: "error",
              variant: "tonal",
              closable: "",
              class: "mx-4 mt-2",
              "onClick:close": _cache[0] || (_cache[0] = $event => (error.value = ''))
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(error.value), 1)
              ]),
              _: 1
            }))
          : _createCommentVNode("", true),
        (actionMsg.value)
          ? (_openBlock(), _createBlock(_component_VAlert, {
              key: 2,
              type: actionMsg.value.type,
              variant: "tonal",
              closable: "",
              class: "mx-4 mt-2",
              "onClick:close": _cache[1] || (_cache[1] = $event => (actionMsg.value = null))
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(actionMsg.value.text), 1)
              ]),
              _: 1
            }, 8, ["type"]))
          : _createCommentVNode("", true),
        _createVNode(_component_VCardText, null, {
          default: _withCtx(() => [
            (loading.value)
              ? (_openBlock(), _createElementBlock("div", _hoisted_1, [
                  _createVNode(_component_VProgressCircular, {
                    indeterminate: "",
                    color: "primary"
                  }),
                  _cache[9] || (_cache[9] = _createElementVNode("div", { class: "text-caption mt-2 text-medium-emphasis" }, "扫描目录中…", -1))
                ]))
              : (!currentData.value || (!currentData.value.children?.length && !currentData.value.children?.length && currentData.value.type !== 'media'))
                ? (_openBlock(), _createBlock(_component_VAlert, {
                    key: 1,
                    type: "info",
                    variant: "tonal"
                  }, {
                    default: _withCtx(() => [...(_cache[10] || (_cache[10] = [
                      _createTextVNode(" 当前目录为空。请确认「基本设置」中的刮削路径是否正确。 ", -1)
                    ]))]),
                    _: 1
                  }))
                : (_openBlock(), _createBlock(_component_VList, {
                    key: 2,
                    density: "compact",
                    class: "file-browser-list"
                  }, {
                    default: _withCtx(() => [
                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(currentData.value.children || [], (item, i) => {
                        return (_openBlock(), _createElementBlock(_Fragment, { key: i }, [
                          (item.type === 'directory')
                            ? (_openBlock(), _createBlock(_component_VListItem, {
                                key: 0,
                                onClick: $event => (enterDirectory(item)),
                                title: item.name,
                                class: "file-item file-item-dir"
                              }, {
                                prepend: _withCtx(() => [
                                  _createVNode(_component_VIcon, {
                                    icon: item.is_bottom_dir ? 'mdi-folder-music' : 'mdi-folder',
                                    color: item.is_bottom_dir ? 'warning' : 'warning',
                                    size: "20"
                                  }, null, 8, ["icon", "color"])
                                ]),
                                subtitle: _withCtx(() => [
                                  (item.total_media_count > 0)
                                    ? (_openBlock(), _createElementBlock("div", _hoisted_2, [
                                        _createVNode(_component_VChip, {
                                          size: "x-small",
                                          color: item.scraped_count >= item.total_media_count ? 'success' : item.scraped_count > 0 ? 'info' : 'grey',
                                          variant: "tonal"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString(item.scraped_count >= item.total_media_count ? '✅ 全部刮削' : `📺 已刮削 ${item.scraped_count}/${item.total_media_count}`), 1)
                                          ]),
                                          _: 2
                                        }, 1032, ["color"]),
                                        (item.has_subtitle_files)
                                          ? (_openBlock(), _createBlock(_component_VChip, {
                                              key: 0,
                                              size: "x-small",
                                              color: "purple",
                                              variant: "tonal"
                                            }, {
                                              default: _withCtx(() => [...(_cache[11] || (_cache[11] = [
                                                _createTextVNode(" 📝 含字幕 ", -1)
                                              ]))]),
                                              _: 1
                                            }))
                                          : _createCommentVNode("", true)
                                      ]))
                                    : (item.has_subtitle_files)
                                      ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
                                          _createVNode(_component_VChip, {
                                            size: "x-small",
                                            color: "purple",
                                            variant: "tonal"
                                          }, {
                                            default: _withCtx(() => [...(_cache[12] || (_cache[12] = [
                                              _createTextVNode(" 📝 含字幕 ", -1)
                                            ]))]),
                                            _: 1
                                          })
                                        ]))
                                      : _createCommentVNode("", true)
                                ]),
                                append: _withCtx(() => [
                                  (item.manual_match)
                                    ? (_openBlock(), _createBlock(_component_VChip, {
                                        key: 0,
                                        size: "x-small",
                                        color: "success",
                                        variant: "tonal",
                                        class: "mr-1"
                                      }, {
                                        default: _withCtx(() => [
                                          _createTextVNode(_toDisplayString(item.manual_match.anime_title || '已匹配'), 1)
                                        ]),
                                        _: 2
                                      }, 1024))
                                    : _createCommentVNode("", true),
                                  _createVNode(_component_VBtn, {
                                    size: "x-small",
                                    color: "primary",
                                    variant: "tonal",
                                    class: "mr-1",
                                    onClick: _withModifiers($event => (scrapeDirectory(item)), ["stop"]),
                                    loading: scrapingItem.value === item.path
                                  }, {
                                    default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
                                      _createTextVNode(" 刮削 ", -1)
                                    ]))]),
                                    _: 1
                                  }, 8, ["onClick", "loading"]),
                                  _createVNode(_component_VBtn, {
                                    size: "x-small",
                                    color: "info",
                                    variant: "text",
                                    onClick: _withModifiers($event => (openManualMatch(item)), ["stop"])
                                  }, {
                                    default: _withCtx(() => [...(_cache[14] || (_cache[14] = [
                                      _createTextVNode(" 匹配 ", -1)
                                    ]))]),
                                    _: 1
                                  }, 8, ["onClick"])
                                ]),
                                _: 2
                              }, 1032, ["onClick", "title"]))
                            : (item.type === 'media')
                              ? (_openBlock(), _createBlock(_component_VListItem, {
                                  key: 1,
                                  title: item.name,
                                  class: "file-item file-item-media"
                                }, {
                                  prepend: _withCtx(() => [
                                    _createVNode(_component_VIcon, {
                                      icon: "mdi-file-video",
                                      color: "secondary",
                                      size: "20"
                                    })
                                  ]),
                                  subtitle: _withCtx(() => [
                                    (item.danmu_count)
                                      ? (_openBlock(), _createElementBlock("span", _hoisted_4, " 🎯 弹幕: " + _toDisplayString(item.danmu_count), 1))
                                      : _createCommentVNode("", true),
                                    (item.manual_match)
                                      ? (_openBlock(), _createBlock(_component_VChip, {
                                          key: 1,
                                          size: "x-small",
                                          color: item.danmu_count ? 'success' : 'warning',
                                          variant: "tonal"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString(item.manual_match.anime_title || '已匹配'), 1)
                                          ]),
                                          _: 2
                                        }, 1032, ["color"]))
                                      : _createCommentVNode("", true)
                                  ]),
                                  append: _withCtx(() => [
                                    (item.danmu_count)
                                      ? (_openBlock(), _createBlock(_component_VChip, {
                                          key: 0,
                                          size: "x-small",
                                          color: "success",
                                          variant: "tonal",
                                          class: "mr-1"
                                        }, {
                                          default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
                                            _createTextVNode(" ✓ 已生成 ", -1)
                                          ]))]),
                                          _: 1
                                        }))
                                      : _createCommentVNode("", true),
                                    _createVNode(_component_VBtn, {
                                      size: "x-small",
                                      color: "primary",
                                      variant: "tonal",
                                      class: "mr-1",
                                      onClick: _withModifiers($event => (scrapeFile(item)), ["stop"]),
                                      loading: scrapingItem.value === item.path
                                    }, {
                                      default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
                                        _createTextVNode(" 刮削 ", -1)
                                      ]))]),
                                      _: 1
                                    }, 8, ["onClick", "loading"]),
                                    _createVNode(_component_VBtn, {
                                      size: "x-small",
                                      color: "info",
                                      variant: "text",
                                      class: "mr-1",
                                      onClick: _withModifiers($event => (openFileManualMatch(item)), ["stop"])
                                    }, {
                                      default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
                                        _createTextVNode(" 匹配 ", -1)
                                      ]))]),
                                      _: 1
                                    }, 8, ["onClick"]),
                                    _createVNode(_component_VBtn, {
                                      size: "x-small",
                                      color: "orange",
                                      variant: "text",
                                      onClick: _withModifiers($event => (matchByTmdb(item)), ["stop"]),
                                      loading: tmdbMatchingItem.value === item.path
                                    }, {
                                      default: _withCtx(() => [...(_cache[18] || (_cache[18] = [
                                        _createTextVNode(" TMDB ", -1)
                                      ]))]),
                                      _: 1
                                    }, 8, ["onClick", "loading"])
                                  ]),
                                  _: 2
                                }, 1032, ["title"]))
                              : _createCommentVNode("", true)
                        ], 64))
                      }), 128))
                    ]),
                    _: 1
                  }))
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _createVNode(_component_VDialog, {
      modelValue: showMatchDialog.value,
      "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((showMatchDialog).value = $event)),
      "max-width": "600"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_VCard, null, {
          default: _withCtx(() => [
            _createVNode(_component_VCardItem, null, {
              default: _withCtx(() => [
                _createVNode(_component_VCardTitle, null, {
                  default: _withCtx(() => [...(_cache[19] || (_cache[19] = [
                    _createTextVNode("手动匹配番剧", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_VCardSubtitle, null, {
                  default: _withCtx(() => [
                    _createTextVNode(_toDisplayString(matchTarget.value?.name), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_VCardText, null, {
              default: _withCtx(() => [
                _createVNode(_component_VTextField, {
                  modelValue: searchKeyword.value,
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((searchKeyword).value = $event)),
                  label: "番剧名称",
                  placeholder: "输入关键词搜索",
                  variant: "outlined",
                  "append-inner-icon": "mdi-magnify",
                  onKeyup: _withKeys(searchAnime, ["enter"]),
                  "onClick:appendInner": searchAnime
                }, null, 8, ["modelValue"]),
                (searchResults.value.length)
                  ? (_openBlock(), _createBlock(_component_VList, {
                      key: 0,
                      density: "compact",
                      class: "mt-2"
                    }, {
                      default: _withCtx(() => [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(searchResults.value, (anime) => {
                          return (_openBlock(), _createBlock(_component_VListItem, {
                            key: anime.anime_id || anime.id,
                            title: anime.anime_title || anime.title,
                            subtitle: `ID: ${anime.anime_id || anime.id}`,
                            onClick: $event => (selectAnime(anime))
                          }, {
                            append: _withCtx(() => [
                              _createVNode(_component_VBtn, {
                                icon: "mdi-check",
                                size: "small",
                                variant: "text",
                                color: "primary"
                              })
                            ]),
                            _: 1
                          }, 8, ["title", "subtitle", "onClick"]))
                        }), 128))
                      ]),
                      _: 1
                    }))
                  : (searchKeyword.value && searchDone.value)
                    ? (_openBlock(), _createBlock(_component_VAlert, {
                        key: 1,
                        type: "info",
                        variant: "tonal",
                        class: "mt-2"
                      }, {
                        default: _withCtx(() => [...(_cache[20] || (_cache[20] = [
                          _createTextVNode(" 未找到匹配的番剧 ", -1)
                        ]))]),
                        _: 1
                      }))
                    : _createCommentVNode("", true),
                (selectedAnime.value)
                  ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                      _createVNode(_component_VDivider, { class: "my-3" }),
                      _createElementVNode("div", _hoisted_5, " 已选择: " + _toDisplayString(selectedAnime.value.anime_title || selectedAnime.value.title), 1),
                      _createVNode(_component_VTextField, {
                        modelValue: episodeOffset.value,
                        "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((episodeOffset).value = $event)),
                        label: "集数偏移",
                        type: "number",
                        variant: "outlined",
                        hint: "正数=后移，负数=前移",
                        "persistent-hint": ""
                      }, null, 8, ["modelValue"])
                    ], 64))
                  : _createCommentVNode("", true)
              ]),
              _: 1
            }),
            _createVNode(_component_VCardActions, null, {
              default: _withCtx(() => [
                _createVNode(_component_VSpacer),
                _createVNode(_component_VBtn, {
                  variant: "text",
                  onClick: _cache[4] || (_cache[4] = $event => (showMatchDialog.value = false))
                }, {
                  default: _withCtx(() => [...(_cache[21] || (_cache[21] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                (selectedAnime.value)
                  ? (_openBlock(), _createBlock(_component_VBtn, {
                      key: 0,
                      color: "primary",
                      variant: "tonal",
                      loading: savingMatch.value,
                      onClick: saveMatch
                    }, {
                      default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
                        _createTextVNode(" 保存匹配 ", -1)
                      ]))]),
                      _: 1
                    }, 8, ["loading"]))
                  : _createCommentVNode("", true)
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"]),
    _createVNode(_component_VDialog, {
      modelValue: showTmdbDialog.value,
      "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((showTmdbDialog).value = $event)),
      "max-width": "650"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_VCard, null, {
          default: _withCtx(() => [
            _createVNode(_component_VCardItem, null, {
              prepend: _withCtx(() => [
                _createVNode(_component_VIcon, {
                  icon: "mdi-database-search",
                  color: "orange",
                  size: "28"
                })
              ]),
              default: _withCtx(() => [
                _createVNode(_component_VCardTitle, null, {
                  default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                    _createTextVNode("TMDB匹配结果", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_VCardSubtitle, null, {
                  default: _withCtx(() => [
                    _createTextVNode(_toDisplayString(tmdbTargetName.value), 1)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }),
            _createVNode(_component_VCardText, null, {
              default: _withCtx(() => [
                (tmdbLoading.value)
                  ? (_openBlock(), _createElementBlock("div", _hoisted_6, [
                      _createVNode(_component_VProgressCircular, {
                        indeterminate: "",
                        color: "orange"
                      }),
                      _cache[24] || (_cache[24] = _createElementVNode("div", { class: "text-caption mt-2 text-medium-emphasis" }, " 文件名 → TMDB 搜索 → 弹弹Play 匹配… ", -1))
                    ]))
                  : (!tmdbResult.value?.success)
                    ? (_openBlock(), _createBlock(_component_VAlert, {
                        key: 1,
                        type: "warning",
                        variant: "tonal",
                        text: tmdbResult.value?.message || 'TMDB匹配失败'
                      }, null, 8, ["text"]))
                    : (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                        _createVNode(_component_VAlert, {
                          type: "success",
                          variant: "tonal",
                          class: "mb-3"
                        }, {
                          text: _withCtx(() => [
                            _createElementVNode("div", null, [
                              _cache[25] || (_cache[25] = _createTextVNode("TMDB ID: ", -1)),
                              _createElementVNode("b", null, _toDisplayString(tmdbResult.value.tmdb_id), 1)
                            ]),
                            _createElementVNode("div", null, "类型: " + _toDisplayString(tmdbResult.value.tmdb_type_label), 1),
                            _createElementVNode("div", null, "识别: " + _toDisplayString(tmdbResult.value.tmdb_title), 1)
                          ]),
                          _: 1
                        }),
                        _createElementVNode("div", _hoisted_7, " 弹弹Play 匹配到的番剧 (" + _toDisplayString((tmdbResult.value.matches || []).length) + " 部): ", 1),
                        (tmdbResult.value.matches?.length)
                          ? (_openBlock(), _createBlock(_component_VList, {
                              key: 0,
                              density: "compact",
                              class: "bg-grey-lighten-4"
                            }, {
                              default: _withCtx(() => [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(tmdbResult.value.matches, (anime) => {
                                  return (_openBlock(), _createBlock(_component_VListItem, {
                                    key: anime.animeId
                                  }, {
                                    prepend: _withCtx(() => [
                                      _createVNode(_component_VIcon, {
                                        icon: "mdi-play-box",
                                        color: "primary",
                                        size: "20"
                                      })
                                    ]),
                                    append: _withCtx(() => [
                                      _createVNode(_component_VBtn, {
                                        size: "small",
                                        color: "success",
                                        variant: "tonal",
                                        onClick: $event => (applyTmdbMatch(anime))
                                      }, {
                                        default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                                          _createTextVNode(" 使用此匹配 ", -1)
                                        ]))]),
                                        _: 1
                                      }, 8, ["onClick"])
                                    ]),
                                    default: _withCtx(() => [
                                      _createVNode(_component_VListItemTitle, null, {
                                        default: _withCtx(() => [
                                          _createTextVNode(_toDisplayString(anime.animeTitle), 1)
                                        ]),
                                        _: 2
                                      }, 1024),
                                      _createVNode(_component_VListItemSubtitle, null, {
                                        default: _withCtx(() => [
                                          _createTextVNode(" ID: " + _toDisplayString(anime.animeId) + " | 类型: " + _toDisplayString(anime.typeDescription || anime.type) + " ", 1),
                                          (anime.episodes?.length)
                                            ? (_openBlock(), _createElementBlock("span", _hoisted_8, " | 集数: " + _toDisplayString(anime.episodes.map(e => e.episodeTitle || e.episodeId).join(', ')), 1))
                                            : _createCommentVNode("", true)
                                        ]),
                                        _: 2
                                      }, 1024)
                                    ]),
                                    _: 2
                                  }, 1024))
                                }), 128))
                              ]),
                              _: 1
                            }))
                          : (_openBlock(), _createBlock(_component_VAlert, {
                              key: 1,
                              type: "info",
                              variant: "tonal"
                            }, {
                              default: _withCtx(() => [...(_cache[27] || (_cache[27] = [
                                _createTextVNode(" 弹弹Play 未收录该 TMDB ID 的弹幕数据 ", -1)
                              ]))]),
                              _: 1
                            }))
                      ], 64))
              ]),
              _: 1
            }),
            _createVNode(_component_VCardActions, null, {
              default: _withCtx(() => [
                _createVNode(_component_VSpacer),
                _createVNode(_component_VBtn, {
                  variant: "text",
                  onClick: _cache[6] || (_cache[6] = $event => (showTmdbDialog.value = false))
                }, {
                  default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                    _createTextVNode("关闭", -1)
                  ]))]),
                  _: 1
                }),
                (tmdbResult.value?.success && tmdbResult.value?.matches?.length)
                  ? (_openBlock(), _createBlock(_component_VBtn, {
                      key: 0,
                      color: "primary",
                      variant: "tonal",
                      onClick: scrapeTargetAfterTmdb
                    }, {
                      default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                        _createTextVNode(" 直接刮削 ", -1)
                      ]))]),
                      _: 1
                    }))
                  : _createCommentVNode("", true)
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"])
  ], 64))
}
}

};
const FileBrowser = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-8ba79938"]]);

export { FileBrowser as F };
