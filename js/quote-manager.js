// js/quote-manager.js
(function() {
    'use strict';

    // 引用状态
    let isQuoteEnabled = false;
    let quotedMessage = null;
    let chatArea = null;

    // ★ 使用全局安全存储与防御性键生成，并增加 localStorage 备用
    async function loadSettings() {
        let data = null;
        try {
            const key = getStorageKey('quoteSettings');
            data = await safeGetItem(key);
        } catch (e) {}

        if (!data || typeof data.enabled !== 'boolean') {
            try {
                const raw = localStorage.getItem('quoteSettings_fallback');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (typeof parsed.enabled === 'boolean') {
                        data = parsed;
                        console.warn('[quote] 从 localStorage 恢复设置');
                    }
                }
            } catch (e) {}
        }

        isQuoteEnabled = data?.enabled ?? false;
        await saveSettings();
        console.log('[引用] 加载成功:', isQuoteEnabled);
    }

    async function saveSettings() {
        try {
            const key = getStorageKey('quoteSettings');
            await safeSetItem(key, { enabled: isQuoteEnabled });
        } catch (e) { console.warn('保存引用设置失败:', e); }
        try {
            localStorage.setItem('quoteSettings_fallback', JSON.stringify({ enabled: isQuoteEnabled }));
        } catch (e) {}
    }

    async function setEnabled(val) {
        isQuoteEnabled = !!val;
        await saveSettings();
        document.dispatchEvent(new CustomEvent('quoteSettingsChanged', { 
            detail: { enabled: isQuoteEnabled } 
        }));
    }

    function getEnabled() { return isQuoteEnabled; }

    // ---------- 双击触发引用（取代之前的单击按钮） ----------
    function initDoubleClickQuote(container) {
        chatArea = container;
        // 事件监听由 listeners.js 统一处理
    }

    // ---------- 显示引用UI（顶部预览栏） ----------
    function showQuote(quotedMsg) {
        if (!quotedMsg) return;
        quotedMessage = quotedMsg;
        let quoteBar = document.getElementById('quoteBar');
        if (!quoteBar) {
            quoteBar = document.createElement('div');
            quoteBar.id = 'quoteBar';
            const inputBar = document.getElementById('inputBar');
            if (inputBar) inputBar.appendChild(quoteBar); 
        }
        const sender = quotedMsg.sender === 'me' ? '我' : '对方';
        
        // 支持图片和文字混合预览
        let contentHtml = '';
        if (quotedMsg.image) {
            contentHtml = `<img src="${quotedMsg.image}" style="max-width:40px;max-height:40px;border-radius:4px;vertical-align:middle;margin-right:4px;" />`;
            if (quotedMsg.text) contentHtml += `<span style="vertical-align:middle;">${quotedMsg.text}</span>`;
        } else {
            contentHtml = quotedMsg.text || '';
        }

        if (quoteBar) {
            quoteBar.innerHTML = `
                <span style="display:flex;align-items:center;gap:4px;flex:1;overflow:hidden;">
                    <span style="font-weight:500;flex-shrink:0;">${sender}：</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${contentHtml}</span>
                </span>
                <button id="clearQuoteBtn" style="background:none;border:none;color:var(--wechat-text-secondary);cursor:pointer;font-size:14px;flex-shrink:0;"><i class="fas fa-times"></i></button>
            `;
            quoteBar.style.display = 'flex';
            document.getElementById('clearQuoteBtn').addEventListener('click', function() {
                clearQuote();
            });
        }
        if (DOM.msgInput) DOM.msgInput.focus();

        // 更新聊天区域底部间距
        if (typeof window.updateChatPadding === 'function') {
            window.updateChatPadding();
        }
    }

    function clearQuote() {
        const quoteBar = document.getElementById('quoteBar');
        if (quoteBar) quoteBar.style.display = 'none';
        quotedMessage = null;

        // 恢复聊天区域底部间距
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
        initDoubleClickQuote,  // 改为双击初始化
        showQuote,            // 直接暴露引用触发方法
        clearQuote,
        getQuotedMessage,
        loadSettings,
    };

    console.log('✅ quoteManager 已加载，改为双击直接触发引用');
})();