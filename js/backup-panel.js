// js/backup-panel.js
(function() {
    'use strict';

    // 兼容 window.APP_PREFIX，如果未定义则使用默认值
    const APP_PREFIX = window.APP_PREFIX || 'CHAT_APP_V3_';

    // ===== 存储信息更新 =====
    async function updateStorageInfo() {
        const usedEl = document.getElementById('usedStorage');
        const totalEl = document.getElementById('totalStorage');
        if (!usedEl || !totalEl) return;
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const used = estimate.usage || 0;
                const quota = estimate.quota || 0;
                usedEl.textContent = (used / (1024 * 1024)).toFixed(2) + ' MB';
                totalEl.textContent = (quota / (1024 * 1024)).toFixed(2) + ' MB';
            } else {
                usedEl.textContent = '不支持';
                totalEl.textContent = '不支持';
            }
        } catch (e) {
            usedEl.textContent = '无法获取';
            totalEl.textContent = '无法获取';
        }
    }

    // ===== 全量备份导出 =====
    async function exportFullBackup() {
        try {
            const cardData = window.cardManager ? window.cardManager.exportData() : {};
            const emojiData = window.emojiManager ? window.emojiManager.exportData() : {};
            const avatarData = window.avatarManager ? window.avatarManager.exportData() : {};
            const fullData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                sessionId: window.SESSION_ID,
                messages: window.messages,
                partnerName: window.partnerName,
                myName: window.myName,
                isDark: window.isDark,
                lastMsgId: window.lastMsgId,
                cards: cardData,
                emojis: emojiData,
                avatars: avatarData
            };
            const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `full-backup-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (typeof window.showToast === 'function') window.showToast('全量备份导出成功', 'success');
        } catch (e) {
            if (typeof window.showToast === 'function') window.showToast('导出失败: ' + e.message, 'error');
            console.error(e);
        }
    }

    // ===== 全量备份导入 =====
    async function importFullBackup(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.sessionId || !data.messages) {
                throw new Error('无效的备份文件');
            }
            if (!confirm('导入将覆盖当前所有数据，确定继续吗？')) return;

            window.messages = data.messages || [];
            window.partnerName = data.partnerName || '梦角';
            window.myName = data.myName || '我';
            window.isDark = data.isDark || false;
            window.lastMsgId = data.lastMsgId || 0;
            
            // 调用主程序的全局保存函数
            if (typeof window.saveMessages === 'function') window.saveMessages();
            else if (typeof localStorage !== 'undefined') {
                // 降级手动保存
                try {
                    const key = `${APP_PREFIX}${window.SESSION_ID}_chatData`;
                    const saveData = { messages: window.messages.slice(-500), partnerName: window.partnerName, myName: window.myName, isDark: window.isDark, lastMsgId: window.lastMsgId };
                    await localforage.setItem(key, saveData);
                } catch(e){}
            }

            if (data.cards && window.cardManager) {
                await window.cardManager.importData(data.cards, 'overwrite');
            }
            if (data.emojis && window.emojiManager) {
                await window.emojiManager.importData(data.emojis, 'overwrite');
            }
            if (data.avatars && window.avatarManager) {
                await window.avatarManager.importData(data.avatars, 'overwrite');
            }

            if (window.isDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.documentElement.removeAttribute('data-theme');
                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }

            const contactName = document.getElementById('contactName');
            if (contactName) contactName.textContent = window.partnerName;
            
            if (typeof window.renderMessages === 'function') window.renderMessages();
            if (window.cardManager && typeof window.cardManager.reload === 'function') window.cardManager.reload();
            if (window.emojiManager && typeof window.emojiManager.reload === 'function') window.emojiManager.reload();
            if (window.avatarManager && typeof window.avatarManager.reload === 'function') window.avatarManager.reload();
            if (typeof window.showToast === 'function') window.showToast('全量导入成功', 'success');
        } catch (e) {
            if (typeof window.showToast === 'function') window.showToast('导入失败: ' + e.message, 'error');
            console.error(e);
        }
    }

    // ===== 导出单独模块 =====
    function exportSingleModule(moduleType) {
        let data = {};
        let fileName = '';
        switch (moduleType) {
            case 'messages':
                data = { messages: window.messages, partnerName: window.partnerName, myName: window.myName, isDark: window.isDark, lastMsgId: window.lastMsgId };
                fileName = 'chat-messages.json';
                break;
            case 'cards':
                data = window.cardManager ? window.cardManager.exportData() : {};
                fileName = 'cards.json';
                break;
            case 'emojis':
                data = window.emojiManager ? window.emojiManager.exportData() : {};
                fileName = 'emojis.json';
                break;
            case 'textEmojis':
                data = window.cardManager ? { textEmojis: window.cardManager.getTextEmojis() } : {};
                fileName = 'text-emojis.json';
                break;
            case 'avatar':
                // ★ 整合头像/背景和双方昵称导出
                const avatarData = window.avatarManager ? window.avatarManager.exportData() : {};
                data = {
                    avatar: avatarData,
                    partnerName: (typeof window.getPartnerName === 'function') ? window.getPartnerName() : '梦角',
                    myName: (typeof window.getMyName === 'function') ? window.getMyName() : '我'
                };
                fileName = 'avatar-backup.json';
                break;
            default: return;
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof window.showToast === 'function') window.showToast(`导出 ${moduleType} 成功`, 'success');
    }

    // ===== 单独导入功能 =====
    async function importSingleModule(moduleType, data, mode) {
        try {
            let result;
            switch (moduleType) {
                case 'messages':
                    if (!data.messages) throw new Error('无效的聊天记录文件');
                    if (mode === 'overwrite') {
                        window.messages = data.messages;
                        window.partnerName = data.partnerName || '梦角';
                        window.myName = data.myName || '我';
                        window.isDark = data.isDark || false;
                        window.lastMsgId = data.lastMsgId || 0;
                    } else {
                        window.messages = window.messages.concat(data.messages || []);
                        if (data.lastMsgId && data.lastMsgId > window.lastMsgId) window.lastMsgId = data.lastMsgId;
                        if (data.partnerName) window.partnerName = data.partnerName;
                        if (data.myName) window.myName = data.myName;
                        if (data.isDark !== undefined) window.isDark = data.isDark;
                    }
                    if (typeof window.saveMessages === 'function') window.saveMessages();
                    const contactName = document.getElementById('contactName');
                    if (contactName) contactName.textContent = window.partnerName;
                    if (typeof window.renderMessages === 'function') window.renderMessages();
                    if (typeof window.showToast === 'function') window.showToast('聊天记录导入成功', 'success');
                    break;

                case 'cards':
                    if (!window.cardManager) return;
                    try {
                        const added = await window.cardManager.importFromJson(data, 'cards', mode);
                        if (added > 0) {
                            await window.cardManager.reload();
                            if (typeof window.showToast === 'function') window.showToast(`成功导入 ${added} 条字卡${mode === 'overwrite' ? '（覆盖）' : '（合并）'}`, 'success');
                        } else {
                            if (typeof window.showToast === 'function') window.showToast('没有新字卡可导入（可能已存在）', 'warning');
                        }
                    } catch (err) {
                        if (typeof window.showToast === 'function') window.showToast('导入失败: ' + err.message, 'error');
                    }
                    break;

                case 'textEmojis':
                    if (!window.cardManager) return;
                    try {
                        const added = await window.cardManager.importFromJson(data, 'emojis', mode);
                        if (added > 0) {
                            await window.cardManager.reload();
                            if (typeof window.showToast === 'function') window.showToast(`成功导入 ${added} 条 Emoji${mode === 'overwrite' ? '（覆盖）' : '（合并）'}`, 'success');
                        } else {
                            if (typeof window.showToast === 'function') window.showToast('没有新 Emoji 可导入（可能已存在）', 'warning');
                        }
                    } catch (err) {
                        if (typeof window.showToast === 'function') window.showToast('导入失败: ' + err.message, 'error');
                    }
                    break;

                case 'emojis':
                    if (!window.emojiManager) return;
                    result = await window.emojiManager.importData(data, mode);
                    if (result.success) {
                        await window.emojiManager.reload();
                        if (typeof window.showToast === 'function') window.showToast('表情包导入成功', 'success');
                    } else if (typeof window.showToast === 'function') window.showToast(result.message, 'error');
                    break;

                case 'avatar':
                    // ★ 整合导入头像/背景以及双方昵称
                    let reloadNeeded = false;
                    // 1. 处理头像和背景数据
                    if (data.avatar && window.avatarManager) {
                        await window.avatarManager.importData(data.avatar, mode);
                        if (typeof window.avatarManager.reload === 'function') await window.avatarManager.reload();
                        reloadNeeded = true;
                    } else if (!data.avatar && (data.myAvatar !== undefined || data.partnerAvatar !== undefined) && window.avatarManager) {
                        // 兼容旧版直接在根部的格式
                        await window.avatarManager.importData(data, mode);
                        if (typeof window.avatarManager.reload === 'function') await window.avatarManager.reload();
                        reloadNeeded = true;
                    }

                    // 2. 处理昵称数据
                    if (data.partnerName && typeof window.setPartnerName === 'function') {
                        window.setPartnerName(data.partnerName);
                        reloadNeeded = true;
                    }
                    if (data.myName && typeof window.setMyName === 'function') {
                        window.setMyName(data.myName);
                        reloadNeeded = true;
                    }

                    // 3. 保存并刷新UI
                    if (reloadNeeded) {
                        if (typeof window.saveMessages === 'function') await window.saveMessages();
                        const contactName = document.getElementById('contactName');
                        if (contactName && typeof window.getPartnerName === 'function') {
                            contactName.textContent = window.getPartnerName();
                        }
                        if (typeof window.renderMessages === 'function') window.renderMessages();
                        if (typeof window.showToast === 'function') window.showToast('头像、背景及昵称恢复成功', 'success');
                    } else {
                        if (typeof window.showToast === 'function') window.showToast('未找到有效的头像/背景或昵称数据', 'warning');
                    }
                    break;

                default: if (typeof window.showToast === 'function') window.showToast('未知模块', 'error');
            }
        } catch (err) {
            if (typeof window.showToast === 'function') window.showToast('导入失败: ' + err.message, 'error');
            console.error(err);
        }
    }

    // ===== 选择导入模式弹窗 =====
    function showImportModeDialog(moduleType, data) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);
            display:flex; align-items:center; justify-content:center;
        `;
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:var(--wechat-bg); border-radius:16px; padding:20px;
            width:90%; max-width:320px; box-shadow:0 8px 30px rgba(0,0,0,0.3);
        `;
        const title = document.createElement('h3');
        title.textContent = '选择导入模式';
        title.style.cssText = 'margin-bottom:12px; font-size:17px; text-align:center;';
        dialog.appendChild(title);

        const desc = document.createElement('p');
        desc.textContent = '合并：追加到已有数据；覆盖：替换已有数据。';
        desc.style.cssText = 'font-size:13px; color:var(--wechat-text-secondary); margin-bottom:16px; text-align:center;';
        dialog.appendChild(desc);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex; gap:12px;';

        const mergeBtn = document.createElement('button');
        mergeBtn.textContent = '合并';
        mergeBtn.style.cssText = 'flex:1; padding:10px; border-radius:8px; border:none; background:var(--wechat-green); color:#fff; font-weight:600; cursor:pointer;';
        mergeBtn.addEventListener('click', function() {
            overlay.remove();
            importSingleModule(moduleType, data, 'merge');
        });

        const overwriteBtn = document.createElement('button');
        overwriteBtn.textContent = '覆盖';
        overwriteBtn.style.cssText = 'flex:1; padding:10px; border-radius:8px; border:none; background:#fa5151; color:#fff; font-weight:600; cursor:pointer;';
        overwriteBtn.addEventListener('click', function() {
            overlay.remove();
            importSingleModule(moduleType, data, 'overwrite');
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'flex:0 0 auto; padding:10px 16px; border-radius:8px; border:1px solid var(--wechat-border); background:none; cursor:pointer;';
        cancelBtn.addEventListener('click', function() {
            overlay.remove();
        });

        btnGroup.appendChild(mergeBtn);
        btnGroup.appendChild(overwriteBtn);
        btnGroup.appendChild(cancelBtn);
        dialog.appendChild(btnGroup);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    // ===== 独立模块操作弹窗 =====
    function showModuleAction(moduleType) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);
            display:flex; align-items:center; justify-content:center;
        `;
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:var(--wechat-bg); border-radius:16px; padding:20px;
            width:90%; max-width:320px; box-shadow:0 8px 30px rgba(0,0,0,0.3);
        `;
        const title = document.createElement('h3');
        const moduleLabels = {
            messages: '聊天记录',
            cards: '字卡（含分组）',
            emojis: '表情包',
            textEmojis: 'Emoji',
            avatar: '头像&背景&昵称'
        };
        title.textContent = moduleLabels[moduleType] || moduleType;
        title.style.cssText = 'margin-bottom:12px; font-size:17px; text-align:center;';
        dialog.appendChild(title);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex; gap:12px;';

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '导出';
        exportBtn.style.cssText = 'flex:1; padding:10px; border-radius:8px; border:none; background:var(--wechat-green); color:#fff; font-weight:600; cursor:pointer;';
        exportBtn.addEventListener('click', function() {
            overlay.remove();
            exportSingleModule(moduleType);
        });

        const importBtn = document.createElement('button');
        importBtn.textContent = '导入';
        importBtn.style.cssText = 'flex:1; padding:10px; border-radius:8px; border:none; background:var(--wechat-border); color:var(--wechat-text-primary); font-weight:600; cursor:pointer;';
        importBtn.addEventListener('click', function() {
            overlay.remove();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                if (!e.target.files[0]) return;
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(ev) {
                    try {
                        const data = JSON.parse(ev.target.result);
                        showImportModeDialog(moduleType, data);
                    } catch (err) {
                        if (typeof window.showToast === 'function') window.showToast('文件格式错误: ' + err.message, 'error');
                    }
                };
                reader.readAsText(file);
                input.remove();
            };
            input.click();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'flex:0 0 auto; padding:10px 16px; border-radius:8px; border:1px solid var(--wechat-border); background:none; cursor:pointer;';
        cancelBtn.addEventListener('click', function() {
            overlay.remove();
        });

        btnGroup.appendChild(exportBtn);
        btnGroup.appendChild(importBtn);
        btnGroup.appendChild(cancelBtn);
        dialog.appendChild(btnGroup);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    // ===== 危险操作：清除会话 =====
    async function clearCurrentSession() {
        if (!confirm('确定删除当前会话的所有消息吗？此操作不可撤销。')) return;
        window.messages = [];
        if (typeof window.saveMessages === 'function') window.saveMessages();
        if (typeof window.renderMessages === 'function') window.renderMessages();
        if (typeof window.showToast === 'function') window.showToast('会话消息已清除', 'success');
    }

    // ===== 危险操作：重置数据 =====
    async function resetAllData() {
        if (!confirm('确定重置所有数据吗？此操作将清除所有聊天记录、字卡、表情、头像、背景等，且不可恢复！\n请确保已导出备份。')) return;
        try {
            await localforage.clear();
            location.reload();
        } catch (e) {
            if (typeof window.showToast === 'function') window.showToast('重置失败: ' + e.message, 'error');
        }
    }

    // ===== 初始化面板按钮事件 =====
    function initBackupPanel() {
        // 绑定全量按钮
        const exportFullBtn = document.getElementById('exportFullBtn');
        if (exportFullBtn) {
            exportFullBtn.addEventListener('click', exportFullBackup);
        }

        const importFullBtn = document.getElementById('importFullBtn');
        if (importFullBtn) {
            importFullBtn.addEventListener('click', function() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = function(e) {
                    if (e.target.files[0]) importFullBackup(e.target.files[0]);
                    input.remove();
                };
                input.click();
            });
        }

        // 绑定独立模块按钮
        document.querySelectorAll('[data-module]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const moduleType = this.dataset.module;
                showModuleAction(moduleType);
            });
        });

        // 绑定危险操作按钮
        const clearSessionBtn = document.getElementById('clearSessionBtn');
        if (clearSessionBtn) {
            clearSessionBtn.addEventListener('click', clearCurrentSession);
        }

        const resetAllBtn = document.getElementById('resetAllBtn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', resetAllData);
        }

        // 绑定存储刷新按钮
        const refreshStorageBtn = document.getElementById('refreshStorageBtn');
        if (refreshStorageBtn) {
            refreshStorageBtn.addEventListener('click', updateStorageInfo);
        }

        // 初始化时执行一次存储统计
        setTimeout(updateStorageInfo, 300);
    }

    // 页面加载完成后执行初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackupPanel);
    } else {
        initBackupPanel();
    }

})();