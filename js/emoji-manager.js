// js/emoji-manager.js
(function() {
    'use strict';

    const MAX_EMOJIS = 200;
    let myEmojis = [];
    let partnerEmojis = [];
    let currentTab = 'my';

    function getKey() {
        return window.getStorageKey('emojiData');
    }

    async function loadData() {
        try {
            const data = await safeGetItem(getKey());
            if (data) {
                if (data.myEmojis) myEmojis = data.myEmojis;
                if (data.partnerEmojis) partnerEmojis = data.partnerEmojis;
                return;
            }
        } catch (e) {
            console.warn('加载表情数据失败，SESSION_ID 可能未就绪:', e);
            return;
        }
        if (myEmojis.length === 0 && partnerEmojis.length === 0) {
            myEmojis = [];
            partnerEmojis = [];
            await saveData();
        }
    }

    async function saveData() {
        try {
            await safeSetItem(getKey(), { myEmojis, partnerEmojis });
        } catch (e) {
            console.warn('保存表情数据失败:', e);
        }
    }

    async function addEmojis(targetArray, imageDataUrls, maxLimit) {
        if (!Array.isArray(imageDataUrls) || imageDataUrls.length === 0) return 0;
        const available = maxLimit - targetArray.length;
        if (available <= 0) return 0;
        const toAdd = imageDataUrls.slice(0, Math.min(available, 50));
        const added = [];
        for (const url of toAdd) {
            if (targetArray.length < maxLimit) {
                targetArray.push(url);
                added.push(url);
            } else break;
        }
        if (added.length) await saveData();
        return added.length;
    }

    function renderPanel() {
        const container = document.getElementById('emojiContent');
        if (!container) {
            console.warn('emojiContent 容器未找到');
            return;
        }

        document.querySelectorAll('#emojiPanel .emoji-tab-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tab === currentTab);
        });

        const emojis = currentTab === 'my' ? myEmojis : partnerEmojis;
        const title = currentTab === 'my' ? '我方表情' : '对方表情';

        container.innerHTML = '';

        const topBtnContainer = document.createElement('div');
        topBtnContainer.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';

        const addBtn = document.createElement('button');
        addBtn.textContent = '添加表情（可多选）';
        addBtn.style.cssText = 'flex:1;padding:10px;background:var(--wechat-green);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;';
        addBtn.addEventListener('click', function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            window.showToast('请在相册中多选图片（长按或点右上角选择）', 'info');
            
            input.onchange = async function(e) {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;
                if (files.length > 50) {
                    window.showToast('单次最多选择50张', 'error');
                    input.value = '';
                    return;
                }
                const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
                if (oversized.length) {
                    window.showToast('部分图片超过5MB，请压缩', 'error');
                    input.value = '';
                    return;
                }
                const targetArray = currentTab === 'my' ? myEmojis : partnerEmojis;
                const available = MAX_EMOJIS - targetArray.length;
                if (available <= 0) {
                    window.showToast((currentTab === 'my' ? '我方' : '对方') + '表情已达上限(' + MAX_EMOJIS + '个)', 'error');
                    input.value = '';
                    return;
                }
                const toLoad = Math.min(files.length, available);
                if (toLoad < files.length) {
                    window.showToast('仅可添加 ' + toLoad + ' 张（达到上限）', 'warning');
                }
                const dataUrls = await Promise.all(
                    Array.from(files).slice(0, toLoad).map(function(file) {
                        return new Promise(function(resolve) {
                            const reader = new FileReader();
                            reader.onload = function(e) { resolve(e.target.result); };
                            reader.readAsDataURL(file);
                        });
                    })
                );
                let added;
                if (currentTab === 'my') {
                    added = await window.emojiManager.addMyEmojis(dataUrls);
                } else {
                    added = await window.emojiManager.addPartnerEmojis(dataUrls);
                }
                if (added > 0) {
                    renderPanel();
                    window.showToast('成功添加 ' + added + ' 张表情', 'success');
                } else {
                    window.showToast('添加失败或已达上限', 'error');
                }
                input.value = '';
            };
            input.click();
        });
        topBtnContainer.appendChild(addBtn);

        if (currentTab === 'my') {
            const sendBtn = document.createElement('button');
            sendBtn.textContent = '发送图片';
            sendBtn.style.cssText = 'flex:1;padding:10px;background:var(--wechat-green);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;';
            sendBtn.addEventListener('click', function() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = false;
                input.onchange = function(e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                        window.showToast('图片不能超过10MB', 'error');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        const img = new Image();
                        img.onload = function() {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            let width = img.width;
                            let height = img.height;
                            const MAX_WIDTH = 1000;
                            if (width > MAX_WIDTH) {
                                height = (MAX_WIDTH / width) * height;
                                width = MAX_WIDTH;
                            }
                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(img, 0, 0, width, height);
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                            if (typeof window.sendMessage === 'function') {
                                window.sendMessage('', compressedDataUrl);
                                window.showToast('图片已发送（已压缩）', 'success');
                                const panel = document.getElementById('emojiPanel');
                                if (panel) panel.classList.remove('open');
                            } else {
                                window.showToast('发送失败', 'error');
                            }
                        };
                        img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            });
            topBtnContainer.appendChild(sendBtn);
        }

        container.appendChild(topBtnContainer);

        if (emojis.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'card-empty';
            emptyDiv.innerHTML = `
                <i class="fas fa-image"></i>
                <p>${title} 暂无表情</p>
                <p style="font-size:12px;margin-top:4px;">点击下方按钮添加（可多选）</p>
            `;
            container.appendChild(emptyDiv);
        } else {
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:10px;';
            emojis.forEach((src, idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'aspect-ratio:1;border-radius:8px;border:1px solid var(--wechat-border);overflow:hidden;cursor:pointer;position:relative;background:var(--wechat-bubble-recv);';
                item.innerHTML = `
                    <img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" />
                    <button class="emoji-del-btn" data-tab="${currentTab}" data-idx="${idx}" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.2s;">✕</button>
                `;
                item.querySelector('.emoji-del-btn').addEventListener('click', async function(e) {
                    e.stopPropagation();
                    const idx = parseInt(this.dataset.idx);
                    const tab = this.dataset.tab;
                    let success = false;
                    if (tab === 'my') {
                        success = await window.emojiManager.removeMyEmoji(idx);
                    } else {
                        success = await window.emojiManager.removePartnerEmoji(idx);
                    }
                    if (success) {
                        renderPanel();
                        window.showToast('已删除', 'success');
                    }
                });
                item.addEventListener('click', async function(e) {
                    if (e.target.closest('.emoji-del-btn')) return;
                    if (currentTab === 'my') {
                        try {
                            await window.emojiManager.sendEmoji(src, true);
                        } finally {
                            document.getElementById('emojiPanel').classList.remove('open');
                        }
                    } else {
                        window.showToast('对方表情不可手动发送', 'info');
                    }
                });
                grid.appendChild(item);
            });
            container.appendChild(grid);
        }
    }

    window.emojiManager = {
        getMyEmojis: function() { return myEmojis; },
        getPartnerEmojis: function() { return partnerEmojis; },

        addMyEmojis: async function(dataUrls) {
            return await addEmojis(myEmojis, dataUrls, MAX_EMOJIS);
        },
        addPartnerEmojis: async function(dataUrls) {
            return await addEmojis(partnerEmojis, dataUrls, MAX_EMOJIS);
        },

        removeMyEmoji: async function(index) {
            if (index >= 0 && index < myEmojis.length) {
                if (confirm('确定删除这个表情吗？')) {
                    myEmojis.splice(index, 1);
                    await saveData();
                    return true;
                }
                return false;
            }
            return false;
        },
        removePartnerEmoji: async function(index) {
            if (index >= 0 && index < partnerEmojis.length) {
                if (confirm('确定删除这个表情吗？')) {
                    partnerEmojis.splice(index, 1);
                    await saveData();
                    return true;
                }
                return false;
            }
            return false;
        },

        exportData: function() {
            return {
                myEmojis: myEmojis.slice(),
                partnerEmojis: partnerEmojis.slice()
            };
        },
        importData: function(data, mode) {
            if (!data || typeof data !== 'object') return { success: false, message: '无效数据' };
            if (mode === 'overwrite') {
                if (data.myEmojis) myEmojis = data.myEmojis.slice(0, MAX_EMOJIS);
                if (data.partnerEmojis) partnerEmojis = data.partnerEmojis.slice(0, MAX_EMOJIS);
            } else {
                if (data.myEmojis) {
                    var set = new Set(myEmojis);
                    data.myEmojis.forEach(function(item) {
                        if (!set.has(item) && myEmojis.length < MAX_EMOJIS) {
                            myEmojis.push(item);
                            set.add(item);
                        }
                    });
                }
                if (data.partnerEmojis) {
                    var set2 = new Set(partnerEmojis);
                    data.partnerEmojis.forEach(function(item) {
                        if (!set2.has(item) && partnerEmojis.length < MAX_EMOJIS) {
                            partnerEmojis.push(item);
                            set2.add(item);
                        }
                    });
                }
            }
            saveData();
            return { success: true };
        },

        openPanel: function() {
            currentTab = 'my';
            renderPanel();
            document.getElementById('emojiPanel').classList.add('open');
        },

        sendEmoji: async function(dataUrl, isMy) {
            if (typeof window.sendMessage === 'function') {
                await window.sendMessage('', dataUrl);
            } else {
                console.warn('sendMessage 未定义');
            }
        },

        reload: async function() {
            await loadData();
            if (document.getElementById('emojiPanel').classList.contains('open')) {
                renderPanel();
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('#emojiPanel .emoji-tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                currentTab = this.dataset.tab;
                renderPanel();
            });
        });

        var panel = document.getElementById('emojiPanel');
        var closeBtn = document.getElementById('closeEmojiPanel');
        if (closeBtn && panel) {
            closeBtn.addEventListener('click', function() {
                panel.classList.remove('open');
            });
            panel.addEventListener('click', function(e) {
                if (e.target === panel) panel.classList.remove('open');
            });
        }

        // ★ 移除 loadData()，由 app.js 统一触发 reload()
        if (panel && panel.classList.contains('open')) {
            renderPanel();
        }
    });

    console.log('✅ 表情包模块已加载（使用安全存储）');
})();