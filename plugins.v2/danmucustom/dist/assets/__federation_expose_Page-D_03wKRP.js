import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { a as axios } from './index-vUEH2SzA.js';
import { F as FileBrowser } from './FileBrowser-BpmOOIl6.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,createElementBlock:_createElementBlock,renderList:_renderList,Fragment:_Fragment} = await importShared('vue');


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
const _hoisted_7 = { class: "d-flex align-center mb-3" };
const _hoisted_8 = {
  class: "text-body-2",
  style: {"max-width":"320px","overflow":"hidden","text-overflow":"ellipsis","white-space":"nowrap"}
};
const _hoisted_9 = { class: "text-caption" };
const _hoisted_10 = { class: "text-caption" };
const _hoisted_11 = { class: "text-caption text-center" };
const _hoisted_12 = { class: "text-caption text-center" };
const _hoisted_13 = { class: "text-caption text-center" };
const _hoisted_14 = { class: "text-caption" };
const _hoisted_15 = {
  key: 0,
  class: "text-success"
};
const _hoisted_16 = {
  key: 1,
  class: "text-error"
};
const _hoisted_17 = { class: "d-flex justify-center mt-3" };

const {ref,reactive,onMounted} = await importShared('vue');

// 插件上下文注入
const API_PLUGIN_ID = 'DanmuCustom';

// 统一封装 API 请求，优先使用 MoviePilot 注入的 api 对象

const _sfc_main = {
  __name: 'Page',
  props: ['pluginId', 'config', 'eventBus', 'api'],
  emits: ['switch', 'close', 'action'],
  setup(__props, { emit: __emit }) {


const emit = __emit;

// 后端 API 注册的插件 ID（大小写敏感，必须与后端 class 名一致）
const requestGet = async (path, options = {}) => {
  if (__props.api?.get) {
    return await __props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options);
  return res.data
};

// 解析响应体：兼容 schemas.Response 包装和普通 dict（如 /status 直接返回）
const unwrapResponse = (res) => {
  const data = res?.data ?? res;
  if (data && typeof data === 'object' && 'success' in data && data.success && data.data) {
    return data.data
  }
  return data
};

// 响应式数据
const loading = ref(false);
const error = ref('');
const status = ref('空闲');
const lastUpdated = ref('--');
const actionLoading = ref(null);
const showDirectoryDialog = ref(false);
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

// 状态展示工具
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

// 格式化时长
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h + '时' : ''}${m > 0 ? m + '分' : ''}${s}秒`
};

// 刷新数据
const refreshData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await requestGet('/status');
    const data = unwrapResponse(res);
    status.value = data.running ? '运行中' : '空闲';
    Object.assign(scrapeProgress, data);
    lastUpdated.value = new Date().toLocaleTimeString();
    // 刮削历史：独立加载，不静默吞掉错误（异常直接显示，便于验证后端是否修复）
    await loadHistory();
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

// 加载刮削历史（持久化分页数据，不隐藏 500 错误）
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
    // 不吞掉异常：直接暴露给用户，便于判断后端是否已修复
    historyError.value = err?.message || String(err);
    scrapeHistory.value = [];
  }
};

// 全局刮削
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

// 目录刮削
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

// 初始化
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
  const _component_VChip = _resolveComponent("VChip");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VSelect = _resolveComponent("VSelect");
  const _component_VTable = _resolveComponent("VTable");
  const _component_VPagination = _resolveComponent("VPagination");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VCheckbox = _resolveComponent("VCheckbox");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VDialog = _resolveComponent("VDialog");

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
                      _cache[11] || (_cache[11] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "刮削状态", -1)),
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
                      _cache[12] || (_cache[12] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "总任务", -1)),
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
                      _cache[13] || (_cache[13] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "成功", -1)),
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
                      _cache[14] || (_cache[14] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "失败", -1)),
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
          _cache[19] || (_cache[19] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "快速操作", -1)),
          _createVNode(_component_VRow, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCol, {
                cols: "12",
                sm: "6",
                md: "3"
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
                    default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
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
                md: "3"
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
                    default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
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
                md: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    color: "info",
                    variant: "tonal",
                    "prepend-icon": "mdi-refresh",
                    loading: loading.value,
                    onClick: refreshData
                  }, {
                    default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
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
                md: "3"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VBtn, {
                    block: "",
                    color: "warning",
                    variant: "tonal",
                    "prepend-icon": "mdi-cog",
                    onClick: _cache[1] || (_cache[1] = $event => (emit('switch')))
                  }, {
                    default: _withCtx(() => [...(_cache[18] || (_cache[18] = [
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
      _createVNode(_component_VDivider),
      _createVNode(_component_VCardText, null, {
        default: _withCtx(() => [
          _cache[20] || (_cache[20] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-3" }, "文件浏览", -1)),
          _createVNode(FileBrowser, {
            "plugin-id": __props.pluginId,
            api: __props.api
          }, null, 8, ["plugin-id", "api"])
        ]),
        _: 1
      }),
      _createVNode(_component_VDivider),
      _createVNode(_component_VCardText, null, {
        default: _withCtx(() => [
          _createElementVNode("div", _hoisted_7, [
            _cache[21] || (_cache[21] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold" }, "刮削历史", -1)),
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
                _cache[2] || (_cache[2] = $event => ((historyStatusFilter).value = $event)),
                _cache[3] || (_cache[3] = $event => (loadHistory(1)))
              ],
              items: historyStatusOptions,
              label: "状态筛选",
              density: "compact",
              variant: "outlined",
              "hide-details": "",
              style: {"max-width":"100px"}
            }, null, 8, ["modelValue"]),
            _createVNode(_component_VSelect, {
              modelValue: historyPageSize.value,
              "onUpdate:modelValue": [
                _cache[4] || (_cache[4] = $event => ((historyPageSize).value = $event)),
                _cache[5] || (_cache[5] = $event => (loadHistory(1)))
              ],
              items: [10, 15, 20, 30, 50],
              label: "每页",
              density: "compact",
              variant: "outlined",
              "hide-details": "",
              style: {"max-width":"80px"},
              class: "ml-2"
            }, null, 8, ["modelValue"])
          ]),
          (historyError.value)
            ? (_openBlock(), _createBlock(_component_VAlert, {
                key: 0,
                type: "error",
                variant: "tonal",
                class: "mb-3"
              }, {
                default: _withCtx(() => [
                  _createTextVNode(" 获取历史失败: " + _toDisplayString(historyError.value), 1)
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
                  _cache[22] || (_cache[22] = _createElementVNode("thead", null, [
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
                        _createElementVNode("td", _hoisted_8, _toDisplayString(item.file_name || item.file_path), 1),
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
                        _createElementVNode("td", _hoisted_9, _toDisplayString(item.duration_ms != null ? (item.duration_ms / 1000).toFixed(1) + 's' : '--'), 1),
                        _createElementVNode("td", _hoisted_10, _toDisplayString(item.finished_at || '--'), 1),
                        _createElementVNode("td", _hoisted_11, _toDisplayString(item.danmu_counts?.received != null ? item.danmu_counts.received : '--'), 1),
                        _createElementVNode("td", _hoisted_12, _toDisplayString(item.danmu_counts?.blocked != null ? item.danmu_counts.blocked : '--'), 1),
                        _createElementVNode("td", _hoisted_13, _toDisplayString(item.danmu_counts?.actual != null ? item.danmu_counts.actual : '--'), 1),
                        _createElementVNode("td", _hoisted_14, [
                          (item.output_ass_path)
                            ? (_openBlock(), _createElementBlock("span", _hoisted_15, "已生成"))
                            : (_openBlock(), _createElementBlock("span", _hoisted_16, "无"))
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
                  default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                    _createTextVNode(" 暂无刮削记录，点击上方按钮开始刮削 ", -1)
                  ]))]),
                  _: 1
                }))
              : _createCommentVNode("", true),
          _createElementVNode("div", _hoisted_17, [
            (historyTotalPages.value > 1)
              ? (_openBlock(), _createBlock(_component_VPagination, {
                  key: 0,
                  modelValue: historyPage.value,
                  "onUpdate:modelValue": [
                    _cache[6] || (_cache[6] = $event => ((historyPage).value = $event)),
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
      }),
      _createVNode(_component_VDialog, {
        modelValue: showDirectoryDialog.value,
        "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((showDirectoryDialog).value = $event)),
        "max-width": "500"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
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
                    "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((directoryPath).value = $event)),
                    label: "目标目录路径",
                    placeholder: "/path/to/videos",
                    variant: "outlined",
                    hint: "输入要刮削的目录完整路径",
                    "persistent-hint": ""
                  }, null, 8, ["modelValue"]),
                  _createVNode(_component_VCheckbox, {
                    modelValue: batchMode.value,
                    "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((batchMode).value = $event)),
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
                    onClick: _cache[9] || (_cache[9] = $event => (showDirectoryDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[25] || (_cache[25] = [
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
                    default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                      _createTextVNode(" 开始刮削 ", -1)
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
      }, 8, ["modelValue"])
    ]),
    _: 1
  }, 8, ["loading"]))
}
}

};
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-da4e0aaf"]]);

export { Page as default };
