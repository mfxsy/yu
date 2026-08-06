// card-manager.js（完整修复版）
(function() {
    'use strict';

    const DEFAULT_CARDS = [
        "嗯，我在听呢",
        "今天也想你哦",
        "你是我最温柔的牵挂",
        "好呀，都听你的",
        "我懂你的意思",
        "想抱抱你",
        "别担心，有我在",
        "你真好",
        "我也是呢",
        "晚点再聊，你先忙",
        "好梦，晚安",
        "你笑起来最好看",
        "我会一直陪着你",
        "今天开心吗？",
        "注意休息呀",
        "你是我每天的期待",
        "我就在你身边",
        "要好好吃饭哦",
        "我在想你",
        "你值得所有的美好"
    ];

    let cards = [];
    let textEmojis = [];
    let groups = [];
    let currentTab = 'cards';
    let filterGroupId = null;
    let showGroupTabs = false;

    function getKey(base) {
        if (typeof window.getStorageKey === 'function') {
            return window.getStorageKey(base);
        }
        return 'CHAT_APP_V3_' + base;
    }

    async function loadData() {
        try {
            const key = getKey('cardData');
            const data = await localforage.getItem(key);
            if (data) {
                if (data.cards) cards = data.cards;
                if (data.textEmojis) textEmojis = data.textEmojis;
            }
        } catch (e) {}
        if (cards.length === 0) cards = [...DEFAULT_CARDS];
        if (textEmojis.length === 0) textEmojis = ['😊', '❤️', '✨', '🌟', '💕', '🌸', '🌙', '⭐', '🌈', '🎵', '💫', '🍀', '🎶', '💖', '🌺'];

        try {
            const gKey = getKey('groupData');
            const gData = await localforage.getItem(gKey);
            if (gData && Array.isArray(gData)) groups = gData;
            else groups = [];
        } catch (e) { groups = []; }

        await saveData();
        await saveGroups();
    }

    async function saveData() {
        try {
            await localforage.setItem(getKey('cardData'), { cards, textEmojis });
        } catch (e) { console.warn('保存字卡失败:', e); }
    }

    async function saveGroups() {
        try {
            await localforage.setItem(getKey('groupData'), groups);
        } catch (e) { console.warn('保存分组失败:', e); }
    }

    window.cardManager = {
        getCards: () => cards,
        getTextEmojis: () => textEmojis,
        getGroups: () => groups,

        exportData: function() {
            return {
                cards: [...cards],
                textEmojis: [...textEmojis],
                groups: JSON.parse(JSON.stringify(groups))
            };
        },
        importData: function(data, mode) {
            if (!data || typeof data !== 'object') return { success: false, message: '无效数据' };
            if (mode === 'overwrite') {
                if (data.cards) cards = data.cards;
                if (data.textEmojis) textEmojis = data.textEmojis;
                if (data.groups) groups = data.groups;
            } else {
                if (data.cards) {
                    const set = new Set(cards);
                    data.cards.forEach(item => { if (!set.has(item)) { cards.push(item); set.add(item); } });
                }
                if (data.textEmojis) {
                    const set = new Set(textEmojis);
                    data.textEmojis.forEach(item => { if (!set.has(item)) { textEmojis.push(item); set.add(item); } });
                }
                if (data.groups) {
                    data.groups.forEach(g => {
                        const existing = groups.find(grp => grp.name === g.name);
                        if (existing) {
                            const set = new Set(existing.items);
                            g.items.forEach(item => { if (!set.has(item)) { existing.items.push(item); set.add(item); } });
                        } else {
                            groups.push({ id: Date.now() + '_' + Math.random().toString(36).substr(2,4), name: g.name, items: g.items ? [...g.items] : [] });
                        }
                    });
                }
            }
            saveData();
            saveGroups();
            return { success: true };
        },

        addItem: async function(text, groupId) {
            text = text.trim();
            if (!text) return false;
            if (currentTab === 'cards') {
                if (cards.includes(text)) return false;
                cards.push(text);
                await saveData();
                if (groupId) {
                    const target = groups.find(g => g.id === groupId);
                    if (target && !target.items.includes(text)) {
                        target.items.push(text);
                        await saveGroups();
                    }
                }
                return true;
            } else if (currentTab === 'emojis') {
                if (textEmojis.includes(text)) return false;
                textEmojis.push(text);
                await saveData();
                return true;
            }
            return false;
        },
        addBatch: async function(items, tab) {
            if (!Array.isArray(items) || items.length === 0) return 0;
            let added = 0;
            const target = tab === 'cards' ? cards : textEmojis;
            const set = new Set(target);
            items.forEach(item => {
                const trimmed = item.trim();
                if (trimmed && !set.has(trimmed)) {
                    target.push(trimmed);
                    set.add(trimmed);
                    added++;
                }
            });
            if (added) await saveData();
            return added;
        },

                importFromJson: async function(jsonData, tab, mode = 'merge') {
            try {
                const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
                let items = [];
                let importedGroups = null;
                if (tab === 'cards') {
                    // ★【修复点 1】新增对导出字段 data.cards 的识别
                    if (data.cards) items = data.cards;
                    else if (data.customReplies) items = data.customReplies;
                    else if (data.replies) items = data.replies;
                    else if (Array.isArray(data)) items = data;
                    else throw new Error('未找到字卡数据');
                    
                    if (data.customReplyGroups) {
                        importedGroups = data.customReplyGroups;
                    }
                } else if (tab === 'emojis') {
                    // ★【修复点 2】新增对导出字段 data.textEmojis 的识别
                    if (data.textEmojis) items = data.textEmojis;
                    else if (data.customEmojis) items = data.customEmojis;
                    else if (data.emojis) items = data.emojis;
                    else if (Array.isArray(data)) items = data;
                    else throw new Error('未找到Emoji数据');
                } else throw new Error('未知选项卡');
                
                if (items.length === 0) return 0;

                const target = tab === 'cards' ? cards : textEmojis;

                if (mode === 'overwrite') {
                    target.length = 0;
                    if (tab === 'cards' && importedGroups) {
                        groups.length = 0;
                        importedGroups.forEach(g => {
                            groups.push({
                                id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                                name: g.name,
                                items: g.items ? [...g.items] : []
                            });
                        });
                        await saveGroups();
                    } else if (tab === 'cards' && !importedGroups) {
                        groups.length = 0;
                        await saveGroups();
                    }
                } else {
                    const set = new Set(target);
                    items.forEach(item => {
                        const trimmed = String(item).trim();
                        if (trimmed && !set.has(trimmed)) {
                            target.push(trimmed);
                            set.add(trimmed);
                        }
                    });
                    if (tab === 'cards' && importedGroups) {
                        importedGroups.forEach(g => {
                            const existing = groups.find(grp => grp.name === g.name);
                            if (existing) {
                                const set2 = new Set(existing.items);
                                g.items.forEach(item => { if (!set2.has(item)) { existing.items.push(item); set2.add(item); } });
                            } else {
                                groups.push({
                                    id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                                    name: g.name,
                                    items: g.items ? [...g.items] : []
                                });
                            }
                        });
                        await saveGroups();
                    }
                }

                if (mode === 'overwrite') {
                    items.forEach(item => {
                        const trimmed = String(item).trim();
                        if (trimmed) target.push(trimmed);
                    });
                }
                await saveData();
                return target.length;
            } catch (e) { throw e; }
        },

        removeCard: async function(index) {
            if (index >= 0 && index < cards.length) {
                if (confirm('确定删除这条字卡吗？')) {
                    const text = cards[index];
                    cards.splice(index, 1);
                    groups.forEach(g => { const idx = g.items.indexOf(text); if (idx!==-1) g.items.splice(idx,1); });
                    await saveData();
                    await saveGroups();
                    return true;
                }
                return false;
            }
            return false;
        },
        editCard: async function(index, newText) {
            newText = newText.trim();
            if (index >= 0 && index < cards.length && newText) {
                const old = cards[index];
                cards[index] = newText;
                groups.forEach(g => { const idx = g.items.indexOf(old); if (idx!==-1) g.items[idx] = newText; });
                await saveData();
                await saveGroups();
                return true;
            }
            return false;
        },
        resetToDefault: async function() {
            if (confirm('恢复默认字卡？')) {
                cards = [...DEFAULT_CARDS];
                groups = [];
                await saveData();
                await saveGroups();
                return true;
            }
            return false;
        },
        removeTextEmoji: async function(index) {
            if (index >= 0 && index < textEmojis.length) {
                if (confirm('确定删除？')) {
                    textEmojis.splice(index, 1);
                    await saveData();
                    return true;
                }
                return false;
            }
            return false;
        },
        editTextEmoji: async function(index, newEmoji) {
            newEmoji = newEmoji.trim();
            if (index >= 0 && index < textEmojis.length && newEmoji) {
                if (textEmojis.includes(newEmoji) && textEmojis[index] !== newEmoji) return false;
                textEmojis[index] = newEmoji;
                await saveData();
                return true;
            }
            return false;
        },
        addGroup: async function(name) {
            name = name.trim();
            if (!name || groups.some(g => g.name === name)) return false;
            groups.push({ id: Date.now()+'_'+Math.random().toString(36).substr(2,4), name, items: [] });
            await saveGroups();
            return true;
        },
        renameGroup: async function(id, newName) {
            newName = newName.trim();
            if (!newName) return false;
            const g = groups.find(grp => grp.id === id);
            if (!g || groups.some(grp => grp.id !== id && grp.name === newName)) return false;
            g.name = newName;
            await saveGroups();
            return true;
        },
        deleteGroup: async function(id) {
            if (!confirm('删除分组？（字卡保留）')) return false;
            groups = groups.filter(g => g.id !== id);
            await saveGroups();
            return true;
        },
        assignCardToGroup: async function(cardText, groupId) {
            if (!cardText || !groupId) return false;
            groups.forEach(g => { const idx = g.items.indexOf(cardText); if (idx!==-1) g.items.splice(idx,1); });
            const target = groups.find(g => g.id === groupId);
            if (target) {
                if (!target.items.includes(cardText)) target.items.push(cardText);
                await saveGroups();
                return true;
            }
            return false;
        },
        removeCardFromGroup: async function(cardText, groupId) {
            const g = groups.find(grp => grp.id === groupId);
            if (g) {
                const idx = g.items.indexOf(cardText);
                if (idx !== -1) { g.items.splice(idx,1); await saveGroups(); return true; }
            }
            return false;
        },
        openPanel: function() {
            filterGroupId = null;
            showGroupTabs = false;
            renderPanel();
            document.getElementById('cardPanel').classList.add('open');
        },
        switchTab: function(tab) {
            currentTab = tab;
            filterGroupId = null;
            showGroupTabs = false;
            renderPanel();
        },
        reload: async function() {
            await loadData();
            if (document.getElementById('cardPanel').classList.contains('open')) renderPanel();
        },
        renderPanel: renderPanel
    };

    // ===== 渲染函数 =====
    async function renderPanel() {
        const container = document.getElementById('cardListContainer');
        const countEl = document.getElementById('cardCount');
        if (!container) return;

        const tabs = document.querySelectorAll('#cardPanel .card-tab-btn');
        tabs.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === currentTab);
        });

        const groupSelector = document.getElementById('groupSelectorWrapper');
        if (groupSelector) {
            groupSelector.style.display = currentTab === 'cards' ? 'flex' : 'none';
        }
        updateGroupSelectOptions();

        if (currentTab === 'cards') {
            renderCardTab(container, countEl);
        } else {
            renderEmojiTab(container, countEl);
        }
    }

    function renderCardTab(container, countEl) {
        const isGroupMode = showGroupTabs;
        const isFiltered = filterGroupId !== null;

        let html = '';

        html += `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="display:flex;gap:10px;flex:1;">
            <button class="filter-btn ${!isGroupMode ? 'active' : ''}" data-filter="all" style="flex:1;padding:6px 0;border-radius:20px;border:1px solid var(--wechat-border);background:${!isGroupMode ? 'var(--wechat-green)' : 'transparent'};color:${!isGroupMode ? '#fff' : 'var(--wechat-text-primary)'};cursor:pointer;font-weight:500;">未分组</button>
            <button class="filter-btn ${isGroupMode ? 'active' : ''}" data-filter="grouped" style="flex:1;padding:6px 0;border-radius:20px;border:1px solid var(--wechat-border);background:${isGroupMode ? 'var(--wechat-green)' : 'transparent'};color:${isGroupMode ? '#fff' : 'var(--wechat-text-primary)'};cursor:pointer;font-weight:500;">已分组</button>
        </div>
            ${!isGroupMode ? `<button id="openGroupManagerBtn" style="padding:4px 12px;background:var(--wechat-green);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">分组管理</button>` : ''}
        </div>
            ${!isGroupMode ? `<div style="text-align:left;font-size:13px;color:var(--wechat-text-secondary);margin-bottom:8px;">${cards.length}个</div>` : ''}
    `;

        if (isGroupMode) {
            if (!isFiltered) {
                html += `<div style="overflow-x:auto;white-space:nowrap;padding-bottom:6px;margin-bottom:10px;display:flex;gap:8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;">
                    <style>#cardListContainer .group-tab::-webkit-scrollbar{display:none;}</style>
                `;
                if (groups.length === 0) {
                    html += `<span style="font-size:12px;color:var(--wechat-text-secondary);">暂无分组，请先创建分组</span>`;
                } else {
                    groups.forEach(g => {
                        html += `<button class="group-tab" data-groupid="${g.id}" style="flex-shrink:0;padding:4px 14px;border-radius:20px;border:1px solid var(--wechat-border);background:transparent;color:var(--wechat-text-primary);cursor:pointer;font-size:12px;">${g.name} (${g.items.length})</button>`;
                    });
                }
                html += `</div>`;
                html += `<div class="card-empty" style="padding:40px 0;"><i class="fas fa-hand-pointer"></i><p>请选择分组</p></div>`;
            } else {
                // 【修复点1】强制转为字符串比较
                const group = groups.find(g => String(g.id) === String(filterGroupId));
                if (group) {
                    const filteredCards = cards.filter(c => group.items.includes(c));
                    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <span style="font-size:14px;font-weight:600;color:var(--wechat-green);">${group.name}（${filteredCards.length} 个）</span>
                        <button id="clearFilterBtn" style="padding:4px 12px;background:none;border:1px solid var(--wechat-border);border-radius:6px;font-size:12px;cursor:pointer;color:var(--wechat-text-secondary);">取消筛选</button>
                    </div>`;
                    if (filteredCards.length === 0) {
                        html += `<div class="card-empty"><i class="fas fa-book-open"></i><p>该分组暂无字卡</p></div>`;
                    } else {
                        const groupMap = {};
                        for (const g of groups) {
                            for (const item of g.items) {
                                if (!groupMap[item]) groupMap[item] = [];
                                groupMap[item].push(g);
                            }
                        }
                        filteredCards.forEach((item, idx) => {
                            const display = item.length > 60 ? item.slice(0, 60) + '…' : item;
                            let groupHtml = '';
                            if (groupMap[item]) {
                                const groupNames = groupMap[item].map(g => `<span style="display:inline-block;background:rgba(0,0,0,0.06);padding:0 6px;border-radius:4px;font-size:10px;margin-right:4px;">${g.name}</span>`).join('');
                                groupHtml = `<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:2px;">${groupNames}</div>`;
                            }
                            html += `
                                <div class="card-item">
                                    <div style="flex:1;min-width:0;">
                                        <span class="card-text">${display}</span>
                                        ${groupHtml}
                                    </div>
                                    <div class="card-actions">
                                        <button class="edit-btn" data-idx="${idx}" title="编辑"><i class="fas fa-pen"></i></button>
                                        <button class="group-btn" data-idx="${idx}" title="分配分组"><i class="fas fa-tag"></i></button>
                                        <button class="del-btn" data-idx="${idx}" title="删除"><i class="fas fa-trash-alt"></i></button>
                                    </div>
                                </div>
                            `;
                        });
                    }
                } else {
                    html += `<div class="card-empty"><i class="fas fa-exclamation-triangle"></i><p>分组不存在</p></div>`;
                }
            }
        } else {
            if (cards.length === 0) {
                html += `<div class="card-empty"><i class="fas fa-book-open"></i><p>字卡库为空</p></div>`;
            } else {
                const groupMap = {};
                for (const g of groups) {
                    for (const item of g.items) {
                        if (!groupMap[item]) groupMap[item] = [];
                        groupMap[item].push(g);
                    }
                }
                cards.forEach((item, idx) => {
                    const display = item.length > 60 ? item.slice(0, 60) + '…' : item;
                    let groupHtml = '';
                    if (groupMap[item]) {
                        const groupNames = groupMap[item].map(g => `<span style="display:inline-block;background:rgba(0,0,0,0.06);padding:0 6px;border-radius:4px;font-size:10px;margin-right:4px;">${g.name}</span>`).join('');
                        groupHtml = `<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:2px;">${groupNames}</div>`;
                    }
                    html += `
                        <div class="card-item">
                            <div style="flex:1;min-width:0;">
                                <span class="card-text">${display}</span>
                                ${groupHtml}
                            </div>
                            <div class="card-actions">
                                <button class="edit-btn" data-idx="${idx}" title="编辑"><i class="fas fa-pen"></i></button>
                                <button class="group-btn" data-idx="${idx}" title="分配分组"><i class="fas fa-tag"></i></button>
                                <button class="del-btn" data-idx="${idx}" title="删除"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </div>
                    `;
                });
            }
        }

        container.innerHTML = html;
        if (countEl) countEl.textContent = `共 ${cards.length} 条`;

        container.querySelectorAll('.filter-btn[data-filter="all"]').forEach(btn => {
            btn.addEventListener('click', function() {
                showGroupTabs = false;
                filterGroupId = null;
                renderPanel();
            });
        });

        container.querySelectorAll('.filter-btn[data-filter="grouped"]').forEach(btn => {
            btn.addEventListener('click', function() {
                if (showGroupTabs && filterGroupId !== null) {
                    filterGroupId = null;
                    renderPanel();
                } else if (showGroupTabs && filterGroupId === null) {
                    showGroupTabs = false;
                    renderPanel();
                } else {
                    showGroupTabs = true;
                    filterGroupId = null;
                    renderPanel();
                }
            });
        });

        container.querySelectorAll('.group-tab').forEach(btn => {
            btn.addEventListener('click', function() {
                const gid = this.dataset.groupid;
                // 【修复点2】强制转为字符串存储
                if (filterGroupId === gid) {
                    filterGroupId = null;
                } else {
                    filterGroupId = String(gid);
                }
                renderPanel();
            });
        });

        const clearBtn = container.querySelector('#clearFilterBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                filterGroupId = null;
                renderPanel();
            });
        }

        const mgrBtn = container.querySelector('#openGroupManagerBtn');
        if (mgrBtn) {
            mgrBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                showGroupManager();
            });
        }

        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                const current = cards[idx];
                const newText = prompt('编辑字卡内容：', current);
                if (newText !== null && newText.trim()) {
                    const success = await window.cardManager.editCard(idx, newText.trim());
                    if (success) {
                        renderPanel();
                        showToast('已更新', 'success');
                    } else {
                        showToast('更新失败', 'error');
                    }
                }
            });
        });

        container.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                const success = await window.cardManager.removeCard(idx);
                if (success) {
                    renderPanel();
                    showToast('已删除', 'success');
                }
            });
        });

        container.querySelectorAll('.group-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                const cardText = cards[idx];
                showGroupPicker(cardText);
            });
        });
    }

    function renderEmojiTab(container, countEl) {
        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-size:13px;font-weight:500;color:var(--wechat-text-secondary);"> ${textEmojis.length}个 </span>
            </div>
        `;
        if (textEmojis.length === 0) {
            html += `<div class="card-empty"><i class="fas fa-smile"></i><p>Emoji 库为空</p></div>`;
        } else {
            textEmojis.forEach((item, idx) => {
                const display = item.length > 60 ? item.slice(0, 60) + '…' : item;
                html += `
                    <div class="card-item">
                        <span class="card-text">${display}</span>
                        <div class="card-actions">
                            <button class="edit-emoji-btn" data-idx="${idx}" title="编辑"><i class="fas fa-pen"></i></button>
                            <button class="del-btn" data-idx="${idx}" title="删除"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                `;
            });
        }
        container.innerHTML = html;
        if (countEl) countEl.textContent = `共 ${textEmojis.length} 条`;

        container.querySelectorAll('.edit-emoji-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                const current = textEmojis[idx];
                const newEmoji = prompt('编辑 Emoji：', current);
                if (newEmoji !== null && newEmoji.trim()) {
                    const success = await window.cardManager.editTextEmoji(idx, newEmoji.trim());
                    if (success) {
                        renderPanel();
                        showToast('已更新', 'success');
                    } else {
                        showToast('更新失败（可能已存在）', 'error');
                    }
                }
            });
        });

        container.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                const success = await window.cardManager.removeTextEmoji(idx);
                if (success) {
                    renderPanel();
                    showToast('已删除', 'success');
                }
            });
        });
    }

    function updateGroupSelectOptions() {
        const select = document.getElementById('addCardGroupSelect');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '无分组';
        select.appendChild(opt);
        groups.forEach(g => {
            const opt2 = document.createElement('option');
            opt2.value = g.id;
            opt2.textContent = g.name;
            select.appendChild(opt2);
        });
        if (currentVal && groups.some(g => g.id === currentVal)) {
            select.value = currentVal;
        } else {
            select.value = '';
        }
    }

    function showGroupPicker(cardText) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:var(--wechat-bg);border-radius:16px;padding:20px;width:90%;max-width:320px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
        const title = document.createElement('h3');
        title.textContent = `分配分组: “${cardText}”`;
        title.style.marginBottom = '12px';
        const list = document.createElement('div');
        list.style.cssText = 'flex:1;overflow-y:auto;margin-bottom:12px;';

        const close = () => overlay.remove();

        if (groups.length === 0) {
            list.innerHTML = '<p style="color:var(--wechat-text-secondary);text-align:center;padding:12px 0;">暂无分组</p>';
        } else {
            groups.forEach(g => {
                const isChecked = g.items.includes(cardText);
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--wechat-border);';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isChecked;
                checkbox.style.width = '18px;height:18px;';
                const label = document.createElement('span');
                label.textContent = g.name;
                label.style.flex = '1';
                item.appendChild(checkbox);
                item.appendChild(label);
                list.appendChild(item);

                checkbox.addEventListener('change', async function() {
                    if (this.checked) {
                        await window.cardManager.assignCardToGroup(cardText, g.id);
                    } else {
                        await window.cardManager.removeCardFromGroup(cardText, g.id);
                    }
                    renderPanel();
                });
            });
        }

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px;';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid var(--wechat-border);background:none;cursor:pointer;';
        closeBtn.addEventListener('click', close);
        btnRow.appendChild(closeBtn);
        dialog.appendChild(title);
        dialog.appendChild(list);
        dialog.appendChild(btnRow);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }

    function showGroupManager() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:var(--wechat-bg);border-radius:16px;padding:20px;width:90%;max-width:360px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
        const title = document.createElement('h3');
        title.textContent = '分组管理';
        title.style.marginBottom = '12px';
        const list = document.createElement('div');
        list.style.cssText = 'flex:1;overflow-y:auto;margin-bottom:12px;';

        const close = () => overlay.remove();

        function renderGroupList() {
            list.innerHTML = '';
            if (groups.length === 0) {
                list.innerHTML = '<p style="color:var(--wechat-text-secondary);text-align:center;padding:12px 0;">暂无分组</p>';
                return;
            }
            groups.forEach(g => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--wechat-border);';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = g.name + ` (${g.items.length})`;
                nameSpan.style.flex = '1';
                const renameBtn = document.createElement('button');
                renameBtn.innerHTML = '<i class="fas fa-pen"></i>';
                renameBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px 6px;';
                renameBtn.title = '重命名';
                renameBtn.addEventListener('click', async function() {
                    const newName = prompt('输入新分组名称：', g.name);
                    if (newName !== null && newName.trim()) {
                        if (await window.cardManager.renameGroup(g.id, newName.trim())) {
                            renderGroupList();
                            renderPanel();
                            showToast('分组已重命名', 'success');
                        } else {
                            showToast('重命名失败（可能名称已存在）', 'error');
                        }
                    }
                });
                const delBtn = document.createElement('button');
                delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                delBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#fa5151;padding:4px 6px;';
                delBtn.title = '删除分组';
                delBtn.addEventListener('click', async function() {
                    if (await window.cardManager.deleteGroup(g.id)) {
                        renderGroupList();
                        renderPanel();
                        showToast('分组已删除', 'success');
                    }
                });
                item.appendChild(nameSpan);
                item.appendChild(renameBtn);
                item.appendChild(delBtn);
                list.appendChild(item);
            });
        }

        const addRow = document.createElement('div');
        addRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '新分组名称…';
        input.style.cssText = 'flex:1;padding:8px 12px;border:1px solid var(--wechat-border);border-radius:8px;font-size:14px;background:var(--wechat-input-bg);color:var(--wechat-text-primary);';
        const addBtn = document.createElement('button');
        addBtn.textContent = '添加';
        addBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:var(--wechat-green);color:#fff;cursor:pointer;font-weight:600;';
        addBtn.addEventListener('click', async function() {
            const name = input.value.trim();
            if (name) {
                if (await window.cardManager.addGroup(name)) {
                    input.value = '';
                    renderGroupList();
                    renderPanel();
                    showToast('分组已创建', 'success');
                } else {
                    showToast('创建失败（名称可能已存在）', 'error');
                }
            }
        });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });
        addRow.appendChild(input);
        addRow.appendChild(addBtn);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid var(--wechat-border);background:none;cursor:pointer;margin-top:8px;';
        closeBtn.addEventListener('click', close);
        dialog.appendChild(title);
        dialog.appendChild(addRow);
        dialog.appendChild(list);
        dialog.appendChild(closeBtn);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        renderGroupList();
    }

    function showToast(msg, type) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = msg;
            toast.className = 'toast ' + (type || 'info');
            void toast.offsetWidth;
            toast.classList.add('show');
            clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
        } else {
            alert(msg);
        }
    }

    // ===== DOM 初始化 =====
    document.addEventListener('DOMContentLoaded', function() {
        const addBtn = document.getElementById('addCardBtn');
        const input = document.getElementById('newCardInput');
        const groupSelect = document.getElementById('addCardGroupSelect');

        if (addBtn && input) {
            addBtn.addEventListener('click', async function() {
                const text = input.value.trim();
                if (!text) {
                    showToast('请输入内容', 'error');
                    return;
                }
                const groupId = groupSelect ? groupSelect.value : '';
                const success = await window.cardManager.addItem(text, groupId);
                if (success) {
                    input.value = '';
                    renderPanel();
                    showToast('添加成功 ✓', 'success');
                    input.focus();
                } else {
                    showToast('内容已存在或无效', 'warning');
                }
            });
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addBtn.click();
                }
            });
        }

        const resetBtn = document.getElementById('resetDefaultCards');
        if (resetBtn) {
            resetBtn.addEventListener('click', async function() {
                if (currentTab === 'cards') {
                    if (await window.cardManager.resetToDefault()) {
                        renderPanel();
                        showToast('已恢复默认字卡', 'success');
                    }
                } else {
                    showToast('该功能仅适用于字卡', 'info');
                }
            });
        }

        const batchBtn = document.getElementById('batchAddBtn');
        if (batchBtn) {
            batchBtn.addEventListener('click', showBatchDialog);
        }

        const importBtn = document.getElementById('importJsonBtn');
        if (importBtn) {
            importBtn.addEventListener('click', showImportDialog);
        }

        document.querySelectorAll('#cardPanel .card-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                window.cardManager.switchTab(this.dataset.tab);
            });
        });

        const closeBtn = document.getElementById('closeCardPanel');
        const panel = document.getElementById('cardPanel');
        if (closeBtn && panel) {
            closeBtn.addEventListener('click', function() {
                panel.classList.remove('open');
            });
            panel.addEventListener('click', function(e) {
                if (e.target === panel) panel.classList.remove('open');
            });
        }

        loadData().then(() => {
            updateGroupSelectOptions();
            if (panel && panel.classList.contains('open')) {
                renderPanel();
            }
        });
    });

    // ---- 批量添加对话框 ----
    function showBatchDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:var(--wechat-bg);border-radius:16px;padding:20px;width:90%;max-width:400px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
        const title = document.createElement('h3');
        title.textContent = `批量添加 ${currentTab === 'cards' ? '字卡' : 'Emoji'}`;
        title.style.marginBottom = '12px';
        const textarea = document.createElement('textarea');
        textarea.rows = 8;
        textarea.placeholder = '每行一条，输入多个内容…';
        textarea.style.cssText = 'flex:1;padding:10px;border:1px solid var(--wechat-border);border-radius:8px;font-size:14px;background:var(--wechat-input-bg);color:var(--wechat-text-primary);resize:vertical;font-family:var(--font-family);';
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end;';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid var(--wechat-border);background:none;cursor:pointer;';
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确认添加';
        confirmBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:var(--wechat-green);color:#fff;cursor:pointer;font-weight:600;';
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);
        dialog.appendChild(title);
        dialog.appendChild(textarea);
        dialog.appendChild(btnRow);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        confirmBtn.addEventListener('click', async function() {
            const raw = textarea.value;
            const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
            if (lines.length === 0) {
                showToast('请输入至少一条内容', 'error');
                return;
            }
            const added = await window.cardManager.addBatch(lines, currentTab);
            if (added > 0) {
                renderPanel();
                showToast(`成功添加 ${added} 条`, 'success');
                close();
            } else {
                showToast('没有新内容可添加（可能已存在）', 'warning');
            }
        });
    }

    // ---- 导入JSON对话框 ----
    function showImportDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:var(--wechat-bg);border-radius:16px;padding:20px;width:90%;max-width:320px;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
        dialog.innerHTML = `
            <h3 style="margin-bottom:12px;font-size:17px;text-align:center;">选择导入模式</h3>
            <p style="font-size:13px;color:var(--wechat-text-secondary);margin-bottom:16px;text-align:center;">合并：追加到已有数据；覆盖：替换已有数据。</p>
            <div style="display:flex;gap:12px;">
                <button id="importMergeBtn" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--wechat-green);color:#fff;font-weight:600;cursor:pointer;">合并</button>
                <button id="importOverwriteBtn" style="flex:1;padding:10px;border-radius:8px;border:none;background:#fa5151;color:#fff;font-weight:600;cursor:pointer;">覆盖</button>
                <button id="importCancelBtn" style="flex:0 0 auto;padding:10px 16px;border-radius:8px;border:1px solid var(--wechat-border);background:none;cursor:pointer;">取消</button>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();

        dialog.querySelector('#importCancelBtn').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        const handleImport = async (mode) => {
            close();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async function(e) {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const added = await window.cardManager.importFromJson(text, currentTab, mode);
                    if (added > 0) {
                        renderPanel();
                        showToast(`成功导入 ${added} 条${currentTab === 'cards' ? '字卡' : 'Emoji'} (${mode === 'overwrite' ? '覆盖' : '合并'})`, 'success');
                    } else {
                        showToast('没有内容可导入', 'warning');
                    }
                } catch (err) {
                    showToast('导入失败: ' + err.message, 'error');
                }
                input.value = '';
            };
            input.click();
        };

        dialog.querySelector('#importMergeBtn').addEventListener('click', () => handleImport('merge'));
        dialog.querySelector('#importOverwriteBtn').addEventListener('click', () => handleImport('overwrite'));
    }

    window.cardManager.renderPanel = renderPanel;
})();