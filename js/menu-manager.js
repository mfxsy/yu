// js/settings-menu.js
(function() {
    'use strict';

    // 定义功能列表（三列布局）
    const MENU_ITEMS = [
        { id: 'session', icon: 'fa-folder-open', label: '会话管理', panelId: 'sessionPanel' },
        { id: 'theme', icon: 'fa-moon', label: '切换主题', action: 'toggleTheme' },
        { id: 'cards', icon: 'fa-book-open', label: '字卡管理', panelId: 'cardPanel' },
        { id: 'emojis', icon: 'fa-smile', label: '表情包', panelId: 'emojiPanel' },
        { id: 'avatar', icon: 'fa-user-circle', label: '头像/背景', panelId: 'avatarPanel' },
        { id: 'backup', icon: 'fa-database', label: '存储与备份', panelId: 'backupPanel' },
    ];

    let isOpen = false;

    function createMenu() {
        const overlay = document.createElement('div');
        overlay.id = 'settingsOverlay';
        overlay.className = 'panel-overlay';
        overlay.innerHTML = `
            <div class="panel-sheet settings-sheet">
                <div class="panel-header">
                    <h2><i class="fas fa-cog" style="margin-right:8px;color:var(--wechat-green);"></i>设置</h2>
                    <button class="close-panel" id="closeSettings"><i class="fas fa-times"></i></button>
                </div>
                <div class="panel-body settings-grid">
                    ${MENU_ITEMS.map(item => `
                        <div class="settings-grid-item" data-id="${item.id}" data-panel="${item.panelId || ''}" data-action="${item.action || ''}">
                            <i class="fas ${item.icon}"></i>
                            <span>${item.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 关闭事件
        overlay.querySelector('#closeSettings').addEventListener('click', closeMenu);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeMenu();
        });

        // 功能项点击
        overlay.querySelectorAll('.settings-grid-item').forEach(item => {
            item.addEventListener('click', function() {
                const panelId = this.dataset.panel;
                const action = this.dataset.action;
                if (panelId) {
                    const panel = document.getElementById(panelId);
                    if (panel) {
                        closeMenu();
                        // 延迟打开面板，避免冲突
                        setTimeout(() => {
                            panel.classList.add('open');
                        }, 200);
                    }
                } else if (action === 'toggleTheme') {
                    closeMenu();
                    // 调用全局主题切换函数
                    if (typeof window.toggleTheme === 'function') {
                        window.toggleTheme();
                    } else {
                        // 触发主题切换事件
                        document.dispatchEvent(new CustomEvent('toggleTheme'));
                    }
                }
            });
        });
    }

    function openMenu() {
        if (!document.getElementById('settingsOverlay')) {
            createMenu();
        }
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) {
            overlay.classList.add('open');
            isOpen = true;
        }
    }

    function closeMenu() {
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) {
            overlay.classList.remove('open');
            isOpen = false;
        }
    }

    function toggleMenu() {
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    // 暴露全局接口
    window.settingsMenu = {
        open: openMenu,
        close: closeMenu,
        toggle: toggleMenu,
        isOpen: function() { return isOpen; }
    };

    // 监听主题切换事件（由主程序触发）
    document.addEventListener('toggleTheme', function() {
        if (typeof window.toggleTheme === 'function') {
            window.toggleTheme();
        } else {
            console.warn('toggleTheme 未定义');
        }
    });

})();