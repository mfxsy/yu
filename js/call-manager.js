// js/call-manager.js
(function() {
    'use strict';

    // ---------- 状态 ----------
    const STATE = {
        IDLE: 'idle',
        CALLING: 'calling',
        INCOMING: 'incoming',
        IN_CALL: 'inCall'
    };

    let currentState = STATE.IDLE;
    let callTimer = null;
    let incomingTimer = null;
    let overlay = null;
    let floatingWindow = null;
    let isFloating = false;
    let initiator = null;
    let callStartTime = null;      // 改为存储开始时间（Date 对象）
    let callStatusEl = null;

    // ★ 新增：存储未接来电的键
    const MISSED_CALL_KEY = 'callManager_missedCall';

    // ---------- 获取昵称 ----------
    function getPartnerName() {
        return document.getElementById('contactName')?.textContent || '梦角';
    }

    function getPartnerAvatar() {
        if (window.avatarManager && typeof window.avatarManager.getPartnerAvatar === 'function') {
            return window.avatarManager.getPartnerAvatar();
        }
        return null;
    }

    // ---------- 发送普通聊天消息 ----------
    function sendChatMessage(text, sender) {
        if (typeof window.addMessage === 'function') {
            window.addMessage(text, sender, 'normal');
        } else {
            console.warn('addMessage not available');
        }
    }

    // ---------- 格式化通话时长（基于秒数） ----------
    function formatDuration(seconds) {
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        return `通话时长 ${h}:${m}:${s} ᯅ`;
    }

    // ---------- 获取当前通话秒数（基于时间戳） ----------
    function getCurrentCallSeconds() {
        if (!callStartTime) return 0;
        return Math.floor((Date.now() - callStartTime.getTime()) / 1000);
    }

    // ---------- 创建悬浮窗（不变） ----------
    function createFloatingWindow() {
        if (floatingWindow) return;
        floatingWindow = document.createElement('div');
        floatingWindow.id = 'callFloatingWindow';
        floatingWindow.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 16px;
            z-index: 9998;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(6px);
            border-radius: 30px;
            padding: 6px 12px 6px 6px;
            display: none;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            color: #fff;
            font-size: 14px;
            cursor: grab;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
            border: 1px solid rgba(255,255,255,0.15);
            min-width: 100px;
        `;

        const avatar = document.createElement('div');
        avatar.id = 'floatingAvatar';
        avatar.style.cssText = `
            width: 36px; height: 36px;
            border-radius: 50%;
            background: #2e2e2e;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: #aaa;
            flex-shrink: 0;
            overflow: hidden;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        avatar.innerHTML = '<i class="fas fa-user"></i>';
        avatar.addEventListener('click', restoreFullScreen);

        const status = document.createElement('span');
        status.id = 'floatingStatus';
        status.style.cssText = 'white-space:nowrap;font-weight:500;';

        const hangupBtn = document.createElement('button');
        hangupBtn.id = 'floatingHangup';
        hangupBtn.innerHTML = '<i class="fas fa-phone-slash"></i>';
        hangupBtn.style.cssText = `
            width: 28px; height: 28px;
            border-radius: 50%;
            border: none;
            background: #fa5151;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: transform 0.15s;
        `;
        hangupBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            handleFloatingHangup();
        });

        floatingWindow.appendChild(avatar);
        floatingWindow.appendChild(status);
        floatingWindow.appendChild(hangupBtn);
        document.body.appendChild(floatingWindow);

        // 拖动逻辑
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        function onDragStart(e) {
            if (e.target.closest('#floatingHangup') || e.target.closest('#floatingAvatar')) return;
            e.preventDefault();
            isDragging = true;
            const rect = floatingWindow.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX - startLeft;
            startY = clientY - startTop;
            floatingWindow.style.cursor = 'grabbing';
            floatingWindow.style.right = 'auto';
            floatingWindow.style.bottom = 'auto';
            floatingWindow.style.left = startLeft + 'px';
            floatingWindow.style.top = startTop + 'px';
        }

        function onDragMove(e) {
            if (!isDragging) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let left = clientX - startX;
            let top = clientY - startY;
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            const rect = floatingWindow.getBoundingClientRect();
            left = Math.max(0, Math.min(left, winWidth - rect.width));
            top = Math.max(0, Math.min(top, winHeight - rect.height));
            floatingWindow.style.left = left + 'px';
            floatingWindow.style.top = top + 'px';
        }

        function onDragEnd() {
            isDragging = false;
            floatingWindow.style.cursor = 'grab';
        }

        floatingWindow.addEventListener('mousedown', onDragStart);
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
        floatingWindow.addEventListener('touchstart', onDragStart, { passive: false });
        window.addEventListener('touchmove', onDragMove, { passive: false });
        window.addEventListener('touchend', onDragEnd, { passive: false });
    }

    // ---------- 恢复全屏 ----------
    function restoreFullScreen() {
        if (currentState === STATE.IDLE) return;
        hideFloatingWindow();
        if (overlay) {
            overlay.style.display = 'flex';
            if (currentState === STATE.CALLING) {
                renderCallScreen('calling', { name: getPartnerName() });
            } else if (currentState === STATE.INCOMING) {
                renderCallScreen('incoming', { name: getPartnerName() });
            } else if (currentState === STATE.IN_CALL) {
                renderCallScreen('inCall', { name: getPartnerName(), preserveTimer: true });
            }
            isFloating = false;
        }
    }

    // ---------- 悬浮窗更新 ----------
    function updateFloatingWindow(statusText, showTimer) {
        if (!floatingWindow) return;
        const statusEl = document.getElementById('floatingStatus');
        if (statusEl) statusEl.textContent = statusText || '通话中';
        const avatarEl = document.getElementById('floatingAvatar');
        if (avatarEl) {
            const avatarSrc = getPartnerAvatar();
            if (avatarSrc) {
                avatarEl.innerHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;" />`;
            } else {
                avatarEl.innerHTML = '<i class="fas fa-user"></i>';
            }
        }
        floatingWindow.style.display = 'flex';
        isFloating = true;
        if (showTimer) updateFloatingTimer();
    }

    function hideFloatingWindow() {
        if (floatingWindow) {
            floatingWindow.style.display = 'none';
            isFloating = false;
        }
    }

    function updateFloatingTimer() {
        if (!isFloating || currentState !== STATE.IN_CALL) return;
        const statusEl = document.getElementById('floatingStatus');
        if (statusEl) {
            const secs = getCurrentCallSeconds();
            const mins = String(Math.floor(secs / 60)).padStart(2, '0');
            const secsStr = String(secs % 60).padStart(2, '0');
            statusEl.textContent = `通话中 ${mins}:${secsStr}`;
        }
    }

    function shrinkCall() {
        if (currentState === STATE.IDLE) return;
        if (overlay) overlay.style.display = 'none';
        let statusText = '';
        let showTimer = false;
        if (currentState === STATE.CALLING) {
            statusText = '呼叫中...';
        } else if (currentState === STATE.INCOMING) {
            statusText = '来电...';
        } else if (currentState === STATE.IN_CALL) {
            statusText = '通话中';
            showTimer = true;
        }
        updateFloatingWindow(statusText, showTimer);
        if (showTimer) updateFloatingTimer();
    }

    function handleFloatingHangup() {
        if (currentState === STATE.IDLE) return;
        if (currentState === STATE.IN_CALL) {
            handleCallEndByMe();
        } else {
            handleCallRejected('me');
        }
    }

    // ---------- 创建/显示通话界面 ----------
    function createOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'callOverlay';
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.85);
            display:none;
            flex-direction:column;
            align-items:center;
            justify-content:space-between;
            color:#fff;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
            backdrop-filter:blur(10px);
            padding: 40px 20px 60px;
            box-sizing:border-box;
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function showOverlay() {
        createOverlay().style.display = 'flex';
        hideFloatingWindow();
        isFloating = false;
    }

    function hideOverlay() {
        if (overlay) {
            overlay.style.display = 'none';
            overlay.innerHTML = '';
        }
    }

    // ---------- 按钮创建 ----------
    function createButton(iconClass, bgColor, onClick) {
        const btn = document.createElement('button');
        btn.innerHTML = `<i class="fas ${iconClass}"></i>`;
        btn.style.cssText = `
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: none;
            background: ${bgColor};
            color: #fff;
            font-size: 28px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: transform 0.2s, box-shadow 0.2s;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            outline: none;
        `;
        btn.addEventListener('click', onClick);
        btn.addEventListener('touchstart', function() { this.style.transform = 'scale(0.92)'; });
        btn.addEventListener('touchend', function() { this.style.transform = 'scale(1)'; });
        return btn;
    }

    // ---------- 渲染通话界面 ----------
    function renderCallScreen(type, data) {
        const ov = createOverlay();
        ov.innerHTML = '';

        const shrinkBtn = document.createElement('div');
        shrinkBtn.style.cssText = `
            align-self: flex-end;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255,255,255,0.15);
            backdrop-filter: blur(4px);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            flex-shrink: 0;
        `;
        shrinkBtn.addEventListener('click', shrinkCall);
        const bar = document.createElement('span');
        bar.style.cssText = `display:block;width:18px;height:2px;background:#fff;border-radius:1px;`;
        shrinkBtn.appendChild(bar);
        ov.appendChild(shrinkBtn);

        const center = document.createElement('div');
        center.style.cssText = `
            flex:1;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            text-align:center;
            width:100%;
            max-width:400px;
            margin: 0 auto;
        `;

        const avatar = document.createElement('div');
        avatar.style.cssText = `
            width:80px; height:80px;
            border-radius:50%;
            background:#2e2e2e;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:36px;
            color:#888;
            margin-bottom:16px;
            border:2px solid #555;
            overflow:hidden;
        `;
        const avatarSrc = getPartnerAvatar();
        if (avatarSrc) {
            avatar.innerHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;" />`;
        } else {
            avatar.innerHTML = '<i class="fas fa-user"></i>';
        }

        const name = document.createElement('div');
        name.style.cssText = 'font-size:20px;font-weight:500;margin-bottom:8px;';
        name.textContent = data.name || getPartnerName();

        const status = document.createElement('div');
        status.style.cssText = 'font-size:14px;color:#aaa;margin-bottom:0;';

        center.appendChild(avatar);
        center.appendChild(name);
        center.appendChild(status);

        const bottom = document.createElement('div');
        bottom.style.cssText = `
            width:100%;
            max-width:400px;
            display:flex;
            justify-content:center;
            gap:80px;
            padding-bottom: 20px;
            flex-shrink:0;
        `;

        if (type === 'calling') {
            status.textContent = '正在呼叫…';
            const hangupBtn = createButton('fa-phone-slash', '#fa5151', () => handleCallRejected('me'));
            bottom.appendChild(hangupBtn);
        } else if (type === 'incoming') {
            status.textContent = '邀请你通话';
            const rejectBtn = createButton('fa-phone-slash', '#fa5151', () => handleCallRejected('me'));
            const answerBtn = createButton('fa-phone', '#07c160', handleIncomingAnswer);
            bottom.appendChild(rejectBtn);
            bottom.appendChild(answerBtn);
        } else if (type === 'inCall') {
            status.textContent = '00:00';
            const hangupBtn = createButton('fa-phone-slash', '#fa5151', handleCallEndByMe);
            bottom.appendChild(hangupBtn);
            callStatusEl = status;
            if (!data?.preserveTimer) {
                startCallTimer();
            } else {
                updateCallStatusDisplay();
            }
        }

        ov.appendChild(center);
        ov.appendChild(bottom);
    }

    function startCallTimer() {
        stopCallTimer();
        callStartTime = new Date();
        updateCallStatusDisplay();
        updateFloatingTimer();
        callTimer = setInterval(() => {
            updateCallStatusDisplay();
            updateFloatingTimer();
        }, 1000);
    }

    function updateCallStatusDisplay() {
        if (callStatusEl) {
            const secs = getCurrentCallSeconds();
            const mins = String(Math.floor(secs / 60)).padStart(2, '0');
            const secsStr = String(secs % 60).padStart(2, '0');
            callStatusEl.textContent = mins + ':' + secsStr;
        }
    }

    function stopCallTimer() {
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
    }

    // ---------- 操作处理 ----------
    function startCall() {
        if (currentState !== STATE.IDLE) return;
        currentState = STATE.CALLING;
        initiator = 'me';
        callStartTime = null;
        showOverlay();
        renderCallScreen('calling', { name: getPartnerName() });

        const delay = 1000 + Math.random() * 9000;
        setTimeout(() => {
            if (currentState !== STATE.CALLING) return;
            const answered = Math.random() < 0.5;
            if (answered) {
                currentState = STATE.IN_CALL;
                callStartTime = new Date();
                renderCallScreen('inCall', { name: getPartnerName() });
                if (isFloating) updateFloatingWindow('通话中', true);
            } else {
                sendChatMessage('对方暂时无法接听ᯅ ', 'me');
                endCall();
            }
        }, delay);
    }

    function handleCallRejected(who) {
        if (currentState === STATE.IDLE) return;
        if (who === 'me') {
            if (currentState === STATE.CALLING) {
                sendChatMessage('已取消ᯅ', 'me');
            } else if (currentState === STATE.INCOMING) {
                sendChatMessage('对方暂时无法接听ᯅ ', 'system'); // 改为 system 防止误触通知
            }
        }
        endCall();
    }

    function handleIncomingAnswer() {
        if (currentState !== STATE.INCOMING) return;
        // ★ 接听后必须清除未接记录
        localforage.removeItem(MISSED_CALL_KEY);
        currentState = STATE.IN_CALL;
        callStartTime = new Date();
        initiator = 'partner';
        renderCallScreen('inCall', { name: getPartnerName() });
        if (isFloating) updateFloatingWindow('通话中', true);
    }

    function handleCallEndByMe() {
        if (currentState !== STATE.IN_CALL) return;
        if (callStartTime) {
            const duration = getCurrentCallSeconds();
            sendChatMessage(formatDuration(duration), initiator || 'me');
        }
        endCall();
    }

    function endCall() {
        stopCallTimer();
        currentState = STATE.IDLE;
        hideOverlay();
        hideFloatingWindow();
        callStartTime = null;
        initiator = null;
        callStatusEl = null;
        if (incomingTimer) {
            clearTimeout(incomingTimer);
            incomingTimer = null;
        }
        startIncomingTimer();
    }

    // ---------- 对方来电 ----------
    function startIncomingTimer() {
        if (incomingTimer) {
            clearTimeout(incomingTimer);
            incomingTimer = null;
        }
        scheduleNextIncoming();
    }

    function scheduleNextIncoming() {
        const minInterval = 15 * 60 * 1000;
        const maxInterval = 60 * 60 * 1000;
        const delay = minInterval + Math.random() * (maxInterval - minInterval);
        incomingTimer = setTimeout(() => {
            if (currentState === STATE.IDLE && Math.random() < 0.3) {
                triggerIncomingCall();
            }
            scheduleNextIncoming();
        }, delay);
    }

    // ★ 修改：新增时间戳持久化存储
    function triggerIncomingCall() {
        if (currentState !== STATE.IDLE) return;
        
        // 记录进存储：精确的发起时间和未来的超时时间点
        const startTime = Date.now();
        localforage.setItem(MISSED_CALL_KEY, {
            startTime: startTime,
            timeoutAt: startTime + 20000 // 20秒
        });

        currentState = STATE.INCOMING;
        initiator = 'partner';
        callStartTime = null;
        showOverlay();
        renderCallScreen('incoming', { name: getPartnerName() });

        setTimeout(() => {
            if (currentState === STATE.INCOMING) {
                // ★ 未接，改为 system 发送者，避免触发通知
                sendChatMessage('对方暂时无法接听ᯅ ', 'system');
                localforage.removeItem(MISSED_CALL_KEY);
                endCall();
            }
        }, 20000);
    }

    // ★ 新增：页面加载时检查是否有未接来电记录
    async function checkForMissedCall() {
        const missed = await localforage.getItem(MISSED_CALL_KEY);
        if (!missed) return;

        const now = Date.now();

        if (now >= missed.timeoutAt) {
            // 已超时，将历史未接来电推入消息列表
            window.lastMsgId = (window.lastMsgId || 0) + 1;
            const msg = {
                id: window.lastMsgId,
                sender: 'system',
                text: '未接来电 ᯅ',
                image: null,
                time: new Date(missed.startTime), // ✅ 修正为真实发起时间
                read: true,
                type: 'system'
            };
            window.messages.push(msg);
            
            // 优先使用增量追加（防止闪烁），否则回退到重绘
            if (typeof window.appendMessageDOM === 'function') {
                window.appendMessageDOM(msg);
            } else {
                window.renderMessages();
            }
            if (typeof window.saveMessages === 'function') window.saveMessages();
            await localforage.removeItem(MISSED_CALL_KEY);
        } else {
            // 如果在 20 秒内恰好打开了网页，就等剩下的时间再判定
            const remaining = missed.timeoutAt - now;
            setTimeout(async () => {
                const stillMissed = await localforage.getItem(MISSED_CALL_KEY);
                if (stillMissed) {
                    // 重复上面的发送逻辑
                    window.lastMsgId = (window.lastMsgId || 0) + 1;
                    const msg = {
                        id: window.lastMsgId,
                        sender: 'system',
                        text: '未接来电 ᯅ',
                        image: null,
                        time: new Date(stillMissed.startTime),
                        read: true,
                        type: 'system'
                    };
                    window.messages.push(msg);
                    if (typeof window.appendMessageDOM === 'function') {
                        window.appendMessageDOM(msg);
                    } else {
                        window.renderMessages();
                    }
                    if (typeof window.saveMessages === 'function') window.saveMessages();
                    await localforage.removeItem(MISSED_CALL_KEY);
                }
            }, remaining);
        }
    }

    // ---------- 初始化 ----------
    function init() {
        const callBtn = document.getElementById('callBtn');
        if (callBtn) {
            callBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (currentState === STATE.IDLE) startCall();
            });
        }

        createFloatingWindow();
        startIncomingTimer();

        // ★ 在页面启动时立即检查未接来电记录
        checkForMissedCall();

        console.log('📞 通话功能已加载（带后台未接来电持久化记录修复）');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.callManager = {
        endCall: endCall,
        getState: () => currentState
    };
})();