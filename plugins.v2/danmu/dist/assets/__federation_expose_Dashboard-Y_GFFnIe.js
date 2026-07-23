import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { d as mdiInformation, c as mdiAlertCircle, e as mdiAlert, b as mdiCheckCircle, f as mdiFileVideo, g as mdiPlayCircle } from './mdi-DMac1LU-.js';
import { _ as _export_sfc, a as axios } from './_plugin-vue_export-helper-DqfLPMFU.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock,createElementVNode:_createElementVNode} = await importShared('vue');


const _hoisted_1 = { class: "d-flex align-center justify-space-between" };
const _hoisted_2 = { class: "text-caption text-medium-emphasis" };
const _hoisted_3 = { class: "text-h6 font-weight-bold mt-1" };
const _hoisted_4 = { class: "text-caption" };
const _hoisted_5 = {
  key: 0,
  class: "mt-4"
};

const {ref,onMounted} = await importShared('vue');


const _sfc_main = {
  __name: 'Dashboard',
  props: ['pluginId', 'config', 'eventBus'],
  setup(__props) {



const loading = ref(false);
const dashboardData = ref([]);
const recentRecords = ref([]);

const getStatusIcon = (status) => {
  const icons = {
    success: mdiCheckCircle,
    warning: mdiAlert,
    error: mdiAlertCircle,
    info: mdiInformation,
  };
  return icons[status] || mdiInformation
};

const getStatusColor = (status) => {
  const colors = {
    success: 'success',
    warning: 'warning',
    error: 'error',
    info: 'info',
  };
  return colors[status] || 'primary'
};

const getItemIcon = (type) => {
  const icons = {
    scrape: mdiPlayCircle,
    filter: 'mdi-filter-variant',
    match: mdiFileVideo,
  };
  return icons[type] || mdiInformation
};

const refreshData = async () => {
  loading.value = true;
  try {
    // 获取刮削状态
    const statusRes = await axios.get(`/api/v1/plugin/${__props.pluginId}/status`);
    const statusData = statusRes.data?.data || {};

    // 获取过滤统计
    const filterRes = await axios.get(`/api/v1/plugin/${__props.pluginId}/filter/stats`).catch(() => ({ data: {} }));
    const filterData = filterRes.data?.data || {};

    dashboardData.value = [
      {
        label: '刮削状态',
        value: statusData.running ? '运行中' : '空闲',
        status: statusData.running ? 'success' : 'info',
        progress: statusData.total > 0
          ? Math.round((statusData.success + statusData.failed) / statusData.total * 100)
          : undefined,
      },
      {
        label: '总任务数',
        value: statusData.total || 0,
        status: 'info',
      },
      {
        label: '成功/失败',
        value: `${statusData.success || 0} / ${statusData.failed || 0}`,
        status: (statusData.failed || 0) > 0 ? 'warning' : 'success',
      },
      {
        label: '过滤分类',
        value: filterData.category_count || 0,
        status: 'info',
      },
      {
        label: '屏蔽关键词',
        value: filterData.keyword_count || 0,
        status: 'warning',
      },
      {
        label: '屏蔽用户',
        value: filterData.blocked_count || 0,
        status: filterData.blocked_count > 0 ? 'error' : 'success',
      },
      {
        label: '插件状态',
        value: statusData.enabled ? '已启用' : '已禁用',
        status: statusData.enabled ? 'success' : 'warning',
      },
    ];

    // 最近记录
    if (statusData.current_file) {
      recentRecords.value = [
        {
          title: `正在刮削: ${statusData.current_file}`,
          time: new Date().toLocaleTimeString(),
          type: 'scrape',
          status: 'success',
        },
      ];
    }
  } catch (err) {
    console.error('获取仪表板数据失败:', err);
  } finally {
    loading.value = false;
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
  const _component_VProgressCircular = _resolveComponent("VProgressCircular");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VCol = _resolveComponent("VCol");
  const _component_VRow = _resolveComponent("VRow");
  const _component_VListItemTitle = _resolveComponent("VListItemTitle");
  const _component_VListItemSubtitle = _resolveComponent("VListItemSubtitle");
  const _component_VListItem = _resolveComponent("VListItem");
  const _component_VList = _resolveComponent("VList");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VCardActions = _resolveComponent("VCardActions");

  return (_openBlock(), _createBlock(_component_VCard, {
    class: "dashboard-component",
    loading: loading.value
  }, {
    default: _withCtx(() => [
      _createVNode(_component_VCardItem, null, {
        prepend: _withCtx(() => [
          _createVNode(_component_VIcon, {
            icon: "mdi-monitor-dashboard",
            color: "primary",
            size: "32"
          })
        ]),
        default: _withCtx(() => [
          _createVNode(_component_VCardTitle, null, {
            default: _withCtx(() => [
              _createTextVNode(_toDisplayString(__props.config?.attrs?.title || '弹幕刮削仪表板'), 1)
            ]),
            _: 1
          }),
          (__props.config?.attrs?.subtitle)
            ? (_openBlock(), _createBlock(_component_VCardSubtitle, { key: 0 }, {
                default: _withCtx(() => [
                  _createTextVNode(_toDisplayString(__props.config.attrs.subtitle), 1)
                ]),
                _: 1
              }))
            : _createCommentVNode("", true)
        ]),
        _: 1
      }),
      _createVNode(_component_VCardText, null, {
        default: _withCtx(() => [
          _createVNode(_component_VRow, null, {
            default: _withCtx(() => [
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(dashboardData.value, (item, index) => {
                return (_openBlock(), _createBlock(_component_VCol, {
                  key: index,
                  cols: "12",
                  sm: "6",
                  md: "4",
                  lg: "3"
                }, {
                  default: _withCtx(() => [
                    _createVNode(_component_VCard, {
                      color: item.color || getStatusColor(item.status),
                      variant: "tonal",
                      class: "px-4 py-3"
                    }, {
                      default: _withCtx(() => [
                        _createElementVNode("div", _hoisted_1, [
                          _createElementVNode("div", null, [
                            _createElementVNode("div", _hoisted_2, _toDisplayString(item.label), 1),
                            _createElementVNode("div", _hoisted_3, [
                              _createVNode(_component_VIcon, {
                                icon: getStatusIcon(item.status),
                                size: "20",
                                class: "mr-1"
                              }, null, 8, ["icon"]),
                              _createTextVNode(" " + _toDisplayString(item.value), 1)
                            ])
                          ]),
                          (item.progress !== undefined)
                            ? (_openBlock(), _createBlock(_component_VProgressCircular, {
                                key: 0,
                                "model-value": item.progress,
                                color: item.color || 'primary',
                                size: "56",
                                width: "4"
                              }, {
                                default: _withCtx(() => [
                                  _createElementVNode("span", _hoisted_4, _toDisplayString(item.progress) + "%", 1)
                                ]),
                                _: 2
                              }, 1032, ["model-value", "color"]))
                            : _createCommentVNode("", true)
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
          (recentRecords.value.length > 0)
            ? (_openBlock(), _createElementBlock("div", _hoisted_5, [
                _cache[0] || (_cache[0] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "最近记录", -1)),
                _createVNode(_component_VList, {
                  density: "compact",
                  lines: "one"
                }, {
                  default: _withCtx(() => [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(recentRecords.value, (item, index) => {
                      return (_openBlock(), _createBlock(_component_VListItem, { key: index }, {
                        prepend: _withCtx(() => [
                          _createVNode(_component_VIcon, {
                            icon: getItemIcon(item.type),
                            size: "20",
                            color: item.status === 'success' ? 'success' : 'error'
                          }, null, 8, ["icon", "color"])
                        ]),
                        default: _withCtx(() => [
                          _createVNode(_component_VListItemTitle, { class: "text-body-2" }, {
                            default: _withCtx(() => [
                              _createTextVNode(_toDisplayString(item.title), 1)
                            ]),
                            _: 2
                          }, 1024),
                          _createVNode(_component_VListItemSubtitle, { class: "text-caption" }, {
                            default: _withCtx(() => [
                              _createTextVNode(_toDisplayString(item.time), 1)
                            ]),
                            _: 2
                          }, 1024)
                        ]),
                        _: 2
                      }, 1024))
                    }), 128))
                  ]),
                  _: 1
                })
              ]))
            : _createCommentVNode("", true)
        ]),
        _: 1
      }),
      (__props.config?.attrs?.showRefresh !== false)
        ? (_openBlock(), _createBlock(_component_VCardActions, { key: 0 }, {
            default: _withCtx(() => [
              _createVNode(_component_VSpacer),
              _createVNode(_component_VBtn, {
                variant: "text",
                loading: loading.value,
                onClick: refreshData
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_VIcon, {
                    icon: "mdi-refresh",
                    start: ""
                  }),
                  _cache[1] || (_cache[1] = _createTextVNode(" 刷新 ", -1))
                ]),
                _: 1
              }, 8, ["loading"])
            ]),
            _: 1
          }))
        : _createCommentVNode("", true)
    ]),
    _: 1
  }, 8, ["loading"]))
}
}

};
const Dashboard = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-5f7de15e"]]);

export { Dashboard as default };
