// 应用启动入口

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. 初始化会话（必须等待）
        const sessionId = await window.sessionManager.initializeSession();
        window.SESSION_ID = sessionId;
        console.log('[app] 已获取会话ID:', window.SESSION_ID);

        // 2. 应用主题（先快速应用）
        if (window.isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            DOM.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }

        // 3. ★ 核心：先立刻绑定按钮事件 + 渲染界面骨架，不让用户白等！
        setupEventListeners();
        DOM.contactName.textContent = window.partnerName || '梦角';
        updateChatPadding();
        renderMessages(); // 第一次渲染（此时可能为空）
        DOM.msgInput.focus();

        // 4. 键盘滚动优化（立即执行）
        let prevInnerHeight = window.innerHeight;
        window.addEventListener('resize', function() {
            if (window.innerHeight > prevInnerHeight) {
                requestAnimationFrame(() => {
                    updateChatPadding();
                    scrollToBottom();
                });
            }
            prevInnerHeight = window.innerHeight;
        });
        if (window.visualViewport) {
            let prevViewportHeight = window.visualViewport.height;
            window.visualViewport.addEventListener('resize', function() {
                const currentHeight = window.visualViewport.height;
                if (currentHeight > prevViewportHeight) {
                    requestAnimationFrame(() => {
                        updateChatPadding();
                        scrollToBottom();
                    });
                }
                prevViewportHeight = currentHeight;
            });
        }

        // 5. ★ 核心：将“所有数据加载”放到后台偷偷执行，绝不阻塞界面
        setTimeout(async () => {
            try {
                const loadPromises = [
                    window.frequencyManager ? window.frequencyManager.load() : Promise.resolve(),
                    window.quoteManager && typeof window.quoteManager.loadSettings === 'function' ? window.quoteManager.loadSettings() : Promise.resolve(),
                    loadTimestampSetting(),
                    loadNoReplySetting(),
                    loadNotificationSetting()
                ];
                await Promise.allSettled(loadPromises);

                const hasData = await loadMessages();
                if (!hasData) {
                    window.messages = []; // 只清内存，不覆盖存储
                }

                const reloadPromises = [
                    window.avatarManager && typeof window.avatarManager.reload === 'function' ? window.avatarManager.reload() : Promise.resolve(),
                    window.emojiManager && typeof window.emojiManager.reload === 'function' ? window.emojiManager.reload() : Promise.resolve(),
                    window.cardManager && typeof window.cardManager.reload === 'function' ? window.cardManager.reload() : Promise.resolve(),
                    window.callManager && typeof window.callManager.checkCallInterruption === 'function' ? window.callManager.checkCallInterruption() : Promise.resolve()
                ];
                await Promise.allSettled(reloadPromises);

                // 数据加载完了，刷新界面
                DOM.contactName.textContent = window.partnerName;
                renderMessages();

                if (window.frequencyManager) {
                    window.frequencyManager.startActiveTimer(() => {
                        window.triggerReply(true);
                    });
                }
            } catch (loadErr) {
                console.warn('后台加载数据时遇到非致命错误', loadErr);
            }
        }, 0); // 0ms 延时，让浏览器主线程优先把界面画出来

        // 6. 定时保存与页面退出保存
        setInterval(() => saveMessages(), 30000);
        window.addEventListener('beforeunload', () => saveMessages());

        console.log('✅ 应用启动完成（界面已优先渲染），会话ID:', window.SESSION_ID);

    } catch (e) {
        console.error('严重初始化错误，但应用仍可降级运行', e);
        renderMessages();
        showToast('启动时遇到问题，但基本功能可用', 'warning', 4000);
    }
});