import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { _ as _export_sfc, a as axios } from './_plugin-vue_export-helper-DqfLPMFU.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,createElementBlock:_createElementBlock} = await importShared('vue');


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

const {ref,reactive,onMounted} = await importShared('vue');

// 插件上下文注入

const _sfc_main = {
  __name: 'Page',
  props: ['pluginId', 'config', 'eventBus'],
  setup(__props) {



// 响应式数据
const loading = ref(false);
const error = ref('');
const status = ref('空闲');
const lastUpdated = ref('--');
const actionLoading = ref(null);
const showDirectoryDialog = ref(false);
const directoryPath = ref('');
const batchMode = ref(false);

const scrapeProgress = reactive({
  running: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
});

// 格式化时长
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h + '时' : ''}${m > 0 ? m + '分' : ''}${s}秒`
};

// 获取 API 基础路径
const getApiBase = () => `/api/v1/plugin/${__props.pluginId}`;

// 刷新数据
const refreshData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get(`${getApiBase()}/status`);
    if (res.data?.success) {
      const data = res.data.data;
      status.value = data.running ? '运行中' : '空闲';
      Object.assign(scrapeProgress, data);
      lastUpdated.value = new Date().toLocaleTimeString();
    }
  } catch (err) {
    error.value = `获取状态失败: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// 全局刮削
const startGlobalScrape = async () => {
  actionLoading.value = 'scrape';
  error.value = '';
  try {
    const res = await axios.get(`${getApiBase()}/generate_danmu_with_path`);
    if (res.data?.success) {
      await refreshData();
    } else {
      error.value = res.data?.message || '刮削启动失败';
    }
  } catch (err) {
    error.value = `刮削请求失败: ${err.message}`;
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
    const res = await axios.get(`${getApiBase()}/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    });
    if (res.data?.success) {
      showDirectoryDialog.value = false;
      await refreshData();
    } else {
      error.value = res.data?.message || '刮削启动失败';
    }
  } catch (err) {
    error.value = `刮削请求失败: ${err.message}`;
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
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VCheckbox = _resolveComponent("VCheckbox");
  const _component_VSpacer = _resolveComponent("VSpacer");
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
                      _cache[6] || (_cache[6] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "刮削状态", -1)),
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
                      _cache[7] || (_cache[7] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "总任务", -1)),
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
                      _cache[8] || (_cache[8] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "成功", -1)),
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
                      _cache[9] || (_cache[9] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "失败", -1)),
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
          _cache[14] || (_cache[14] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "快速操作", -1)),
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
                    default: _withCtx(() => [...(_cache[10] || (_cache[10] = [
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
                    default: _withCtx(() => [...(_cache[11] || (_cache[11] = [
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
                    default: _withCtx(() => [...(_cache[12] || (_cache[12] = [
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
                    onClick: _cache[1] || (_cache[1] = $event => (_ctx.$emit('open-config')))
                  }, {
                    default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
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
        modelValue: showDirectoryDialog.value,
        "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((showDirectoryDialog).value = $event)),
        "max-width": "500"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
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
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((directoryPath).value = $event)),
                    label: "目标目录路径",
                    placeholder: "/path/to/videos",
                    variant: "outlined",
                    hint: "输入要刮削的目录完整路径",
                    "persistent-hint": ""
                  }, null, 8, ["modelValue"]),
                  _createVNode(_component_VCheckbox, {
                    modelValue: batchMode.value,
                    "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((batchMode).value = $event)),
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
                    onClick: _cache[4] || (_cache[4] = $event => (showDirectoryDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
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
                    default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
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
const Page = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-a8794208"]]);

export { Page as default };
