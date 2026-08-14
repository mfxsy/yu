// 应用启动入口

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. 初始化会话（确保 SESSION_ID 永不丢失）
        const sessionId = await window.sessionManager.initializeSession();
        window.SESSION_ID = sessionId;
        console.log('[app] 已获取会话ID:', window.SESSION_ID);

        // 2. ★ 核心修改：将多个状态加载改为“并行容错加载”
        // 使用 Promise.allSettled，即使某一个读取超时，也不会阻塞其他读取
        const loadPromises = [
            window.frequencyManager ? window.frequencyManager.load() : Promise.resolve(),
            window.quoteManager && typeof window.quoteManager.loadSettings === 'function' ? window.quoteManager.loadSettings() : Promise.resolve(),
            loadTimestampSetting(),
            loadNoReplySetting(),
            loadNotificationSetting()
        ];
        await Promise.allSettled(loadPromises);

        // 3. 加载数据（使用安全存储）——单独处理
        const hasData = await loadMessages();
        if (!hasData) {
            window.messages = [];
            // ★ 注意：这里绝对不能写 await saveMessages()，以防覆盖掉旧数据
        }

        // 4. 刷新各管理器（同样用并行，防止阻塞）
        const reloadPromises = [
            window.avatarManager && typeof window.avatarManager.reload === 'function' ? window.avatarManager.reload() : Promise.resolve(),
            window.emojiManager && typeof window.emojiManager.reload === 'function' ? window.emojiManager.reload() : Promise.resolve(),
            window.cardManager && typeof window.cardManager.reload === 'function' ? window.cardManager.reload() : Promise.resolve(),
            window.callManager && typeof window.callManager.checkCallInterruption === 'function' ? window.callManager.checkCallInterruption() : Promise.resolve()
        ];
        await Promise.allSettled(reloadPromises);

        // 5. 应用主题
        if (window.isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            DOM.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }

        // 6. 更新界面
        DOM.contactName.textContent = window.partnerName;
        renderMessages();

        // 7. 启动主动发送定时器
        if (window.frequencyManager) {
            window.frequencyManager.startActiveTimer(() => {
                window.triggerReply(true);
            });
        }

        // 8. 绑定所有事件
        setupEventListeners();

        // 9. 更新底部留白
        updateChatPadding();

        // 10. 键盘滚动优化
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

        // 11. 定时保存与页面退出保存
        setInterval(() => saveMessages(), 30000);
        window.addEventListener('beforeunload', () => saveMessages());

        // 12. 聚焦输入框
        DOM.msgInput.focus();

        console.log('✅ 应用启动完成，会话ID:', window.SESSION_ID);

    } catch (e) {
        console.error('严重初始化错误，但应用仍可降级运行', e);
        renderMessages();
        showToast('启动时遇到问题，但基本功能可用', 'warning', 4000);
    }
});