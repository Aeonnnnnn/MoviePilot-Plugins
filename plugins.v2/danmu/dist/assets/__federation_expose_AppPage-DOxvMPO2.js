import { importShared } from './__federation_fn_import-DE4nw86B.js';
import AppPageScrape from './__federation_expose_AppPageScrape--745__D-.js';

const {openBlock:_openBlock,createBlock:_createBlock} = await importShared('vue');


const _sfc_main = {
  __name: 'AppPage',
  props: ['pluginId', 'config', 'eventBus', 'navKey'],
  setup(__props) {



return (_ctx, _cache) => {
  return (_openBlock(), _createBlock(AppPageScrape, {
    "plugin-id": __props.pluginId,
    config: __props.config,
    "event-bus": __props.eventBus,
    "nav-key": __props.navKey
  }, null, 8, ["plugin-id", "config", "event-bus", "nav-key"]))
}
}

};

export { _sfc_main as default };
