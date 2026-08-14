// 核心业务逻辑：数据加载、保存、消息渲染、发送、自动回复等

// ---------- 1. 数据加载与保存 ----------
async function loadMessages() {
    // 使用局部变量暂存，绝不能一上来就清空 window.messages
    let data = null;
    let fromBackup = false;

    // 1. 先尝试从 IndexedDB 读取
    try {
        const key = getStorageKey('chatData');
        data = await safeGetItem(key);
    } catch (e) {
        console.warn('加载消息时发生异常，尝试后备恢复:', e);
    }

    // 2. 如果 IndexedDB 读取失败、返回空，尝试从 localStorage 后备恢复
    const isEmptyData = !data || (typeof data === 'object' && Object.keys(data).length === 0);
    if (isEmptyData) {
        try {
            const backupRaw = localStorage.getItem('BACKUP_V1_critical');
            if (backupRaw) {
                const backup = JSON.parse(backupRaw);
                if (backup.messages && Array.isArray(backup.messages) && backup.messages.length > 0) {
                    data = {
                        messages: backup.messages,
                        partnerName: backup.settings?.partnerName || '梦角',
                        myName: backup.settings?.myName || '我',
                        isDark: backup.settings?.isDark || false,
                        lastMsgId: backup.lastMsgId || 0
                    };
                    fromBackup = true;
                    console.warn('[loadMessages] 从 localStorage 后备恢复成功！');
                }
            }
        } catch (e) {
            console.warn('[loadMessages] 后备恢复失败:', e);
        }
    }

    // 3. 只有真正拿到了有效数据，才赋值给 window.messages 并返回 true
    if (data && typeof data === 'object' && Array.isArray(data.messages) && data.messages.length > 0) {
        window.messages = data.messages || [];
        window.partnerName = data.partnerName || '梦角';
        window.myName = data.myName || '我';
        window.isDark = data.isDark || false;
        window.lastMsgId = data.lastMsgId || 0;

        // 如果是从后备恢复的，异步写回修复存储
        if (fromBackup) {
            setTimeout(() => {
                saveMessages().catch(() => {});
            }, 1000);
        }
        return true; // 表示有数据
    }

    // 4. 返回 false，表示没有有效数据，让 app.js 去初始化空数组
    return false;
}

async function saveMessages() {
    try {
        const key = getStorageKey('chatData');
        const data = {
            messages: window.messages.slice(-500),
            partnerName: window.partnerName,
            myName: window.myName,
            isDark: window.isDark,
            lastMsgId: window.lastMsgId
        };
        await safeSetItem(key, data);
    } catch (e) {
        console.warn('保存消息失败:', e);
    }
    // 同步写入 localStorage 备用
    try {
        _backupCriticalData();
    } catch (e) {
        console.warn('备用备份失败:', e);
    }
}
window.saveMessages = saveMessages;

// ---------- 2. 消息渲染 ----------
function scrollToBottom() {
    const chatArea = DOM.chatArea;
    if (!chatArea) return;
    chatArea.scrollTop = chatArea.scrollHeight;
    requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    });
}

function renderMessages() {
    const chatArea = DOM.chatArea;
    if (!chatArea) return;
    const myAv = window.avatarManager ? window.avatarManager.getMyAvatar() : null;
    const partnerAv = window.avatarManager ? window.avatarManager.getPartnerAvatar() : null;

    if (window.messages.length === 0) {
        chatArea.innerHTML = `
            <div class="empty-state" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;color:var(--wechat-text-secondary);opacity:0.5;text-align:center;">
                <i class="fas fa-comment-dots" style="font-size:48px;margin-bottom:16px;opacity:0.3;"></i>
                <p style="font-size:15px;font-weight:500;">开始你们的对话</p>
            </div>
        `;
        window._lastDateKey = '';
        return;
    }

    let html = '';
    let lastDateKey = '';

    window.messages.forEach((msg) => {
        const dateKey = getDateKey(msg.time);
        if (dateKey !== lastDateKey) {
            const label = (() => {
                const now = new Date();
                const today = getDateKey(now);
                const yesterday = getDateKey(new Date(now.getTime() - 86400000));
                if (dateKey === today) return '今天';
                if (dateKey === yesterday) return '昨天';
                const d = msg.time;
                return d.getFullYear() + '年' + String(d.getMonth() + 1) + '月' + String(d.getDate()) + '日';
            })();
            html += `<div class="msg-timestamp">${label}</div>`;
            lastDateKey = dateKey;
        }

        if (msg.type === 'system') {
            html += `<div class="msg-system">${msg.text}</div>`;
            return;
        }

        const isSent = msg.sender === 'me';
        const avatarSrc = isSent ? myAv : partnerAv;
        const avatarHtml = avatarSrc ? `<img src="${avatarSrc}" alt="" />` : `<i class="fas fa-user"></i>`;

        let replyHtml = '';
        if (msg.replyTo) {
            let senderName = (msg.replyToSender === 'me') ? window.myName : window.partnerName;
            let replyContent = '';
            if (msg.replyToImage) {
                replyContent = `<img src="${msg.replyToImage}" style="max-width:60px;max-height:60px;border-radius:4px;vertical-align:middle;margin-right:4px;" />`;
                if (msg.replyToText) {
                    replyContent += `<span style="vertical-align:middle;">${msg.replyToText}</span>`;
                }
            } else {
                replyContent = msg.replyToText || '';
                if (replyContent.length > 30) replyContent = replyContent.substring(0, 30) + '…';
            }
            replyHtml = `<div class="quote-preview"><span style="font-weight:500;">${senderName}：</span>${replyContent}</div>`;
        }

        const isImgOnly = msg.image && !msg.text;
        let bubbleContent = '';
        if (msg.text) bubbleContent += msg.text.replace(/\n/g, '<br />');
        if (msg.image) {
            const imgHtml = `<img src="${msg.image}" alt="图片" onclick="window._viewImage && window._viewImage('${msg.image.replace(/'/g, "\\'")}')" loading="lazy" />`;
            bubbleContent += bubbleContent ? ('<br />' + imgHtml) : imgHtml;
        }
        const finalBubbleContent = replyHtml + (bubbleContent ? `<div>${bubbleContent}</div>` : '');
        const bubbleClass = (isSent ? 'sent' : 'recv') + (isImgOnly ? ' img-only' : '');
        const timeStr = formatTime(msg.time);
        const timeHtml = window.showTimestamp ? `<span>${timeStr}</span>` : '';

        html += `
            <div class="msg-row ${isSent ? 'sent' : 'recv'}" data-msg-id="${msg.id}">
                <div class="msg-avatar">${avatarHtml}</div>
                <div class="msg-bubble-wrap">
                    <div class="msg-bubble ${bubbleClass}">${finalBubbleContent}</div>
                    <div class="msg-meta">
                        ${timeHtml}
                        ${isSent ? `<span class="read-status ${msg.read ? 'read' : ''}">${msg.read ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-check"></i>'}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    chatArea.innerHTML = html;
    window._lastDateKey = window.messages.length > 0 ? getDateKey(window.messages[window.messages.length - 1].time) : '';
    setTimeout(scrollToBottom, 30);
}
window.renderMessages = renderMessages;

// 增量追加（用于新消息，避免重绘整个列表）
function appendMessageDOM(msg) {
    const chatArea = DOM.chatArea;
    if (!chatArea) return;
    const myAv = window.avatarManager ? window.avatarManager.getMyAvatar() : null;
    const partnerAv = window.avatarManager ? window.avatarManager.getPartnerAvatar() : null;

    const dateKey = getDateKey(msg.time);
    if (dateKey !== window._lastDateKey) {
        const label = (() => {
            const now = new Date();
            const today = getDateKey(now);
            const yesterday = getDateKey(new Date(now.getTime() - 86400000));
            if (dateKey === today) return '今天';
            if (dateKey === yesterday) return '昨天';
            const d = msg.time;
            return d.getFullYear() + '年' + String(d.getMonth() + 1) + '月' + String(d.getDate()) + '日';
        })();
        const ts = document.createElement('div');
        ts.className = 'msg-timestamp';
        ts.textContent = label;
        chatArea.appendChild(ts);
        window._lastDateKey = dateKey;
    }

    if (msg.type === 'system') {
        const sys = document.createElement('div');
        sys.className = 'msg-system';
        sys.textContent = msg.text;
        chatArea.appendChild(sys);
        scrollToBottom();
        return;
    }

    const isSent = msg.sender === 'me';
    const avatarSrc = isSent ? myAv : partnerAv;
    const avatarHtml = avatarSrc ? `<img src="${avatarSrc}" alt="" />` : `<i class="fas fa-user"></i>`;

    let replyHtml = '';
    if (msg.replyTo) {
        let senderName = (msg.replyToSender === 'me') ? window.myName : window.partnerName;
        let replyContent = '';
        if (msg.replyToImage) {
            replyContent = `<img src="${msg.replyToImage}" style="max-width:60px;max-height:60px;border-radius:4px;vertical-align:middle;margin-right:4px;" />`;
            if (msg.replyToText) {
                replyContent += `<span style="vertical-align:middle;">${msg.replyToText}</span>`;
            }
        } else {
            replyContent = msg.replyToText || '';
            if (replyContent.length > 30) replyContent = replyContent.substring(0, 30) + '…';
        }
        replyHtml = `<div class="quote-preview"><span style="font-weight:500;">${senderName}：</span>${replyContent}</div>`;
    }

    const isImgOnly = msg.image && !msg.text;
    let bubbleContent = '';
    if (msg.text) bubbleContent += msg.text.replace(/\n/g, '<br />');
    if (msg.image) {
        const imgHtml = `<img src="${msg.image}" alt="图片" onclick="window._viewImage && window._viewImage('${msg.image.replace(/'/g, "\\'")}')" loading="lazy" />`;
        bubbleContent += bubbleContent ? ('<br />' + imgHtml) : imgHtml;
    }
    const finalBubbleContent = replyHtml + (bubbleContent ? `<div>${bubbleContent}</div>` : '');
    const bubbleClass = (isSent ? 'sent' : 'recv') + (isImgOnly ? ' img-only' : '');
    const timeStr = formatTime(msg.time);
    const timeHtml = window.showTimestamp ? `<span>${timeStr}</span>` : '';

    const row = document.createElement('div');
    row.className = `msg-row ${isSent ? 'sent' : 'recv'}`;
    row.dataset.msgId = msg.id;
    row.innerHTML = `
        <div class="msg-avatar">${avatarHtml}</div>
        <div class="msg-bubble-wrap">
            <div class="msg-bubble ${bubbleClass}">${finalBubbleContent}</div>
            <div class="msg-meta">
                ${timeHtml}
                ${isSent ? `<span class="read-status ${msg.read ? 'read' : ''}">${msg.read ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-check"></i>'}</span>` : ''}
            </div>
        </div>
    `;
    chatArea.appendChild(row);
    scrollToBottom();
}
window.appendMessageDOM = appendMessageDOM;

// ---------- 3. 发送消息 ----------
window.sendMessage = async function(text, image) {
    text = (text || '').trim();
    if (!text && !image) return false;

    let quoted = null;
    if (window.quoteManager) {
        quoted = window.quoteManager.getQuotedMessage();
    }

    const msg = {
        id: ++window.lastMsgId,
        sender: 'me',
        text: text || '',
        image: image || null,
        time: new Date(),
        read: false,
        type: 'normal',
    };
    if (quoted) {
        msg.replyTo = quoted.id;
        msg.replyToSender = quoted.sender;
        msg.replyToText = quoted.text || '';
        msg.replyToImage = quoted.image || null; // ★ 添加图片引用
        if (window.quoteManager) window.quoteManager.clearQuote();
    }

    window.messages.push(msg);

    if (window.messages.length === 1) {
        renderMessages();
    } else {
        appendMessageDOM(msg);
    }

    scrollToBottom();
    await saveMessages();

    setTimeout(async () => {
        if (!window.noReplyEnabled) {
            msg.read = true;
            updateReadReceipt(msg.id);
            await saveMessages();
        }
    }, 800 + Math.random() * 1200);
    triggerReply(false);
    return true;
};

// 更新已读回执
function updateReadReceipt(msgId) {
    const row = DOM.chatArea ? DOM.chatArea.querySelector(`.msg-row[data-msg-id="${msgId}"]`) : null;
    if (row) {
        const statusEl = row.querySelector('.msg-meta .read-status');
        if (statusEl) {
            statusEl.className = 'read-status read';
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i>';
        }
    }
}

// 添加外部消息（用于对方回复）
window.addMessage = function(text, sender, type) {
    sender = sender || 'me';
    type = type || 'normal';
    const msg = {
        id: ++window.lastMsgId,
        sender: sender,
        text: text || '',
        image: null,
        time: new Date(),
        read: sender === 'me' ? false : true,
        type: type
    };
    window.messages.push(msg);

    if (window.messages.length === 1) {
        renderMessages();
    } else {
        appendMessageDOM(msg);
    }
    saveMessages();
    if (sender === 'partner') {
        sendNotification();
    }
};

// ---------- 4. 自动回复逻辑 ----------
function triggerReply(fromActive) {
    if (window.isTyping) return;

    if (!fromActive && window.noReplyEnabled) {
        if (Math.random() < 0.65) return;
    }

    const cards = window.cardManager ? window.cardManager.getCards() : [];
    const textEmojis = window.cardManager ? window.cardManager.getTextEmojis() : [];
    const partnerImages = window.emojiManager ? window.emojiManager.getPartnerEmojis() : [];

    const textPool = [...cards, ...textEmojis];
    const hasText = textPool.length > 0;
    const hasImage = partnerImages.length > 0;

    if (!hasText && !hasImage) {
        setTimeout(async () => {
            const hint = {
                id: ++window.lastMsgId,
                sender: 'partner',
                text: '还没有回复内容呢，快去添加字卡或表情吧！',
                image: null,
                time: new Date(),
                read: true,
                type: 'normal',
            };
            window.messages.push(hint);
            if (window.messages.length === 1) renderMessages();
            else appendMessageDOM(hint);
            await saveMessages();
            sendNotification();
        }, 600);
        return;
    }

    window.isTyping = true;
    if (DOM.contactStatus) DOM.contactStatus.textContent = '对方正在输入…';

    let delaySec = 2;
    if (window.frequencyManager) {
        delaySec = window.frequencyManager.getReplyDelay();
    }
    delaySec = Math.max(1, Math.min(180, delaySec));
    const delayMs = delaySec * 1000;

    window.typingTimer = setTimeout(async () => {
        window.isTyping = false;
        if (DOM.contactStatus) DOM.contactStatus.textContent = '在线';

        let replyText = null;
        let replyImage = null;

        if (window.frequencyManager && textPool.length > 0) {
            const mergeResult = window.frequencyManager.mergeReplies(cards, textEmojis);
            if (mergeResult) {
                replyText = mergeResult.text;
            }
        }

        if (replyText === null && replyImage === null) {
            const mixedPool = [];
            textPool.forEach(t => mixedPool.push({ type: 'text', data: t }));
            partnerImages.forEach(src => mixedPool.push({ type: 'image', data: src }));

            if (mixedPool.length === 0) return;

            const chosen = mixedPool[Math.floor(Math.random() * mixedPool.length)];
            if (chosen.type === 'text') {
                replyText = chosen.data;
            } else {
                replyImage = chosen.data;
            }
        }

        const reply = {
            id: ++window.lastMsgId,
            sender: 'partner',
            text: replyText || '',
            image: replyImage || null,
            time: new Date(),
            read: true,
            type: 'normal',
        };

        // ★ 对方自动回复时，也支持引用（含图片）
        if (window.quoteManager && window.quoteManager.getEnabled() && Math.random() < 0.3) {
            const lastMyMsg = window.messages.slice().reverse().find(m => m.sender === 'me');
            if (lastMyMsg) {
                reply.replyTo = lastMyMsg.id;
                reply.replyToSender = lastMyMsg.sender;
                reply.replyToText = lastMyMsg.text || '';
                reply.replyToImage = lastMyMsg.image || null; // ★ 携带图片
            }
        }

        window.messages.push(reply);
        if (window.messages.length === 1) renderMessages();
        else appendMessageDOM(reply);
        await saveMessages();
        sendNotification();

        // 标记所有我方未读消息为已读
        markAllMyMessagesAsRead();

        if (Math.random() < 0.2 && textPool.length > 1) {
            const extraText = textPool[Math.floor(Math.random() * textPool.length)];
            if (extraText) {
                const extraMsg = {
                    id: ++window.lastMsgId,
                    sender: 'partner',
                    text: extraText,
                    image: null,
                    time: new Date(),
                    read: true,
                    type: 'normal',
                };
                window.messages.push(extraMsg);
                if (window.messages.length === 1) renderMessages();
                else appendMessageDOM(extraMsg);
                await saveMessages();
                sendNotification();
            }
        }
    }, delayMs);
}
window.triggerReply = triggerReply;

// 标记所有我方消息为已读
function markAllMyMessagesAsRead() {
    let changed = false;
    window.messages.forEach(msg => {
        if (msg.sender === 'me' && !msg.read) {
            msg.read = true;
            changed = true;
        }
    });
    if (changed) {
        const rows = DOM.chatArea ? DOM.chatArea.querySelectorAll('.msg-row.sent') : [];
        rows.forEach(row => {
            const msgId = row.dataset.msgId;
            if (msgId) {
                const msg = window.messages.find(m => String(m.id) === String(msgId));
                if (msg && msg.sender === 'me' && msg.read) {
                    const statusEl = row.querySelector('.msg-meta .read-status');
                    if (statusEl && !statusEl.classList.contains('read')) {
                        statusEl.className = 'read-status read';
                        statusEl.innerHTML = '<i class="fas fa-check-circle"></i>';
                    }
                }
            }
        });
        saveMessages();
    }
}

// ---------- 5. 主题切换 ----------
window.toggleTheme = function() {
    window.isDark = !window.isDark;
    document.documentElement.setAttribute('data-theme', window.isDark ? 'dark' : '');
    if (DOM.themeToggle) DOM.themeToggle.innerHTML = window.isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    saveMessages();
};

// ---------- 6. 通知 ----------
function sendNotification() {
    if (!window.notificationEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        clearTimeout(window.notificationTimer);
        window.notificationCount++;
        window.notificationTimer = setTimeout(() => {
            const count = window.notificationCount;
            window.notificationCount = 0;
            const title = '传讯 · 字卡';
            const body = `收到 ${count} 条新消息`;
            try {
                new Notification(title, { body: body });
            } catch (e) { /* ignore */ }
        }, 3000);
    } else if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ---------- 7. 更新底部留白 ----------
function updateChatPadding() {
    if (!DOM.inputBar || !DOM.chatArea) return;
    const inputBarHeight = DOM.inputBar.offsetHeight;
    let quoteBarHeight = 0;
    const quoteBar = DOM.quoteBar;
    if (quoteBar && quoteBar.style.display !== 'none') {
        quoteBarHeight = quoteBar.offsetHeight;
    }
    let bottomToolbarHeight = 0;
    if (window.visualViewport) {
        const diff = window.innerHeight - window.visualViewport.height;
        if (diff > 0) bottomToolbarHeight = diff;
    }
    const totalBottomPadding = inputBarHeight + quoteBarHeight + bottomToolbarHeight + 20;
    DOM.chatArea.style.paddingBottom = totalBottomPadding + 'px';
}
window.updateChatPadding = updateChatPadding;

// ---------- 8. 后备备份与恢复 ----------
const _BACKUP_PREFIX = 'BACKUP_V1_';
function _backupCriticalData() {
    if (window._skipBackup) return;
    try {
        const backupPayload = {
            ts: Date.now(),
            messages: window.messages,
            settings: { partnerName: window.partnerName, myName: window.myName, isDark: window.isDark },
            sessionId: window.SESSION_ID,
            lastMsgId: window.lastMsgId
        };
        let payloadToStore = backupPayload;
        const msgSizeEstimate = window.messages.length * 500;
        if (msgSizeEstimate > 3 * 1024 * 1024) {
            payloadToStore = {
                ...backupPayload,
                messages: window.messages.slice(-200),
                _truncated: true
            };
        }
        const json = JSON.stringify(payloadToStore);
        if (json.length > 4.5 * 1024 * 1024) {
            const smallerPayload = {
                ...payloadToStore,
                messages: window.messages.slice(-50),
                _truncated: true
            };
            localStorage.setItem(_BACKUP_PREFIX + 'critical', JSON.stringify(smallerPayload));
        } else {
            localStorage.setItem(_BACKUP_PREFIX + 'critical', json);
        }
        localStorage.setItem(_BACKUP_PREFIX + 'timestamp', String(Date.now()));
    } catch (e) {
        console.warn('localStorage 备份写入失败:', e);
    }
}