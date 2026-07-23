import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { a as axios } from './index-vUEH2SzA.js';
import { F as FileBrowser } from './FileBrowser-D6LUftXX.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,createElementBlock:_createElementBlock,renderList:_renderList,Fragment:_Fragment,withKeys:_withKeys} = await importShared('vue');


const _hoisted_1 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_2 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_3 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_4 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_5 = {
  key: 1,
  class: "mt-2 text-body-2 text-medium-emphasis"
};
const _hoisted_6 = {
  key: 2,
  class: "mt-1 text-caption text-disabled"
};
const _hoisted_7 = {
  class: "text-body-2",
  style: {"max-width":"320px","overflow":"hidden","text-overflow":"ellipsis","white-space":"nowrap"}
};
const _hoisted_8 = { class: "text-caption" };
const _hoisted_9 = { class: "text-caption" };
const _hoisted_10 = { class: "text-caption text-center" };
const _hoisted_11 = { class: "text-caption text-center" };
const _hoisted_12 = { class: "text-caption text-center" };
const _hoisted_13 = { class: "text-caption" };
const _hoisted_14 = {
  key: 0,
  class: "text-success"
};
const _hoisted_15 = {
  key: 1,
  class: "text-error"
};
const _hoisted_16 = { class: "d-flex justify-center mt-3" };
const _hoisted_17 = { class: "text-subtitle-2 mb-2" };

const {ref,reactive,onMounted} = await importShared('vue');

const API_PLUGIN_ID = 'DanmuCustom';


const _sfc_main = {
  __name: 'Page',
  props: ['pluginId', 'config', 'eventBus', 'api'],
  emits: ['switch', 'close', 'action'],
  setup(__props, { emit: __emit }) {


const emit = __emit;

const requestGet = async (path, options = {}) => {
  if (__props.api?.get) {
    return await __props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options);
  return res.data
};

const requestPost = async (path, data = {}, options = {}) => {
  if (__props.api?.post) {
    return await __props.api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  }
  const res = await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options);
  return res.data
};

const unwrapResponse = (res) => {
  const data = res?.data ?? res;
  if (data && typeof data === 'object' && 'success' in data && data.success && data.data) {
    return data.data
  }
  return data
};

const loading = ref(false);
const error = ref('');
const status = ref('空闲');
const lastUpdated = ref('--');
const actionLoading = ref(null);
const showDirectoryDialog = ref(false);
const showFileBrowser = ref(false);
const showHistoryDialog = ref(false);
const directoryPath = ref('');
const batchMode = ref(false);
const scrapeHistory = ref([]);
const historyTotal = ref(0);
const historyPage = ref(1);
const historyPageSize = ref(15);
const historyTotalPages = ref(0);
const historyError = ref('');
const historyStatusFilter = ref('all');
const historyStatusOptions = [
  { title: '全部', value: 'all' },
  { title: '成功', value: 'success' },
  { title: '失败', value: 'failed' },
  { title: '跳过', value: 'skipped' },
  { title: '中断', value: 'interrupted' },
  { title: '等待', value: 'pending' },
];

const scrapeProgress = reactive({
  running: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
});

const statusColor = (s) => {
  switch (s) {
    case 'success': return 'success'
    case 'failed': return 'error'
    case 'skipped': return 'info'
    case 'interrupted': return 'warning'
    case 'running': return 'primary'
    case 'pending': return 'grey'
    default: return 'grey'
  }
};
const statusText = (s) => {
  switch (s) {
    case 'success': return '成功'
    case 'failed': return '失败'
    case 'skipped': return '跳过'
    case 'interrupted': return '中断'
    case 'running': return '运行中'
    case 'pending': return '等待'
    default: return s || '未知'
  }
};

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h + '时' : ''}${m > 0 ? m + '分' : ''}${s}秒`
};

const refreshData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await requestGet('/status');
    const data = unwrapResponse(res);
    status.value = data.running ? '运行中' : '空闲';
    Object.assign(scrapeProgress, data);
    lastUpdated.value = new Date().toLocaleTimeString();
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用或后端 API 未注册，请先在插件配置中启用插件并保存。';
    } else {
      error.value = `获取状态失败: ${err.message}`;
    }
  } finally {
    loading.value = false;
  }
};

const loadHistory = async (page = historyPage.value) => {
  historyPage.value = page;
  historyError.value = '';
  try {
    const params = `?page=${page}&page_size=${historyPageSize.value}`;
    const filter = historyStatusFilter.value !== 'all' ? `&status=${historyStatusFilter.value}` : '';
    const res = await requestGet(`/history${params}${filter}`);
    const body = unwrapResponse(res);
    if (body && typeof body === 'object' && 'items' in body) {
      scrapeHistory.value = body.items || [];
      historyTotal.value = body.total || 0;
      historyTotalPages.value = body.total_pages || 0;
    } else {
      historyError.value = '返回数据格式异常';
      scrapeHistory.value = [];
    }
  } catch (err) {
    historyError.value = err?.message || String(err);
    scrapeHistory.value = [];
  }
};

const startGlobalScrape = async () => {
  actionLoading.value = 'scrape';
  error.value = '';
  try {
    const res = await requestGet('/generate_danmu_with_path');
    if (res?.success) {
      await refreshData();
    } else {
      error.value = res?.message || '刮削启动失败';
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用，请先在插件配置中启用插件并保存。';
    } else {
      error.value = `刮削请求失败: ${err.message}`;
    }
  } finally {
    actionLoading.value = null;
  }
};

const startDirectoryScrape = async () => {
  if (!directoryPath.value.trim()) {
    error.value = '请输入目标目录路径';
    return
  }
  actionLoading.value = 'dir';
  error.value = '';
  try {
    const endpoint = batchMode.value ? 'batch_season_scrape' : 'scrape_directory';
    const res = await requestGet(`/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    });
    if (res?.success) {
      showDirectoryDialog.value = false;
      await refreshData();
    } else {
      error.value = res?.message || '刮削启动失败';
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用，请先在插件配置中启用插件并保存。';
    } else {
      error.value = `刮削请求失败: ${err.message}`;
    }
  } finally {
    actionLoading.value = null;
  }
};

// 搜索番剧（带错误展示）
const showSearchDialog = ref(false);
const searchKeyword = ref('');
const searchResults = ref([]);
const searchDone = ref(false);
const searchError = ref('');
const selectedAnime = ref(null);
const episodeOffset = ref(0);
const matchFilePath = ref('');

const searchAnime = async () => {
  if (!searchKeyword.value.trim()) return
  searchError.value = '';
  searchResults.value = [];
  searchDone.value = false;
  try {
    const res = await requestGet('/search_anime', {
      params: { keyword: searchKeyword.value }
    });
    if (res?.success) {
      searchResults.value = Array.isArray(res?.data) ? res.data : [];
    } else {
      searchError.value = res?.message || '搜索失败';
    }
    searchDone.value = true;
  } catch (err) {
    searchError.value = err?.response?.data?.message || err?.message || '网络请求失败';
    searchDone.value = true;
  }
};

const selectAnime = (anime) => {
  selectedAnime.value = anime;
};

const saveMatch = async () => {
  if (!selectedAnime.value || !matchFilePath.value.trim()) return
  actionLoading.value = 'match';
  try {
    const res = await requestPost('/manual_match', {
      anime_id: selectedAnime.value.anime_id || selectedAnime.value.id,
      anime_title: selectedAnime.value.anime_title || selectedAnime.value.title,
      file_path: matchFilePath.value,
      episode_offset: episodeOffset.value,
    });
    if (res?.success) {
      showSearchDialog.value = false;
      selectedAnime.value = null;
      searchKeyword.value = '';
      searchResults.value = [];
      searchDone.value = false;
      searchError.value = '';
      matchFilePath.value = '';
      episodeOffset.value = 0;
      await refreshData();
    } else {
      error.value = res?.message || '保存失败';
    }
  } catch (err) {
    error.value = `保存失败: ${err.message}`;
  } finally {
    actionLoading.value = null;
  }
};

onMounted(() => {
  refreshData();
});

return (_ctx, _cache) => {
  const _component_VIcon = _resolveComponent("VIcon");
  const _component_VCardTitle = _resolveComponent("VCardTitle");
  const _component_VCardSubtitle = _resolveComponent("VCardSubtitle");
  const _component_VCardItem = _resolveComponent("VCardItem");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VCol = _resolveComponent("VCol");
  const _component_VRow = _resolveComponent("VRow");
  const _component_VProgressLinear = _resolveComponent("VProgressLinear");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VDialog = _resolveComponent("VDialog");
  const _component_VChip = _resolveComponent("VChip");
  const _component_VSelect = _resolveComponent("VSelect");
  const _component_VTable = _resolveComponent("VTable");
  const _component_VPagination = _resolveComponent("VPagination");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VCheckbox = _resolveComponent("VCheckbox");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VListItem = _resolveComponent("VListItem");
  const _component_VList = _resolveComponent("VList");

  return (_openBlock(), _createBlock(_component_VCard, {
    class: "page-component",
    loading: loading.value
  }, {
    default: _withCtx(() => [
      _createVNode(_component_VCardItem, null, {
        prepend: _withCtx(() => [
          _createVNode(_component_VIcon, {
            icon: "mdi-movie-open-star",
            color: "primary",
            size: "32"
          })
        ]),
        default: _withCtx(() => [
          _createVNode(_component_VCardTitle, null, {
            default: _withCtx(() => [
              _createTextVNode(_toDisplayString(__props.config?.attrs?.title || '弹幕刮削'), 1)
            ]),
            _: 1
          }),
          _createVNode(_component_VCardSubtitle, null, {
            default: _withCtx(() => [
              _createTextVNode("状态: " + _toDisplayString(status.value) + " | 最后更新: " + _toDisplayString(lastUpdated.value), 1)
            ]),
            _: 1
          })
        ]),
        _: 1
      }),
      (error.value)
        ? (_openBlock(), _createBlock(_component_VAlert, {
            key: 0,
            type: "error",
            variant: "tonal",
            closable: "",
            class: "mx-4 mb-2"
          }, {
            default: _withCtx(() => [
              _createTextVNode(_toDisplayString(error.value), 1)
            ]),
            _: 1
          }))
        : _createCommentVNode("", true),
      _createVNode(_component_VCardText, null, {
        default: _withCtx(() => [
          _createVNode(_component_VRow, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCard, {
                    variant: "tonal",
                    color: scrapeProgress.running ? 'success' : 'grey',
                    class: "pa-3 text-center"
                  }, {
                    default: _withCtx(() => [
                      _cache[23] || (_cache[23] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "刮削状态", -1)),
                      _createElementVNode("div", _hoisted_1, [
                        _createVNode(_component_VIcon, {
                          icon: scrapeProgress.running ? 'mdi-play-circle' : 'mdi-stop-circle',
                          size: "24",
                          class: "mr-1"
                        }, null, 8, ["icon"]),
                        _createTextVNode(" " + _toDisplayString(scrapeProgress.running ? '运行中' : '空闲'), 1)
                      ])
                    ]),
                    _: 1
                  }, 8, ["color"])
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCard, {
                    variant: "tonal",
                    color: "info",
                    class: "pa-3 text-center"
                  }, {
                    default: _withCtx(() => [
                      _cache[24] || (_cache[24] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "总任务", -1)),
                      _createElementVNode("div", _hoisted_2, _toDisplayString(scrapeProgress.total || 0), 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCard, {
                    variant: "tonal",
                    color: "success",
                    class: "pa-3 text-center"
                  }, {
                    default: _withCtx(() => [
                      _cache[25] || (_cache[25] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "成功", -1)),
                      _createElementVNode("div", _hoisted_3, _toDisplayString(scrapeProgress.success || 0), 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCard, {
                    variant: "tonal",
                    color: "error",
                    class: "pa-3 text-center"
                  }, {
                    default: _withCtx(() => [
                      _cache[26] || (_cache[26] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "失败", -1)),
                      _createElementVNode("div", _hoisted_4, _toDisplayString(scrapeProgress.failed || 0), 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          (scrapeProgress.total > 0)
            ? (_openBlock(), _createBlock(_component_VProgressLinear, {
                key: 0,
                "model-value": scrapeProgress.total > 0 ? ((scrapeProgress.success + scrapeProgress.failed) / scrapeProgress.total * 100) : 0,
                color: scrapeProgress.running ? 'primary' : 'success',
                height: "8",
                class: "mt-4",
                rounded: ""
              }, null, 8, ["model-value", "color"]))
            : _createCommentVNode("", true),
          (scrapeProgress.current_file)
            ? (_openBlock(), _createElementBlock("div", _hoisted_5, " 当前处理: " + _toDisplayString(scrapeProgress.current_file), 1))
            : _createCommentVNode("", true),
          (scrapeProgress.duration)
            ? (_openBlock(), _createElementBlock("div", _hoisted_6, " 已运行: " + _toDisplayString(formatDuration(scrapeProgress.duration)), 1))
            : _createCommentVNode("", true)
        ]),
        _: 1
      }),
      _createVNode(_component_VDivider),
      _createVNode(_component_VCardText, { class: "pb-2" }, {
        default: _withCtx(() => [
          _cache[34] || (_cache[34] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "快速操作", -1)),
          _createVNode(_component_VRow, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "4",
                lg: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    color: "primary",
                    variant: "tonal",
                    "prepend-icon": "mdi-play",
                    loading: actionLoading.value === 'scrape',
                    disabled: scrapeProgress.running,
                    onClick: startGlobalScrape
                  }, {
                    default: _withCtx(() => [...(_cache[27] || (_cache[27] = [
                      _createTextVNode(" 全局刮削 ", -1)
                    ]))]),
                    _: 1
                  }, 8, ["loading", "disabled"])
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "4",
                lg: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    color: "secondary",
                    variant: "tonal",
                    "prepend-icon": "mdi-folder-search",
                    loading: actionLoading.value === 'dir',
                    disabled: scrapeProgress.running,
                    onClick: _cache[0] || (_cache[0] = $event => (showDirectoryDialog.value = true))
                  }, {
                    default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                      _createTextVNode(" 目录刮削 ", -1)
                    ]))]),
                    _: 1
                  }, 8, ["loading", "disabled"])
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "4",
                lg: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    color: "info",
                    variant: "tonal",
                    "prepend-icon": "mdi-magnify",
                    onClick: _cache[1] || (_cache[1] = $event => (showSearchDialog.value = true))
                  }, {
                    default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                      _createTextVNode(" 手动匹配 ", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "4",
                lg: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    color: "success",
                    variant: "tonal",
                    "prepend-icon": "mdi-refresh",
                    loading: loading.value,
                    onClick: refreshData
                  }, {
                    default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
                      _createTextVNode(" 刷新状态 ", -1)
                    ]))]),
                    _: 1
                  }, 8, ["loading"])
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "4",
                lg: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    variant: "outlined",
                    "prepend-icon": "mdi-folder-multiple",
                    onClick: _cache[2] || (_cache[2] = $event => (showFileBrowser.value = true))
                  }, {
                    default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
                      _createTextVNode(" 文件浏览 ", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "4",
                lg: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    variant: "outlined",
                    "prepend-icon": "mdi-history",
                    onClick: _cache[3] || (_cache[3] = $event => (showHistoryDialog.value = true))
                  }, {
                    default: _withCtx(() => [...(_cache[32] || (_cache[32] = [
                      _createTextVNode(" 刮削历史 ", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "4",
                lg: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    variant: "outlined",
                    color: "warning",
                    "prepend-icon": "mdi-cog",
                    onClick: _cache[4] || (_cache[4] = $event => (emit('switch')))
                  }, {
                    default: _withCtx(() => [...(_cache[33] || (_cache[33] = [
                      _createTextVNode(" 配置 ", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]),
        _: 1
      }),
      _createVNode(_component_VDialog, {
        modelValue: showFileBrowser.value,
        "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((showFileBrowser).value = $event)),
        fullscreen: ""
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, { class: "d-flex align-center" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[35] || (_cache[35] = [
                      _createTextVNode("文件浏览", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VBtn, {
                    icon: "mdi-close",
                    variant: "text",
                    onClick: _cache[5] || (_cache[5] = $event => (showFileBrowser.value = false))
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VDivider),
              _createVNode(_component_VCardText, { style: {"min-height":"60vh"} }, {
                default: _withCtx(() => [
                  _createVNode(FileBrowser, {
                    "plugin-id": __props.pluginId,
                    api: __props.api
                  }, null, 8, ["plugin-id", "api"])
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
        modelValue: showHistoryDialog.value,
        "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((showHistoryDialog).value = $event)),
        "max-width": "900"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, { class: "d-flex align-center" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[36] || (_cache[36] = [
                      _createTextVNode("刮削历史", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VChip, {
                    size: "small",
                    class: "ml-2",
                    color: "primary",
                    variant: "tonal"
                  }, {
                    default: _withCtx(() => [
                      _createTextVNode(_toDisplayString(historyTotal.value), 1)
                    ]),
                    _: 1
                  }),
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VSelect, {
                    modelValue: historyStatusFilter.value,
                    "onUpdate:modelValue": [
                      _cache[7] || (_cache[7] = $event => ((historyStatusFilter).value = $event)),
                      _cache[8] || (_cache[8] = $event => (loadHistory(1)))
                    ],
                    items: historyStatusOptions,
                    label: "状态",
                    density: "compact",
                    variant: "outlined",
                    "hide-details": "",
                    style: {"max-width":"100px"}
                  }, null, 8, ["modelValue"]),
                  _createVNode(_component_VBtn, {
                    icon: "mdi-close",
                    variant: "text",
                    onClick: _cache[9] || (_cache[9] = $event => (showHistoryDialog.value = false))
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VDivider),
              _createVNode(_component_VCardText, null, {
                default: _withCtx(() => [
                  (historyError.value)
                    ? (_openBlock(), _createBlock(_component_VAlert, {
                        key: 0,
                        type: "error",
                        variant: "tonal",
                        class: "mb-3"
                      }, {
                        default: _withCtx(() => [
                          _createTextVNode(_toDisplayString(historyError.value), 1)
                        ]),
                        _: 1
                      }))
                    : _createCommentVNode("", true),
                  (scrapeHistory.value.length > 0)
                    ? (_openBlock(), _createBlock(_component_VTable, {
                        key: 1,
                        density: "compact"
                      }, {
                        default: _withCtx(() => [
                          _cache[37] || (_cache[37] = _createElementVNode("thead", null, [
                            _createElementVNode("tr", null, [
                              _createElementVNode("th", null, "文件"),
                              _createElementVNode("th", null, "状态"),
                              _createElementVNode("th", null, "耗时"),
                              _createElementVNode("th", null, "完成时间"),
                              _createElementVNode("th", null, "接收"),
                              _createElementVNode("th", null, "屏蔽"),
                              _createElementVNode("th", null, "实际"),
                              _createElementVNode("th", null, "输出")
                            ])
                          ], -1)),
                          _createElementVNode("tbody", null, [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(scrapeHistory.value, (item, i) => {
                              return (_openBlock(), _createElementBlock("tr", { key: i }, [
                                _createElementVNode("td", _hoisted_7, _toDisplayString(item.file_name || item.file_path), 1),
                                _createElementVNode("td", null, [
                                  _createVNode(_component_VChip, {
                                    color: statusColor(item.status),
                                    size: "small",
                                    variant: "tonal"
                                  }, {
                                    default: _withCtx(() => [
                                      _createTextVNode(_toDisplayString(statusText(item.status)), 1)
                                    ]),
                                    _: 2
                                  }, 1032, ["color"])
                                ]),
                                _createElementVNode("td", _hoisted_8, _toDisplayString(item.duration_ms != null ? (item.duration_ms / 1000).toFixed(1) + 's' : '--'), 1),
                                _createElementVNode("td", _hoisted_9, _toDisplayString(item.finished_at || '--'), 1),
                                _createElementVNode("td", _hoisted_10, _toDisplayString(item.danmu_counts?.received != null ? item.danmu_counts.received : '--'), 1),
                                _createElementVNode("td", _hoisted_11, _toDisplayString(item.danmu_counts?.blocked != null ? item.danmu_counts.blocked : '--'), 1),
                                _createElementVNode("td", _hoisted_12, _toDisplayString(item.danmu_counts?.actual != null ? item.danmu_counts.actual : '--'), 1),
                                _createElementVNode("td", _hoisted_13, [
                                  (item.output_ass_path)
                                    ? (_openBlock(), _createElementBlock("span", _hoisted_14, "已生成"))
                                    : (_openBlock(), _createElementBlock("span", _hoisted_15, "无"))
                                ])
                              ]))
                            }), 128))
                          ])
                        ]),
                        _: 1
                      }))
                    : (!historyError.value)
                      ? (_openBlock(), _createBlock(_component_VAlert, {
                          key: 2,
                          type: "info",
                          variant: "tonal",
                          class: "mt-2"
                        }, {
                          default: _withCtx(() => [...(_cache[38] || (_cache[38] = [
                            _createTextVNode(" 暂无刮削记录 ", -1)
                          ]))]),
                          _: 1
                        }))
                      : _createCommentVNode("", true),
                  _createElementVNode("div", _hoisted_16, [
                    _createVNode(_component_VSelect, {
                      modelValue: historyPageSize.value,
                      "onUpdate:modelValue": [
                        _cache[10] || (_cache[10] = $event => ((historyPageSize).value = $event)),
                        _cache[11] || (_cache[11] = $event => (loadHistory(1)))
                      ],
                      items: [10, 15, 20, 30, 50],
                      label: "每页",
                      density: "compact",
                      variant: "outlined",
                      "hide-details": "",
                      style: {"max-width":"80px"},
                      class: "mr-4"
                    }, null, 8, ["modelValue"]),
                    (historyTotalPages.value > 1)
                      ? (_openBlock(), _createBlock(_component_VPagination, {
                          key: 0,
                          modelValue: historyPage.value,
                          "onUpdate:modelValue": [
                            _cache[12] || (_cache[12] = $event => ((historyPage).value = $event)),
                            loadHistory
                          ],
                          length: historyTotalPages.value,
                          "total-visible": 7,
                          density: "compact"
                        }, null, 8, ["modelValue", "length"]))
                      : _createCommentVNode("", true)
                  ])
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
        modelValue: showDirectoryDialog.value,
        "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => ((showDirectoryDialog).value = $event)),
        "max-width": "500"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[39] || (_cache[39] = [
                      _createTextVNode("目录刮削", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCardText, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VTextField, {
                    modelValue: directoryPath.value,
                    "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => ((directoryPath).value = $event)),
                    label: "目标目录路径",
                    placeholder: "/path/to/videos",
                    variant: "outlined",
                    hint: "输入要刮削的目录完整路径",
                    "persistent-hint": ""
                  }, null, 8, ["modelValue"]),
                  _createVNode(_component_VCheckbox, {
                    modelValue: batchMode.value,
                    "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((batchMode).value = $event)),
                    label: "分季批量刮削",
                    hint: "每个子文件夹独立匹配",
                    "persistent-hint": ""
                  }, null, 8, ["modelValue"])
                ]),
                _: 1
              }),
              _createVNode(_component_VCardActions, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    onClick: _cache[16] || (_cache[16] = $event => (showDirectoryDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[40] || (_cache[40] = [
                      _createTextVNode("取消", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VBtn, {
                    color: "primary",
                    variant: "tonal",
                    loading: actionLoading.value === 'dir',
                    onClick: startDirectoryScrape
                  }, {
                    default: _withCtx(() => [...(_cache[41] || (_cache[41] = [
                      _createTextVNode("开始刮削", -1)
                    ]))]),
                    _: 1
                  }, 8, ["loading"])
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
        modelValue: showSearchDialog.value,
        "onUpdate:modelValue": _cache[22] || (_cache[22] = $event => ((showSearchDialog).value = $event)),
        "max-width": "600"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[42] || (_cache[42] = [
                      _createTextVNode("手动匹配番剧", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCardText, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VTextField, {
                    modelValue: searchKeyword.value,
                    "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => ((searchKeyword).value = $event)),
                    label: "番剧名称",
                    placeholder: "输入关键词搜索",
                    variant: "outlined",
                    "append-inner-icon": "mdi-magnify",
                    onKeyup: _withKeys(searchAnime, ["enter"]),
                    "onClick:appendInner": searchAnime
                  }, null, 8, ["modelValue"]),
                  (searchError.value)
                    ? (_openBlock(), _createBlock(_component_VAlert, {
                        key: 0,
                        type: "warning",
                        variant: "tonal",
                        class: "mt-2"
                      }, {
                        default: _withCtx(() => [
                          _createTextVNode(_toDisplayString(searchError.value), 1)
                        ]),
                        _: 1
                      }))
                    : _createCommentVNode("", true),
                  (searchResults.value.length > 0)
                    ? (_openBlock(), _createBlock(_component_VList, {
                        key: 1,
                        class: "mt-2",
                        density: "compact"
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
                    : (searchKeyword.value && searchDone.value && !searchError.value)
                      ? (_openBlock(), _createBlock(_component_VAlert, {
                          key: 2,
                          type: "info",
                          variant: "tonal",
                          class: "mt-2"
                        }, {
                          default: _withCtx(() => [...(_cache[43] || (_cache[43] = [
                            _createTextVNode(" 未找到匹配的番剧 ", -1)
                          ]))]),
                          _: 1
                        }))
                      : _createCommentVNode("", true),
                  (selectedAnime.value)
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 3 }, [
                        _createVNode(_component_VDivider, { class: "my-3" }),
                        _createElementVNode("div", _hoisted_17, "已选择: " + _toDisplayString(selectedAnime.value.anime_title || selectedAnime.value.title), 1),
                        _createVNode(_component_VTextField, {
                          modelValue: episodeOffset.value,
                          "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((episodeOffset).value = $event)),
                          label: "集数偏移",
                          type: "number",
                          variant: "outlined",
                          hint: "正数=后移，负数=前移",
                          "persistent-hint": ""
                        }, null, 8, ["modelValue"]),
                        _createVNode(_component_VTextField, {
                          modelValue: matchFilePath.value,
                          "onUpdate:modelValue": _cache[20] || (_cache[20] = $event => ((matchFilePath).value = $event)),
                          label: "视频文件路径",
                          variant: "outlined",
                          hint: "要匹配的视频文件路径",
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
                    onClick: _cache[21] || (_cache[21] = $event => (showSearchDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[44] || (_cache[44] = [
                      _createTextVNode("取消", -1)
                    ]))]),
                    _: 1
                  }),
                  (selectedAnime.value)
                    ? (_openBlock(), _createBlock(_component_VBtn, {
                        key: 0,
                        color: "primary",
                        variant: "tonal",
                        loading: actionLoading.value === 'match',
                        onClick: saveMatch
                      }, {
                        default: _withCtx(() => [...(_cache[45] || (_cache[45] = [
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
      }, 8, ["modelValue"])
    ]),
    _: 1
  }, 8, ["loading"]))
}
}

};
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-7d553dc3"]]);

export { Page as default };
