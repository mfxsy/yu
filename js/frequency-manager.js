// js/frequency-manager.js（完整扩展版）
(function() {
    'use strict';

    const DEFAULTS = {
        replyMin: 1,
        replyMax: 30,
        activeEnabled: false,
        activeInterval: 5,
        mergeEmoji: false,
        mergeCards: false,
    };

    let settings = { ...DEFAULTS };
    let activeTimer = null;
    let loadAttempts = 0;
    const MAX_LOAD_ATTEMPTS = 3;

    function getKey() {
        return getStorageKey('frequencySettings');
    }

    // ★ 加载设置，并严格防止错误覆盖数据
    async function loadSettings() {
        loadAttempts++;
        try {
            const key = getKey();
            console.log(`[频率] 尝试加载 (${loadAttempts})，键:`, key);
            const data = await safeGetItem(key);

            const isValid = data && typeof data === 'object' && Object.keys(data).length > 0;

            if (isValid) {
                settings = { ...DEFAULTS, ...data };
                console.log('[频率] 加载成功:', settings);
                loadAttempts = 0;
                return true;
            } else {
                console.warn('[频率] 主存储数据无效或不存在，尝试从 localStorage 备用恢复...');
                const restored = restoreFromLocalStorage();
                if (restored) {
                    console.log('[频率] 从 localStorage 恢复成功');
                    try {
                        await safeSetItem(key, settings);
                    } catch (e) {
                        console.warn('[频率] 写回主存储失败，但不影响使用');
                    }
                } else {
                    console.warn('[频率] 无备用数据，使用默认值');
                    settings = { ...DEFAULTS };
                }
                loadAttempts = 0;
                return true;
            }
        } catch (e) {
            console.error('[频率] 加载失败:', e);
            if (loadAttempts <= MAX_LOAD_ATTEMPTS) {
                console.log(`[频率] ${loadAttempts} 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * loadAttempts));
                return loadSettings();
            } else {
                console.error('[频率] 重试次数用尽，尝试从 localStorage 恢复');
                const restored = restoreFromLocalStorage();
                if (restored) {
                    console.log('[频率] 从 localStorage 恢复成功（重试后）');
                    loadAttempts = 0;
                    return true;
                } else {
                    settings = { ...DEFAULTS };
                    loadAttempts = 0;
                    return false;
                }
            }
        }
    }

    async function saveSettings() {
        try {
            const key = getKey();
            await safeSetItem(key, settings);
            console.log('[频率] 保存成功:', settings);
        } catch (e) {
            console.error('[频率] safeSetItem 失败:', e);
        }
        try {
            localStorage.setItem('frequencySettings_fallback', JSON.stringify(settings));
            console.log('[频率] 已保存到 localStorage 作为备用');
        } catch (lsErr) {
            console.error('[频率] localStorage 备用保存也失败:', lsErr);
        }
    }

    function restoreFromLocalStorage() {
        try {
            const raw = localStorage.getItem('frequencySettings_fallback');
            if (raw) {
                const parsed = JSON.parse(raw);
                settings = { ...DEFAULTS, ...parsed };
                return true;
            }
        } catch (e) {
            console.warn('[频率] localStorage 恢复失败:', e);
        }
        return false;
    }

    // ---------- UI渲染与事件绑定 ----------
    let uiEventsBound = false;

    function renderUI() {
        // ★ 修复：这里直接使用外层闭包的 settings 变量，不要调用不存在的 getSettings()
        console.log('[频率] 渲染面板，当前设置:', settings);

        const minSlider = document.getElementById('replyMinSlider');
        const minDisplay = document.getElementById('replyMinDisplay');
        if (minSlider) {
            minSlider.value = settings.replyMin;
            if (minDisplay) minDisplay.textContent = settings.replyMin;
        }

        const maxSlider = document.getElementById('replyMaxSlider');
        const maxDisplay = document.getElementById('replyMaxDisplay');
        if (maxSlider) {
            maxSlider.value = settings.replyMax;
            if (maxDisplay) maxDisplay.textContent = settings.replyMax;
        }

        const activeToggle = document.getElementById('activeEnabledToggle');
        if (activeToggle) {
            activeToggle.checked = settings.activeEnabled;
        }

        const intervalSlider = document.getElementById('activeIntervalSlider');
        const intervalDisplay = document.getElementById('activeIntervalDisplay');
        if (intervalSlider) {
            intervalSlider.value = settings.activeInterval;
            if (intervalDisplay) intervalDisplay.textContent = settings.activeInterval;
        }

        const mergeEmoji = document.getElementById('mergeEmojiToggle');
        if (mergeEmoji) {
            mergeEmoji.checked = settings.mergeEmoji;
        }

        const mergeCards = document.getElementById('mergeCardsToggle');
        if (mergeCards) {
            mergeCards.checked = settings.mergeCards;
        }
    }

    function bindUIEvents() {
        if (uiEventsBound) {
            console.log('[频率] UI事件已绑定，跳过');
            return;
        }
        uiEventsBound = true;
        console.log('[频率] 绑定UI事件');

        const minSlider = document.getElementById('replyMinSlider');
        const maxSlider = document.getElementById('replyMaxSlider');
        const minDisplay = document.getElementById('replyMinDisplay');
        const maxDisplay = document.getElementById('replyMaxDisplay');

        if (minSlider) {
            minSlider.addEventListener('input', function() {
                const val = parseInt(this.value);
                if (minDisplay) minDisplay.textContent = val;
                const maxVal = parseInt(maxSlider?.value || 30);
                if (val > maxVal && maxSlider) {
                    maxSlider.value = val;
                    if (maxDisplay) maxDisplay.textContent = val;
                }
                frequencyManager.updateSetting('replyMin', val);
            });
        }

        if (maxSlider) {
            maxSlider.addEventListener('input', function() {
                const val = parseInt(this.value);
                if (maxDisplay) maxDisplay.textContent = val;
                const minVal = parseInt(minSlider?.value || 1);
                if (val < minVal && minSlider) {
                    minSlider.value = val;
                    if (minDisplay) minDisplay.textContent = val;
                }
                frequencyManager.updateSetting('replyMax', val);
            });
        }

        const activeToggle = document.getElementById('activeEnabledToggle');
        if (activeToggle) {
            activeToggle.addEventListener('change', function() {
                frequencyManager.updateSetting('activeEnabled', this.checked);
                frequencyManager.restartActiveTimer(() => {
                    if (typeof window.triggerReply === 'function') {
                        window.triggerReply(true);
                    }
                });
            });
        }

        const intervalSlider = document.getElementById('activeIntervalSlider');
        const intervalDisplay = document.getElementById('activeIntervalDisplay');
        if (intervalSlider) {
            intervalSlider.addEventListener('input', function() {
                const val = parseInt(this.value);
                if (intervalDisplay) intervalDisplay.textContent = val;
                frequencyManager.updateSetting('activeInterval', val);
                frequencyManager.restartActiveTimer(() => {
                    if (typeof window.triggerReply === 'function') {
                        window.triggerReply(true);
                    }
                });
            });
        }

        const mergeEmoji = document.getElementById('mergeEmojiToggle');
        if (mergeEmoji) {
            mergeEmoji.addEventListener('change', function() {
                frequencyManager.updateSetting('mergeEmoji', this.checked);
            });
        }

        const mergeCards = document.getElementById('mergeCardsToggle');
        if (mergeCards) {
            mergeCards.addEventListener('change', function() {
                frequencyManager.updateSetting('mergeCards', this.checked);
            });
        }
    }

    function initUI() {
        renderUI();
        bindUIEvents();
        document.addEventListener('frequencySettingsChanged', function() {
            const panel = document.getElementById('frequencySettingsPanel');
            if (panel && panel.classList.contains('open')) {
                const currentSettings = window.frequencyManager.getSettings();
                const minDisplay = document.getElementById('replyMinDisplay');
                if (minDisplay) minDisplay.textContent = currentSettings.replyMin || 1;
                const maxDisplay = document.getElementById('replyMaxDisplay');
                if (maxDisplay) maxDisplay.textContent = currentSettings.replyMax || 30;
                const intervalDisplay = document.getElementById('activeIntervalDisplay');
                if (intervalDisplay) intervalDisplay.textContent = currentSettings.activeInterval || 5;
            }
        });
    }

    // ---------- 核心管理对象 ----------
    const frequencyManager = {
        getSettings: function() { return { ...settings }; },

        updateSetting: async function(key, value) {
            if (key in settings) {
                settings[key] = value;
                await saveSettings();
                if (key === 'activeEnabled' || key === 'activeInterval') {
                    this.restartActiveTimer();
                }
                document.dispatchEvent(new CustomEvent('frequencySettingsChanged', {
                    detail: { key, value }
                }));
                return true;
            }
            return false;
        },

        updateSettings: async function(newSettings) {
            let changed = false;
            for (let key in newSettings) {
                if (key in settings && settings[key] !== newSettings[key]) {
                    settings[key] = newSettings[key];
                    changed = true;
                }
            }
            if (changed) {
                await saveSettings();
                this.restartActiveTimer();
                document.dispatchEvent(new CustomEvent('frequencySettingsChanged', {
                    detail: { settings: { ...settings } }
                }));
            }
            return changed;
        },

        resetToDefault: async function() {
            settings = { ...DEFAULTS };
            await saveSettings();
            this.restartActiveTimer();
            document.dispatchEvent(new CustomEvent('frequencySettingsChanged', {
                detail: { settings: { ...settings } }
            }));
        },

        getReplyDelay: function() {
            const min = Math.max(1, settings.replyMin);
            const max = Math.min(180, settings.replyMax);
            if (min >= max) return min;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },

        mergeReplies: function(cards, emojis) {
            if (!cards || cards.length === 0) return null;
            if (settings.mergeCards) {
                if (Math.random() < 0.3) {
                    const maxCount = Math.min(5, cards.length);
                    const count = Math.floor(Math.random() * (maxCount - 1)) + 2;
                    const shuffled = [...cards];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    const selected = shuffled.slice(0, count);
                    const mergedText = selected.join('，');
                    return { text: mergedText, merged: true };
                }
            }
            if (settings.mergeEmoji && emojis && emojis.length > 0) {
                if (Math.random() < 0.3) {
                    const card = cards[Math.floor(Math.random() * cards.length)];
                    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                    const order = Math.random() < 0.5 ? [card, emoji] : [emoji, card];
                    return { text: order.join(' '), merged: true };
                }
            }
            return null;
        },

        startActiveTimer: function(callback) {
            this.stopActiveTimer();
            if (!settings.activeEnabled) return;
            const intervalMinutes = Math.max(1, Math.min(300, settings.activeInterval));
            const intervalMs = intervalMinutes * 60 * 1000;
            activeTimer = setInterval(() => {
                if (typeof callback === 'function') {
                    callback();
                }
            }, intervalMs);
            console.log(`[频率] 主动发送定时器已启动，间隔 ${intervalMinutes} 分钟`);
        },

        stopActiveTimer: function() {
            if (activeTimer) {
                clearInterval(activeTimer);
                activeTimer = null;
                console.log('[频率] 主动发送定时器已停止');
            }
        },

        restartActiveTimer: function(callback) {
            this.stopActiveTimer();
            this.startActiveTimer(callback);
        },

        load: loadSettings,
        save: saveSettings,
        getDefaults: function() { return { ...DEFAULTS }; },

        renderUI: renderUI,
        bindUIEvents: bindUIEvents,
        initUI: initUI,

        inspect: async function() {
            try {
                const key = getKey();
                const data = await safeGetItem(key);
                console.log('[频率] 存储键:', key);
                console.log('[频率] 存储值:', data);
                console.log('[频率] 当前内存 settings:', settings);
                return { key, data, settings };
            } catch (e) {
                console.error('[频率] 检查存储失败:', e);
                return null;
            }
        }
    };

    window.frequencyManager = frequencyManager;
    console.log('✅ frequencyManager 已加载，包含UI管理');
})();