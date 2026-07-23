import { importShared } from './__federation_fn_import-DE4nw86B.js';
import { m as mdiPlay, a as mdiStopCircle, b as mdiCheckCircle, c as mdiAlertCircle } from './mdi-DMac1LU-.js';
import { _ as _export_sfc, a as axios } from './_plugin-vue_export-helper-DqfLPMFU.js';

const {resolveComponent:_resolveComponent,createVNode:_createVNode,createTextVNode:_createTextVNode,withCtx:_withCtx,toDisplayString:_toDisplayString,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock,createElementVNode:_createElementVNode,withKeys:_withKeys} = await importShared('vue');


const _hoisted_1 = { class: "text-caption text-medium-emphasis" };
const _hoisted_2 = { class: "text-h5 font-weight-bold mt-1" };
const _hoisted_3 = {
  key: 1,
  class: "mt-2 text-body-2 text-medium-emphasis"
};
const _hoisted_4 = { class: "text-subtitle-2 font-weight-bold mb-3" };
const _hoisted_5 = {
  class: "text-body-2",
  style: {"max-width":"300px","overflow":"hidden","text-overflow":"ellipsis","white-space":"nowrap"}
};
const _hoisted_6 = { class: "text-caption" };
const _hoisted_7 = { class: "text-subtitle-2 mb-2" };

const {ref,reactive,computed,onMounted} = await importShared('vue');


const _sfc_main = {
  __name: 'AppPageScrape',
  props: ['pluginId', 'config', 'eventBus', 'navKey'],
  setup(__props) {



const loading = ref(false);
const error = ref('');
const actionLoading = ref(null);
const actionResult = ref(null);

// 刮削进度
const scrapeProgress = reactive({
  running: false,
  total: 0,
  current: 0,
  current_file: '',
  success: 0,
  failed: 0,
  duration: 0,
});

const scrapeHistory = ref([]);

// 统计卡片
const statsCards = computed(() => [
  {
    title: '刮削状态',
    value: scrapeProgress.running ? '运行中' : '空闲',
    icon: scrapeProgress.running ? mdiPlay : mdiStopCircle,
    color: scrapeProgress.running ? 'success' : 'grey',
  },
  {
    title: '总任务',
    value: scrapeProgress.total || 0,
    icon: 'mdi-numeric',
    color: 'info',
  },
  {
    title: '成功',
    value: scrapeProgress.success || 0,
    icon: mdiCheckCircle,
    color: 'success',
  },
  {
    title: '失败',
    value: scrapeProgress.failed || 0,
    icon: mdiAlertCircle,
    color: 'error',
  },
]);

// 目录刮削
const showDirectoryDialog = ref(false);
const directoryPath = ref('');
const batchMode = ref(false);

// 手动匹配
const showSearchDialog = ref(false);
const searchKeyword = ref('');
const searchResults = ref([]);
const searchDone = ref(false);
const selectedAnime = ref(null);
const episodeOffset = ref(0);
const matchFilePath = ref('');

const getApiBase = () => `/api/v1/plugin/${__props.pluginId}`;

// 刷新状态
const refreshStatus = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get(`${getApiBase()}/status`);
    if (res.data?.success) {
      Object.assign(scrapeProgress, res.data.data || {});
    }
    // 获取历史
    const historyRes = await axios.get(`${getApiBase()}/history`);
    if (historyRes.data?.success) {
      scrapeHistory.value = historyRes.data.data || [];
    }
  } catch (err) {
    error.value = `获取状态失败: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

// 全局刮削
const startGlobalScrape = async () => {
  actionLoading.value = 'global';
  actionResult.value = null;
  try {
    const res = await axios.get(`${getApiBase()}/generate_danmu_with_path`);
    actionResult.value = {
      type: res.data?.success ? 'success' : 'error',
      message: res.data?.message || '刮削已启动',
    };
    setTimeout(refreshStatus, 2000);
  } catch (err) {
    actionResult.value = { type: 'error', message: `请求失败: ${err.message}` };
  } finally {
    actionLoading.value = null;
  }
};

// 目录刮削
const startDirectoryScrape = async () => {
  if (!directoryPath.value.trim()) {
    actionResult.value = { type: 'error', message: '请输入目录路径' };
    return
  }
  actionLoading.value = 'dir';
  actionResult.value = null;
  try {
    const endpoint = batchMode.value ? 'batch_season_scrape' : 'scrape_directory';
    const res = await axios.get(`${getApiBase()}/${endpoint}`, {
      params: { directory_path: directoryPath.value }
    });
    actionResult.value = {
      type: res.data?.success ? 'success' : 'error',
      message: res.data?.message || '刮削已启动',
    };
    showDirectoryDialog.value = false;
    setTimeout(refreshStatus, 2000);
  } catch (err) {
    actionResult.value = { type: 'error', message: `请求失败: ${err.message}` };
  } finally {
    actionLoading.value = null;
  }
};

// 搜索番剧
const searchAnime = async () => {
  if (!searchKeyword.value.trim()) return
  try {
    const res = await axios.get(`${getApiBase()}/search_anime`, {
      params: { keyword: searchKeyword.value }
    });
    searchResults.value = res.data?.data || [];
    searchDone.value = true;
  } catch (err) {
    actionResult.value = { type: 'error', message: `搜索失败: ${err.message}` };
  }
};

// 选择番剧
const selectAnime = (anime) => {
  selectedAnime.value = anime;
};

// 保存匹配
const saveMatch = async () => {
  if (!selectedAnime.value || !matchFilePath.value.trim()) return
  actionLoading.value = 'match';
  try {
    const res = await axios.post(`${getApiBase()}/manual_match`, {
      anime_id: selectedAnime.value.anime_id || selectedAnime.value.id,
      anime_title: selectedAnime.value.anime_title || selectedAnime.value.title,
      file_path: matchFilePath.value,
      episode_offset: episodeOffset.value,
    });
    actionResult.value = {
      type: res.data?.success ? 'success' : 'error',
      message: res.data?.message || '匹配已保存',
    };
    if (res.data?.success) {
      showSearchDialog.value = false;
      selectedAnime.value = null;
      searchKeyword.value = '';
      searchResults.value = [];
      searchDone.value = false;
      matchFilePath.value = '';
      episodeOffset.value = 0;
    }
  } catch (err) {
    actionResult.value = { type: 'error', message: `保存失败: ${err.message}` };
  } finally {
    actionLoading.value = null;
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
  const _component_VCard = _resolveComponent("VCard");
  const _component_VCol = _resolveComponent("VCol");
  const _component_VRow = _resolveComponent("VRow");
  const _component_VProgressLinear = _resolveComponent("VProgressLinear");
  const _component_VCardText = _resolveComponent("VCardText");
  const _component_VDivider = _resolveComponent("VDivider");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VChip = _resolveComponent("VChip");
  const _component_VTable = _resolveComponent("VTable");
  const _component_VTextField = _resolveComponent("VTextField");
  const _component_VCheckbox = _resolveComponent("VCheckbox");
  const _component_VSpacer = _resolveComponent("VSpacer");
  const _component_VCardActions = _resolveComponent("VCardActions");
  const _component_VDialog = _resolveComponent("VDialog");
  const _component_VListItem = _resolveComponent("VListItem");
  const _component_VList = _resolveComponent("VList");
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
                        default: _withCtx(() => [...(_cache[11] || (_cache[11] = [
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
                          _createTextVNode(_toDisplayString(actionResult.value.message), 1)
                        ]),
                        _: 1
                      }, 8, ["type"]))
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
                                    _createElementVNode("div", _hoisted_1, _toDisplayString(stat.title), 1),
                                    _createElementVNode("div", _hoisted_2, [
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
                      (scrapeProgress.total > 0 && scrapeProgress.running)
                        ? (_openBlock(), _createBlock(_component_VProgressLinear, {
                            key: 0,
                            "model-value": scrapeProgress.total > 0 ? ((scrapeProgress.success + scrapeProgress.failed) / scrapeProgress.total * 100) : 0,
                            color: "primary",
                            height: "8",
                            class: "mt-4",
                            rounded: "",
                            striped: ""
                          }, null, 8, ["model-value"]))
                        : _createCommentVNode("", true),
                      (scrapeProgress.current_file)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
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
                      _cache[16] || (_cache[16] = _createElementVNode("div", { class: "text-subtitle-2 font-weight-bold mb-3" }, "刮削操作", -1)),
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
                                size: "large",
                                "prepend-icon": "mdi-play-circle",
                                loading: actionLoading.value === 'global',
                                onClick: startGlobalScrape
                              }, {
                                default: _withCtx(() => [...(_cache[12] || (_cache[12] = [
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
                            md: "3"
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
                                default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
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
                            md: "3"
                          }, {
                            default: _withCtx(() => [
                              _createVNode(_component_VBtn, {
                                block: "",
                                color: "info",
                                variant: "tonal",
                                size: "large",
                                "prepend-icon": "mdi-magnify",
                                onClick: _cache[1] || (_cache[1] = $event => (showSearchDialog.value = true))
                              }, {
                                default: _withCtx(() => [...(_cache[14] || (_cache[14] = [
                                  _createTextVNode(" 手动匹配 ", -1)
                                ]))]),
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
                              _createVNode(_component_VBtn, {
                                block: "",
                                color: "success",
                                variant: "tonal",
                                size: "large",
                                "prepend-icon": "mdi-refresh",
                                loading: loading.value,
                                onClick: refreshStatus
                              }, {
                                default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
                                  _createTextVNode(" 刷新状态 ", -1)
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
                  }),
                  _createVNode(_component_VDivider),
                  _createVNode(_component_VCardText, null, {
                    default: _withCtx(() => [
                      _createElementVNode("div", _hoisted_4, [
                        _cache[17] || (_cache[17] = _createTextVNode(" 刮削历史 ", -1)),
                        _createVNode(_component_VChip, {
                          size: "small",
                          class: "ml-2",
                          color: "primary",
                          variant: "tonal"
                        }, {
                          default: _withCtx(() => [
                            _createTextVNode(_toDisplayString(scrapeHistory.value.length), 1)
                          ]),
                          _: 1
                        })
                      ]),
                      (scrapeHistory.value.length > 0)
                        ? (_openBlock(), _createBlock(_component_VTable, {
                            key: 0,
                            density: "compact"
                          }, {
                            default: _withCtx(() => [
                              _cache[18] || (_cache[18] = _createElementVNode("thead", null, [
                                _createElementVNode("tr", null, [
                                  _createElementVNode("th", null, "文件"),
                                  _createElementVNode("th", null, "弹幕数"),
                                  _createElementVNode("th", null, "时间"),
                                  _createElementVNode("th", null, "状态")
                                ])
                              ], -1)),
                              _createElementVNode("tbody", null, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(scrapeHistory.value, (item, i) => {
                                  return (_openBlock(), _createElementBlock("tr", { key: i }, [
                                    _createElementVNode("td", _hoisted_5, _toDisplayString(item.file_name || item.file_path), 1),
                                    _createElementVNode("td", null, _toDisplayString(item.danmu_count || '--'), 1),
                                    _createElementVNode("td", _hoisted_6, _toDisplayString(item.time || '--'), 1),
                                    _createElementVNode("td", null, [
                                      _createVNode(_component_VChip, {
                                        color: item.status === 'success' ? 'success' : 'error',
                                        size: "small",
                                        variant: "tonal"
                                      }, {
                                        default: _withCtx(() => [
                                          _createTextVNode(_toDisplayString(item.status === 'success' ? '成功' : '失败'), 1)
                                        ]),
                                        _: 2
                                      }, 1032, ["color"])
                                    ])
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
                            default: _withCtx(() => [...(_cache[19] || (_cache[19] = [
                              _createTextVNode(" 暂无刮削记录，点击上方按钮开始刮削 ", -1)
                            ]))]),
                            _: 1
                          }))
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
                    default: _withCtx(() => [...(_cache[20] || (_cache[20] = [
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
                    onClick: _cache[4] || (_cache[4] = $event => (showDirectoryDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[21] || (_cache[21] = [
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
                    default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
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
      }, 8, ["modelValue"]),
      _createVNode(_component_VDialog, {
        modelValue: showSearchDialog.value,
        "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((showSearchDialog).value = $event)),
        "max-width": "600"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_VCard, null, {
            default: _withCtx(() => [
              _createVNode(_component_VCardItem, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VCardTitle, null, {
                    default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                      _createTextVNode("手动匹配番剧", -1)
                    ]))]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_VCardText, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VTextField, {
                    modelValue: searchKeyword.value,
                    "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((searchKeyword).value = $event)),
                    label: "番剧名称",
                    placeholder: "输入关键词搜索",
                    variant: "outlined",
                    "append-inner-icon": "mdi-magnify",
                    onKeyup: _withKeys(searchAnime, ["enter"]),
                    "onClick:appendInner": searchAnime
                  }, null, 8, ["modelValue"]),
                  (searchResults.value.length > 0)
                    ? (_openBlock(), _createBlock(_component_VList, {
                        key: 0,
                        class: "mt-2",
                        density: "compact"
                      }, {
                        default: _withCtx(() => [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(searchResults.value, (anime) => {
                            return (_openBlock(), _createBlock(_component_VListItem, {
                              key: anime.anime_id || anime.id,
                              title: anime.anime_title || anime.title,
                              subtitle: `ID: ${anime.anime_id || anime.id}`,
                              onClick: $event => (selectAnime(anime))
                            }, {
                              append: _withCtx(() => [
                                _createVNode(_component_VBtn, {
                                  icon: "mdi-check",
                                  size: "small",
                                  variant: "text",
                                  color: "primary"
                                })
                              ]),
                              _: 1
                            }, 8, ["title", "subtitle", "onClick"]))
                          }), 128))
                        ]),
                        _: 1
                      }))
                    : (searchKeyword.value && searchDone.value)
                      ? (_openBlock(), _createBlock(_component_VAlert, {
                          key: 1,
                          type: "info",
                          variant: "tonal",
                          class: "mt-2"
                        }, {
                          default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                            _createTextVNode(" 未找到匹配的番剧 ", -1)
                          ]))]),
                          _: 1
                        }))
                      : _createCommentVNode("", true),
                  (selectedAnime.value)
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                        _createVNode(_component_VDivider, { class: "my-3" }),
                        _createElementVNode("div", _hoisted_7, "已选择: " + _toDisplayString(selectedAnime.value.anime_title || selectedAnime.value.title), 1),
                        _createVNode(_component_VTextField, {
                          modelValue: episodeOffset.value,
                          "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((episodeOffset).value = $event)),
                          label: "集数偏移",
                          type: "number",
                          variant: "outlined",
                          hint: "正数=后移，负数=前移",
                          "persistent-hint": ""
                        }, null, 8, ["modelValue"]),
                        _createVNode(_component_VTextField, {
                          modelValue: matchFilePath.value,
                          "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((matchFilePath).value = $event)),
                          label: "视频文件路径",
                          variant: "outlined",
                          hint: "要匹配的视频文件路径",
                          "persistent-hint": ""
                        }, null, 8, ["modelValue"])
                      ], 64))
                    : _createCommentVNode("", true)
                ]),
                _: 1
              }),
              _createVNode(_component_VCardActions, null, {
                default: _withCtx(() => [
                  _createVNode(_component_VSpacer),
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    onClick: _cache[9] || (_cache[9] = $event => (showSearchDialog.value = false))
                  }, {
                    default: _withCtx(() => [...(_cache[25] || (_cache[25] = [
                      _createTextVNode("取消", -1)
                    ]))]),
                    _: 1
                  }),
                  (selectedAnime.value)
                    ? (_openBlock(), _createBlock(_component_VBtn, {
                        key: 0,
                        color: "primary",
                        variant: "tonal",
                        loading: actionLoading.value === 'match',
                        onClick: saveMatch
                      }, {
                        default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                          _createTextVNode(" 保存匹配 ", -1)
                        ]))]),
                        _: 1
                      }, 8, ["loading"]))
                    : _createCommentVNode("", true)
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
const AppPageScrape = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-ebde65d6"]]);

export { AppPageScrape as default };
