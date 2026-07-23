import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { a as axios } from './index-vUEH2SzA.js';
import { _ as _sfc_main$1 } from './FilterManager-C39A9_Li.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,mergeProps:_mergeProps,Fragment:_Fragment,createElementBlock:_createElementBlock} = await importShared('vue');


const {ref,reactive,onMounted} = await importShared('vue');

const API_PLUGIN_ID = 'DanmuCustom';

// 统一封装 API 请求，优先使用 MoviePilot 注入的 api 对象

const _sfc_main = {
  __name: 'Config',
  props: {
  pluginId: String,
  config: Object,
  initialConfig: Object,
  eventBus: Object,
  api: Object,
},
  emits: ['save', 'close', 'switch'],
  setup(__props, { emit: __emit }) {

const props = __props;

const emit = __emit;

// 后端 API 注册的插件 ID（大小写敏感，必须与后端 class 名一致）
const requestGet = async (path, options = {}) => {
  if (props.api?.get) {
    return await props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options);
  return res.data
};

// 解析响应体，兼容 schemas.Response 和普通 dict
const unwrapResponse = (res) => {
  const data = res?.data ?? res;
  // 如果有 success 字段，提取 data；否则直接返回
  if (data && typeof data === 'object' && 'success' in data && data.success && data.data) {
    return data.data
  }
  return data
};

const loading = ref(false);
const saving = ref(false);
const error = ref('');
const saveSuccess = ref(false);
const configTab = ref('basic');

const screenAreaOptions = [
  { title: '全屏', value: 'full' },
  { title: '半屏', value: 'half' },
  { title: '1/4 屏', value: 'quarter' },
];

const defaultForm = {
  enabled: false,
  path: '',
  width: 1920,
  height: 1080,
  fontsize: 50,
  alpha: 0.8,
  duration: 15,
  max_threads: 10,
  onlyFromBili: false,
  useTmdbID: true,
  auto_scrape: true,
  enable_retry_task: true,
  screen_area: 'full',
  enable_strm: true,
  filter_enabled: true,
  filter_blocked_modes: [],
  filter_similarity_threshold: 0.8,
  filter_similarity_enabled: true,
  filter_freq_window: 30.0,
  filter_freq_max: 10,
  filter_screen_max: 15,
  filter_screen_window: 5.0,
  filter_screen_top_ratio: 0.25,
  filter_screen_bottom_ratio: 0.10,
  filter_screen_scroll_ratio: 0.65,
};

const form = reactive({ ...defaultForm });

// 加载配置：优先使用 MoviePilot 注入的配置，仅作为兜底才请求自定义 /config API
const loadConfig = async () => {
  loading.value = true;
  error.value = '';

  try {
    // 优先使用 MoviePilot 注入的 initialConfig 或 config
    const injectedConfig = props.initialConfig || props.config;
    if (injectedConfig && Object.keys(injectedConfig).length > 0) {
      Object.assign(form, defaultForm, injectedConfig);
      return
    }

    // 兜底：通过自定义 API 加载
    const res = await requestGet('/config');
    const configData = unwrapResponse(res);
    if (configData) {
      Object.assign(form, defaultForm, configData);
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件后端 API 未注册，可能插件尚未启用。请先打开「启用插件」开关并保存。';
    } else {
      error.value = `加载配置失败: ${err.message}`;
    }
  } finally {
    loading.value = false;
  }
};

// 保存配置：通过 MoviePilot 标准 emit('save') 流程保存
const saveConfig = () => {
  saving.value = true;
  error.value = '';
  saveSuccess.value = false;

  try {
    emit('save', { ...form });
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err) {
    error.value = `保存配置失败: ${err.message}`;
  } finally {
    saving.value = false;
  }
};

// 重置
const resetConfig = () => {
  Object.assign(form, defaultForm);
};

onMounted(() => {
  loadConfig();
});

return (_ctx, _cache) => {
  const _component_VIcon = _resolveComponent("VIcon");
  const _component_VCardTitle = _resolveComponent("VCardTitle");
  const _component_VCardSubtitle = _resolveComponent("VCardSubtitle");
  const _component_VCardItem = _resolveComponent("VCardItem");
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VTab = _resolveComponent("VTab");
  const _component_VTabs = _resolveComponent("VTabs");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VSwitch = _resolveComponent("VSwitch");
  const _component_VCol = _resolveComponent("VCol");
  const _component_VTextarea = _resolveComponent("VTextarea");
  const _component_VRow = _resolveComponent("VRow");
  const _component_VWindowItem = _resolveComponent("VWindowItem");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VSelect = _resolveComponent("VSelect");
  const _component_VCheckbox = _resolveComponent("VCheckbox");
  const _component_VTooltip = _resolveComponent("VTooltip");
  const _component_VWindow = _resolveComponent("VWindow");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VCard = _resolveComponent("VCard");

  return (_openBlock(), _createBlock(_component_VCard, {
    class: "config-component",
    loading: loading.value
  }, {
    default: _withCtx(() => [
      _createVNode(_component_VCardItem, null, {
        prepend: _withCtx(() => [
          _createVNode(_component_VIcon, {
            icon: "mdi-cog",
            color: "primary",
            size: "32"
          })
        ]),
        default: _withCtx(() => [
          _createVNode(_component_VCardTitle, null, {
            default: _withCtx(() => [...(_cache[33] || (_cache[33] = [
              _createTextVNode("插件配置", -1)
            ]))]),
            _: 1
          }),
          _createVNode(_component_VCardSubtitle, null, {
            default: _withCtx(() => [...(_cache[34] || (_cache[34] = [
              _createTextVNode("弹幕刮削参数设置", -1)
            ]))]),
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
      (saveSuccess.value)
        ? (_openBlock(), _createBlock(_component_VAlert, {
            key: 1,
            type: "success",
            variant: "tonal",
            closable: "",
            class: "mx-4 mb-2"
          }, {
            default: _withCtx(() => [...(_cache[35] || (_cache[35] = [
              _createTextVNode(" 配置已保存 ", -1)
            ]))]),
            _: 1
          }))
        : _createCommentVNode("", true),
      _createVNode(_component_VCardText, null, {
        default: _withCtx(() => [
          _createVNode(_component_VTabs, {
            modelValue: configTab.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((configTab).value = $event)),
            color: "primary"
          }, {
            default: _withCtx(() => [
              _createVNode(_component_VTab, { value: "basic" }, {
                default: _withCtx(() => [...(_cache[36] || (_cache[36] = [
                  _createTextVNode("基本设置", -1)
                ]))]),
                _: 1
              }),
              _createVNode(_component_VTab, { value: "display" }, {
                default: _withCtx(() => [...(_cache[37] || (_cache[37] = [
                  _createTextVNode("显示参数", -1)
                ]))]),
                _: 1
              }),
              _createVNode(_component_VTab, { value: "filter" }, {
                default: _withCtx(() => [...(_cache[38] || (_cache[38] = [
                  _createTextVNode("过滤设置", -1)
                ]))]),
                _: 1
              }),
              _createVNode(_component_VTab, { value: "dictionary" }, {
                default: _withCtx(() => [...(_cache[39] || (_cache[39] = [
                  _createTextVNode("词库管理", -1)
                ]))]),
                _: 1
              }),
              _createVNode(_component_VTab, { value: "advanced" }, {
                default: _withCtx(() => [...(_cache[40] || (_cache[40] = [
                  _createTextVNode("高级选项", -1)
                ]))]),
                _: 1
              })
            ]),
            _: 1
          }, 8, ["modelValue"]),
          _createVNode(_component_VDivider, { class: "mb-4" }),
          _createVNode(_component_VWindow, {
            modelValue: configTab.value,
            "onUpdate:modelValue": _cache[32] || (_cache[32] = $event => ((configTab).value = $event))
          }, {
            default: _withCtx(() => [
              _createVNode(_component_VWindowItem, { value: "basic" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VRow, null, {
                    default: _withCtx(() => [
                      _createVNode(_component_VCol, { cols: "12" }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            modelValue: form.enabled,
                            "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((form.enabled) = $event)),
                            label: "启用插件",
                            color: "primary",
                            "hide-details": "",
                            class: "mb-4"
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, { cols: "12" }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextarea, {
                            modelValue: form.path,
                            "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((form.path) = $event)),
                            label: "刮削路径",
                            placeholder: "每行一个目录路径",
                            variant: "outlined",
                            rows: "3",
                            hint: "配置需要刮削弹幕的视频目录，支持多路径（每行一个）",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, { cols: "12" }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            modelValue: form.auto_scrape,
                            "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((form.auto_scrape) = $event)),
                            label: "自动刮削",
                            color: "primary",
                            hint: "文件传输完成后自动生成弹幕",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, { cols: "12" }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            modelValue: form.enable_retry_task,
                            "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((form.enable_retry_task) = $event)),
                            label: "启用重试任务",
                            color: "primary",
                            hint: "每3小时自动重试弹幕数量不足的文件",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, { cols: "12" }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            modelValue: form.enable_strm,
                            "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((form.enable_strm) = $event)),
                            label: "启用 .strm 文件刮削",
                            color: "primary",
                            hint: "对 .strm 流媒体文件也进行弹幕刮削",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VWindowItem, { value: "display" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VRow, null, {
                    default: _withCtx(() => [
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "6"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: form.width,
                            "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((form.width) = $event)),
                            modelModifiers: { number: true },
                            label: "宽度",
                            type: "number",
                            variant: "outlined",
                            hint: "弹幕分辨率宽度",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "6"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: form.height,
                            "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((form.height) = $event)),
                            modelModifiers: { number: true },
                            label: "高度",
                            type: "number",
                            variant: "outlined",
                            hint: "弹幕分辨率高度",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "4"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: form.fontsize,
                            "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((form.fontsize) = $event)),
                            modelModifiers: { number: true },
                            label: "字号",
                            type: "number",
                            variant: "outlined",
                            suffix: "px"
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "4"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: form.alpha,
                            "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((form.alpha) = $event)),
                            modelModifiers: { number: true },
                            label: "透明度",
                            type: "number",
                            variant: "outlined",
                            hint: "0.0 ~ 1.0",
                            min: "0",
                            max: "1",
                            step: "0.05",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "4"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: form.duration,
                            "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((form.duration) = $event)),
                            modelModifiers: { number: true },
                            label: "持续时间",
                            type: "number",
                            variant: "outlined",
                            suffix: "秒"
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "6"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSelect, {
                            modelValue: form.screen_area,
                            "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((form.screen_area) = $event)),
                            label: "屏幕区域",
                            items: screenAreaOptions,
                            variant: "outlined"
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "6"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            modelValue: form.onlyFromBili,
                            "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((form.onlyFromBili) = $event)),
                            label: "仅使用B站弹幕",
                            color: "primary",
                            hint: "只使用来自Bilibili的弹幕源",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      _createVNode(_component_VCol, { cols: "12" }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            modelValue: form.useTmdbID,
                            "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((form.useTmdbID) = $event)),
                            label: "使用TMDB ID匹配",
                            color: "primary",
                            hint: "优先使用TMDB ID进行番剧匹配",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VWindowItem, { value: "filter" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VRow, null, {
                    default: _withCtx(() => [
                      _createVNode(_component_VCol, { cols: "12" }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            modelValue: form.filter_enabled,
                            "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => ((form.filter_enabled) = $event)),
                            label: "启用弹幕内容过滤",
                            color: "primary",
                            class: "mb-4"
                          }, null, 8, ["modelValue"])
                        ]),
                        _: 1
                      }),
                      (form.filter_enabled)
                        ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                            _createVNode(_component_VCol, { cols: "12" }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VAlert, {
                                  type: "info",
                                  variant: "tonal",
                                  icon: "mdi-information",
                                  class: "mb-2"
                                }, {
                                  default: _withCtx(() => [...(_cache[41] || (_cache[41] = [
                                    _createTextVNode(" 分类屏蔽词库和关键词维护、已封禁用户管理请前往「词库管理」页签操作，或通过左侧栏「弹幕过滤」页面操作。 ", -1)
                                  ]))]),
                                  _: 1
                                })
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, { cols: "12" }, {
                              default: _withCtx(() => [
                                _cache[42] || (_cache[42] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "屏蔽弹幕模式", -1)),
                                _createVNode(_component_VCheckbox, {
                                  modelValue: form.filter_blocked_modes,
                                  "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((form.filter_blocked_modes) = $event)),
                                  label: "顶部弹幕",
                                  value: "top",
                                  color: "primary"
                                }, null, 8, ["modelValue"]),
                                _createVNode(_component_VCheckbox, {
                                  modelValue: form.filter_blocked_modes,
                                  "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => ((form.filter_blocked_modes) = $event)),
                                  label: "底部弹幕",
                                  value: "bottom",
                                  color: "primary"
                                }, null, 8, ["modelValue"]),
                                _createVNode(_component_VCheckbox, {
                                  modelValue: form.filter_blocked_modes,
                                  "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => ((form.filter_blocked_modes) = $event)),
                                  label: "滚动弹幕",
                                  value: "scroll",
                                  color: "primary"
                                }, null, 8, ["modelValue"]),
                                _createVNode(_component_VCheckbox, {
                                  modelValue: form.filter_blocked_modes,
                                  "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => ((form.filter_blocked_modes) = $event)),
                                  label: "逆向弹幕",
                                  value: "reverse",
                                  color: "primary"
                                }, null, 8, ["modelValue"]),
                                _createVNode(_component_VCheckbox, {
                                  modelValue: form.filter_blocked_modes,
                                  "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => ((form.filter_blocked_modes) = $event)),
                                  label: "精准定位",
                                  value: "position",
                                  color: "primary"
                                }, null, 8, ["modelValue"]),
                                _createVNode(_component_VCheckbox, {
                                  modelValue: form.filter_blocked_modes,
                                  "onUpdate:modelValue": _cache[20] || (_cache[20] = $event => ((form.filter_blocked_modes) = $event)),
                                  label: "高级弹幕",
                                  value: "advanced",
                                  color: "primary"
                                }, null, 8, ["modelValue"]),
                                _createVNode(_component_VCheckbox, {
                                  modelValue: form.filter_blocked_modes,
                                  "onUpdate:modelValue": _cache[21] || (_cache[21] = $event => ((form.filter_blocked_modes) = $event)),
                                  label: "代码弹幕",
                                  value: "code",
                                  color: "primary"
                                }, null, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VDivider, { class: "my-3" }),
                            _createVNode(_component_VCol, { cols: "12" }, {
                              default: _withCtx(() => [...(_cache[43] || (_cache[43] = [
                                _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "相似弹幕过滤", -1)
                              ]))]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "6"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VSwitch, {
                                  modelValue: form.filter_similarity_enabled,
                                  "onUpdate:modelValue": _cache[22] || (_cache[22] = $event => ((form.filter_similarity_enabled) = $event)),
                                  label: "启用相似弹幕过滤",
                                  color: "primary"
                                }, null, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "6"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_similarity_threshold,
                                  "onUpdate:modelValue": _cache[23] || (_cache[23] = $event => ((form.filter_similarity_threshold) = $event)),
                                  modelModifiers: { number: true },
                                  label: "相似度阈值",
                                  type: "number",
                                  variant: "outlined",
                                  hint: "0.0 ~ 1.0，值越低越严格",
                                  min: "0",
                                  max: "1",
                                  step: "0.05",
                                  "persistent-hint": ""
                                }, null, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VDivider, { class: "my-3" }),
                            _createVNode(_component_VCol, { cols: "12" }, {
                              default: _withCtx(() => [...(_cache[44] || (_cache[44] = [
                                _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "同屏密度控制", -1)
                              ]))]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "4"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_screen_max,
                                  "onUpdate:modelValue": _cache[24] || (_cache[24] = $event => ((form.filter_screen_max) = $event)),
                                  modelModifiers: { number: true },
                                  label: "同屏最大弹幕数",
                                  type: "number",
                                  variant: "outlined",
                                  hint: "同一时刻屏幕允许显示的最大弹幕条数，超过则丢弃",
                                  "persistent-hint": ""
                                }, {
                                  "append-inner": _withCtx(() => [
                                    _createVNode(_component_VTooltip, {
                                      text: "同一时刻屏幕上的最大弹幕数量上限。超出此数量后新增弹幕将被丢弃。适合控制弹幕密集程度，避免遮挡画面。",
                                      location: "bottom"
                                    }, {
                                      activator: _withCtx(({ props }) => [
                                        _createVNode(_component_VIcon, _mergeProps(props, {
                                          icon: "mdi-help-circle-outline",
                                          size: "small",
                                          color: "medium-emphasis"
                                        }), null, 16)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "4"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_screen_window,
                                  "onUpdate:modelValue": _cache[25] || (_cache[25] = $event => ((form.filter_screen_window) = $event)),
                                  modelModifiers: { number: true },
                                  label: "同屏时间窗口",
                                  type: "number",
                                  variant: "outlined",
                                  suffix: "秒",
                                  hint: "统计同屏弹幕数量的时间窗口",
                                  "persistent-hint": ""
                                }, {
                                  "append-inner": _withCtx(() => [
                                    _createVNode(_component_VTooltip, {
                                      text: "统计『同屏弹幕数』的时间范围（秒）。在此时间窗口内累计的弹幕数超过上限即被丢弃。窗口越小、弹幕统计越精确。",
                                      location: "bottom"
                                    }, {
                                      activator: _withCtx(({ props }) => [
                                        _createVNode(_component_VIcon, _mergeProps(props, {
                                          icon: "mdi-help-circle-outline",
                                          size: "small",
                                          color: "medium-emphasis"
                                        }), null, 16)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "4"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_freq_window,
                                  "onUpdate:modelValue": _cache[26] || (_cache[26] = $event => ((form.filter_freq_window) = $event)),
                                  modelModifiers: { number: true },
                                  label: "用户频率窗口",
                                  type: "number",
                                  variant: "outlined",
                                  suffix: "秒",
                                  hint: "统计单用户发送频率的时间窗口",
                                  "persistent-hint": ""
                                }, {
                                  "append-inner": _withCtx(() => [
                                    _createVNode(_component_VTooltip, {
                                      text: "统计单个用户弹幕发送频率的时间范围（秒）。在此窗口内若某用户发送弹幕超过上限，该用户将被降低信用分，累积到一定程度会被屏蔽。",
                                      location: "bottom"
                                    }, {
                                      activator: _withCtx(({ props }) => [
                                        _createVNode(_component_VIcon, _mergeProps(props, {
                                          icon: "mdi-help-circle-outline",
                                          size: "small",
                                          color: "medium-emphasis"
                                        }), null, 16)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "4"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_freq_max,
                                  "onUpdate:modelValue": _cache[27] || (_cache[27] = $event => ((form.filter_freq_max) = $event)),
                                  modelModifiers: { number: true },
                                  label: "窗口内最大弹幕",
                                  type: "number",
                                  variant: "outlined",
                                  hint: "超过则降低信用分",
                                  "persistent-hint": ""
                                }, {
                                  "append-inner": _withCtx(() => [
                                    _createVNode(_component_VTooltip, {
                                      text: "单用户在频率窗口内允许发送的最大弹幕数。超过此数量则用户信用分被扣减，信用分过低时该用户弹幕将被屏蔽，直至恢复正常或管理员手动解封。",
                                      location: "bottom"
                                    }, {
                                      activator: _withCtx(({ props }) => [
                                        _createVNode(_component_VIcon, _mergeProps(props, {
                                          icon: "mdi-help-circle-outline",
                                          size: "small",
                                          color: "medium-emphasis"
                                        }), null, 16)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VDivider, { class: "my-3" }),
                            _createVNode(_component_VCol, { cols: "12" }, {
                              default: _withCtx(() => [...(_cache[45] || (_cache[45] = [
                                _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "屏幕区域保留比例", -1)
                              ]))]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "4"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_screen_top_ratio,
                                  "onUpdate:modelValue": _cache[28] || (_cache[28] = $event => ((form.filter_screen_top_ratio) = $event)),
                                  modelModifiers: { number: true },
                                  label: "顶部保留比例",
                                  type: "number",
                                  variant: "outlined",
                                  hint: "0.0 ~ 1.0",
                                  min: "0",
                                  max: "1",
                                  step: "0.05",
                                  "persistent-hint": ""
                                }, {
                                  "append-inner": _withCtx(() => [
                                    _createVNode(_component_VTooltip, {
                                      text: "屏幕顶部预留给弹幕的显示区域比例。设为 0 则不显示顶部弹幕；设为 0.33 则顶部 1/3 区域为弹幕区。配合底部比例和滚动比例一起调整弹幕布局。",
                                      location: "bottom"
                                    }, {
                                      activator: _withCtx(({ props }) => [
                                        _createVNode(_component_VIcon, _mergeProps(props, {
                                          icon: "mdi-help-circle-outline",
                                          size: "small",
                                          color: "medium-emphasis"
                                        }), null, 16)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "4"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_screen_bottom_ratio,
                                  "onUpdate:modelValue": _cache[29] || (_cache[29] = $event => ((form.filter_screen_bottom_ratio) = $event)),
                                  modelModifiers: { number: true },
                                  label: "底部保留比例",
                                  type: "number",
                                  variant: "outlined",
                                  hint: "0.0 ~ 1.0",
                                  min: "0",
                                  max: "1",
                                  step: "0.05",
                                  "persistent-hint": ""
                                }, {
                                  "append-inner": _withCtx(() => [
                                    _createVNode(_component_VTooltip, {
                                      text: "屏幕底部预留给弹幕的显示区域比例。底弹幕通常用于字幕区上方，建议不要过大以免遮挡字幕/UI。",
                                      location: "bottom"
                                    }, {
                                      activator: _withCtx(({ props }) => [
                                        _createVNode(_component_VIcon, _mergeProps(props, {
                                          icon: "mdi-help-circle-outline",
                                          size: "small",
                                          color: "medium-emphasis"
                                        }), null, 16)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"])
                              ]),
                              _: 1
                            }),
                            _createVNode(_component_VCol, {
                              cols: "12",
                              md: "4"
                            }, {
                              default: _withCtx(() => [
                                _createVNode(_component_VTextField, {
                                  modelValue: form.filter_screen_scroll_ratio,
                                  "onUpdate:modelValue": _cache[30] || (_cache[30] = $event => ((form.filter_screen_scroll_ratio) = $event)),
                                  modelModifiers: { number: true },
                                  label: "滚动保留比例",
                                  type: "number",
                                  variant: "outlined",
                                  hint: "0.0 ~ 1.0",
                                  min: "0",
                                  max: "1",
                                  step: "0.05",
                                  "persistent-hint": ""
                                }, {
                                  "append-inner": _withCtx(() => [
                                    _createVNode(_component_VTooltip, {
                                      text: "屏幕滚动弹幕的显示区域比例。滚动弹幕是弹幕主力，通常占比最大。三个比例（顶部+底部+滚动）建议之和不超 1.0。",
                                      location: "bottom"
                                    }, {
                                      activator: _withCtx(({ props }) => [
                                        _createVNode(_component_VIcon, _mergeProps(props, {
                                          icon: "mdi-help-circle-outline",
                                          size: "small",
                                          color: "medium-emphasis"
                                        }), null, 16)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["modelValue"])
                              ]),
                              _: 1
                            })
                          ], 64))
                        : _createCommentVNode("", true)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VWindowItem, { value: "dictionary" }, {
                default: _withCtx(() => [
                  _createVNode(_sfc_main$1, {
                    "plugin-id": API_PLUGIN_ID,
                    api: props.api,
                    compact: ""
                  }, null, 8, ["api"])
                ]),
                _: 1
              }),
              _createVNode(_component_VWindowItem, { value: "advanced" }, {
                default: _withCtx(() => [
                  _createVNode(_component_VRow, null, {
                    default: _withCtx(() => [
                      _createVNode(_component_VCol, {
                        cols: "12",
                        md: "6"
                      }, {
                        default: _withCtx(() => [
                          _createVNode(_component_VTextField, {
                            modelValue: form.max_threads,
                            "onUpdate:modelValue": _cache[31] || (_cache[31] = $event => ((form.max_threads) = $event)),
                            modelModifiers: { number: true },
                            label: "最大线程数",
                            type: "number",
                            variant: "outlined",
                            hint: "同时刮削的任务数",
                            "persistent-hint": ""
                          }, null, 8, ["modelValue"])
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
          }, 8, ["modelValue"])
        ]),
        _: 1
      }),
      _createVNode(_component_VDivider),
      _createVNode(_component_VCardActions, { class: "pa-4" }, {
        default: _withCtx(() => [
          _createVNode(_component_VBtn, {
            variant: "tonal",
            color: "grey",
            onClick: resetConfig
          }, {
            default: _withCtx(() => [
              _createVNode(_component_VIcon, {
                icon: "mdi-restore",
                start: ""
              }),
              _cache[46] || (_cache[46] = _createTextVNode(" 重置 ", -1))
            ]),
            _: 1
          }),
          _createVNode(_component_VSpacer),
          _createVNode(_component_VBtn, {
            variant: "tonal",
            color: "primary",
            loading: saving.value,
            onClick: saveConfig
          }, {
            default: _withCtx(() => [
              _createVNode(_component_VIcon, {
                icon: "mdi-content-save",
                start: ""
              }),
              _cache[47] || (_cache[47] = _createTextVNode(" 保存配置 ", -1))
            ]),
            _: 1
          }, 8, ["loading"])
        ]),
        _: 1
      })
    ]),
    _: 1
  }, 8, ["loading"]))
}
}

};
const Config = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-1f621dad"]]);

export { Config as default };
