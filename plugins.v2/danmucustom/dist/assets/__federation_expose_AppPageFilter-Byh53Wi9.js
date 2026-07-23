import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { _ as _sfc_main$1 } from './FilterManager-C39A9_Li.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createElementVNode:_createElementVNode,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock} = await importShared('vue');


const _hoisted_1 = { class: "d-flex align-center mb-4" };

const API_PLUGIN_ID = 'DanmuCustom';

const _sfc_main = {
  __name: 'AppPageFilter',
  props: ['pluginId', 'config', 'eventBus', 'navKey', 'api'],
  setup(__props) {



return (_ctx, _cache) => {
  const _component_VIcon = _resolveComponent("VIcon");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VSheet = _resolveComponent("VSheet");

  return (_openBlock(), _createBlock(_component_VSheet, { class: "pa-4" }, {
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        _createVNode(_component_VIcon, {
          icon: "mdi-filter-variant",
          color: "primary",
          size: "28",
          class: "mr-3"
        }),
        _cache[0] || (_cache[0] = _createElementVNode("div", null, [
          _createElementVNode("div", { class: "text-h5" }, "弹幕过滤管理"),
          _createElementVNode("div", { class: "text-subtitle-2 text-medium-emphasis" }, "分类屏蔽词库 · 关键词维护 · 用户管理")
        ], -1))
      ]),
      _createVNode(_component_VDivider, { class: "mb-4" }),
      _createVNode(_sfc_main$1, {
        "plugin-id": API_PLUGIN_ID,
        api: __props.api
      }, null, 8, ["api"])
    ]),
    _: 1
  }))
}
}

};

export { _sfc_main as default };
