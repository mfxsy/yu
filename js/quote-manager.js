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
    const inputBar = document.getElementById('inputBar');
    if (!inputBar) return;

    // 创建引用栏（如果不存在）
    if (!quoteBar) {
        quoteBar = document.createElement('div');
        quoteBar.id = 'quoteBar';
        // 使用固定定位，保证始终悬浮在输入栏上方
        quoteBar.style.cssText = `
            position: fixed;
            left: 0;
            right: 0;
            z-index: 99;
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: var(--wechat-nav-bg);
            border-bottom: 1px solid var(--wechat-border);
            border-top: 1px solid var(--wechat-border);
            font-size: 13px;
            color: var(--wechat-text-secondary);
            min-height: 44px;
            box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(quoteBar);
    }

    // 动态更新引用栏的位置（紧贴在输入栏顶部）
    function updateQuotePosition() {
        if (quoteBar.style.display === 'none') return;
        const inputBarRect = inputBar.getBoundingClientRect();
        // 计算底部偏移量，实现无缝黏贴
        quoteBar.style.bottom = (window.innerHeight - inputBarRect.top) + 'px';
    }

    // 移除之前可能残留的 resize 监听，防止重复绑定
    window.removeEventListener('resize', updateQuotePosition);

    // 格式化引用信息
    const sender = quotedMsg.sender === 'me' ? '我' : '对方';
    // 【修复】去除字符限制，完整显示引用内容，CSS 自动处理溢出省略
    const content = quotedMsg.text || (quotedMsg.image ? '[图片]' : '');

    quoteBar.innerHTML = `
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;">
            <span style="color:var(--wechat-green);font-weight:600;margin-right:4px;">${sender}：</span>${content}
        </span>
        <button id="clearQuoteBtn" style="flex-shrink:0; background:rgba(0,0,0,0.05); border:none; border-radius:50%; width:30px; height:30px; color:var(--wechat-text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:background 0.2s;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // 显示引用栏并更新位置
    quoteBar.style.display = 'flex';
    updateQuotePosition();
    
    // 窗口变化（如键盘弹起）时，保持引用栏始终黏贴正确位置
    window.addEventListener('resize', updateQuotePosition);

    // 绑定删除键事件
    document.getElementById('clearQuoteBtn').addEventListener('click', function() {
        clearQuote();
        window.removeEventListener('resize', updateQuotePosition);
    });

    if (msgInput) msgInput.focus();
}



    function clearQuote() {
        const quoteBar = document.getElementById('quoteBar');
        if (quoteBar) quoteBar.style.display = 'none';
        quotedMessage = null;
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