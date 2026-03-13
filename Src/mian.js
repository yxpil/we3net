/**
 * We3Net 主程序入口文件
 * 
 * @author yxpil
 * @responsibility 负责整个应用程序的启动、窗口管理、系统托盘、HTTP服务器管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 这是 Electron 应用的主进程文件，负责：
 * - 应用程序生命周期管理
 * - 主窗口创建和管理
 * - 系统托盘集成
 * - HTTP服务器子进程管理
 * - IPC通信处理
 * - 窗口控制事件处理
 * 
 * @usage
 * 作为 Electron 应用的入口点，通过 package.json 中的 main 字段指定
 */

const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { logger } = require('./Tools/Logs.js');
const PasswordValidator = require('./Tools/Password.js');

// 窗口控制枚举
const WindowControl = {
  MINIMIZE: 'minimize',
  MAXIMIZE: 'maximize',
  CLOSE: 'close',
  RESTORE: 'restore'
};

// 保持窗口对象的全局引用
let mainWindow;
let httpServerProcess; // HTTP服务器子进程
let serverCheckInterval; // 服务器检查定时器
let tray; // 系统托盘实例

// 创建系统托盘函数
function createTray() {
    logger.info('SYSTEM', '创建系统托盘', null);
    
    // 设置托盘图标路径
    const iconPath = path.join(__dirname, '../Static/Images/icon.png');
    
    // 检查图标文件是否存在
    if (!require('fs').existsSync(iconPath)) {
        logger.error('SYSTEM', '系统托盘图标文件不存在', null);
        return;
    }
    
    // 创建系统托盘实例
    tray = new Tray(iconPath);
    
    // 设置托盘提示文本
    tray.setToolTip('we3net');
    
    // 创建托盘菜单模板
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: '隐藏窗口',
            click: () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.hide();
                }
            }
        },
        {
            type: 'separator'
        },
        {
            label: '退出应用',
            click: () => {
                app.quit();
            }
        }
    ]);
    
    // 设置托盘菜单
    tray.setContextMenu(contextMenu);
    
    // 托盘被点击时的处理
    tray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

// 创建浏览器窗口函数
function createWindow() {
    logger.info('SYSTEM', '创建 Electron 主窗口', null);
    
    // 创建浏览器窗口 - 启动界面使用小尺寸
    mainWindow = new BrowserWindow({
        width: 300,  // 宽度减半
        height: 200, // 高度减半
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            devTools: true // 启用开发工具
        },
        frame: false, // 无边框窗口
        transparent: false, // 不透明背景
        resizable: false, // 不可调整大小
        show: false, // 初始不显示，加载完成后再显示
        icon: path.join(__dirname, 'Static/Images/icon.png'), // 图标（如果有的话）
        alwaysOnTop: true, // 启动窗口置顶显示
        skipTaskbar: false  // 显示在任务栏
    });

    // 加载启动界面
    const startUrl = path.join(__dirname, '../Static/Viwes/start.html');
    logger.info('SYSTEM', `加载启动界面: ${startUrl}`, null);
    
    mainWindow.loadFile(startUrl);

    // 窗口加载完成后的处理
    mainWindow.once('ready-to-show', () => {
        logger.info('SYSTEM', '窗口准备就绪，显示启动界面', null);
        mainWindow.show();
        
        // 启动HTTP服务器子进程并开始轮询
        startHttpServer();
        pollServerStatus(); // 异步轮询，不阻塞
    });

    // 窗口关闭按钮点击时的处理（隐藏窗口而不是关闭）
    mainWindow.on('close', (event) => {
        if (process.platform !== 'darwin') { // 非 macOS 系统
            event.preventDefault(); // 阻止默认关闭行为
            mainWindow.hide(); // 隐藏窗口
            logger.info('SYSTEM', '窗口已隐藏到托盘', null);
        }
    });

    // 窗口关闭时的处理（仅当窗口被销毁时）
    mainWindow.on('closed', () => {
        logger.info('SYSTEM', '主窗口已关闭', null);
        mainWindow = null;
    });

    // 监听渲染进程的消息
    setupIpcHandlers();
}

// 加载主应用程序
function loadMainApplication() {
    logger.info('SYSTEM', '启动主应用程序', null);
    
    // 直接加载主界面 - 无延迟
    const mainUrl = path.join(__dirname, '../Static/Viwes/Main.html');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        // 立即加载主界面
        mainWindow.loadFile(mainUrl);
        
        // 恢复窗口大小和样式
        mainWindow.setSize(1024, 768);
        mainWindow.setResizable(true);
        mainWindow.setMinimumSize(800, 600);
        mainWindow.setTitle('we3net');
        
        logger.info('SYSTEM', '主应用程序加载完成', null);
    }
}

// 检查HTTP服务器状态
function checkHttpServerStatus() {
    return new Promise((resolve) => {
        const options = {
            hostname: '127.0.0.1',
            port: 5726,
            path: '/health',
            method: 'GET',
            timeout: 1000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response.ready || false);
                } catch (e) {
                    resolve(false);
                }
            });
        });

        req.on('error', () => {
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// 启动HTTP服务器子进程
function startHttpServer() {
    logger.info('SYSTEM', '启动HTTP服务器子进程', null);
    
    const serverPath = path.join(__dirname, 'Nets/main.js');
    
    httpServerProcess = spawn('node', [serverPath], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..') // 设置为项目根目录
    });

    httpServerProcess.stdout.on('data', (data) => {
        logger.info('SYSTEM', `HTTP服务器: ${data.toString().trim()}`, null);
    });

    httpServerProcess.stderr.on('data', (data) => {
        logger.error('SYSTEM', `HTTP服务器错误: ${data.toString().trim()}`, null);
    });

    httpServerProcess.on('close', (code) => {
        logger.info('SYSTEM', `HTTP服务器子进程退出，代码: ${code}`, null);
    });

    httpServerProcess.on('error', (error) => {
        logger.error('SYSTEM', 'HTTP服务器子进程启动失败', error);
    });
}

// 轮询服务器状态
async function pollServerStatus() {
    let retryCount = 0;
    const maxRetries = 50; // 最多轮询50次（约50秒）
    
    while (retryCount < maxRetries) {
        const isReady = await checkHttpServerStatus();
        
        if (isReady) {
            logger.info('SYSTEM', 'HTTP服务器已就绪，加载主应用程序', null);
            
            // 向渲染进程发送服务器就绪消息
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server-ready', { ready: true });
            }
            
            // 延迟一点时间让用户看到完成状态，然后加载主界面
            setTimeout(() => {
                loadMainApplication();
            }, 500);
            
            return;
        }
        
        retryCount++;
        const progress = Math.round((retryCount / maxRetries) * 100);
        
        logger.info('SYSTEM', `等待HTTP服务器启动... (${retryCount}/${maxRetries})`, null);
        
        // 向渲染进程发送进度更新
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('loading-progress', {
                message: `等待服务器启动... ${progress}%`,
                progress: progress
            });
        }
        
        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.error('SYSTEM', 'HTTP服务器启动超时', null);
    
    // 向渲染进程发送超时消息
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-timeout', { timeout: true });
    }
}

// 设置 IPC 处理器
function setupIpcHandlers() {
    // 防止重复注册 - 先移除现有的处理器
    ipcMain.removeAllListeners('validate-password');
    ipcMain.removeAllListeners('get-logs');
    ipcMain.removeAllListeners('window-minimize');
    ipcMain.removeAllListeners('window-maximize');
    ipcMain.removeAllListeners('window-close');
    ipcMain.removeAllListeners('get-window-state');
    
    // 密码验证请求
    ipcMain.handle('validate-password', async (event, password) => {
        try {
            const passwordValidator = new PasswordValidator({
                minLength: 8,
                maxLength: 32,
                requireUppercase: true,
                requireLowercase: true,
                requireNumber: true,
                requireSpecialChar: true
            });
            
            const result = passwordValidator.validate(password);
            logger.info('BUSINESS', `密码验证请求: ${password}`, null);
            
            return result;
        } catch (error) {
            logger.error('SYSTEM', '密码验证错误', error);
            return { valid: false, errors: ['验证过程出错'] };
        }
    });

    // 获取日志信息
    ipcMain.handle('get-logs', async (event, level = 'INFO') => {
        try {
            // 这里可以实现读取日志文件的逻辑
            logger.info('SYSTEM', `获取${level}级别日志请求`, null);
            return { success: true, level: level, message: '日志功能已准备就绪' };
        } catch (error) {
            logger.error('SYSTEM', '获取日志错误', error);
            return { success: false, error: error.message };
        }
    });

    // 窗口控制
    ipcMain.handle('window-minimize', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize();
            logger.info('SYSTEM', '窗口最小化', null);
        }
    });

    ipcMain.handle('window-maximize', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
                logger.info('SYSTEM', '窗口还原', null);
            } else {
                mainWindow.maximize();
                logger.info('SYSTEM', '窗口最大化', null);
            }
        }
    });

    ipcMain.handle('window-close', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.close();
            logger.info('SYSTEM', '窗口关闭', null);
        }
    });

    // 获取窗口状态
    ipcMain.handle('get-window-state', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            return {
                success: true,
                isMaximized: mainWindow.isMaximized(),
                isMinimized: mainWindow.isMinimized(),
                isFullScreen: mainWindow.isFullScreen(),
                bounds: mainWindow.getBounds()
            };
        } else {
            return { success: false, error: '窗口不存在' };
        }
    });
}

// Electron 应用准备就绪
app.whenReady().then(() => {
    logger.info('SYSTEM', 'Electron 应用准备就绪', null);
    
    // 设置应用名称
    app.setName('we3net');
    
    // 设置应用图标
    const iconPath = path.join(__dirname, '../Static/Images/icon.png');
    if (require('fs').existsSync(iconPath)) {
        app.dock && app.dock.setIcon && app.dock.setIcon(iconPath);
    }
    
    // 创建窗口
    createWindow();
    
    // 创建系统托盘
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时不退出应用，保持在托盘中运行
app.on('window-all-closed', () => {
    logger.info('SYSTEM', '所有窗口已关闭，应用继续在托盘中运行', null);
    // 不退出应用，保持在托盘中运行
    // if (process.platform !== 'darwin') {
    //     app.quit();
    // }
});

// 应用即将退出
app.on('before-quit', () => {
    logger.info('SYSTEM', '应用即将退出', null);
    
    // 清理HTTP服务器子进程
    if (httpServerProcess && !httpServerProcess.killed) {
        logger.info('SYSTEM', '正在关闭HTTP服务器子进程...', null);
        httpServerProcess.kill('SIGTERM');
    }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    logger.error('SYSTEM', '未捕获的异常', error);
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('SYSTEM', '未处理的 Promise 拒绝', new Error(reason));
    console.error('未处理的 Promise 拒绝:', reason);
});