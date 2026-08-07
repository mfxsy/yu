// js/share-import.js
(function() {
    'use strict';

    // ---------- 自动注入 UI 到设置面板 ----------
    function injectUI() {
        const container = document.getElementById('settingsContent');
        if (!container) return;
        // 防止重复注入
        if (document.getElementById('importShareBtn')) return;

        const btn = document.createElement('button');
        btn.id = 'importShareBtn';
        btn.className = 'settings-entry';
        btn.style.cssText = `
            padding:16px;
            background:var(--wechat-bubble-recv);
            border:1px solid var(--wechat-border);
            border-radius:12px;
            cursor:pointer;
            text-align:center;
            color:var(--wechat-text-primary);
            transition:transform 0.15s;
        `;
        btn.innerHTML = `
            <i class="fas fa-share-alt" style="font-size:24px;display:block;margin-bottom:6px;color:var(--wechat-green);"></i>
            <span style="font-size:13px;font-weight:500;">导入分享链接</span>
        `;
        btn.addEventListener('click', function() {
            // 关闭设置面板，再打开导入对话框
            const settingsPanel = document.getElementById('settingsPanel');
            if (settingsPanel) settingsPanel.classList.remove('open');
            setTimeout(openImportDialog, 200);
        });
        container.appendChild(btn);
    }

    // ---------- 创建导入对话框 ----------
    function openImportDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:9999;
            background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);
            display:flex; align-items:center; justify-content:center;
        `;
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:var(--wechat-bg); border-radius:16px; padding:20px;
            width:90%; max-width:400px; box-shadow:0 8px 30px rgba(0,0,0,0.3);
        `;
        dialog.innerHTML = `
            <h3 style="margin-bottom:12px;font-size:17px;text-align:center;color:var(--wechat-text-primary);">
                <i class="fas fa-link" style="color:var(--wechat-green);"></i> 导入分享链接
            </h3>
            <p style="font-size:13px;color:var(--wechat-text-secondary);margin-bottom:12px;text-align:center;">
                粘贴来自其他 App 的帖子或视频链接
            </p>
            <textarea id="importUrlInput" rows="3" placeholder="https://..." style="
                width:100%; padding:10px;
                border:1px solid var(--wechat-border); border-radius:8px;
                background:var(--wechat-input-bg); color:var(--wechat-text-primary);
                font-size:14px; resize:vertical; font-family:var(--font-family);
            "></textarea>
            <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
                <button id="importCancelBtn" style="
                    padding:8px 16px; border-radius:8px;
                    border:1px solid var(--wechat-border); background:none;
                    cursor:pointer; color:var(--wechat-text-primary);
                ">取消</button>
                <button id="importConfirmBtn" style="
                    padding:8px 16px; border-radius:8px; border:none;
                    background:var(--wechat-green); color:#fff;
                    cursor:pointer; font-weight:600;
                ">导入</button>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        dialog.querySelector('#importCancelBtn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        dialog.querySelector('#importConfirmBtn').addEventListener('click', async function() {
            const url = document.getElementById('importUrlInput').value.trim();
            if (!url) {
                showToast('请输入链接', 'error');
                return;
            }
            this.disabled = true;
            this.textContent = '解析中...';
            await processUrl(url);
            this.disabled = false;
            this.textContent = '导入';
            close();
        });

        // 自动聚焦输入框
        setTimeout(() => document.getElementById('importUrlInput').focus(), 100);
    }

    // ---------- 解析并发送链接 ----------
    async function processUrl(url) {
        try {
            // 使用 CORS 代理获取页面内容（若需自建可替换）
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('获取页面失败');
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const getMeta = (prop) => {
                const el = doc.querySelector(`meta[property="${prop}"]`) || doc.querySelector(`meta[name="${prop}"]`);
                return el ? el.getAttribute('content') : null;
            };

            const title = getMeta('og:title') || doc.title || '分享链接';
            const description = getMeta('og:description') || '点击查看详情';
            const image = getMeta('og:image');
            const siteName = getMeta('og:site_name') || '';

            // 构造消息文本
            let messageText = `📎 ${siteName || '分享'}\n`;
            messageText += `【${title}】\n`;
            messageText += `${description}\n`;
            messageText += `🔗 ${url}`;

            // 如果有图片，尝试作为图片消息发送
            if (image) {
                try {
                    const imgResp = await fetch(image);
                    const blob = await imgResp.blob();
                    const reader = new FileReader();
                    const dataUrl = await new Promise((resolve) => {
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    if (typeof window.sendMessage === 'function') {
                        window.sendMessage(messageText, dataUrl);
                    } else {
                        window.addMessage(messageText, 'me', 'normal');
                    }
                } catch (e) {
                    // 图片加载失败，只发文本
                    if (typeof window.sendMessage === 'function') {
                        window.sendMessage(messageText);
                    } else {
                        window.addMessage(messageText, 'me', 'normal');
                    }
                }
            } else {
                if (typeof window.sendMessage === 'function') {
                    window.sendMessage(messageText);
                } else {
                    window.addMessage(messageText, 'me', 'normal');
                }
            }
            showToast('分享已导入 ✨', 'success');
        } catch (e) {
            // 解析失败，发送纯文本链接
            if (typeof window.sendMessage === 'function') {
                window.sendMessage(`📎 分享链接\n${url}`);
            } else {
                window.addMessage(`📎 分享链接\n${url}`, 'me', 'normal');
            }
            showToast('已导入为纯链接', 'warning');
        }
    }

    // ---------- Toast 提示（复用主程序） ----------
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

    // ---------- 等待 DOM 就绪后注入 ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // 给主程序 500ms 渲染设置面板
            setTimeout(injectUI, 500);
        });
    } else {
        setTimeout(injectUI, 500);
    }

})();