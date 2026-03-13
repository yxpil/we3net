/**
 * 窗口控制功能组件
 * 专门处理最小化、最大化、关闭等窗口操作
 */

// 引入SVG图标加载器
const { SVGIconLoader } = require('../../Src/Tools/SVGIconLoader.js');

// 全局变量
let windowIcons = {};
let svgIconLoader = null;

/**
 * 初始化窗口控制图标
 */
function initializeWindowIcons() {
    try {
        svgIconLoader = new SVGIconLoader();
        windowIcons = svgIconLoader.getWindowControlIconsSync();
        
        // 设置最小化图标
        const minimizeBtn = document.getElementById('minimize-btn');
        if (minimizeBtn && windowIcons.minimize) {
            minimizeBtn.innerHTML = windowIcons.minimize;
            console.log('最小化图标已加载');
        }
        
        // 设置最大化图标
        const maximizeBtn = document.getElementById('maximize-btn');
        if (maximizeBtn && windowIcons.maximize) {
            maximizeBtn.innerHTML = windowIcons.maximize;
            console.log('最大化图标已加载');
        }
        
        // 设置关闭图标
        const closeBtn = document.getElementById('close-btn');
        if (closeBtn && windowIcons.close) {
            closeBtn.innerHTML = windowIcons.close;
            console.log('关闭图标已加载');
        }
        
        console.log('窗口控制图标初始化完成');
    } catch (error) {
        console.error('初始化窗口图标失败:', error);
    }
}

/**
 * 设置窗口控制事件监听器
 */
function setupWindowControls() {
    // 最小化按钮
    const minimizeBtn = document.getElementById('minimize-btn');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.minimizeWindow();
                console.log('最小化窗口');
            } else {
                console.log('最小化窗口 (模拟)');
            }
        });
    }

    // 最大化/还原按钮
    const maximizeBtn = document.getElementById('maximize-btn');
    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.maximizeWindow();
                updateMaximizeButton();
                console.log('最大化/还原窗口');
            } else {
                console.log('最大化/还原窗口 (模拟)');
            }
        });
    }

    // 关闭按钮
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.closeWindow();
                console.log('关闭窗口');
            } else {
                console.log('关闭窗口 (模拟)');
            }
        });
    }

    // 双击标题栏最大化/还原
    const header = document.querySelector('.header');
    if (header) {
        header.addEventListener('dblclick', () => {
            if (window.electronAPI) {
                window.electronAPI.maximizeWindow();
                updateMaximizeButton();
                console.log('双击标题栏 - 最大化/还原');
            }
        });
    }
}

/**
 * 更新最大化按钮状态和图标
 */
async function updateMaximizeButton() {
    if (window.electronAPI) {
        try {
            const state = await window.electronAPI.getWindowState();
            const maximizeBtn = document.getElementById('maximize-btn');
            if (maximizeBtn) {
                if (state.isMaximized) {
                    maximizeBtn.title = '还原';
                    maximizeBtn.style.background = '#28ca42';
                    // 切换到还原图标
                    maximizeBtn.innerHTML = windowIcons.restore;
                } else {
                    maximizeBtn.title = '最大化';
                    maximizeBtn.style.background = '#28ca42';
                    // 切换到最大化图标
                    maximizeBtn.innerHTML = windowIcons.maximize;
                }
            }
        } catch (error) {
            console.error('获取窗口状态失败:', error);
        }
    }
}

/**
 * 调试窗口控制按钮状态
 */
function debugWindowControls() {
    console.log('=== 窗口控制调试信息 ===');
    console.log('窗口控制按钮状态:');
    console.log('最小化按钮:', document.getElementById('minimize-btn'));
    console.log('最大化按钮:', document.getElementById('maximize-btn'));
    console.log('关闭按钮:', document.getElementById('close-btn'));
    console.log('窗口图标对象:', windowIcons);
    console.log('Electron API 可用:', !!window.electronAPI);
}

/**
 * 初始化窗口控制模块
 */
function initializeWindowControlModule() {
    console.log('初始化窗口控制模块...');
    initializeWindowIcons();
    setupWindowControls();
    updateMaximizeButton();
    
    // 定期更新最大化按钮状态
    setInterval(updateMaximizeButton, 1000);
    
    // 调试信息
    setTimeout(debugWindowControls, 1000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeWindowControlModule();
});

// 导出功能供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeWindowIcons,
        setupWindowControls,
        updateMaximizeButton,
        debugWindowControls
    };
}