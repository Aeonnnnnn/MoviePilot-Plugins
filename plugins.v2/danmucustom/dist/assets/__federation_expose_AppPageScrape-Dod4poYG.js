import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { m as mdiStopCircle, a as mdiCheckCircle, b as mdiAlertCircle, c as mdiPauseCircle, d as mdiPlay } from './mdi-Dq0LriwR.js';
import { a as axios } from './index-vUEH2SzA.js';
import { F as FileBrowser } from './FileBrowser-Br1t0ODW.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock} = await importShared('vue');


const _hoisted_1 = {
  class: "d-flex align-center flex-wrap",
  style: {"gap":"8px"}
};
const _hoisted_2 = { class: "ml-1 text-caption" };
const _hoisted_3 = { class: "text-caption text-medium-emphasis" };
const _hoisted_4 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_5 = {
  key: 1,
  class: "mt-2 text-body-2 text-medium-emphasis"
};
const _hoisted_6 = {
  class: "text-body-2",
  style: {"max-width":"320px","overflow":"hidden","text-overflow":"ellipsis","white-space":"nowrap"}
};
const _hoisted_7 = { class: "text-caption" };
const _hoisted_8 = { class: "text-caption" };
const _hoisted_9 = { class: "text-caption text-center" };
const _hoisted_10 = { class: "text-caption text-center" };
const _hoisted_11 = { class: "text-caption text-center" };
const _hoisted_12 = { class: "text-caption" };
const _hoisted_13 = {
  key: 0,
  class: "text-success"
};
const _hoisted_14 = {
  key: 1,
  class: "text-error"
};
const _hoisted_15 = { class: "d-flex justify-center mt-3" };

const {ref,reactive,computed,onMounted} = await importShared('vue');

const API_PLUGIN_ID = 'DanmuCustom';


const _sfc_main = {
  __name: 'AppPageScrape',
  props: ['pluginId', 'config', 'eventBus', 'navKey', 'api'],
  setup(__props) {



const requestGet = async (path, options = {}) => {
  if (__props.api?.get) {
    return await __props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options);
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
const actionLoading = ref(null);
const actionResult = ref(null);
const taskActionLoading = ref(null);

const scrapeProgress = reactive({
  running: false,
  paused: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
});

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

const statsCards = computed(() => {
  let statusText = '空闲';
  let statusColor = 'grey';
  let statusIcon = mdiStopCircle;
  if (scrapeProgress.paused) {
    statusText = '已暂停';
    statusColor = 'warning';
    statusIcon = mdiPauseCircle;
  } else if (scrapeProgress.running) {
    statusText = '运行中';
    statusColor = 'success';
    statusIcon = mdiPlay;
  }
  const skipped = scrapeProgress.skipped || 0;
  return [
    {
      title: '刮削状态',
      value: statusText,
      icon: statusIcon,
      color: statusColor,
    },
    {
      title: '总任务',
      value: scrapeProgress.total || 0,
      icon: 'mdi-numeric',
      color: 'info',
    },
    {
      title: '成功 / 跳过',
      value: `${scrapeProgress.success || 0} / ${skipped}`,
      icon: mdiCheckCircle,
      color: 'success',
    },
    {
      title: '失败',
      value: scrapeProgress.failed || 0,
      icon: mdiAlertCircle,
      color: 'error',
    },
  ]
});

// 对话框
const showDirectoryDialog = ref(false);
const showFileBrowser = ref(false);
const showHistoryDialog = ref(false);
const directoryPath = ref('');
const batchMode = ref(false);

// 轮询定时器
let pollingTimer = null;

const startPolling = () => {
  stopPolling();
  pollingTimer = setInterval(refreshStatus, 3000);
};

const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
};

const refreshStatus = async () => {
  try {
    const res = await requestGet('/task/status');
    const statusData = unwrapResponse(res) || {};
    const st = statusData?.status || 'idle';
    scrapeProgress.running = st === 'running';
    scrapeProgress.paused = st === 'paused';
    scrapeProgress.total = statusData?.total || 0;
    scrapeProgress.success = statusData?.success || 0;
    scrapeProgress.failed = statusData?.failed || 0;
    scrapeProgress.skipped = statusData?.skipped || 0;
    scrapeProgress.current_file = statusData?.current_file || '';
    // 如果任务结束（非 running / paused），停止轮询
    if (!scrapeProgress.running && !scrapeProgress.paused) {
      stopPolling();
    }
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

const startGlobalScrape = async () => {
  actionLoading.value = 'global';
  actionResult.value = null;
  try {
    const res = await requestGet('/generate_danmu_with_path');
    const body = unwrapResponse(res) || {};
    actionResult.value = {
      type: res?.success ? 'success' : 'error',
      message: res?.message || '刮削已启动',
      preMatch: body?.pre_match,
    };
    startPolling();
    setTimeout(refreshStatus, 2000);
  } catch (err) {
    actionResult.value = { type: 'error', message: err?.response?.status === 404 || err?.status === 404 ? '插件未启用，请先在插件配置中启用插件并保存。' : `请求失败: ${err.message}` };
  } finally {
    actionLoading.value = null;
  }
};

const startDirectoryScrape = async () => {
  if (!directoryPath.value.trim()) {
    actionResult.value = { type: 'error', message: '请输入目录路径' };
    return
  }
  actionLoading.value = 'dir';
  actionResult.value = null;
  try {
    const endpoint = batchMode.value ? 'batch_season_scrape' : 'scrape_directory';
    const res = await requestGet(`/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    });
    const body = unwrapResponse(res) || {};
    actionResult.value = {
      type: res?.success ? 'success' : 'error',
      message: res?.message || '刮削已启动',
      preMatch: body?.pre_match,
    };
    startPolling();
    showDirectoryDialog.value = false;
    setTimeout(refreshStatus, 2000);
  } catch (err) {
    actionResult.value = { type: 'error', message: err?.response?.status === 404 || err?.status === 404 ? '插件未启用，请先在插件配置中启用插件并保存。' : `请求失败: ${err.message}` };
  } finally {
    actionLoading.value = null;
  }
};

// --- 任务控制 ---
const taskPause = async () => {
  if (!confirm('确定要暂停当前刮削任务吗？暂停后可继续。')) return
  taskActionLoading.value = 'pause';
  actionResult.value = null;
  try {
    const res = await requestGet('/task/pause');
    if (res?.success) {
      scrapeProgress.paused = true;
      scrapeProgress.running = false;
      actionResult.value = { type: 'success', message: res.message || '任务已暂停' };
    } else {
      actionResult.value = { type: 'error', message: res?.message || '暂停失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `暂停失败：${err?.message || err}` };
  } finally {
    taskActionLoading.value = null;
  }
};

const taskResume = async () => {
  taskActionLoading.value = 'resume';
  actionResult.value = null;
  try {
    const res = await requestGet('/task/resume');
    if (res?.success) {
      scrapeProgress.paused = false;
      scrapeProgress.running = true;
      actionResult.value = { type: 'success', message: res.message || '任务已恢复' };
      startPolling();
    } else {
      actionResult.value = { type: 'error', message: res?.message || '恢复失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `恢复失败：${err?.message || err}` };
  } finally {
    taskActionLoading.value = null;
  }
};

const taskCancel = async () => {
  if (!confirm('确定要取消当前刮削任务吗？已完成的文件不会丢失，未完成的可重新提交。')) return
  taskActionLoading.value = 'cancel';
  actionResult.value = null;
  try {
    await requestGet('/task/clear');
    const res = await requestGet('/task/cancel');
    if (res?.success) {
      scrapeProgress.running = false;
      scrapeProgress.paused = false;
      actionResult.value = { type: 'success', message: res.message || '任务已取消' };
      stopPolling();
    } else {
      actionResult.value = { type: 'error', message: res?.message || '取消失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `取消失败：${err?.message || err}` };
  } finally {
    taskActionLoading.value = null;
  }
};

onMounted(() => {
  refreshStatus();
});

return (_ctx, _cache) => {
  const _component_VIcon = _resolveComponent("VIcon");
  const _component_VCardTitle = _resolveComponent("VCardTitle");
  const _component_VCardSubtitle = _resolveComponent("VCardSubtitle");
  const _component_VCardItem = _resolveComponent("VCardItem");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VChip = _resolveComponent("VChip");
  const _component_VCol = _resolveComponent("VCol");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VRow = _resolveComponent("VRow");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VProgressLinear = _resolveComponent("VProgressLinear");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VDialog = _resolveComponent("VDialog");
  const _component_VSelect = _resolveComponent("VSelect");
  const _component_VTable = _resolveComponent("VTable");
  const _component_VPagination = _resolveComponent("VPagination");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VCheckbox = _resolveComponent("VCheckbox");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VContainer = _resolveComponent("VContainer");

  return (_openBlock(), _createBlock(_component_VContainer, {
    fluid: "",
    class: "pa-4 app-page-scrape"
  }, {
    default: _withCtx(() => [
      _createVNode(_component_VRow, null, {
        default: _withCtx(() => [
          _createVNode(_component_VCol, { cols: "12" }, {
            default: _withCtx(() => [
              _createVNode(_component_VCard, null, {
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
                        default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
                          _createTextVNode("弹幕刮削管理", -1)
                        ]))]),
                        _: 1
                      }),
                      _createVNode(_component_VCardSubtitle, null, {
                        default: _withCtx(() => [
                          _createTextVNode("pluginId: " + _toDisplayString(__props.pluginId) + " · navKey: " + _toDisplayString(__props.navKey), 1)
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
                  (actionResult.value)
                    ? (_openBlock(), _createBlock(_component_VAlert, {
                        key: 1,
                        type: actionResult.value.type,
                        variant: "tonal",
                        closable: "",
                        class: "mx-4 mb-2"
                      }, {
                        default: _withCtx(() => [
                          _createElementVNode("div", _hoisted_1, [
                            _createElementVNode("span", null, _toDisplayString(actionResult.value.message), 1),
                            (actionResult.value.preMatch && actionResult.value.preMatch.total > 0)
                              ? (_openBlock(), _createBlock(_component_VChip, {
                                  key: 0,
                                  color: actionResult.value.preMatch.matched > 0 ? 'success' : 'warning',
                                  size: "small",
                                  variant: "elevated",
                                  "prepend-icon": "mdi-rocket-launch"
                                }, {
                                  default: _withCtx(() => [
                                    _createTextVNode(" 预匹配 " + _toDisplayString(actionResult.value.preMatch.matched) + "/" + _toDisplayString(actionResult.value.preMatch.total) + " ", 1),
                                    _createElementVNode("span", _hoisted_2, "(" + _toDisplayString(actionResult.value.preMatch.elapsed) + "s" + _toDisplayString(actionResult.value.preMatch.source ? ' · ' + actionResult.value.preMatch.source : '') + ")", 1)
                                  ]),
                                  _: 1
                                }, 8, ["color"]))
                              : _createCommentVNode("", true)
                          ])
                        ]),
                        _: 1
                      }, 8, ["type"]))
                    : _createCommentVNode("", true),
                  (scrapeProgress.running || scrapeProgress.paused)
                    ? (_openBlock(), _createBlock(_component_VCardText, {
                        key: 2,
                        class: "pb-0"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VRow, { class: "align-center" }, {
                            default: _withCtx(() => [
                              _createVNode(_component_VCol, null, {
                                default: _withCtx(() => [
                                  _createVNode(_component_VAlert, {
                                    density: "compact",
                                    type: scrapeProgress.paused ? 'warning' : 'info',
                                    variant: "tonal",
                                    class: "mb-0"
                                  }, {
                                    default: _withCtx(() => [
                                      _createVNode(_component_VIcon, {
                                        icon: scrapeProgress.paused ? 'mdi-pause-circle' : 'mdi-play-circle',
                                        size: "18",
                                        class: "mr-1"
                                      }, null, 8, ["icon"]),
                                      _createTextVNode(" " + _toDisplayString(scrapeProgress.paused ? '任务已暂停，点击「继续」恢复刮削' : '任务运行中… 可暂停后继续'), 1)
                                    ]),
                                    _: 1
                                  }, 8, ["type"])
                                ]),
                                _: 1
                              }),
                              _createVNode(_component_VCol, { cols: "auto" }, {
                                default: _withCtx(() => [
                                  (!scrapeProgress.paused)
                                    ? (_openBlock(), _createBlock(_component_VBtn, {
                                        key: 0,
                                        color: "warning",
                                        variant: "tonal",
                                        size: "small",
                                        "prepend-icon": "mdi-pause",
                                        loading: taskActionLoading.value === 'pause',
                                        onClick: taskPause,
                                        class: "mr-2"
                                      }, {
                                        default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
                                          _createTextVNode(" 暂停 ", -1)
                                        ]))]),
                                        _: 1
                                      }, 8, ["loading"]))
                                    : (_openBlock(), _createBlock(_component_VBtn, {
                                        key: 1,
                                        color: "success",
                                        variant: "tonal",
                                        size: "small",
                                        "prepend-icon": "mdi-play",
                                        loading: taskActionLoading.value === 'resume',
                                        onClick: taskResume,
                                        class: "mr-2"
                                      }, {
                                        default: _withCtx(() => [...(_cache[18] || (_cache[18] = [
                                          _createTextVNode(" 继续 ", -1)
                                        ]))]),
                                        _: 1
                                      }, 8, ["loading"])),
                                  _createVNode(_component_VBtn, {
                                    color: "error",
                                    variant: "tonal",
                                    size: "small",
                                    "prepend-icon": "mdi-stop",
                                    loading: taskActionLoading.value === 'cancel',
                                    onClick: taskCancel
                                  }, {
                                    default: _withCtx(() => [...(_cache[19] || (_cache[19] = [
                                      _createTextVNode(" 取消 ", -1)
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
                      }))
                    : _createCommentVNode("", true),
                  _createVNode(_component_VCardText, null, {
                    default: _withCtx(() => [
                      _createVNode(_component_VRow, null, {
                        default: _withCtx(() => [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(statsCards.value, (stat) => {
                            return (_openBlock(), _createBlock(_component_VCol, {
                              cols: "12",
                              sm: "6",
                              md: "3",
                              key: stat.title
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VCard, {
                                  variant: "tonal",
                                  color: stat.color,
                                  class: "pa-3 text-center"
                                }, {
                                  default: _withCtx(() => [
                                    _createElementVNode("div", _hoisted_3, _toDisplayString(stat.title), 1),
                                    _createElementVNode("div", _hoisted_4, [
                                      _createVNode(_component_VIcon, {
                                        icon: stat.icon,
                                        size: "24",
                                        class: "mr-1"
                                      }, null, 8, ["icon"]),
                                      _createTextVNode(" " + _toDisplayString(stat.value), 1)
                                    ])
                                  ]),
                                  _: 2
                                }, 1032, ["color"])
                              ]),
                              _: 2
                            }, 1024))
                          }), 128))
                        ]),
                        _: 1
                      }),
                      (scrapeProgress.total > 0 && (scrapeProgress.running || scrapeProgress.paused))
                        ? (_openBlock(), _createBlock(_component_VProgressLinear, {
                            key: 0,
                            "model-value": scrapeProgress.total > 0 ? ((scrapeProgress.success + scrapeProgress.failed) / scrapeProgress.total * 100) : 0,
                            color: scrapeProgress.paused ? 'warning' : 'primary',
                            height: "8",
                            class: "mt-4",
                            rounded: "",
                            striped: ""
                          }, null, 8, ["model-value", "color"]))
                        : _createCommentVNode("", true),
                      (scrapeProgress.current_file)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_5, [
                            _createVNode(_component_VIcon, {
                              icon: "mdi-file-video",
                              size: "16",
                              class: "mr-1"
                            }),
                            _createTextVNode(" " + _toDisplayString(scrapeProgress.current_file), 1)
                          ]))
                        : _createCommentVNode("", true)
                    ]),
                    _: 1
                  }),
                  _createVNode(_component_VDivider),
                  _createVNode(_component_VCardText, null, {
                    default: _withCtx(() => [
                      _cache[25] || (_cache[25] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-3" }, "快速操作", -1)),
                      _createVNode(_component_VRow, null, {
                        default: _withCtx(() => [
                          _createVNode(_component_VCol, {
                            cols: "12",
                            sm: "6",
                            md: "4",
                            lg: "2"
                          }, {
                            default: _withCtx(() => [
                              _createVNode(_component_VBtn, {
                                block: "",
                                color: "primary",
                                variant: "tonal",
                                size: "large",
                                "prepend-icon": "mdi-play-circle",
                                loading: actionLoading.value === 'global',
                                onClick: startGlobalScrape
                              }, {
                                default: _withCtx(() => [...(_cache[20] || (_cache[20] = [
                                  _createTextVNode(" 全局刮削 ", -1)
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
                            lg: "2"
                          }, {
                            default: _withCtx(() => [
                              _createVNode(_component_VBtn, {
                                block: "",
                                color: "secondary",
                                variant: "tonal",
                                size: "large",
                                "prepend-icon": "mdi-folder-search",
                                onClick: _cache[0] || (_cache[0] = $event => (showDirectoryDialog.value = true))
                              }, {
                                default: _withCtx(() => [...(_cache[21] || (_cache[21] = [
                                  _createTextVNode(" 目录刮削 ", -1)
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
                                size: "large",
                                "prepend-icon": "mdi-refresh",
                                loading: loading.value,
                                onClick: refreshStatus
                              }, {
                                default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
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
                                size: "large",
                                "prepend-icon": "mdi-folder-multiple",
                                onClick: _cache[1] || (_cache[1] = $event => (showFileBrowser.value = true))
                              }, {
                                default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
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
                                size: "large",
                                "prepend-icon": "mdi-history",
                                onClick: _cache[2] || (_cache[2] = $event => (showHistoryDialog.value = true))
                              }, {
                                default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                                  _createTextVNode(" 刮削历史 ", -1)
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
        "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((showFileBrowser).value = $event)),
        "max-width": "1100",
        scrollable: ""
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, { "max-height": "80vh" }, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, { class: "d-flex align-center" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                      _createTextVNode("文件浏览", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VBtn, {
                    icon: "mdi-close",
                    variant: "text",
                    onClick: _cache[3] || (_cache[3] = $event => (showFileBrowser.value = false))
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VDivider),
              _createVNode(_component_VCardText, { style: {"overflow-y":"auto","max-height":"65vh"} }, {
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
        "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((showHistoryDialog).value = $event)),
        "max-width": "1000"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, { class: "d-flex align-center" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[27] || (_cache[27] = [
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
                      _cache[5] || (_cache[5] = $event => ((historyStatusFilter).value = $event)),
                      _cache[6] || (_cache[6] = $event => (loadHistory(1)))
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
                    onClick: _cache[7] || (_cache[7] = $event => (showHistoryDialog.value = false))
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VDivider),
              _createVNode(_component_VCardText, { style: {"overflow-x":"auto"} }, {
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
                        density: "compact",
                        style: {"min-width":"780px"}
                      }, {
                        default: _withCtx(() => [
                          _cache[28] || (_cache[28] = _createElementVNode("thead", null, [
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
                                _createElementVNode("td", _hoisted_6, _toDisplayString(item.file_name || item.file_path), 1),
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
                                _createElementVNode("td", _hoisted_7, _toDisplayString(item.duration_ms != null ? (item.duration_ms / 1000).toFixed(1) + 's' : '--'), 1),
                                _createElementVNode("td", _hoisted_8, _toDisplayString(item.finished_at || '--'), 1),
                                _createElementVNode("td", _hoisted_9, _toDisplayString(item.danmu_counts?.received != null ? item.danmu_counts.received : '--'), 1),
                                _createElementVNode("td", _hoisted_10, _toDisplayString(item.danmu_counts?.blocked != null ? item.danmu_counts.blocked : '--'), 1),
                                _createElementVNode("td", _hoisted_11, _toDisplayString(item.danmu_counts?.actual != null ? item.danmu_counts.actual : '--'), 1),
                                _createElementVNode("td", _hoisted_12, [
                                  (item.output_ass_path)
                                    ? (_openBlock(), _createElementBlock("span", _hoisted_13, "已生成"))
                                    : (_openBlock(), _createElementBlock("span", _hoisted_14, "无"))
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
                          default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                            _createTextVNode(" 暂无刮削记录 ", -1)
                          ]))]),
                          _: 1
                        }))
                      : _createCommentVNode("", true),
                  _createElementVNode("div", _hoisted_15, [
                    _createVNode(_component_VSelect, {
                      modelValue: historyPageSize.value,
                      "onUpdate:modelValue": [
                        _cache[8] || (_cache[8] = $event => ((historyPageSize).value = $event)),
                        _cache[9] || (_cache[9] = $event => (loadHistory(1)))
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
                            _cache[10] || (_cache[10] = $event => ((historyPage).value = $event)),
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
        "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((showDirectoryDialog).value = $event)),
        "max-width": "500"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
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
                    "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((directoryPath).value = $event)),
                    label: "目标目录路径",
                    placeholder: "/path/to/videos",
                    variant: "outlined",
                    hint: "输入要刮削的目录完整路径",
                    "persistent-hint": ""
                  }, null, 8, ["modelValue"]),
                  _createVNode(_component_VCheckbox, {
                    modelValue: batchMode.value,
                    "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((batchMode).value = $event)),
                    label: "分季批量刮削",
                    color: "primary",
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
                    onClick: _cache[14] || (_cache[14] = $event => (showDirectoryDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
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
                    default: _withCtx(() => [...(_cache[32] || (_cache[32] = [
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
      }, 8, ["modelValue"])
    ]),
    _: 1
  }))
}
}

};
const AppPageScrape = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-63eb9e08"]]);

export { AppPageScrape as default };
