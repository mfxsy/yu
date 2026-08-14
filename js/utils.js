// 工具函数与安全存储

// 超时保护（3秒内读取失败返回默认值）
function safeGetItem(key, defaultVal = null) {
    return Promise.race([
        localforage.getItem(key),
        new Promise(resolve => setTimeout(() => resolve(defaultVal), 3000))
    ]);
}

// ★ 核心修复：如果写入超时或失败，必须 reject 而不是静默通过！
function safeSetItem(key, value) {
    return Promise.race([
        localforage.setItem(key, value),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('存储写入超时')), 3000))
    ]);
}

function safeRemoveItem(key) {
    return Promise.race([
        localforage.removeItem(key),
        new Promise(resolve => setTimeout(resolve, 3000))
    ]);
}

// 防御性存储键生成（即使 SESSION_ID 未初始化也不抛错）
function getStorageKey(baseKey) {
    if (!window.SESSION_ID) {
        console.warn('[存储] SESSION_ID未初始化，使用临时存储键');
        return window.APP_PREFIX + 'temp_' + baseKey;
    }
    return window.APP_PREFIX + window.SESSION_ID + '_' + baseKey;
}

// 其他工具函数
function getRandomItem(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(date) {
    if (!(date instanceof Date)) date = new Date(date);
    if (isNaN(date.getTime())) return '--:--';
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return h + ':' + m;
}

function getDateKey(date) {
    if (!(date instanceof Date)) date = new Date(date);
    if (isNaN(date.getTime())) return '1970-01-01';
    const d = date;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

let _toastTimer = null;
function showToast(text, type = 'info', duration = 2200) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.className = 'toast ' + type;
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}
window.showToast = showToast;

// 下载文件回退
function downloadFileFallback(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}