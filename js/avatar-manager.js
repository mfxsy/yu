// avatar-manager.js
(function() {
    'use strict';

    let myAvatar = null;
    let partnerAvatar = null;
    let chatBg = null;

    function getKey(base) {
        if (typeof window.getStorageKey === 'function') {
            return window.getStorageKey(base);
        }
        return 'CHAT_APP_V3_' + base;
    }

    async function loadData() {
        try {
            const data = await localforage.getItem(getKey('avatarData'));
            if (data) {
                if (data.myAvatar !== undefined) myAvatar = data.myAvatar;
                if (data.partnerAvatar !== undefined) partnerAvatar = data.partnerAvatar;
            }
            const bg = await localforage.getItem(getKey('chatBg'));
            if (bg !== undefined) chatBg = bg;
        } catch (e) {
            // 若 getKey 失败（如 SESSION_ID 未定义），不要清空数据，直接返回
            console.warn('加载头像/背景失败，SESSION_ID 可能未就绪:', e);
            return;
        }
        if (myAvatar === undefined) myAvatar = null;
        if (partnerAvatar === undefined) partnerAvatar = null;
        if (chatBg === undefined) chatBg = null;
        await saveData();
    }

    async function saveData() {
        try {
            await localforage.setItem(getKey('avatarData'), { myAvatar, partnerAvatar });
            if (chatBg) await localforage.setItem(getKey('chatBg'), chatBg);
            else await localforage.removeItem(getKey('chatBg'));
        } catch (e) { console.warn('保存头像/背景失败:', e); }
    }

    window.avatarManager = {
        getMyAvatar: () => myAvatar,
        getPartnerAvatar: () => partnerAvatar,
        getChatBg: () => chatBg,
        setMyAvatar: async function(dataUrl) { myAvatar = dataUrl || null; await saveData(); this.notifyUpdate(); },
        setPartnerAvatar: async function(dataUrl) { partnerAvatar = dataUrl || null; await saveData(); this.notifyUpdate(); },
        setChatBg: async function(dataUrl) { chatBg = dataUrl || null; await saveData(); this.applyBg(); this.notifyUpdate(); },
        removeChatBg: async function() {
            if (confirm('移除背景？')) {
                chatBg = null;
                await saveData();
                this.applyBg();
                this.notifyUpdate();
                showToast('已移除背景', 'success');
            }
        },
        applyBg: function() {
            if (chatBg) {
                document.documentElement.style.setProperty('--chat-bg-image', 'url("' + chatBg + '")');
                document.body.classList.add('with-background');
            } else {
                document.documentElement.style.removeProperty('--chat-bg-image');
                document.body.classList.remove('with-background');
            }
        },
        exportData: function() {
            return {
                myAvatar: myAvatar,
                partnerAvatar: partnerAvatar,
                chatBg: chatBg
            };
        },
        importData: function(data, mode) {
            if (!data || typeof data !== 'object') return { success: false, message: '无效数据' };
            if (mode === 'overwrite') {
                if (data.myAvatar !== undefined) myAvatar = data.myAvatar;
                if (data.partnerAvatar !== undefined) partnerAvatar = data.partnerAvatar;
                if (data.chatBg !== undefined) chatBg = data.chatBg;
            } else {
                if (data.myAvatar) myAvatar = data.myAvatar;
                if (data.partnerAvatar) partnerAvatar = data.partnerAvatar;
                if (data.chatBg) chatBg = data.chatBg;
            }
            saveData();
            this.applyBg();
            this.notifyUpdate();
            return { success: true };
        },
        openPanel: function() {
            renderPanel();
            document.getElementById('avatarPanel').classList.add('open');
        },
        notifyUpdate: function() {
            document.dispatchEvent(new CustomEvent('avatarUpdated'));
        },
        reload: async function() {
            await loadData();
            this.applyBg();
            if (document.getElementById('avatarPanel').classList.contains('open')) renderPanel();
            this.notifyUpdate();
        }
    };

    function renderPanel() {
        const container = document.getElementById('avatarContent');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:20px;">
                <!-- 我方头像 -->
                <div style="display:flex;align-items:center;gap:16px;">
                    <div style="width:60px;height:60px;border-radius:4px;overflow:hidden;background:var(--wechat-border);border:2px solid var(--wechat-border);flex-shrink:0;">
                        ${myAvatar ? `<img src="${myAvatar}" style="width:100%;height:100%;object-fit:cover;" />` : '<i class="fas fa-user" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--wechat-text-secondary);font-size:24px;"></i>'}
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600;margin-bottom:4px;">我方头像</div>
                        <button class="avatar-upload-btn" data-target="my" style="padding:6px 16px;background:var(--wechat-green);color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">更换</button>
                        ${myAvatar ? `<button class="avatar-remove-btn" data-target="my" style="padding:6px 12px;background:none;border:1px solid #fa5151;color:#fa5151;border-radius:8px;font-size:13px;cursor:pointer;margin-left:8px;">移除</button>` : ''}
                    </div>
                </div>
                <!-- 对方头像 -->
                <div style="display:flex;align-items:center;gap:16px;">
                    <div style="width:60px;height:60px;border-radius:4px;overflow:hidden;background:var(--wechat-border);border:2px solid var(--wechat-border);flex-shrink:0;">
                        ${partnerAvatar ? `<img src="${partnerAvatar}" style="width:100%;height:100%;object-fit:cover;" />` : '<i class="fas fa-user" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--wechat-text-secondary);font-size:24px;"></i>'}
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600;margin-bottom:4px;">对方头像</div>
                        <button class="avatar-upload-btn" data-target="partner" style="padding:6px 16px;background:var(--wechat-green);color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">更换</button>
                        ${partnerAvatar ? `<button class="avatar-remove-btn" data-target="partner" style="padding:6px 12px;background:none;border:1px solid #fa5151;color:#fa5151;border-radius:8px;font-size:13px;cursor:pointer;margin-left:8px;">移除</button>` : ''}
                    </div>
                </div>
                <!-- 聊天背景 -->
                <div style="border-top:1px solid var(--wechat-border);padding-top:16px;">
                    <div style="font-weight:600;margin-bottom:8px;">聊天背景</div>
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        ${chatBg ? `<div style="width:60px;height:60px;border-radius:8px;overflow:hidden;border:2px solid var(--wechat-border);flex-shrink:0;"><img src="${chatBg}" style="width:100%;height:100%;object-fit:cover;" /></div>` : ''}
                        <button class="bg-upload-btn" style="padding:6px 16px;background:var(--wechat-green);color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">上传背景</button>
                        ${chatBg ? `<button class="bg-remove-btn" style="padding:6px 12px;background:none;border:1px solid #fa5151;color:#fa5151;border-radius:8px;font-size:13px;cursor:pointer;">移除</button>` : ''}
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll('.avatar-upload-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const target = this.dataset.target;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = function(e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                        showToast('图片不能超过10MB', 'error');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        const dataUrl = ev.target.result;
                        if (target === 'my') {
                            window.avatarManager.setMyAvatar(dataUrl);
                        } else {
                            window.avatarManager.setPartnerAvatar(dataUrl);
                        }
                        renderPanel();
                        showToast('头像已更新', 'success');
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            });
        });

        container.querySelectorAll('.avatar-remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const target = this.dataset.target;
                if (confirm('确定移除该头像吗？')) {
                    if (target === 'my') {
                        window.avatarManager.setMyAvatar(null);
                    } else {
                        window.avatarManager.setPartnerAvatar(null);
                    }
                    renderPanel();
                    showToast('已移除', 'success');
                }
            });
        });


        container.querySelector('.bg-upload-btn')?.addEventListener('click', function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        // 这里保持你之前改好的 10MB 限制
        if (file.size > 10 * 1024 * 1024) { 
            showToast('图片不能超过10MB，请压缩后重试', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(ev) {
            const img = new Image();
            img.onload = function() {
                // 创建 Canvas 进行压缩
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 如果图片宽度大于 1000px，则等比例缩放到 1000px
                // (这个尺寸做手机壁纸足够了，而且能大幅缩短 Base64 长度)
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
                
                // 转为 JPEG 格式，质量 0.85（肉眼几乎看不出和原图差别，但体积小很多）
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                
                // ★ 这里用的是 setChatBg，数据会永久存入 localforage，刷新绝对不丢 ★
                window.avatarManager.setChatBg(compressedDataUrl);
                renderPanel();
                showToast('背景已更新', 'success');
            };
            img.src = ev.target.result; // 开始加载原始图片数据
        };
        reader.readAsDataURL(file);
    };
    input.click();
});


        container.querySelector('.bg-remove-btn')?.addEventListener('click', function() {
            window.avatarManager.removeChatBg();
            renderPanel();
        });
    }

    function showToast(msg, type) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = msg;
            toast.className = 'toast ' + (type || 'info');
            void toast.offsetWidth;
            toast.classList.add('show');
            clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
        } else {
            alert(msg);
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        const panel = document.getElementById('avatarPanel');
        const closeBtn = document.getElementById('closeAvatarPanel');
        if (closeBtn && panel) {
            closeBtn.addEventListener('click', function() {
                panel.classList.remove('open');
            });
            panel.addEventListener('click', function(e) {
                if (e.target === panel) panel.classList.remove('open');
            });
        }

        // 不再自动加载，改为由主程序在 SESSION_ID 就绪后调用 reload
        loadData().then(() => {
            window.avatarManager.applyBg();
            setTimeout(() => window.avatarManager.notifyUpdate(), 100);
        });
    });
})();