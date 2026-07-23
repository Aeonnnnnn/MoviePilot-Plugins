import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { _ as _export_sfc, a as axios } from './_plugin-vue_export-helper-DqfLPMFU.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock,withModifiers:_withModifiers,withKeys:_withKeys} = await importShared('vue');


const _hoisted_1 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_2 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_3 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_4 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_5 = { class: "d-flex align-center justify-space-between mb-3" };
const _hoisted_6 = { class: "d-flex align-center justify-space-between w-100" };
const _hoisted_7 = { class: "d-flex align-center" };
const _hoisted_8 = { class: "text-body-1" };
const _hoisted_9 = { class: "mb-3" };
const _hoisted_10 = { class: "d-flex align-center justify-space-between mb-2" };
const _hoisted_11 = {
  key: 1,
  class: "text-caption text-disabled"
};
const _hoisted_12 = { class: "text-subtitle-2 font-weight-bold mb-3" };
const _hoisted_13 = { class: "text-body-2" };
const _hoisted_14 = { class: "text-body-2" };
const _hoisted_15 = { class: "text-caption" };

const {ref,computed,onMounted} = await importShared('vue');


const _sfc_main = {
  __name: 'AppPageFilter',
  props: ['pluginId', 'config', 'eventBus', 'navKey'],
  setup(__props) {



const loading = ref(false);
const error = ref('');
const actionResult = ref(null);
const categories = ref([]);
const blockedUsers = ref([]);

// 对话框
const showAddCategoryDialog = ref(false);
const newCategoryName = ref('');
const showAddKeywordDialog = ref(false);
const addingToCategory = ref('');
const newKeyword = ref('');
const showConfirmDelete = ref(false);
const deletingCategory = ref('');

const totalKeywords = computed(() => {
  return categories.value.reduce((sum, cat) => sum + (cat.keywords?.length || 0), 0)
});

const getApiBase = () => `/api/v1/plugin/${__props.pluginId}`;

// 刷新数据
const refreshData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const [catRes, userRes] = await Promise.all([
      axios.get(`${getApiBase()}/filter/categories`),
      axios.get(`${getApiBase()}/filter/blocked_users`),
    ]);
    if (catRes.data?.success) {
      categories.value = catRes.data.data || [];
    }
    if (userRes.data?.success) {
      blockedUsers.value = userRes.data.data || [];
    }
  } catch (err) {
    error.value = `获取数据失败: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// 添加分类
const addCategory = async () => {
  if (!newCategoryName.value.trim()) return
  try {
    const res = await axios.post(`${getApiBase()}/filter/category/add`, {
      category: newCategoryName.value.trim(),
    });
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '分类已添加' };
      newCategoryName.value = '';
      showAddCategoryDialog.value = false;
      await refreshData();
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '添加失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` };
  }
};

// 确认删除分类
const confirmRemoveCategory = (name) => {
  deletingCategory.value = name;
  showConfirmDelete.value = true;
};

// 删除分类
const removeCategory = async () => {
  try {
    const res = await axios.post(`${getApiBase()}/filter/category/remove`, {
      category: deletingCategory.value,
    });
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '分类已删除' };
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '删除失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` };
  } finally {
    showConfirmDelete.value = false;
    deletingCategory.value = '';
    await refreshData();
  }
};

// 切换分类启用状态
const toggleCategory = async (name, enabled) => {
  try {
    const res = await axios.post(`${getApiBase()}/filter/category/enable`, {
      category: name,
      enabled,
    });
    if (res.data?.success) {
      const cat = categories.value.find(c => c.name === name);
      if (cat) cat.enabled = enabled;
    }
  } catch (err) {
    error.value = `切换状态失败: ${err.message}`;
  }
};

// 打开添加关键词
const openAddKeyword = (catName) => {
  addingToCategory.value = catName;
  newKeyword.value = '';
  showAddKeywordDialog.value = true;
};

// 添加关键词
const addKeyword = async () => {
  if (!newKeyword.value.trim() || !addingToCategory.value) return
  try {
    const res = await axios.post(`${getApiBase()}/filter/keywords/add`, {
      category: addingToCategory.value,
      keyword: newKeyword.value.trim(),
    });
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '关键词已添加' };
      newKeyword.value = '';
      showAddKeywordDialog.value = false;
      await refreshData();
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '添加失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `添加失败: ${err.message}` };
  }
};

// 删除关键词
const removeKeyword = async (catName, keyword) => {
  try {
    const res = await axios.post(`${getApiBase()}/filter/keywords/remove`, {
      category: catName,
      keyword,
    });
    if (res.data?.success) {
      actionResult.value = { type: 'success', message: '关键词已删除' };
      await refreshData();
    } else {
      actionResult.value = { type: 'error', message: res.data?.message || '删除失败' };
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `删除失败: ${err.message}` };
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
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VChip = _resolveComponent("VChip");
  const _component_VSwitch = _resolveComponent("VSwitch");
  const _component_VExpansionPanelTitle = _resolveComponent("VExpansionPanelTitle");
  const _component_VChipGroup = _resolveComponent("VChipGroup");
  const _component_VExpansionPanelText = _resolveComponent("VExpansionPanelText");
  const _component_VExpansionPanel = _resolveComponent("VExpansionPanel");
  const _component_VExpansionPanels = _resolveComponent("VExpansionPanels");
  const _component_VTable = _resolveComponent("VTable");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VDialog = _resolveComponent("VDialog");
  const _component_VContainer = _resolveComponent("VContainer");

  return (_openBlock(), _createBlock(_component_VContainer, {
    fluid: "",
    class: "pa-4 app-page-filter"
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
                        icon: "mdi-filter-variant",
                        color: "primary",
                        size: "32"
                      })
                    ]),
                    default: _withCtx(() => [
                      _createVNode(_component_VCardTitle, null, {
                        default: _withCtx(() => [...(_cache[11] || (_cache[11] = [
                          _createTextVNode("弹幕过滤管理", -1)
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
                          _createTextVNode(_toDisplayString(actionResult.value.message), 1)
                        ]),
                        _: 1
                      }, 8, ["type"]))
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
                                color: "primary",
                                class: "pa-3 text-center"
                              }, {
                                default: _withCtx(() => [
                                  _cache[12] || (_cache[12] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "分类总数", -1)),
                                  _createElementVNode("div", _hoisted_1, _toDisplayString(categories.value.length), 1)
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
                                  _cache[13] || (_cache[13] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "已启用分类", -1)),
                                  _createElementVNode("div", _hoisted_2, _toDisplayString(categories.value.filter(c => c.enabled).length), 1)
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
                                color: "warning",
                                class: "pa-3 text-center"
                              }, {
                                default: _withCtx(() => [
                                  _cache[14] || (_cache[14] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "关键词总数", -1)),
                                  _createElementVNode("div", _hoisted_3, _toDisplayString(totalKeywords.value), 1)
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
                                  _cache[15] || (_cache[15] = _createElementVNode("div", { class: "text-caption text-medium-emphasis" }, "屏蔽用户", -1)),
                                  _createElementVNode("div", _hoisted_4, _toDisplayString(blockedUsers.value.length), 1)
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
                  _createVNode(_component_VDivider),
                  _createVNode(_component_VCardText, null, {
                    default: _withCtx(() => [
                      _createElementVNode("div", _hoisted_5, [
                        _cache[17] || (_cache[17] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold" }, "过滤分类", -1)),
                        _createVNode(_component_VBtn, {
                          color: "primary",
                          size: "small",
                          variant: "tonal",
                          "prepend-icon": "mdi-plus",
                          onClick: _cache[0] || (_cache[0] = $event => (showAddCategoryDialog.value = true))
                        }, {
                          default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
                            _createTextVNode(" 添加分类 ", -1)
                          ]))]),
                          _: 1
                        })
                      ]),
                      (categories.value.length > 0)
                        ? (_openBlock(), _createBlock(_component_VExpansionPanels, {
                            key: 0,
                            variant: "accordion"
                          }, {
                            default: _withCtx(() => [
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(categories.value, (cat) => {
                                return (_openBlock(), _createBlock(_component_VExpansionPanel, {
                                  key: cat.name
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_VExpansionPanelTitle, null, {
                                      default: _withCtx(() => [
                                        _createElementVNode("div", _hoisted_6, [
                                          _createElementVNode("div", _hoisted_7, [
                                            _createVNode(_component_VIcon, {
                                              icon: cat.enabled ? 'mdi-check-circle' : 'mdi-close-circle',
                                              color: cat.enabled ? 'success' : 'grey',
                                              size: "20",
                                              class: "mr-2"
                                            }, null, 8, ["icon", "color"]),
                                            _createElementVNode("span", _hoisted_8, _toDisplayString(cat.name), 1),
                                            _createVNode(_component_VChip, {
                                              size: "x-small",
                                              class: "ml-2",
                                              color: "primary",
                                              variant: "tonal"
                                            }, {
                                              default: _withCtx(() => [
                                                _createTextVNode(_toDisplayString(cat.keywords?.length || 0) + " 个关键词", 1)
                                              ]),
                                              _: 2
                                            }, 1024)
                                          ]),
                                          _createElementVNode("div", {
                                            class: "d-flex align-center",
                                            onClick: _cache[2] || (_cache[2] = _withModifiers(() => {}, ["stop"]))
                                          }, [
                                            _createVNode(_component_VSwitch, {
                                              "model-value": cat.enabled,
                                              color: "success",
                                              "hide-details": "",
                                              density: "compact",
                                              onClick: _cache[1] || (_cache[1] = _withModifiers(() => {}, ["stop"])),
                                              "onUpdate:modelValue": (v) => toggleCategory(cat.name, v)
                                            }, null, 8, ["model-value", "onUpdate:modelValue"]),
                                            _createVNode(_component_VBtn, {
                                              icon: "mdi-delete",
                                              size: "small",
                                              variant: "text",
                                              color: "error",
                                              class: "ml-2",
                                              onClick: _withModifiers($event => (confirmRemoveCategory(cat.name)), ["stop"])
                                            }, null, 8, ["onClick"])
                                          ])
                                        ])
                                      ]),
                                      _: 2
                                    }, 1024),
                                    _createVNode(_component_VExpansionPanelText, null, {
                                      default: _withCtx(() => [
                                        _createElementVNode("div", _hoisted_9, [
                                          _createElementVNode("div", _hoisted_10, [
                                            _cache[19] || (_cache[19] = _createElementVNode("span", { class: "text-caption text-medium-emphasis" }, "关键词列表", -1)),
                                            _createVNode(_component_VBtn, {
                                              size: "x-small",
                                              variant: "text",
                                              color: "primary",
                                              "prepend-icon": "mdi-plus",
                                              onClick: $event => (openAddKeyword(cat.name))
                                            }, {
                                              default: _withCtx(() => [...(_cache[18] || (_cache[18] = [
                                                _createTextVNode(" 添加 ", -1)
                                              ]))]),
                                              _: 1
                                            }, 8, ["onClick"])
                                          ]),
                                          (cat.keywords?.length > 0)
                                            ? (_openBlock(), _createBlock(_component_VChipGroup, { key: 0 }, {
                                                default: _withCtx(() => [
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(cat.keywords, (kw) => {
                                                    return (_openBlock(), _createBlock(_component_VChip, {
                                                      key: kw,
                                                      size: "small",
                                                      variant: "tonal",
                                                      closable: "",
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
                                            : (_openBlock(), _createElementBlock("div", _hoisted_11, "暂无关键词"))
                                        ])
                                      ]),
                                      _: 2
                                    }, 1024)
                                  ]),
                                  _: 2
                                }, 1024))
                              }), 128))
                            ]),
                            _: 1
                          }))
                        : (_openBlock(), _createBlock(_component_VAlert, {
                            key: 1,
                            type: "info",
                            variant: "tonal",
                            class: "mt-2"
                          }, {
                            default: _withCtx(() => [...(_cache[20] || (_cache[20] = [
                              _createTextVNode(" 暂无过滤分类，点击\"添加分类\"创建 ", -1)
                            ]))]),
                            _: 1
                          }))
                    ]),
                    _: 1
                  }),
                  _createVNode(_component_VDivider),
                  _createVNode(_component_VCardText, null, {
                    default: _withCtx(() => [
                      _createElementVNode("div", _hoisted_12, [
                        _cache[21] || (_cache[21] = _createTextVNode(" 屏蔽/警告用户 ", -1)),
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
                        })
                      ]),
                      (blockedUsers.value.length > 0)
                        ? (_openBlock(), _createBlock(_component_VTable, {
                            key: 0,
                            density: "compact"
                          }, {
                            default: _withCtx(() => [
                              _cache[22] || (_cache[22] = _createElementVNode("thead", null, [
                                _createElementVNode("tr", null, [
                                  _createElementVNode("th", null, "用户ID"),
                                  _createElementVNode("th", null, "信用分"),
                                  _createElementVNode("th", null, "原因"),
                                  _createElementVNode("th", null, "时间")
                                ])
                              ], -1)),
                              _createElementVNode("tbody", null, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(blockedUsers.value, (user) => {
                                  return (_openBlock(), _createElementBlock("tr", {
                                    key: user.user_id
                                  }, [
                                    _createElementVNode("td", _hoisted_13, _toDisplayString(user.user_id), 1),
                                    _createElementVNode("td", null, [
                                      _createVNode(_component_VChip, {
                                        color: user.credit_score < 30 ? 'error' : user.credit_score < 60 ? 'warning' : 'success',
                                        size: "small",
                                        variant: "tonal"
                                      }, {
                                        default: _withCtx(() => [
                                          _createTextVNode(_toDisplayString(user.credit_score), 1)
                                        ]),
                                        _: 2
                                      }, 1032, ["color"])
                                    ]),
                                    _createElementVNode("td", _hoisted_14, _toDisplayString(user.block_reason || '--'), 1),
                                    _createElementVNode("td", _hoisted_15, _toDisplayString(user.blocked_at || '--'), 1)
                                  ]))
                                }), 128))
                              ])
                            ]),
                            _: 1
                          }))
                        : (_openBlock(), _createBlock(_component_VAlert, {
                            key: 1,
                            type: "info",
                            variant: "tonal",
                            class: "mt-2"
                          }, {
                            default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                              _createTextVNode(" 暂无屏蔽或警告用户 ", -1)
                            ]))]),
                            _: 1
                          }))
                    ]),
                    _: 1
                  }),
                  _createVNode(_component_VDivider),
                  _createVNode(_component_VCardActions, { class: "pa-4" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_VSpacer),
                      _createVNode(_component_VBtn, {
                        variant: "tonal",
                        color: "primary",
                        "prepend-icon": "mdi-refresh",
                        loading: loading.value,
                        onClick: refreshData
                      }, {
                        default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                          _createTextVNode(" 刷新 ", -1)
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
          })
        ]),
        _: 1
      }),
      _createVNode(_component_VDialog, {
        modelValue: showAddCategoryDialog.value,
        "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((showAddCategoryDialog).value = $event)),
        "max-width": "400"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[25] || (_cache[25] = [
                      _createTextVNode("添加过滤分类", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCardText, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VTextField, {
                    modelValue: newCategoryName.value,
                    "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((newCategoryName).value = $event)),
                    label: "分类名称",
                    variant: "outlined",
                    placeholder: "如：广告、剧透、刷屏",
                    onKeyup: _withKeys(addCategory, ["enter"])
                  }, null, 8, ["modelValue"])
                ]),
                _: 1
              }),
              _createVNode(_component_VCardActions, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    onClick: _cache[4] || (_cache[4] = $event => (showAddCategoryDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                      _createTextVNode("取消", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VBtn, {
                    color: "primary",
                    variant: "tonal",
                    onClick: addCategory
                  }, {
                    default: _withCtx(() => [...(_cache[27] || (_cache[27] = [
                      _createTextVNode("添加", -1)
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
      }, 8, ["modelValue"]),
      _createVNode(_component_VDialog, {
        modelValue: showAddKeywordDialog.value,
        "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((showAddKeywordDialog).value = $event)),
        "max-width": "400"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [
                      _createTextVNode("添加关键词到「" + _toDisplayString(addingToCategory.value) + "」", 1)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCardText, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VTextField, {
                    modelValue: newKeyword.value,
                    "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((newKeyword).value = $event)),
                    label: "关键词",
                    variant: "outlined",
                    placeholder: "输入要屏蔽的关键词",
                    onKeyup: _withKeys(addKeyword, ["enter"])
                  }, null, 8, ["modelValue"])
                ]),
                _: 1
              }),
              _createVNode(_component_VCardActions, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    onClick: _cache[7] || (_cache[7] = $event => (showAddKeywordDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                      _createTextVNode("取消", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VBtn, {
                    color: "primary",
                    variant: "tonal",
                    onClick: addKeyword
                  }, {
                    default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                      _createTextVNode("添加", -1)
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
      }, 8, ["modelValue"]),
      _createVNode(_component_VDialog, {
        modelValue: showConfirmDelete.value,
        "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((showConfirmDelete).value = $event)),
        "max-width": "400"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
                      _createTextVNode("确认删除", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCardText, null, {
                default: _withCtx(() => [
                  _createTextVNode(" 确定要删除分类「" + _toDisplayString(deletingCategory.value) + "」吗？此操作不可撤销。 ", 1)
                ]),
                _: 1
              }),
              _createVNode(_component_VCardActions, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    onClick: _cache[9] || (_cache[9] = $event => (showConfirmDelete.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
                      _createTextVNode("取消", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VBtn, {
                    color: "error",
                    variant: "tonal",
                    onClick: removeCategory
                  }, {
                    default: _withCtx(() => [...(_cache[32] || (_cache[32] = [
                      _createTextVNode("删除", -1)
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
      }, 8, ["modelValue"])
    ]),
    _: 1
  }))
}
}

};
const AppPageFilter = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-52b1e9f4"]]);

export { AppPageFilter as default };
