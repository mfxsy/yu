// 全局状态变量与 DOM 引用

window.SESSION_ID = null;
window.messages = [];
window.partnerName = '梦角';
window.myName = '我';
window.isDark = false;
window.lastMsgId = 0;
window.sessionList = [];
window.isTyping = false;
window.typingTimer = null;
window.showTimestamp = true;
window.noReplyEnabled = false;
window.notificationEnabled = false;
window.notificationCount = 0;
window.notificationTimer = null;
window._lastDateKey = '';
window._replySuspended = false;
window._pendingReplyTimer = null;

// 所有 DOM 引用（统一管理）
const DOM = {
    chatArea: document.getElementById('chatArea'),
    msgInput: document.getElementById('msgInput'),
    sendBtn: document.getElementById('sendBtn'),
    inputBar: document.getElementById('inputBar'),
    contactName: document.getElementById('contactName'),
    contactStatus: document.getElementById('contactStatus'),
    themeToggle: document.getElementById('themeToggle'),
    toast: document.getElementById('toast'),
    settingsBtn: document.getElementById('settingsBtn'),
    emojiBtn: document.getElementById('emojiBtn'),
    callBtn: document.getElementById('callBtn'),
    // 面板
    cardPanel: document.getElementById('cardPanel'),
    emojiPanel: document.getElementById('emojiPanel'),
    avatarPanel: document.getElementById('avatarPanel'),
    sessionPanel: document.getElementById('sessionPanel'),
    backupPanel: document.getElementById('backupPanel'),
    settingsPanel: document.getElementById('settingsPanel'),
    messageSettingsPanel: document.getElementById('messageSettingsPanel'),
    nicknamePanel: document.getElementById('nicknamePanel'),
    interactSettingsPanel: document.getElementById('interactSettingsPanel'),
    frequencySettingsPanel: document.getElementById('frequencySettingsPanel'),
    // 其他
    quoteBar: document.getElementById('quoteBar'),
    groupSelectorWrapper: document.getElementById('groupSelectorWrapper'),
    addCardGroupSelect: document.getElementById('addCardGroupSelect'),
    cardListContainer: document.getElementById('cardListContainer'),
    cardCount: document.getElementById('cardCount'),
    emojiContent: document.getElementById('emojiContent'),
    avatarContent: document.getElementById('avatarContent'),
    sessionListContainer: document.getElementById('sessionListContainer'),
    backupContent: document.getElementById('backupContent'),
    settingsContent: document.getElementById('settingsContent'),
    messageSettingsContent: document.getElementById('messageSettingsContent'),
    interactSettingsContent: document.getElementById('interactSettingsContent'),
    frequencySettingsContent: document.getElementById('frequencySettingsContent'),
    nicknameContent: document.getElementById('nicknameContent'),
    newCardInput: document.getElementById('newCardInput'),
    addCardBtn: document.getElementById('addCardBtn'),
    resetDefaultCards: document.getElementById('resetDefaultCards'),
    batchAddBtn: document.getElementById('batchAddBtn'),
    importJsonBtn: document.getElementById('importJsonBtn'),
    createSessionBtn: document.getElementById('createSessionBtn'),
    closeCardPanel: document.getElementById('closeCardPanel'),
    closeEmojiPanel: document.getElementById('closeEmojiPanel'),
    closeAvatarPanel: document.getElementById('closeAvatarPanel'),
    closeSessionPanel: document.getElementById('closeSessionPanel'),
    closeBackupPanel: document.getElementById('closeBackupPanel'),
    closeSettingsPanel: document.getElementById('closeSettingsPanel'),
    closeMessageSettingsPanel: document.getElementById('closeMessageSettingsPanel'),
    closeInteractSettingsPanel: document.getElementById('closeInteractSettingsPanel'),
    closeFrequencySettingsPanel: document.getElementById('closeFrequencySettingsPanel'),
    closeNicknamePanel: document.getElementById('closeNicknamePanel'),
};
window.DOM = DOM;