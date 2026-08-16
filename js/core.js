// 核心业务逻辑：数据加载、保存、消息渲染、发送、自动回复等

// ---- 新增：懒加载与时间限制配置 ----
window.msgBatchSize = 40;          // 每次向上加载的条数
window.loadedBatchCount = 1;       // 已加载批次
window._isLoadingOlder = false;    // 防止重复触发
window._hasLoadedAll = false;      // 是否已加载全部
window._currentRenderedCount = 0;  // 当前DOM中渲染的消息数量

// 6个月时间限制（毫秒）
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

// ---- 新增：按时间修剪消息 ----
function trimMessagesByDate(messages) {
    const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS);
    return messages.filter(m => {
        const d = new Date(m.time);
        return d >= sixMonthsAgo;
    });
}

// ---------- 1. 数据加载与保存 ----------
async function loadMessages() {
    let data = null;
    let fromBackup = false;

    try {
        const key = getStorageKey('chatData');
        data = await safeGetItem(key);
    } catch (e) {
        console.warn('加载消息时发生异常，尝试后备恢复:', e);
    }

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

    if (data && typeof data === 'object' && Array.isArray(data.messages)) {
        // 核心：按时间修剪，只保留最近6个月
        data.messages = trimMessagesByDate(data.messages || []);
        
        window.messages = data.messages;
        window.partnerName = data.partnerName || '梦角';
        window.myName = data.myName || '我';
        window.isDark = data.isDark || false;
        window.lastMsgId = data.lastMsgId || 0;

        if (fromBackup) {
            setTimeout(() => {
                saveMessages().catch(() => {});
            }, 1000);
        }
        return data.messages.length > 0; // 有数据返回 true
    }

    return false;
}

async function saveMessages() {
    try {
        const key = getStorageKey('chatData');
        // 核心：保存前也按时间修剪
        const messagesToSave = trimMessagesByDate(window.messages.slice());
        const data = {
            messages: messagesToSave,
            partnerName: window.partnerName,
            myName: window.myName,
            isDark: window.isDark,
            lastMsgId: window.lastMsgId
        };
        await safeSetItem(key, data);
    } catch (e) {
        console.warn('保存消息失败:', e);
    }
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
        window._currentRenderedCount = 0;
        window._hasLoadedAll = true;
        return;
    }

    // 计算需要渲染的消息范围（从底部开始）
    let totalToShow = Math.min(window.messages.length, window.msgBatchSize * window.loadedBatchCount);
    if (totalToShow <= 0) totalToShow = Math.min(window.messages.length, window.msgBatchSize);
    
    const startIndex = window.messages.length - totalToShow;
    const messagesToRender = window.messages.slice(startIndex);

    let html = '';
    let lastDateKey = '';

    messagesToRender.forEach((msg) => {
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

    // 已经删除了返回按钮逻辑，只有纯粹的滚动懒加载
    window._lastDateKey = messagesToRender.length > 0 ? getDateKey(messagesToRender[messagesToRender.length - 1].time) : '';
    window._currentRenderedCount = messagesToRender.length;
    if (window._currentRenderedCount >= window.messages.length) {
        window._hasLoadedAll = true;
    } else {
        window._hasLoadedAll = false;
    }
    setTimeout(scrollToBottom, 30);
}
window.renderMessages = renderMessages;

// ★ 新增：向上滚动触顶时加载更旧的消息（仅保留懒加载）
async function loadOlderMessages() {
    if (window._isLoadingOlder) return;
    const total = window.messages.length;
    const rendered = window._currentRenderedCount || 0;
    if (rendered >= total) {
        window._hasLoadedAll = true;
        return;
    }

    window._isLoadingOlder = true;
    const batchSize = window.msgBatchSize;
    const nextStartIndex = Math.max(0, total - rendered - batchSize);
    const messagesToPrepend = window.messages.slice(nextStartIndex, total - rendered);

    if (messagesToPrepend.length === 0) {
        window._isLoadingOlder = false;
        window._hasLoadedAll = true;
        return;
    }

    const chatArea = DOM.chatArea;
    const myAv = window.avatarManager ? window.avatarManager.getMyAvatar() : null;
    const partnerAv = window.avatarManager ? window.avatarManager.getPartnerAvatar() : null;

    let html = '';
    let lastDateKey = '';
    const firstChild = chatArea.firstChild;
    const existingDate = (firstChild && firstChild.classList && firstChild.classList.contains('msg-timestamp')) 
        ? firstChild.textContent : null;

    messagesToPrepend.forEach((msg) => {
        const dateKey = getDateKey(msg.time);
        const label = (() => {
            const now = new Date();
            const today = getDateKey(now);
            const yesterday = getDateKey(new Date(now.getTime() - 86400000));
            if (dateKey === today) return '今天';
            if (dateKey === yesterday) return '昨天';
            const d = msg.time;
            return d.getFullYear() + '年' + String(d.getMonth() + 1) + '月' + String(d.getDate()) + '日';
        })();

        if (dateKey !== lastDateKey) {
            if (!(messagesToPrepend.indexOf(msg) === 0 && label === existingDate)) {
                html += `<div class="msg-timestamp">${label}</div>`;
            }
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

    chatArea.insertAdjacentHTML('afterbegin', html);

    const newFirst = chatArea.firstChild;
    if (newFirst && newFirst.classList && newFirst.classList.contains('msg-timestamp')) {
        const nextSibling = newFirst.nextSibling;
        if (nextSibling && nextSibling.classList && nextSibling.classList.contains('msg-timestamp')) {
            newFirst.remove();
        }
    }

    window._currentRenderedCount = rendered + messagesToPrepend.length;
    window._isLoadingOlder = false;
}

// ★ 仅保留懒加载滚动监听（已彻底去掉返回按钮逻辑）
function initScrollLazyLoad() {
    const chatArea = DOM.chatArea;
    if (!chatArea) return;

    chatArea.addEventListener('scroll', () => {
        const scrollTop = chatArea.scrollTop;
        // 触顶且未加载完
        if (scrollTop <= 10 && !window._isLoadingOlder && !window._hasLoadedAll) {
            loadOlderMessages();
        }
    });
}

// 在页面加载后调用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollLazyLoad);
} else {
    initScrollLazyLoad();
}

// ---------- 3. 增量追加（用于新消息，避免重绘整个列表） ----------
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

// ---------- 4. 发送消息 ----------
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
        msg.replyToImage = quoted.image || null;
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

// ---------- 5. 自动回复逻辑 ----------
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

        function getRandomRecentMyMsg() {
            const recentMyMsgs = window.messages.slice().reverse()
                .filter(m => m.sender === 'me' && (m.text || m.image))
                .slice(0, 10);
            if (recentMyMsgs.length === 0) return null;
            return recentMyMsgs[Math.floor(Math.random() * recentMyMsgs.length)];
        }

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

        if (window.quoteManager && window.quoteManager.getEnabled() && Math.random() < 0.3) {
            const quotedMsg = getRandomRecentMyMsg();
            if (quotedMsg) {
                reply.replyTo = quotedMsg.id;
                reply.replyToSender = quotedMsg.sender;
                reply.replyToText = quotedMsg.text || '';
                reply.replyToImage = quotedMsg.image || null;
            }
        }

        window.messages.push(reply);
        if (window.messages.length === 1) renderMessages();
        else appendMessageDOM(reply);
        await saveMessages();
        sendNotification();

        markAllMyMessagesAsRead();

        let extraCount = 0;
        const MAX_EXTRA = 5;
        while (extraCount < MAX_EXTRA && Math.random() < 0.2 && (textPool.length > 0 || partnerImages.length > 0)) {
            let extraText = null;
            let extraImage = null;

            if (window.frequencyManager && textPool.length > 0) {
                const mergeResult = window.frequencyManager.mergeReplies(cards, textEmojis);
                if (mergeResult) {
                    extraText = mergeResult.text;
                }
            }

            if (extraText === null && extraImage === null) {
                const mixedPool = [];
                textPool.forEach(t => mixedPool.push({ type: 'text', data: t }));
                partnerImages.forEach(src => mixedPool.push({ type: 'image', data: src }));

                if (mixedPool.length === 0) break;

                const chosen = mixedPool[Math.floor(Math.random() * mixedPool.length)];
                if (chosen.type === 'text') {
                    extraText = chosen.data;
                } else {
                    extraImage = chosen.data;
                }
            }

            const extraMsg = {
                id: ++window.lastMsgId,
                sender: 'partner',
                text: extraText || '',
                image: extraImage || null,
                time: new Date(),
                read: true,
                type: 'normal',
            };

            if (window.quoteManager && window.quoteManager.getEnabled() && Math.random() < 0.3) {
                const quotedMsg = getRandomRecentMyMsg();
                if (quotedMsg) {
                    extraMsg.replyTo = quotedMsg.id;
                    extraMsg.replyToSender = quotedMsg.sender;
                    extraMsg.replyToText = quotedMsg.text || '';
                    extraMsg.replyToImage = quotedMsg.image || null;
                }
            }

            window.messages.push(extraMsg);
            if (window.messages.length === 1) renderMessages();
            else appendMessageDOM(extraMsg);
            await saveMessages();
            sendNotification();
            extraCount++;
        }

    }, delayMs);
}
window.triggerReply = triggerReply;

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

// ---------- 6. 主题切换 ----------
window.toggleTheme = function() {
    window.isDark = !window.isDark;
    document.documentElement.setAttribute('data-theme', window.isDark ? 'dark' : '');
    if (DOM.themeToggle) DOM.themeToggle.innerHTML = window.isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    saveMessages();
};

// ---------- 7. 通知 ----------
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

// ---------- 8. 更新底部留白 ----------
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

// ---------- 9. 后备备份与恢复 ----------
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