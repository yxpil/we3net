/**
 * 全局消息提示系统
 * Global Notification System
 * 提供统一的消息提示界面，支持成功、错误、警告、信息等类型
 */

class GlobalNotification {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.init();
    }

    /**
     * 初始化消息容器
     */
    init() {
        if (document.getElementById('global-notification-container')) {
            return;
        }

        // 创建消息容器
        this.container = document.createElement('div');
        this.container.id = 'global-notification-container';
        this.container.className = 'notification-container';
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            }
            
            .notification {
                background: #fff;
                border-radius: 8px;
                padding: 16px 20px;
                margin-bottom: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                border-left: 4px solid #ddd;
                min-width: 300px;
                max-width: 400px;
                transform: translateX(400px);
                opacity: 0;
                transition: all 0.3s ease;
                pointer-events: all;
                position: relative;
            }
            
            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .notification.success {
                border-left-color: #52c41a;
                background: #f6ffed;
            }
            
            .notification.error {
                border-left-color: #ff4d4f;
                background: #fff2f0;
            }
            
            .notification.warning {
                border-left-color: #faad14;
                background: #fffbe6;
            }
            
            .notification.info {
                border-left-color: #1890ff;
                background: #e6f7ff;
            }
            
            .notification-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                margin-right: 12px;
                flex-shrink: 0;
            }
            
            .notification-content {
                display: flex;
                align-items: flex-start;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
                line-height: 1.5;
                color: #333;
            }
            
            .notification-title {
                font-weight: 500;
                margin-bottom: 4px;
                color: #111;
            }
            
            .notification-close {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.6;
                transition: opacity 0.2s ease;
            }
            
            .notification-close:hover {
                opacity: 1;
                background: rgba(0, 0, 0, 0.05);
            }
            
            .notification-close svg {
                width: 14px;
                height: 14px;
                fill: #666;
            }
            
            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 2px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 0 0 8px 8px;
                transition: width linear;
            }
            
            @media (max-width: 768px) {
                .notification-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                }
                
                .notification {
                    min-width: auto;
                    max-width: none;
                    transform: translateY(-100px);
                }
                
                .notification.show {
                    transform: translateY(0);
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(this.container);
    }

    /**
     * 显示通知
     */
    show(options) {
        const notification = this.createNotification(options);
        this.container.appendChild(notification);
        
        // 触发动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 自动关闭
        if (options.duration !== 0) {
            const duration = options.duration || 3000;
            this.startProgressBar(notification, duration);
            
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }
        
        this.notifications.push(notification);
        return notification;
    }

    /**
     * 创建通知元素
     */
    createNotification(options) {
        const notification = document.createElement('div');
        notification.className = `notification ${options.type || 'info'}`;
        
        const icon = this.getIcon(options.type || 'info');
        const title = options.title ? `<div class="notification-title">${options.title}</div>` : '';
        const message = `<div class="notification-message">${title}${options.message}</div>`;
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                ${message}
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
            <div class="notification-progress"></div>
        `;
        
        return notification;
    }

    /**
     * 获取图标SVG
     */
    getIcon(type) {
        const icons = {
            success: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#52c41a">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>`,
            error: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#ff4d4f">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>`,
            warning: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#faad14">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>`,
            info: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#1890ff">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>`
        };
        
        return icons[type] || icons.info;
    }

    /**
     * 开始进度条动画
     */
    startProgressBar(notification, duration) {
        const progressBar = notification.querySelector('.notification-progress');
        if (progressBar) {
            progressBar.style.transitionDuration = `${duration}ms`;
            progressBar.style.width = '0%';
            setTimeout(() => {
                progressBar.style.width = '100%';
            }, 100);
        }
    }

    /**
     * 移除通知
     */
    removeNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }

    /**
     * 快捷方法：成功通知
     */
    success(message, title, duration) {
        return this.show({
            type: 'success',
            title: title,
            message: message,
            duration: duration
        });
    }

    /**
     * 快捷方法：错误通知
     */
    error(message, title, duration) {
        return this.show({
            type: 'error',
            title: title,
            message: message,
            duration: duration
        });
    }

    /**
     * 快捷方法：警告通知
     */
    warning(message, title, duration) {
        return this.show({
            type: 'warning',
            title: title,
            message: message,
            duration: duration
        });
    }

    /**
     * 快捷方法：信息通知
     */
    info(message, title, duration) {
        return this.show({
            type: 'info',
            title: title,
            message: message,
            duration: duration
        });
    }
}

// 创建全局实例
const notification = new GlobalNotification();

// 添加到全局作用域，方便在HTML中直接使用
window.notification = notification;

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobalNotification;
}