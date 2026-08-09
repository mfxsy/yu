// js/quote-manager.js
(function() {
    'use strict';

    // 引用状态
    let isQuoteEnabled = false;
    let quotedMessage = null;
    let longPressTimer = null;
    let isLongPress = false;
    const LONG_PRESS_DELAY = 500;

    let chatArea = null;
    let msgInput = null;

    // ★ 严格依赖主程序提供的 getStorageKey
    function getKey() {
        if (typeof window.getStorageKey !== 'function') {
            throw new Error('引用设置：window.getStorageKey 未定义');
        }
        return window.getStorageKey('quoteSettings');
    }

    async function loadSettings() {
        try {
            const data = await localforage.getItem(getKey());
            if (data && typeof data.enabled === 'boolean') {
                isQuoteEnabled = data.enabled;
            } else {
                isQuoteEnabled = false;
                await saveSettings();
            }
            console.log('[引用] 加载成功:', isQuoteEnabled);
        } catch (e) {
            console.warn('引用设置加载失败，使用默认值:', e);
            isQuoteEnabled = false;
        }
    }

    async function saveSettings() {
        try {
            await localforage.setItem(getKey(), { enabled: isQuoteEnabled });
            console.log('[引用] 保存成功:', isQuoteEnabled);
        } catch (e) {
            console.warn('保存引用设置失败:', e);
        }
    }

    async function setEnabled(val) {
        isQuoteEnabled = !!val;
        await saveSettings();
        document.dispatchEvent(new CustomEvent('quoteSettingsChanged', { 
            detail: { enabled: isQuoteEnabled } 
        }));
    }

    function getEnabled() { return isQuoteEnabled; }

    // ---------- 长按事件绑定 ----------
    function initLongPress(container, inputElement) {
        chatArea = container;
        msgInput = inputElement;

        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchend', onTouchEnd, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: true });
        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mouseup', onMouseUp);
        container.addEventListener('mouseleave', onMouseUp);
    }

    function getMsgRow(target) {
        let el = target;
        while (el && el !== chatArea) {
            if (el.classList && el.classList.contains('msg-row')) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function startLongPress(event) {
        const target = event.target;
        const row = getMsgRow(target);
        if (!row) return;
        if (target.closest('.wechat-input-bar') || target.closest('.msg-meta') || target.closest('.msg-avatar')) return;

        const bubble = row.querySelector('.msg-bubble');
        if (!bubble) return;

        const ev = new CustomEvent('quote-request', { detail: { row: row } });
        document.dispatchEvent(ev);
    }

    function onLongPressStart(event) {
        if (!isQuoteEnabled) return;
        if (longPressTimer) clearTimeout(longPressTimer);
        isLongPress = false;
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            startLongPress(event);
        }, LONG_PRESS_DELAY);
    }

    function onLongPressEnd() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    let touchStartX = 0, touchStartY = 0;
    function onTouchStart(e) {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        onLongPressStart(e);
    }
    function onTouchEnd(e) {
        onLongPressEnd();
        if (isLongPress) {
            e.preventDefault();
            isLongPress = false;
        }
    }
    function onTouchMove(e) {
        if (longPressTimer) {
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
    }

    function onMouseDown(e) {
        if (e.button !== 0) return;
        onLongPressStart(e);
    }
    function onMouseUp(e) {
        onLongPressEnd();
        if (isLongPress) {
            isLongPress = false;
            e.preventDefault();
        }
    }

    // ---------- 显示引用UI ----------
    function showQuote(quotedMsg) {
        if (!quotedMsg) return;
        quotedMessage = quotedMsg;
        let quoteBar = document.getElementById('quoteBar');
        if (!quoteBar) {
            quoteBar = document.createElement('div');
            quoteBar.id = 'quoteBar';
            // ★ 关键修改：直接追加到 inputBar 内部，而非插入到其前面
            const inputBar = document.getElementById('inputBar');
            inputBar.appendChild(quoteBar); 
        }
        const sender = quotedMsg.sender === 'me' ? '我' : '对方';
        const content = quotedMsg.text || (quotedMsg.image ? '[图片]' : '');
        quoteBar.innerHTML = `
            <span>${sender}：${content.substring(0, 50)}${content.length > 50 ? '…' : ''}</span>
            <button id="clearQuoteBtn" style="background:none;border:none;color:var(--wechat-text-secondary);cursor:pointer;font-size:14px;"><i class="fas fa-times"></i></button>
        `;
        quoteBar.style.display = 'flex';
        document.getElementById('clearQuoteBtn').addEventListener('click', function() {
            clearQuote();
        });
        if (msgInput) msgInput.focus();

        // ★ 新增：显示引用条后，更新聊天区域底部间距，留出位置
        if (typeof window.updateChatPadding === 'function') {
            window.updateChatPadding();
        }
    }

    function clearQuote() {
        const quoteBar = document.getElementById('quoteBar');
        if (quoteBar) quoteBar.style.display = 'none';
        quotedMessage = null;

        // ★ 新增：隐藏引用条后，恢复聊天区域底部间距
        if (typeof window.updateChatPadding === 'function') {
            window.updateChatPadding();
        }
    }

    function getQuotedMessage() {
        return quotedMessage;
    }

    // ---------- 对外接口 ----------
    window.quoteManager = {
        getEnabled,
        setEnabled,
        initLongPress,
        showQuote,
        clearQuote,
        getQuotedMessage,
        loadSettings,
    };

    console.log('✅ quoteManager 已加载，等待主程序调用 .loadSettings()');
})();