// js/session-manager.js
(function() {
    'use strict';

    const APP_PREFIX = 'CHAT_APP_V3_';
    let sessionList = [];
    let currentSessionId = null;

    async function loadSessionList() {
        try {
            const data = await localforage.getItem(APP_PREFIX + 'sessionList');
            if (data && Array.isArray(data)) {
                sessionList = data;
            } else {
                sessionList = [];
            }
        } catch (e) {
            sessionList = [];
        }
    }

    async function saveSessionList() {
        try {
            await localforage.setItem(APP_PREFIX + 'sessionList', sessionList);
        } catch (e) {
            console.warn('保存会话列表失败', e);
        }
    }

    // ★ 修改点3：createNewSession 加上 try-catch，保存失败时只输出警告，不崩
    async function createNewSession(name) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        const newSession = {
            id: id,
            name: name || ('会话 ' + (sessionList.length + 1)),
            createdAt: Date.now()
        };
        sessionList.push(newSession);
        try {
            await saveSessionList();
        } catch (e) {
            console.warn('保存新会话失败，仅内存有效', e);
        }
        return id;
    }

    const sessionManager = {
        /**
         * 初始化会话：
         * 1. 若 URL Hash 存在且有效 → 使用该会话
         * 2. 否则，尝试恢复 lastSessionId
         * 3. 否则，取会话列表中的第一个
         * 4. 否则，创建全新会话
         */
        // ★ 修改点2：initializeSession 整体套上 try-catch，最外层生成临时ID
        async initializeSession() {
            // 加载列表时即使失败也不抛出
            try {
                await loadSessionList();
            } catch (e) {
                console.warn('加载会话列表失败', e);
                sessionList = [];
            }

            try {
                // 1) URL Hash
                const hash = window.location.hash.substring(1);
                if (hash && sessionList.some(s => s.id === hash)) {
                    currentSessionId = hash;
                    await localforage.setItem(APP_PREFIX + 'lastSessionId', currentSessionId);
                    return currentSessionId;
                }

                // 2) lastSessionId
                const lastId = await localforage.getItem(APP_PREFIX + 'lastSessionId');
                if (lastId && sessionList.some(s => s.id === lastId)) {
                    currentSessionId = lastId;
                    await localforage.setItem(APP_PREFIX + 'lastSessionId', currentSessionId);
                    return currentSessionId;
                }

                // 3) 取第一个会话
                if (sessionList.length > 0) {
                    currentSessionId = sessionList[0].id;
                    await localforage.setItem(APP_PREFIX + 'lastSessionId', currentSessionId);
                    return currentSessionId;
                }

                // 4) 完全无会话 → 新建
                const newId = await createNewSession('我的会话');
                currentSessionId = newId;
                await localforage.setItem(APP_PREFIX + 'lastSessionId', currentSessionId);
                return currentSessionId;
            } catch (e) {
                // ★ 如果上面所有步骤都失败，生成一个临时内存ID，保证应用不崩，也不写进URL
                console.error('[会话] 严重初始化错误，生成临时会话', e);
                currentSessionId = 'temp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
                return currentSessionId;
            }
        },

        // 切换会话
        async switchSession(sessionId) {
            if (sessionId === currentSessionId) return;
            currentSessionId = sessionId;
            window.location.hash = sessionId;
            await localforage.setItem(APP_PREFIX + 'lastSessionId', sessionId);
            document.dispatchEvent(new CustomEvent('sessionChanged', { detail: { sessionId } }));
        },

        // 新建会话（不切换）
        async createNewSession(name) {
            return await createNewSession(name);
        },

        // 新建并切换
        async createAndSwitch(name) {
            const newId = await createNewSession(name);
            await this.switchSession(newId);
            return newId;
        },

        // 删除会话
        async deleteSession(sessionId) {
            if (sessionList.length <= 1) {
                throw new Error('至少保留一个会话');
            }
            const keys = await localforage.keys();
            const prefix = APP_PREFIX + sessionId + '_';
            const toRemove = keys.filter(k => k.startsWith(prefix));
            for (const k of toRemove) {
                await localforage.removeItem(k);
            }
            sessionList = sessionList.filter(s => s.id !== sessionId);
            await saveSessionList();
            if (sessionId === currentSessionId) {
                const first = sessionList[0];
                if (first) {
                    await this.switchSession(first.id);
                }
            }
        },

        // 重命名会话
        async renameSession(sessionId, newName) {
            const session = sessionList.find(s => s.id === sessionId);
            if (session) {
                session.name = newName.trim() || session.name;
                await saveSessionList();
                return true;
            }
            return false;
        },

        getCurrentSessionId() {
            return currentSessionId;
        },

        getSessionList() {
            return sessionList;
        },

        renderSessionList(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            if (sessionList.length === 0) {
                container.innerHTML = `<div class="card-empty"><p>暂无会话</p></div>`;
                return;
            }
            let html = '';
            sessionList.forEach(s => {
                const active = s.id === currentSessionId ? 'active' : '';
                html += `
                    <div class="card-item" data-id="${s.id}" style="${active ? 'border-color:var(--wechat-green);background:rgba(var(--wechat-green-rgb),0.05);' : ''}">
                        <span class="card-text" style="font-weight:${active ? '600' : '400'};">${s.name}</span>
                        <div class="card-actions">
                            ${active ? `<span style="font-size:11px;color:var(--wechat-green);font-weight:600;">当前</span>` : `<button class="switch-session-btn" data-id="${s.id}" style="background:none;border:none;color:var(--wechat-green);cursor:pointer;font-size:13px;">切换</button>`}
                            <button class="rename-session-btn" data-id="${s.id}" style="background:none;border:none;color:var(--wechat-text-secondary);cursor:pointer;font-size:13px;" title="重命名"><i class="fas fa-pen"></i></button>
                            <button class="del-session-btn" data-id="${s.id}" style="background:none;border:none;color:#fa5151;cursor:pointer;font-size:13px;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;

            container.querySelectorAll('.switch-session-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    sessionManager.switchSession(id);
                    document.getElementById('sessionPanel').classList.remove('open');
                    sessionManager.renderSessionList(containerId);
                });
            });

            container.querySelectorAll('.rename-session-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const session = sessionList.find(s => s.id === id);
                    if (!session) return;
                    const newName = prompt('输入新名称：', session.name);
                    if (newName !== null && newName.trim()) {
                        sessionManager.renameSession(id, newName.trim()).then(() => {
                            sessionManager.renderSessionList(containerId);
                            document.dispatchEvent(new CustomEvent('sessionRenamed', { detail: { sessionId: id, newName: newName.trim() } }));
                        });
                    }
                });
            });

            container.querySelectorAll('.del-session-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    if (sessionList.length <= 1) {
                        alert('至少保留一个会话');
                        return;
                    }
                    if (confirm('确定删除此会话及所有数据吗？不可恢复！')) {
                        try {
                            await sessionManager.deleteSession(id);
                            sessionManager.renderSessionList(containerId);
                            document.dispatchEvent(new CustomEvent('sessionChanged', { detail: { sessionId: sessionManager.getCurrentSessionId() } }));
                        } catch (err) {
                            alert(err.message);
                        }
                    }
                });
            });
        }
    };

    window.sessionManager = sessionManager;
})();