import { importShared } from './__federation_fn_import-DE4nw86B.js';
import AppPageScrape from './__federation_expose_AppPageScrape-DtP18i0C.js';
import _sfc_main$1 from './__federation_expose_AppPageFilter-Byh53Wi9.js';

const {openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode} = await importShared('vue');


const _sfc_main = {
  __name: 'AppPage',
  props: ['pluginId', 'config', 'eventBus', 'navKey', 'api'],
  setup(__props) {



return (_ctx, _cache) => {
  return (__props.navKey === 'scrape' || !__props.navKey)
    ? (_openBlock(), _createBlock(AppPageScrape, {
        key: 0,
        "plugin-id": __props.pluginId,
        config: __props.config,
        "event-bus": __props.eventBus,
        "nav-key": __props.navKey,
        api: __props.api
      }, null, 8, ["plugin-id", "config", "event-bus", "nav-key", "api"]))
    : (_openBlock(), _createBlock(_sfc_main$1, {
        key: 1,
        "plugin-id": __props.pluginId,
        config: __props.config,
        "event-bus": __props.eventBus,
        "nav-key": __props.navKey,
        api: __props.api
      }, null, 8, ["plugin-id", "config", "event-bus", "nav-key", "api"]))
}
}

};

export { _sfc_main as default };
