/**
 * 侧边栏导航功能
 * 处理左侧菜单点击，切换右侧iframe内容
 */

// 导航配置
const navConfig = {
    'personal-settings': {
        title: '个人设置',
        url: 'personal-settings.html',
        icon: '⚙️'
    },
    'nearby-messages': {
        title: '附近消息',
        url: 'nearby-messages.html',
        icon: '📍'
    },
    'local-video': {
        title: '本机视频',
        url: 'local-video.html',
        icon: '🎬'
    },
    'local-images': {
        title: '本机图文',
        url: 'local-images.html',
        icon: '🖼️'
    },
    'friend-list': {
        title: '好友列表',
        url: 'friend-list.html',
        icon: '👥'
    },
    'system-settings': {
        title: '系统设置',
        url: 'system-settings.html',
        icon: '🔧'
    },
    'theme-settings': {
        title: '主题设置',
        url: 'theme-settings.html',
        icon: '🎨'
    },
    'friend-auth': {
        title: '好友认证',
        url: 'friend-auth.html',
        icon: '🔐'
    },
    'network-settings': {
        title: '网络设置',
        url: 'network-settings.html',
        icon: '🌐'
    },
    'plugin-management': {
        title: '插件管理',
        url: 'plugin-management.html',
        icon: '🔌'
    },
    'chat-server': {
        title: '聊天服务器',
        url: 'chat-server.html',
        icon: '💬'
    },
    'system-info': {
        title: '系统信息',
        url: 'system-info.html',
        icon: 'ℹ️'
    }
};

// 初始化导航
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
});

/**
 * 初始化导航功能
 */
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentFrame = document.getElementById('content-frame');
    
    if (!contentFrame) {
        console.error('内容iframe未找到');
        return;
    }
    
    // 为每个导航项添加点击事件
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const pageId = this.getAttribute('data-page');
            if (pageId) {
                switchPage(pageId, this);
            }
        });
    });
    
    // 默认激活第一个导航项
    const firstNavItem = navItems[0];
    if (firstNavItem) {
        const firstPageId = firstNavItem.getAttribute('data-page');
        if (firstPageId) {
            switchPage(firstPageId, firstNavItem);
        }
    }
}

/**
 * 切换页面
 * @param {string} pageId - 页面ID
 * @param {HTMLElement} navItem - 导航项元素
 */
function switchPage(pageId, navItem) {
    const config = navConfig[pageId];
    if (!config) {
        console.error(`未找到页面配置: ${pageId}`);
        return;
    }
    
    // 更新导航项激活状态
    updateActiveNavItem(navItem);
    
    // 加载新页面
    loadPage(config.url, config.title);
}

/**
 * 更新导航项激活状态
 * @param {HTMLElement} activeItem - 当前激活的导航项
 */
function updateActiveNavItem(activeItem) {
    // 移除所有导航项的激活状态
    const allNavItems = document.querySelectorAll('.nav-item');
    allNavItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // 添加当前项的激活状态
    activeItem.classList.add('active');
}

/**
 * 加载页面到iframe
 * @param {string} url - 页面URL
 * @param {string} title - 页面标题
 */
function loadPage(url, title) {
    const contentFrame = document.getElementById('content-frame');
    if (!contentFrame) {
        console.error('内容iframe未找到');
        return;
    }
    
    // 显示加载状态
    showLoadingState();
    
    // 加载新页面
    contentFrame.src = url;
    
    // 监听加载完成
    contentFrame.onload = function() {
        hideLoadingState();
        console.log(`页面加载完成: ${title} (${url})`);
    };
    
    contentFrame.onerror = function() {
        hideLoadingState();
        showErrorState(`页面加载失败: ${url}`);
        console.error(`页面加载失败: ${url}`);
    };
}

/**
 * 显示加载状态
 */
function showLoadingState() {
    // 可以在这里添加加载动画或状态提示
    console.log('正在加载页面...');
}

/**
 * 隐藏加载状态
 */
function hideLoadingState() {
    // 隐藏加载动画或状态提示
    console.log('页面加载完成');
}

/**
 * 显示错误状态
 * @param {string} errorMessage - 错误信息
 */
function showErrorState(errorMessage) {
    const contentFrame = document.getElementById('content-frame');
    if (contentFrame) {
        // 显示错误页面或提示
        contentFrame.src = 'error.html?message=' + encodeURIComponent(errorMessage);
    }
}

/**
 * 获取当前激活的页面ID
 * @returns {string|null} 当前页面ID
 */
function getCurrentPageId() {
    const activeItem = document.querySelector('.nav-item.active');
    return activeItem ? activeItem.getAttribute('data-page') : null;
}

/**
 * 刷新当前页面
 */
function refreshCurrentPage() {
    const currentPageId = getCurrentPageId();
    if (currentPageId) {
        const config = navConfig[currentPageId];
        if (config) {
            loadPage(config.url, config.title);
        }
    }
}

// 暴露全局函数供其他脚本调用
window.Navigation = {
    switchPage: switchPage,
    getCurrentPageId: getCurrentPageId,
    refreshCurrentPage: refreshCurrentPage,
    navConfig: navConfig
};