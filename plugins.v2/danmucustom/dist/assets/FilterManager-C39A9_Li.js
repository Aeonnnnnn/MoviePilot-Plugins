import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { a as axios } from './index-vUEH2SzA.js';

const {toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,resolveComponent:_resolveComponent,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createVNode:_createVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock,withModifiers:_withModifiers,mergeProps:_mergeProps,withKeys:_withKeys,createElementVNode:_createElementVNode} = await importShared('vue');


const _hoisted_1 = { class: "ml-8 mb-2" };
const _hoisted_2 = { class: "d-flex align-center mb-1" };
const _hoisted_3 = {
  key: 1,
  class: "text-caption text-medium-emphasis mt-1"
};
const _hoisted_4 = { class: "ml-8 mb-2" };
const _hoisted_5 = { class: "d-flex align-center mb-1" };
const _hoisted_6 = {
  key: 1,
  class: "text-caption text-medium-emphasis mt-1"
};
const _hoisted_7 = { class: "ml-8 mb-2" };
const _hoisted_8 = { class: "d-flex align-center mb-1" };
const _hoisted_9 = {
  key: 1,
  class: "text-caption text-medium-emphasis mt-1"
};
const _hoisted_10 = {
  key: 0,
  class: "mb-3"
};
const _hoisted_11 = { class: "flex-grow-1" };
const _hoisted_12 = { class: "text-body-2 font-weight-medium" };
const _hoisted_13 = { class: "text-caption text-medium-emphasis" };
const _hoisted_14 = {
  key: 1,
  class: "text-caption text-medium-emphasis mb-3"
};
const _hoisted_15 = { key: 2 };
const _hoisted_16 = { class: "flex-grow-1" };
const _hoisted_17 = { class: "text-body-2 font-weight-medium" };
const _hoisted_18 = { class: "text-caption text-medium-emphasis" };
const _hoisted_19 = { class: "d-flex justify-end mt-3" };

const {ref,computed,onMounted} = await importShared('vue');


const _sfc_main = {
  __name: 'FilterManager',
  props: {
  pluginId: { type: String, required: true },
  api: { type: Object, default: null },
  compact: { type: Boolean, default: false },
},
  setup(__props) {

const props = __props;

const API_PLUGIN_ID = props.pluginId || 'DanmuCustom';

// --- API 封装 ---
const requestGet = async (path, options = {}) => {
  if (props.api?.get) {
    return await props.api.get(`plugin/${API_PLUGIN_ID}${path}`, options)
  }
  const res = await axios.get(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, options);
  return res.data
};

const requestPost = async (path, data = {}, options = {}) => {
  if (props.api?.post) {
    return await props.api.post(`plugin/${API_PLUGIN_ID}${path}`, data, options)
  }
  const res = await axios.post(`/api/v1/plugin/${API_PLUGIN_ID}${path}`, data, options);
  return res.data
};

// --- 状态 ---
const loading = ref(false);
const error = ref('');
const actionResult = ref(null);
const actionLoading = ref(null);
const categories = ref([]);
const blockedUsers = ref([]);
const warnedUsers = ref([]);
const unblockLoading = ref(null);
const resetLoading = ref(null);

// 新增关键词输入
const newKeywords = ref({});
// 组合规则 / 正则规则输入缓存
const newCombos = ref({});
const newRegexes = ref({});

// 为分类初始化组合/正则输入缓存，避免模板 v-model 访问 undefined 报错
const ensureInputs = (cats) => {
  (cats || []).forEach((c) => {
    if (!newCombos.value[c.name]) newCombos.value[c.name] = { keyword: '', max_len: 0 };
    if (!newRegexes.value[c.name]) newRegexes.value[c.name] = { pattern: '', level: 2 };
  });
};

// 对话框
const showAddCategoryDialog = ref(false);
const newCategoryName = ref('');
const newCategoryDesc = ref('');
const showDeleteCategoryDialog = ref(false);
const deletingCategory = ref('');

const totalKeywords = computed(() => {
  return categories.value.reduce((sum, cat) => sum + (cat.keywords?.length || 0), 0)
});

// --- 数据刷新 ---
const refreshData = async () => {
  loading.value = true;
  error.value = '';
  try {
    // 并发请求：分类 + 用户数据（使用 allSettled，单个接口失败不拖垮整个页面）
    const [catResult, userResult] = await Promise.allSettled([
      requestGet('/filter/categories'),
      requestGet('/filter/blocked_users'),
    ]);

    if (catResult.status === 'fulfilled') {
      const catRes = catResult.value;
      const payload = catRes?.data ?? catRes;

      if (payload?.success || Array.isArray(payload)) {
        const data = payload.success ? (payload.data || []) : payload;
        if (Array.isArray(data)) {
          categories.value = data;
          ensureInputs(categories.value);
        } else if (data.categories && typeof data.categories === 'object') {
          categories.value = Object.entries(data.categories).map(([name, item]) => ({
            name,
            ...(item || {}),
            keywords: item?.keywords || [],
            combos: item?.combos || [],
            regexes: item?.regexes || [],
          }));
          ensureInputs(categories.value);
        } else {
          categories.value = [];
        }
      } else {
        error.value = payload?.message || '获取分类失败';
      }
    } else {
      error.value = `获取分类失败: ${catResult.reason?.message || catResult.reason}`;
    }

    if (userResult.status === 'fulfilled') {
      const userRes = userResult.value;
      const payload = userRes?.data ?? userRes;

      if (payload?.success) {
        const userData = payload.data || {};
        blockedUsers.value = userData.blocked_users || [];
        warnedUsers.value = userData.warned_users || [];
      } else if (payload && typeof payload === 'object') {
        blockedUsers.value = payload.blocked_users || [];
        warnedUsers.value = payload.warned_users || [];
      }
    } else {
      // 用户数据不是核心数据，失败时不要阻断分类词库页面
      blockedUsers.value = [];
      warnedUsers.value = [];
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.status === 404) {
      error.value = '插件未启用或后端 API 未注册，请先在插件配置中启用插件并保存。';
    } else {
      error.value = `获取数据失败: ${err.message}`;
    }
  } finally {
    loading.value = false;
  }
};

// --- 分类操作 ---
const openAddCategoryDialog = () => {
  newCategoryName.value = '';
  newCategoryDesc.value = '';
  showAddCategoryDialog.value = true;
};

const addCategory = async () => {
  const name = newCategoryName.value.trim();
  if (!name) return
  actionLoading.value = 'add-category';
  try {
    const res = await requestPost('/filter/category/add', { name, desc: newCategoryDesc.value.trim() });
    const data = res?.data ?? res;
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已添加分类「${name}」` };
      showAddCategoryDialog.value = false;
      await refreshData();
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加分类失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` };
  } finally {
    actionLoading.value = null;
  }
};

const confirmDeleteCategory = (name) => {
  deletingCategory.value = name;
  showDeleteCategoryDialog.value = true;
};

const deleteCategory = async () => {
  const name = deletingCategory.value;
  if (!name) return
  actionLoading.value = 'delete-category';
  try {
    const res = await requestPost('/filter/category/remove', { name });
    const data = res?.data ?? res;
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已删除分类「${name}」` };
      showDeleteCategoryDialog.value = false;
      await refreshData();
    } else {
      actionResult.value = { type: 'error', message: data?.message || '删除分类失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` };
  } finally {
    actionLoading.value = null;
  }
};

const toggleCategory = async (name, enabled) => {
  try {
    const res = await requestPost('/filter/category/enable', { name, enabled });
    const data = res?.data ?? res;
    if (data?.success) {
      const cat = categories.value.find(c => c.name === name);
      if (cat) cat.enabled = enabled;
    }
  } catch (err) {
    // 静默恢复
    categories.value = [...categories.value];
  }
};

// --- 关键词操作 ---
const addKeyword = async (categoryName) => {
  const kw = (newKeywords.value[categoryName] || '').trim();
  if (!kw) return
  try {
    const res = await requestPost('/filter/keywords/add', { category: categoryName, keyword: kw });
    const data = res?.data ?? res;
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName);
      if (cat) {
        if (!cat.keywords) cat.keywords = [];
        if (!cat.keywords.includes(kw)) cat.keywords.push(kw);
      }
      newKeywords.value[categoryName] = '';
      actionResult.value = { type: 'success', message: `已添加关键词「${kw}」` };
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加关键词失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` };
  }
};

const removeKeyword = async (categoryName, keyword) => {
  try {
    const res = await requestPost('/filter/keywords/remove', { category: categoryName, keyword });
    const data = res?.data ?? res;
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName);
      if (cat && cat.keywords) {
        cat.keywords = cat.keywords.filter(k => k !== keyword);
      }
      actionResult.value = { type: 'success', message: `已删除关键词「${keyword}」` };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` };
  }
};

// --- 组合规则操作 ---
const addCombo = async (categoryName) => {
  const inp = newCombos.value[categoryName];
  const kw = (inp?.keyword || '').trim();
  const maxLen = Number(inp?.max_len) || 0;
  if (!kw) return
  try {
    const res = await requestPost('/filter/combo/add', { category: categoryName, keyword: kw, max_len: maxLen });
    const data = res?.data ?? res;
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName);
      if (cat) {
        if (!cat.combos) cat.combos = [];
        if (!cat.combos.find(r => r[0] === kw)) cat.combos.push([kw, maxLen]);
      }
      inp.keyword = '';
      inp.max_len = 0;
      actionResult.value = { type: 'success', message: `已添加组合规则「${kw}」` };
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加组合规则失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` };
  }
};

const removeCombo = async (categoryName, keyword) => {
  try {
    const res = await requestPost('/filter/combo/remove', { category: categoryName, keyword });
    const data = res?.data ?? res;
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName);
      if (cat && cat.combos) cat.combos = cat.combos.filter(r => r[0] !== keyword);
      actionResult.value = { type: 'success', message: `已删除组合规则「${keyword}」` };
    } else {
      actionResult.value = { type: 'error', message: data?.message || '删除组合规则失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` };
  }
};

// --- 正则规则操作 ---
const addRegex = async (categoryName) => {
  const inp = newRegexes.value[categoryName];
  const pat = (inp?.pattern || '').trim();
  const level = Number(inp?.level) || 2;
  if (!pat) return
  try {
    const res = await requestPost('/filter/regex/add', { category: categoryName, pattern: pat, level });
    const data = res?.data ?? res;
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName);
      if (cat) {
        if (!cat.regexes) cat.regexes = [];
        if (!cat.regexes.find(r => r[0] === pat)) cat.regexes.push([pat, level]);
      }
      inp.pattern = '';
      inp.level = 2;
      actionResult.value = { type: 'success', message: `已添加正则规则「${pat}」` };
    } else {
      actionResult.value = { type: 'error', message: data?.message || '添加正则规则失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` };
  }
};

const removeRegex = async (categoryName, pattern) => {
  try {
    const res = await requestPost('/filter/regex/remove', { category: categoryName, pattern });
    const data = res?.data ?? res;
    if (data?.success) {
      const cat = categories.value.find(c => c.name === categoryName);
      if (cat && cat.regexes) cat.regexes = cat.regexes.filter(r => r[0] !== pattern);
      actionResult.value = { type: 'success', message: `已删除正则规则「${pattern}」` };
    } else {
      actionResult.value = { type: 'error', message: data?.message || '删除正则规则失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` };
  }
};

// --- 用户操作 ---
const handleUnblock = async (userId) => {
  if (!confirm(`确定解除封禁用户 ${userId} 吗？解除后将恢复默认信用分。`)) return
  unblockLoading.value = userId;
  try {
    const res = await requestPost('/filter/users/unblock', { mid_hash: userId });
    const data = res?.data ?? res;
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已解除封禁用户 ${userId}` };
    } else {
      actionResult.value = { type: 'error', message: data?.message || '解除封禁失败' };
    }
    await refreshData();
  } catch (err) {
    actionResult.value = { type: 'error', message: `解除封禁失败: ${err.message}` };
  } finally {
    unblockLoading.value = null;
  }
};

const handleReset = async (userId) => {
  if (!confirm(`确定重置用户 ${userId} 的信用分吗？将恢复到默认值并解除封禁状态。`)) return
  resetLoading.value = userId;
  try {
    const res = await requestPost('/filter/users/reset', { mid_hash: userId });
    const data = res?.data ?? res;
    if (data?.success) {
      actionResult.value = { type: 'success', message: `已重置用户 ${userId} 的信用分` };
    } else {
      actionResult.value = { type: 'error', message: data?.message || '重置失败' };
    }
    await refreshData();
  } catch (err) {
    actionResult.value = { type: 'error', message: `重置失败: ${err.message}` };
  } finally {
    resetLoading.value = null;
  }
};

onMounted(() => {
  refreshData();
});

return (_ctx, _cache) => {
  const _component_VAlert = _resolveComponent("VAlert");
  const _component_VIcon = _resolveComponent("VIcon");
  const _component_VChip = _resolveComponent("VChip");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VCardTitle = _resolveComponent("VCardTitle");
  const _component_VSwitch = _resolveComponent("VSwitch");
  const _component_VListItem = _resolveComponent("VListItem");
  const _component_VTooltip = _resolveComponent("VTooltip");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VChipGroup = _resolveComponent("VChipGroup");
  const _component_VSelect = _resolveComponent("VSelect");
  const _component_VListGroup = _resolveComponent("VListGroup");
  const _component_VList = _resolveComponent("VList");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VCol = _resolveComponent("VCol");
  const _component_VRow = _resolveComponent("VRow");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VDialog = _resolveComponent("VDialog");

  return (_openBlock(), _createElementBlock("div", null, [
    (actionResult.value)
      ? (_openBlock(), _createBlock(_component_VAlert, {
          key: 0,
          type: actionResult.value.type,
          variant: "tonal",
          closable: "",
          class: "mb-3",
          "onClick:close": _cache[0] || (_cache[0] = $event => (actionResult.value = null))
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(actionResult.value.message), 1)
          ]),
          _: 1
        }, 8, ["type"]))
      : _createCommentVNode("", true),
    (error.value)
      ? (_openBlock(), _createBlock(_component_VAlert, {
          key: 1,
          type: "error",
          variant: "tonal",
          closable: "",
          class: "mb-3",
          "onClick:close": _cache[1] || (_cache[1] = $event => (error.value = ''))
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(error.value), 1)
          ]),
          _: 1
        }))
      : _createCommentVNode("", true),
    _createVNode(_component_VRow, null, {
      default: _withCtx(() => [
        _createVNode(_component_VCol, {
          cols: __props.compact ? 12 : 12,
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_VCard, {
              variant: __props.compact ? 'tonal' : 'elevated'
            }, {
              default: _withCtx(() => [
                _createVNode(_component_VCardTitle, { class: "d-flex align-center" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_VIcon, { start: "" }, {
                      default: _withCtx(() => [...(_cache[9] || (_cache[9] = [
                        _createTextVNode("mdi-book-open-variant", -1)
                      ]))]),
                      _: 1
                    }),
                    _cache[11] || (_cache[11] = _createTextVNode(" 分类屏蔽词库 ", -1)),
                    _createVNode(_component_VChip, {
                      size: "small",
                      class: "ml-2",
                      color: "primary",
                      variant: "tonal"
                    }, {
                      default: _withCtx(() => [
                        _createTextVNode(_toDisplayString(totalKeywords.value), 1)
                      ]),
                      _: 1
                    }),
                    _createVNode(_component_VSpacer),
                    _createVNode(_component_VBtn, {
                      size: "small",
                      color: "primary",
                      variant: "tonal",
                      "prepend-icon": "mdi-plus",
                      onClick: openAddCategoryDialog
                    }, {
                      default: _withCtx(() => [...(_cache[10] || (_cache[10] = [
                        _createTextVNode(" 添加分类 ", -1)
                      ]))]),
                      _: 1
                    })
                  ]),
                  _: 1
                }),
                _createVNode(_component_VCardText, null, {
                  default: _withCtx(() => [
                    (categories.value.length > 0)
                      ? (_openBlock(), _createBlock(_component_VList, {
                          key: 0,
                          density: "compact",
                          lines: "two"
                        }, {
                          default: _withCtx(() => [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(categories.value, (cat) => {
                              return (_openBlock(), _createBlock(_component_VListGroup, {
                                key: cat.name,
                                value: cat.name
                              }, {
                                activator: _withCtx(({ props: activatorProps }) => [
                                  _createVNode(_component_VListItem, _mergeProps({ ref_for: true }, activatorProps, {
                                    "prepend-icon": cat.enabled ? 'mdi-check-circle' : 'mdi-close-circle',
                                    title: cat.name
                                  }), {
                                    subtitle: _withCtx(() => [
                                      _createTextVNode(_toDisplayString(cat.desc || '无描述') + " · " + _toDisplayString(cat.keywords?.length || 0) + " 个关键词 ", 1)
                                    ]),
                                    append: _withCtx(() => [
                                      _createVNode(_component_VSwitch, {
                                        "model-value": cat.enabled,
                                        density: "compact",
                                        "hide-details": "",
                                        color: "success",
                                        onClick: _cache[2] || (_cache[2] = _withModifiers(() => {}, ["stop"])),
                                        "onUpdate:modelValue": $event => (toggleCategory(cat.name, $event))
                                      }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                      _createVNode(_component_VBtn, {
                                        icon: "mdi-delete",
                                        size: "x-small",
                                        variant: "text",
                                        color: "error",
                                        class: "ml-1",
                                        onClick: _withModifiers($event => (confirmDeleteCategory(cat.name)), ["stop"])
                                      }, null, 8, ["onClick"])
                                    ]),
                                    _: 2
                                  }, 1040, ["prepend-icon", "title"])
                                ]),
                                default: _withCtx(() => [
                                  _createElementVNode("div", _hoisted_1, [
                                    _createElementVNode("div", _hoisted_2, [
                                      _createVNode(_component_VTextField, {
                                        modelValue: newKeywords.value[cat.name],
                                        "onUpdate:modelValue": $event => ((newKeywords.value[cat.name]) = $event),
                                        label: "添加关键词",
                                        density: "compact",
                                        variant: "outlined",
                                        size: "small",
                                        "hide-details": "",
                                        class: "mr-2",
                                        onKeyup: _withKeys($event => (addKeyword(cat.name)), ["enter"])
                                      }, {
                                        "append-inner": _withCtx(() => [
                                          _createVNode(_component_VTooltip, {
                                            text: "命中即整条弹幕被屏蔽的精确词/短语，例如「打卡」「签到」「哈哈哈哈」。回车可快速添加，已添加的标签可点 × 删除。",
                                            location: "bottom"
                                          }, {
                                            activator: _withCtx(({ props }) => [
                                              _createVNode(_component_VIcon, _mergeProps({ ref_for: true }, props, {
                                                icon: "mdi-help-circle-outline",
                                                size: "small",
                                                color: "medium-emphasis"
                                              }), null, 16)
                                            ]),
                                            _: 1
                                          })
                                        ]),
                                        _: 1
                                      }, 8, ["modelValue", "onUpdate:modelValue", "onKeyup"]),
                                      _createVNode(_component_VBtn, {
                                        size: "small",
                                        color: "primary",
                                        variant: "tonal",
                                        icon: "mdi-plus",
                                        onClick: $event => (addKeyword(cat.name))
                                      }, null, 8, ["onClick"])
                                    ]),
                                    (cat.keywords?.length > 0)
                                      ? (_openBlock(), _createBlock(_component_VChipGroup, {
                                          key: 0,
                                          column: ""
                                        }, {
                                          default: _withCtx(() => [
                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(cat.keywords, (kw) => {
                                              return (_openBlock(), _createBlock(_component_VChip, {
                                                key: kw,
                                                size: "small",
                                                closable: "",
                                                label: "",
                                                "onClick:close": $event => (removeKeyword(cat.name, kw))
                                              }, {
                                                default: _withCtx(() => [
                                                  _createTextVNode(_toDisplayString(kw), 1)
                                                ]),
                                                _: 2
                                              }, 1032, ["onClick:close"]))
                                            }), 128))
                                          ]),
                                          _: 2
                                        }, 1024))
                                      : (_openBlock(), _createElementBlock("div", _hoisted_3, "暂无关键词，请在上方添加"))
                                  ]),
                                  _createElementVNode("div", _hoisted_4, [
                                    _cache[12] || (_cache[12] = _createElementVNode("div", { class: "text-caption font-weight-bold mb-1" }, "组合规则（关键词 + 长度上限）", -1)),
                                    _cache[13] || (_cache[13] = _createElementVNode("div", { class: "text-caption text-medium-emphasis mb-1" }, "含指定关键词且长度不超过上限的弹幕将被屏蔽，适合屏蔽带变化前缀的长文本（如「xx打卡」）。", -1)),
                                    _createElementVNode("div", _hoisted_5, [
                                      _createVNode(_component_VTextField, {
                                        modelValue: newCombos.value[cat.name].keyword,
                                        "onUpdate:modelValue": $event => ((newCombos.value[cat.name].keyword) = $event),
                                        label: "关键词",
                                        density: "compact",
                                        variant: "outlined",
                                        "hide-details": "",
                                        class: "mr-2",
                                        onKeyup: _withKeys($event => (addCombo(cat.name)), ["enter"])
                                      }, {
                                        "append-inner": _withCtx(() => [
                                          _createVNode(_component_VTooltip, {
                                            text: "代表弹幕『主题』的核心词，配合『长度≤』判定：含此词且长度不超过上限的弹幕会被屏蔽。用于屏蔽「xx打卡」「xx签到」这类带变化前缀的长文本。",
                                            location: "bottom"
                                          }, {
                                            activator: _withCtx(({ props }) => [
                                              _createVNode(_component_VIcon, _mergeProps({ ref_for: true }, props, {
                                                icon: "mdi-help-circle-outline",
                                                size: "small",
                                                color: "medium-emphasis"
                                              }), null, 16)
                                            ]),
                                            _: 1
                                          })
                                        ]),
                                        _: 1
                                      }, 8, ["modelValue", "onUpdate:modelValue", "onKeyup"]),
                                      _createVNode(_component_VTextField, {
                                        modelValue: newCombos.value[cat.name].max_len,
                                        "onUpdate:modelValue": $event => ((newCombos.value[cat.name].max_len) = $event),
                                        modelModifiers: { number: true },
                                        label: "长度≤",
                                        type: "number",
                                        density: "compact",
                                        variant: "outlined",
                                        "hide-details": "",
                                        style: {"max-width":"90px"},
                                        class: "mr-2"
                                      }, {
                                        "append-inner": _withCtx(() => [
                                          _createVNode(_component_VTooltip, {
                                            text: "弹幕字符数上限。含『关键词』且长度 ≤ 此值才屏蔽；填 0 表示不限制长度（只要含关键词即屏蔽）。",
                                            location: "bottom"
                                          }, {
                                            activator: _withCtx(({ props }) => [
                                              _createVNode(_component_VIcon, _mergeProps({ ref_for: true }, props, {
                                                icon: "mdi-help-circle-outline",
                                                size: "small",
                                                color: "medium-emphasis"
                                              }), null, 16)
                                            ]),
                                            _: 1
                                          })
                                        ]),
                                        _: 1
                                      }, 8, ["modelValue", "onUpdate:modelValue"]),
                                      _createVNode(_component_VBtn, {
                                        size: "small",
                                        color: "primary",
                                        variant: "tonal",
                                        icon: "mdi-plus",
                                        onClick: $event => (addCombo(cat.name))
                                      }, null, 8, ["onClick"])
                                    ]),
                                    (cat.combos?.length > 0)
                                      ? (_openBlock(), _createBlock(_component_VChipGroup, {
                                          key: 0,
                                          column: ""
                                        }, {
                                          default: _withCtx(() => [
                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(cat.combos, (r) => {
                                              return (_openBlock(), _createBlock(_component_VChip, {
                                                key: r[0],
                                                size: "small",
                                                closable: "",
                                                label: "",
                                                "onClick:close": $event => (removeCombo(cat.name, r[0]))
                                              }, {
                                                default: _withCtx(() => [
                                                  _createTextVNode(_toDisplayString(r[0]) + " (≤" + _toDisplayString(r[1]) + "字) ", 1)
                                                ]),
                                                _: 2
                                              }, 1032, ["onClick:close"]))
                                            }), 128))
                                          ]),
                                          _: 2
                                        }, 1024))
                                      : (_openBlock(), _createElementBlock("div", _hoisted_6, "暂无组合规则"))
                                  ]),
                                  _createElementVNode("div", _hoisted_7, [
                                    _cache[14] || (_cache[14] = _createElementVNode("div", { class: "text-caption font-weight-bold mb-1" }, "正则规则", -1)),
                                    _cache[15] || (_cache[15] = _createElementVNode("div", { class: "text-caption text-medium-emphasis mb-1" }, "用正则表达式匹配弹幕内容，适合屏蔽有规律的变体（如纯数字串、超短弹幕）。", -1)),
                                    _createElementVNode("div", _hoisted_8, [
                                      _createVNode(_component_VTextField, {
                                        modelValue: newRegexes.value[cat.name].pattern,
                                        "onUpdate:modelValue": $event => ((newRegexes.value[cat.name].pattern) = $event),
                                        label: "正则表达式",
                                        density: "compact",
                                        variant: "outlined",
                                        "hide-details": "",
                                        class: "mr-2",
                                        onKeyup: _withKeys($event => (addRegex(cat.name)), ["enter"])
                                      }, {
                                        "append-inner": _withCtx(() => [
                                          _createVNode(_component_VTooltip, {
                                            text: "用正则匹配弹幕内容（默认区分大小写，可在正则开头加 (?i) 忽略）。例：^.{1,3}$ 屏蔽超短弹幕；\\d{6,} 屏蔽长数字串。语法错误会导致匹配异常，请确认后再添加。",
                                            location: "bottom"
                                          }, {
                                            activator: _withCtx(({ props }) => [
                                              _createVNode(_component_VIcon, _mergeProps({ ref_for: true }, props, {
                                                icon: "mdi-help-circle-outline",
                                                size: "small",
                                                color: "medium-emphasis"
                                              }), null, 16)
                                            ]),
                                            _: 1
                                          })
                                        ]),
                                        _: 1
                                      }, 8, ["modelValue", "onUpdate:modelValue", "onKeyup"]),
                                      _createVNode(_component_VSelect, {
                                        modelValue: newRegexes.value[cat.name].level,
                                        "onUpdate:modelValue": $event => ((newRegexes.value[cat.name].level) = $event),
                                        modelModifiers: { number: true },
                                        items: [1, 2, 3],
                                        label: "等级",
                                        density: "compact",
                                        variant: "outlined",
                                        "hide-details": "",
                                        style: {"max-width":"90px"},
                                        class: "mr-2"
                                      }, {
                                        "append-inner": _withCtx(() => [
                                          _createVNode(_component_VTooltip, {
                                            text: "匹配命中后的处理等级：1=弱（仅标记）；2=普通屏蔽（默认）；3=强屏蔽（优先处理，可覆盖白名单）。一般填 2。",
                                            location: "bottom"
                                          }, {
                                            activator: _withCtx(({ props }) => [
                                              _createVNode(_component_VIcon, _mergeProps({ ref_for: true }, props, {
                                                icon: "mdi-help-circle-outline",
                                                size: "small",
                                                color: "medium-emphasis"
                                              }), null, 16)
                                            ]),
                                            _: 1
                                          })
                                        ]),
                                        _: 1
                                      }, 8, ["modelValue", "onUpdate:modelValue"]),
                                      _createVNode(_component_VBtn, {
                                        size: "small",
                                        color: "primary",
                                        variant: "tonal",
                                        icon: "mdi-plus",
                                        onClick: $event => (addRegex(cat.name))
                                      }, null, 8, ["onClick"])
                                    ]),
                                    (cat.regexes?.length > 0)
                                      ? (_openBlock(), _createBlock(_component_VChipGroup, {
                                          key: 0,
                                          column: ""
                                        }, {
                                          default: _withCtx(() => [
                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(cat.regexes, (r) => {
                                              return (_openBlock(), _createBlock(_component_VChip, {
                                                key: r[0],
                                                size: "small",
                                                closable: "",
                                                label: "",
                                                "onClick:close": $event => (removeRegex(cat.name, r[0]))
                                              }, {
                                                default: _withCtx(() => [
                                                  _createTextVNode(_toDisplayString(r[0]) + " (等级" + _toDisplayString(r[1]) + ") ", 1)
                                                ]),
                                                _: 2
                                              }, 1032, ["onClick:close"]))
                                            }), 128))
                                          ]),
                                          _: 2
                                        }, 1024))
                                      : (_openBlock(), _createElementBlock("div", _hoisted_9, "暂无正则规则"))
                                  ])
                                ]),
                                _: 2
                              }, 1032, ["value"]))
                            }), 128))
                          ]),
                          _: 1
                        }))
                      : (_openBlock(), _createBlock(_component_VAlert, {
                          key: 1,
                          type: "info",
                          variant: "tonal"
                        }, {
                          default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
                            _createTextVNode(" 暂无分类，请点击「添加分类」创建屏蔽词库 ", -1)
                          ]))]),
                          _: 1
                        }))
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["variant"])
          ]),
          _: 1
        }, 8, ["cols"]),
        _createVNode(_component_VCol, {
          cols: __props.compact ? 12 : 12,
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_VCard, {
              variant: __props.compact ? 'tonal' : 'elevated'
            }, {
              default: _withCtx(() => [
                _createVNode(_component_VCardTitle, { class: "d-flex align-center" }, {
                  default: _withCtx(() => [
                    _createVNode(_component_VIcon, { start: "" }, {
                      default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
                        _createTextVNode("mdi-account-cancel", -1)
                      ]))]),
                      _: 1
                    }),
                    _cache[18] || (_cache[18] = _createTextVNode(" 用户管理 ", -1)),
                    _createVNode(_component_VChip, {
                      size: "small",
                      class: "ml-2",
                      color: "error",
                      variant: "tonal"
                    }, {
                      default: _withCtx(() => [
                        _createTextVNode(_toDisplayString(blockedUsers.value.length), 1)
                      ]),
                      _: 1
                    }),
                    (warnedUsers.value.length)
                      ? (_openBlock(), _createBlock(_component_VChip, {
                          key: 0,
                          size: "small",
                          class: "ml-1",
                          color: "warning",
                          variant: "tonal"
                        }, {
                          default: _withCtx(() => [
                            _createTextVNode(_toDisplayString(warnedUsers.value.length), 1)
                          ]),
                          _: 1
                        }))
                      : _createCommentVNode("", true)
                  ]),
                  _: 1
                }),
                _createVNode(_component_VCardText, null, {
                  default: _withCtx(() => [
                    _cache[23] || (_cache[23] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "已封禁用户", -1)),
                    (blockedUsers.value.length > 0)
                      ? (_openBlock(), _createElementBlock("div", _hoisted_10, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(blockedUsers.value, (user) => {
                            return (_openBlock(), _createElementBlock("div", {
                              key: user.user_id,
                              class: "d-flex align-center py-1 px-2 rounded bg-error-lighten-5 mb-1"
                            }, [
                              _createElementVNode("div", _hoisted_11, [
                                _createElementVNode("div", _hoisted_12, _toDisplayString(user.user_id), 1),
                                _createElementVNode("div", _hoisted_13, " 信用分: " + _toDisplayString(user.credit_score) + " · " + _toDisplayString(user.block_reason || '--'), 1)
                              ]),
                              _createVNode(_component_VBtn, {
                                size: "x-small",
                                color: "success",
                                variant: "tonal",
                                "prepend-icon": "mdi-lock-open",
                                loading: unblockLoading.value === user.user_id,
                                onClick: $event => (handleUnblock(user.user_id))
                              }, {
                                default: _withCtx(() => [...(_cache[19] || (_cache[19] = [
                                  _createTextVNode(" 解封 ", -1)
                                ]))]),
                                _: 1
                              }, 8, ["loading", "onClick"])
                            ]))
                          }), 128))
                        ]))
                      : (_openBlock(), _createElementBlock("div", _hoisted_14, " 暂无封禁用户 ")),
                    (warnedUsers.value.length > 0)
                      ? (_openBlock(), _createElementBlock("div", _hoisted_15, [
                          _cache[21] || (_cache[21] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-2" }, "警告用户（信用分 ≤ 50）", -1)),
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(warnedUsers.value, (user) => {
                            return (_openBlock(), _createElementBlock("div", {
                              key: user.user_id,
                              class: "d-flex align-center py-1 px-2 rounded bg-warning-lighten-5 mb-1"
                            }, [
                              _createElementVNode("div", _hoisted_16, [
                                _createElementVNode("div", _hoisted_17, _toDisplayString(user.user_id), 1),
                                _createElementVNode("div", _hoisted_18, " 信用分: " + _toDisplayString(user.credit_score) + " · 发送: " + _toDisplayString(user.total_sent || 0) + " 次 ", 1)
                              ]),
                              _createVNode(_component_VBtn, {
                                size: "x-small",
                                color: "primary",
                                variant: "tonal",
                                "prepend-icon": "mdi-refresh",
                                loading: resetLoading.value === user.user_id,
                                onClick: $event => (handleReset(user.user_id))
                              }, {
                                default: _withCtx(() => [...(_cache[20] || (_cache[20] = [
                                  _createTextVNode(" 重置 ", -1)
                                ]))]),
                                _: 1
                              }, 8, ["loading", "onClick"])
                            ]))
                          }), 128))
                        ]))
                      : _createCommentVNode("", true),
                    (!blockedUsers.value.length && !warnedUsers.value.length)
                      ? (_openBlock(), _createBlock(_component_VAlert, {
                          key: 3,
                          type: "info",
                          variant: "tonal"
                        }, {
                          default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
                            _createTextVNode(" 暂无用户数据（请先执行弹幕刮削后方可看到用户信息） ", -1)
                          ]))]),
                          _: 1
                        }))
                      : _createCommentVNode("", true)
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["variant"])
          ]),
          _: 1
        }, 8, ["cols"])
      ]),
      _: 1
    }),
    _createVNode(_component_VDialog, {
      modelValue: showAddCategoryDialog.value,
      "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((showAddCategoryDialog).value = $event)),
      "max-width": "400"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_VCard, null, {
          default: _withCtx(() => [
            _createVNode(_component_VCardTitle, null, {
              default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                _createTextVNode("添加分类", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_VCardText, null, {
              default: _withCtx(() => [
                _createVNode(_component_VTextField, {
                  modelValue: newCategoryName.value,
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((newCategoryName).value = $event)),
                  label: "分类名称",
                  density: "compact",
                  variant: "outlined",
                  autofocus: ""
                }, {
                  "append-inner": _withCtx(() => [
                    _createVNode(_component_VTooltip, {
                      text: "自定义一个分类名（如「番剧专有屏蔽」「直播间水军」）。内置分类不可改名，自定义分类可删除。名称会作为该分类下所有词/规则的归属标识。",
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
                }, 8, ["modelValue"]),
                _createVNode(_component_VTextField, {
                  modelValue: newCategoryDesc.value,
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((newCategoryDesc).value = $event)),
                  label: "描述（可选）",
                  density: "compact",
                  variant: "outlined",
                  class: "mt-2"
                }, {
                  "append-inner": _withCtx(() => [
                    _createVNode(_component_VTooltip, {
                      text: "说明这个分类屏蔽什么，便于日后维护时快速理解，可不填。",
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
            _createVNode(_component_VCardActions, null, {
              default: _withCtx(() => [
                _createVNode(_component_VSpacer),
                _createVNode(_component_VBtn, {
                  variant: "text",
                  onClick: _cache[5] || (_cache[5] = $event => (showAddCategoryDialog.value = false))
                }, {
                  default: _withCtx(() => [...(_cache[25] || (_cache[25] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_VBtn, {
                  color: "primary",
                  loading: actionLoading.value === 'add-category',
                  onClick: addCategory
                }, {
                  default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                    _createTextVNode("确定", -1)
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
      modelValue: showDeleteCategoryDialog.value,
      "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((showDeleteCategoryDialog).value = $event)),
      "max-width": "400"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_VCard, null, {
          default: _withCtx(() => [
            _createVNode(_component_VCardTitle, null, {
              default: _withCtx(() => [...(_cache[27] || (_cache[27] = [
                _createTextVNode("确认删除", -1)
              ]))]),
              _: 1
            }),
            _createVNode(_component_VCardText, null, {
              default: _withCtx(() => [
                _createTextVNode(" 确定删除分类「" + _toDisplayString(deletingCategory.value) + "」吗？该分类下的所有关键词将被同时删除，此操作不可恢复。 ", 1)
              ]),
              _: 1
            }),
            _createVNode(_component_VCardActions, null, {
              default: _withCtx(() => [
                _createVNode(_component_VSpacer),
                _createVNode(_component_VBtn, {
                  variant: "text",
                  onClick: _cache[7] || (_cache[7] = $event => (showDeleteCategoryDialog.value = false))
                }, {
                  default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_VBtn, {
                  color: "error",
                  loading: actionLoading.value === 'delete-category',
                  onClick: deleteCategory
                }, {
                  default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                    _createTextVNode("确认删除", -1)
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
    _createElementVNode("div", _hoisted_19, [
      _createVNode(_component_VBtn, {
        color: "secondary",
        variant: "tonal",
        "prepend-icon": "mdi-refresh",
        loading: loading.value,
        onClick: refreshData
      }, {
        default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
          _createTextVNode(" 刷新数据 ", -1)
        ]))]),
        _: 1
      }, 8, ["loading"])
    ])
  ]))
}
}

};

export { _sfc_main as _ };
