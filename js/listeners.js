// 事件绑定：所有 addEventListener 集中在此

function setupEventListeners() {
    const DOM = window.DOM;
    if (!DOM) return;

    // --- 发送按钮 ---
    if (DOM.sendBtn) {
        DOM.sendBtn.addEventListener('click', function() {
            const text = DOM.msgInput ? DOM.msgInput.value : '';
            if (text.trim()) {
                window.sendMessage(text);
                if (DOM.msgInput) {
                    DOM.msgInput.value = '';
                    DOM.msgInput.style.height = 'auto';
                }
            }
        });
    }

    // --- 输入框回车发送 ---
    if (DOM.msgInput) {
        DOM.msgInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (DOM.sendBtn) DOM.sendBtn.click();
            }
        });
        DOM.msgInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
            updateChatPadding();
        });
    }

    // --- 主题切换 ---
    if (DOM.themeToggle) {
        DOM.themeToggle.addEventListener('click', window.toggleTheme);
    }

    // --- 设置按钮 ---
    if (DOM.settingsBtn) {
        DOM.settingsBtn.addEventListener('click', function() {
            if (DOM.settingsPanel) DOM.settingsPanel.classList.add('open');
        });
    }

    // --- 所有面板的关闭按钮 ---
    document.querySelectorAll('.panel-overlay .close-panel').forEach(btn => {
        btn.addEventListener('click', function() {
            const panel = this.closest('.panel-overlay');
            if (panel) panel.classList.remove('open');
        });
    });

    // --- 点击面板外部关闭 ---
    document.querySelectorAll('.panel-overlay').forEach(panel => {
        panel.addEventListener('click', function(e) {
            if (e.target === panel) panel.classList.remove('open');
        });
    });

    // --- 设置面板内子菜单 ---
    document.querySelectorAll('#settingsContent .settings-entry').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            if (DOM.settingsPanel) DOM.settingsPanel.classList.remove('open');
            switch (action) {
                case 'session':
                    if (window.sessionManager) window.sessionManager.renderSessionList('sessionListContainer');
                    if (DOM.sessionPanel) DOM.sessionPanel.classList.add('open');
                    break;
                case 'backup':
                    if (DOM.backupPanel) DOM.backupPanel.classList.add('open');
                    break;
                case 'cards':
                    if (window.cardManager) window.cardManager.openPanel();
                    break;
                case 'message':
                    if (DOM.messageSettingsPanel) DOM.messageSettingsPanel.classList.add('open');
                    break;
                default:
                    break;
            }
        });
    });

    // --- 消息设置内的子菜单 ---
    document.querySelectorAll('#messageSettingsContent .settings-entry').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            if (DOM.messageSettingsPanel) DOM.messageSettingsPanel.classList.remove('open');
            
            if (action === 'interact') {
                if (DOM.interactSettingsPanel) DOM.interactSettingsPanel.classList.add('open');
            } else if (action === 'avatar') {
                if (window.avatarManager) window.avatarManager.openPanel();
            } else if (action === 'frequency') {
                if (window.frequencyManager) {
                    window.frequencyManager.initUI();
                }
                if (DOM.frequencySettingsPanel) DOM.frequencySettingsPanel.classList.add('open');
            } else if (action === 'nickname') {
                openNicknamePanel();
            }
        });
    });

    // --- 昵称保存 ---
    const saveNicknameBtn = document.getElementById('saveNicknameBtn');
    if (saveNicknameBtn) {
        saveNicknameBtn.addEventListener('click', saveNickname);
    }
    document.querySelectorAll('#nicknamePanel input').forEach(input => {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveNickname();
            }
        });
    });

    // --- 通知开关 ---
    const notifToggle = document.getElementById('notificationToggle');
    if (notifToggle) {
        notifToggle.checked = window.notificationEnabled;
        notifToggle.addEventListener('change', async function() {
            window.notificationEnabled = this.checked;
            await saveNotificationSetting();
            if (window.notificationEnabled && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        });
    }

    // --- 引用回复开关 ---
    const quoteToggle = document.getElementById('quoteToggle');
    const timestampToggle = document.getElementById('timestampToggle');
    const noReplyToggle = document.getElementById('noReplyToggle');

    if (quoteToggle && window.quoteManager) {
        quoteToggle.checked = window.quoteManager.getEnabled();
        quoteToggle.addEventListener('change', function() {
            window.quoteManager.setEnabled(this.checked);
        });
    }

    if (timestampToggle) {
        timestampToggle.checked = window.showTimestamp;
        timestampToggle.addEventListener('change', async function() {
            window.showTimestamp = this.checked;
            await saveTimestampSetting();
            renderMessages();
        });
    }

    if (noReplyToggle) {
        noReplyToggle.checked = window.noReplyEnabled;
        noReplyToggle.addEventListener('change', async function() {
            window.noReplyEnabled = this.checked;
            await saveNoReplySetting();
        });
    }

    // ★ 移除旧的长按初始化，改为单击初始化
    if (window.quoteManager) {
        window.quoteManager.initClickQuote(DOM.chatArea);
    }

    // ★ 单击气泡弹出引用按钮（替代长按）
    if (DOM.chatArea) {
        DOM.chatArea.addEventListener('click', function(e) {
            const bubble = e.target.closest('.msg-bubble');
            if (!bubble) return;
            // 点击图片本身则继续触发查看大图，不干扰
            if (e.target.tagName === 'IMG') return;

            const row = bubble.closest('.msg-row');
            if (!row) return;

            if (window.quoteManager && window.quoteManager.getEnabled()) {
                window.quoteManager.showQuoteButton(row);
            }
        });
    }

    // --- 表情按钮 ---
    if (DOM.emojiBtn) {
        DOM.emojiBtn.addEventListener('click', function() {
            if (window.emojiManager) window.emojiManager.openPanel();
            else showToast('表情模块未加载', 'error');
        });
    }

    // --- 通话按钮 ---
    if (DOM.callBtn) {
        DOM.callBtn.addEventListener('click', function() {
            if (window.callManager) {
                if (window.callManager.getState && window.callManager.getState() === 'idle') {
                    if (window.callManager.startCall) window.callManager.startCall();
                }
            }
        });
    }

    // --- 点击联系人名称修改昵称 ---
    if (DOM.contactName) {
        DOM.contactName.addEventListener('click', async function() {
            const newName = prompt('修改对方昵称：', window.partnerName);
            if (newName !== null && newName.trim()) {
                window.partnerName = newName.trim();
                DOM.contactName.textContent = window.partnerName;
                await saveMessages();
                renderMessages();
                showToast('昵称已更新', 'success');
            }
        });
    }

    // --- 新建会话 ---
    const createSessionBtn = document.getElementById('createSessionBtn');
    if (createSessionBtn) {
        createSessionBtn.addEventListener('click', async function() {
            const name = prompt('请输入新会话名称：', '我的会话');
            if (name === null) return;
            await window.sessionManager.createAndSwitch(name.trim() || '会话');
            window.SESSION_ID = window.sessionManager.getCurrentSessionId();
            window.messages = [];
            await saveMessages();
            renderMessages();
            if (DOM.sessionPanel) DOM.sessionPanel.classList.remove('open');
            showToast('新会话已创建', 'success');
        });
    }

    // --- 监听会话切换事件 ---
    document.addEventListener('sessionChanged', async function(e) {
        window.SESSION_ID = e.detail.sessionId;
        window.sessionList = window.sessionManager.getSessionList();
        window.getSessionId = function() { return window.SESSION_ID; };

        if (window.frequencyManager) {
            await window.frequencyManager.load();
            window.frequencyManager.restartActiveTimer(() => {
                window.triggerReply(true);
            });
        }
        await loadTimestampSetting();
        if (timestampToggle) timestampToggle.checked = window.showTimestamp;
        await loadNoReplySetting();
        if (noReplyToggle) noReplyToggle.checked = window.noReplyEnabled;

        const hasData = await loadMessages();
        if (!hasData) {
            window.messages = [];
            await saveMessages();
        }
        if (DOM.contactName) DOM.contactName.textContent = window.partnerName;
        renderMessages();
        if (window.cardManager) window.cardManager.reload();
        if (window.emojiManager) window.emojiManager.reload();
        if (window.avatarManager) window.avatarManager.reload();
        showToast('已切换会话', 'success');
    });

    // --- Ctrl+Enter 发送 ---
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (document.activeElement === DOM.msgInput && DOM.sendBtn) {
                e.preventDefault();
                DOM.sendBtn.click();
            }
        }
    });

    // --- 点击消息区域查看图片 ---
    window._viewImage = function(src) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;animation:fadeIn 0.2s ease;';
        overlay.innerHTML = `<img src="${src}" style="max-width:92vw;max-height:88vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.6);" />`;
        overlay.addEventListener('click', function() { overlay.remove(); });
        document.body.appendChild(overlay);
    };
}

function saveNickname() {
    const newMy = document.getElementById('myNameInput').value.trim() || '我';
    const newPartner = document.getElementById('partnerNameInput').value.trim() || '梦角';
    if (newMy === window.myName && newPartner === window.partnerName) {
        showToast('昵称未改变', 'info');
        return;
    }
    window.myName = newMy;
    window.partnerName = newPartner;
    saveMessages();
    if (DOM.contactName) DOM.contactName.textContent = window.partnerName;
    renderMessages();
    if (DOM.nicknamePanel) DOM.nicknamePanel.classList.remove('open');
    showToast('昵称已更新', 'success');
}

function openNicknamePanel() {
    const myNameInput = document.getElementById('myNameInput');
    const partnerNameInput = document.getElementById('partnerNameInput');
    if (myNameInput) myNameInput.value = window.myName;
    if (partnerNameInput) partnerNameInput.value = window.partnerName;
    if (DOM.nicknamePanel) DOM.nicknamePanel.classList.add('open');
}

// ---------- 设置加载与保存（添加 localStorage 备用） ----------

async function loadTimestampSetting() {
    let data = null;
    try {
        const key = getStorageKey('timestampSettings');
        data = await safeGetItem(key);
    } catch (e) { /* 忽略 */ }

    if (!data || typeof data.enabled !== 'boolean') {
        try {
            const raw = localStorage.getItem('timestampSettings_fallback');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed.enabled === 'boolean') {
                    data = parsed;
                    console.warn('[timestamp] 从 localStorage 恢复设置');
                }
            }
        } catch (e) { /* 忽略 */ }
    }

    window.showTimestamp = data?.enabled ?? true;
    await saveTimestampSetting();
}
async function saveTimestampSetting() {
    try {
        await safeSetItem(getStorageKey('timestampSettings'), { enabled: window.showTimestamp });
    } catch (e) { console.warn('保存时间戳设置失败:', e); }
    try {
        localStorage.setItem('timestampSettings_fallback', JSON.stringify({ enabled: window.showTimestamp }));
    } catch (e) { /* 忽略 */ }
}

async function loadNoReplySetting() {
    let data = null;
    try {
        const key = getStorageKey('noReplySettings');
        data = await safeGetItem(key);
    } catch (e) {}

    if (!data || typeof data.enabled !== 'boolean') {
        try {
            const raw = localStorage.getItem('noReplySettings_fallback');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed.enabled === 'boolean') {
                    data = parsed;
                    console.warn('[noReply] 从 localStorage 恢复设置');
                }
            }
        } catch (e) {}
    }

    window.noReplyEnabled = data?.enabled ?? false;
    await saveNoReplySetting();
}
async function saveNoReplySetting() {
    try {
        await safeSetItem(getStorageKey('noReplySettings'), { enabled: window.noReplyEnabled });
    } catch (e) { /* 忽略 */ }
    try {
        localStorage.setItem('noReplySettings_fallback', JSON.stringify({ enabled: window.noReplyEnabled }));
    } catch (e) {}
}

async function loadNotificationSetting() {
    let data = null;
    try {
        const key = window.APP_PREFIX + 'notificationEnabled';
        data = await safeGetItem(key);
    } catch (e) {}

    if (!data || typeof data.enabled !== 'boolean') {
        try {
            const raw = localStorage.getItem('notificationEnabled_fallback');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed.enabled === 'boolean') {
                    data = parsed;
                    console.warn('[notif] 从 localStorage 恢复设置');
                }
            }
        } catch (e) {}
    }

    window.notificationEnabled = data?.enabled ?? false;
    await saveNotificationSetting();
}
async function saveNotificationSetting() {
    try {
        await safeSetItem(window.APP_PREFIX + 'notificationEnabled', { enabled: window.notificationEnabled });
    } catch (e) {}
    try {
        localStorage.setItem('notificationEnabled_fallback', JSON.stringify({ enabled: window.notificationEnabled }));
    } catch (e) {}
}