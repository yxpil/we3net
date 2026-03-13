/**
 * 窗口控制器模块
 * 
 * @author yxpil
 * @responsibility 负责应用程序窗口的控制和管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 窗口控制核心模块，提供以下功能：
 * - 窗口最小化、最大化、还原、关闭
 * - 窗口状态管理
 * - 窗口位置记忆
 * - 窗口大小调整
 * - 窗口事件处理
 * - Electron 环境检测
 * - 窗口动画效果
 * 
 * @usage
 * 通过 WindowController 类实例化使用，提供统一的窗口控制接口
 */

const { SVGIconUtils } = require('./SVGIconUtils.js');

class WindowController {
    constructor() {
        this.isElectron = this.checkElectronEnvironment();
        this.currentWindow = null;
        this.svgIconUtils = new SVGIconUtils();
        
        if (this.isElectron) {
            this.initializeElectronWindow();
        }
    }

    /**
     * 检查是否在 Electron 环境中运行
     */
    checkElectronEnvironment() {
        return typeof process !== 'undefined' && 
               process.versions && 
               process.versions.electron;
    }

    /**
     * 初始化 Electron 窗口
     */
    initializeElectronWindow() {
        try {
            const { remote, BrowserWindow } = require('@electron/remote');
            if (remote) {
                this.currentWindow = remote.getCurrentWindow();
            } else {
                // 使用新的 API
                this.currentWindow = BrowserWindow.getFocusedWindow();
            }
        } catch (error) {
            console.warn('无法获取 Electron 窗口:', error);
            this.isElectron = false;
        }
    }

    /**
     * 最小化窗口
     */
    minimize() {
        if (this.isElectron && this.currentWindow) {
            this.currentWindow.minimize();
            return { success: true, action: 'minimize' };
        } else {
            // 浏览器环境下的模拟操作
            return { 
                success: false, 
                error: '非 Electron 环境，无法最小化窗口',
                simulated: true 
            };
        }
    }

    /**
     * 最大化/还原窗口
     */
    maximize() {
        if (this.isElectron && this.currentWindow) {
            if (this.currentWindow.isMaximized()) {
                this.currentWindow.unmaximize();
                return { success: true, action: 'unmaximize' };
            } else {
                this.currentWindow.maximize();
                return { success: true, action: 'maximize' };
            }
        } else {
            return { 
                success: false, 
                error: '非 Electron 环境，无法最大化窗口',
                simulated: true 
            };
        }
    }

    /**
     * 关闭窗口
     */
    close() {
        if (this.isElectron && this.currentWindow) {
            this.currentWindow.close();
            return { success: true, action: 'close' };
        } else {
            return { 
                success: false, 
                error: '非 Electron 环境，无法关闭窗口',
                simulated: true 
            };
        }
    }

    /**
     * 设置窗口大小
     * @param {number} width - 窗口宽度
     * @param {number} height - 窗口高度
     */
    setSize(width, height) {
        if (this.isElectron && this.currentWindow) {
            this.currentWindow.setSize(width, height);
            return { success: true, action: 'setSize', width, height };
        } else {
            return { 
                success: false, 
                error: '非 Electron 环境，无法设置窗口大小',
                simulated: true 
            };
        }
    }

    /**
     * 获取窗口状态
     */
    getWindowState() {
        if (this.isElectron && this.currentWindow) {
            return {
                isMaximized: this.currentWindow.isMaximized(),
                isMinimized: this.currentWindow.isMinimized(),
                isFullScreen: this.currentWindow.isFullScreen(),
                bounds: this.currentWindow.getBounds(),
                isElectron: true
            };
        } else {
            return {
                isMaximized: false,
                isMinimized: false,
                isFullScreen: false,
                bounds: null,
                isElectron: false
            };
        }
    }

    /**
     * 显示窗口控制按钮 - 使用SVG图标
     */
    createWindowControls(containerId = 'window-controls') {
        if (typeof document === 'undefined') {
            return { success: false, error: 'DOM 环境不可用' };
        }

        const container = document.getElementById(containerId);
        if (!container) {
            return { success: false, error: `找不到容器元素: ${containerId}` };
        }

        // 获取SVG图标
        const svgIcons = this.svgIconUtils.getWindowControlIcons();

        const controlsHTML = `
            <div class="window-controls" style="
                display: flex;
                gap: 8px;
                padding: 4px;
                border-radius: 12px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            ">
                <button id="minimize-btn" class="window-btn minimize" style="
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(5px);
                " title="最小化">
                    ${svgIcons.minimize}
                </button>
                
                <button id="maximize-btn" class="window-btn maximize" style="
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(5px);
                " title="最大化/还原">
                    ${svgIcons.maximize}
                </button>
                
                <button id="close-btn" class="window-btn close" style="
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(5px);
                " title="关闭">
                    ${svgIcons.close}
                </button>
            </div>
        `;

        container.innerHTML = controlsHTML;

        // 绑定事件
        document.getElementById('minimize-btn').addEventListener('click', () => {
            this.minimize();
        });

        document.getElementById('maximize-btn').addEventListener('click', () => {
            this.maximize();
            this.updateMaximizeButtonIcon();
        });

        document.getElementById('close-btn').addEventListener('click', () => {
            this.close();
        });

        // 添加悬停效果
        const buttons = container.querySelectorAll('.window-btn');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'scale(1.05)';
                btn.style.opacity = '1';
                btn.style.filter = 'brightness(1.2)';
                btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
                btn.style.opacity = '0.8';
                btn.style.filter = 'brightness(1)';
                btn.style.boxShadow = 'none';
            });

            // 点击效果
            btn.addEventListener('mousedown', () => {
                btn.style.transform = 'scale(0.95)';
            });

            btn.addEventListener('mouseup', () => {
                btn.style.transform = 'scale(1.05)';
            });
        });

        return { success: true, message: '窗口控制按钮已创建' };
    }

    /**
     * 更新最大化按钮图标
     */
    updateMaximizeButtonIcon() {
        if (typeof document === 'undefined') return;
        
        const maximizeBtn = document.getElementById('maximize-btn');
        if (!maximizeBtn) return;

        const currentState = this.getWindowState();
        const svgIcons = this.svgIconUtils.getWindowControlIcons();
        
        if (currentState.isMaximized) {
            maximizeBtn.innerHTML = svgIcons.restore;
        } else {
            maximizeBtn.innerHTML = svgIcons.maximize;
        }
    }
}

// 创建全局实例
var windowController = new WindowController();

// 导出工具类和实例
module.exports = { WindowController, windowController: windowController };