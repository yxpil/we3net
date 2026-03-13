// Electron 渲染进程脚本 - 启动界面交互
const { ipcRenderer } = require('electron');

// 获取 DOM 元素
const progressText = document.getElementById('progressText');
const loader = document.querySelector('.loader');

// 真实加载模式 - 只响应实际IPC消息

// 监听主进程的进度更新
ipcRenderer.on('loading-progress', (event, data) => {
    console.log('收到进度更新:', data);
    updateProgress(data.message, data.progress);
});

// 监听服务器状态更新
ipcRenderer.on('server-ready', (event, data) => {
    console.log('服务器已就绪:', data);
    updateProgress('准备服务器', 100);
});

// 监听服务器超时
ipcRenderer.on('server-timeout', (event, data) => {
    console.error('启动失败:', data);
    if (progressText) {
        progressText.textContent = '服务器启动失败';
        progressText.style.color = '#f44336';
    }
});

// 更新进度显示
function updateProgress(message, progress) {
    if (progressText) {
        progressText.textContent = message;
    }
    console.log(`进度: ${progress}% - ${message}`);
}

// 显示完成信息
function showCompletionMessage() {
    if (progressText) {
        progressText.textContent = '加载完成';
        progressText.style.color = '#000000ff';
    }
}

// 页面加载完成后开始
window.addEventListener('DOMContentLoaded', () => {
    console.log('等待主进程');
});

// 错误处理
window.addEventListener('error', (event) => {
    console.error('错误:', event.error);
    if (progressText) {
        progressText.textContent = '加载出错，请重试';
        progressText.style.color = '#f44336';
    }
});

// 暴露一些全局函数供 HTML 调用
window.electronAPI = {
    // 密码验证功能
    validatePassword: async (password) => {
        try {
            const result = await ipcRenderer.invoke('validate-password', password);
            return result;
        } catch (error) {
            console.error('密码验证错误:', error);
            return { valid: false, errors: ['验证失败'] };
        }
    },
    
    // 获取日志
    getLogs: async (level) => {
        try {
            const result = await ipcRenderer.invoke('get-logs', level);
            return result;
        } catch (error) {
            console.error('获取日志错误:', error);
            return { success: false, error: error.message };
        }
    },
    
    // 窗口控制
    minimizeWindow: () => {
        ipcRenderer.invoke('window-minimize');
    },
    
    maximizeWindow: () => {
        ipcRenderer.invoke('window-maximize');
    },
    
    closeWindow: () => {
        ipcRenderer.invoke('window-close');
    },
    
    // 获取窗口状态
    getWindowState: () => {
        return ipcRenderer.invoke('get-window-state');
    }
};