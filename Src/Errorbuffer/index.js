/**
 * 致命错误缓冲库
 * 提供全方位的错误捕获、处理和恢复机制，确保程序在各种错误情况下都能继续运行
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

// 导入现有的日志系统
const { logger } = require('../Tools/Logs');


/**
 * 致命错误缓冲器类
 */
class ErrorBuffer extends EventEmitter {
    /**
     * 构造函数
     * @param {Object} options 配置选项
     */
    constructor(options = {}) {
        super();
        
        // 配置项
        this.config = {
            maxErrorLogSize: options.maxErrorLogSize || 10 * 1024 * 1024, // 10MB
            maxErrorHistory: options.maxErrorHistory || 1000, // 最大错误历史记录数
            autoRecover: options.autoRecover !== false, // 自动恢复
            restartAfterErrors: options.restartAfterErrors || 5, // 连续错误数达到此值时考虑重启
            memoryThreshold: options.memoryThreshold || 0.9, // 内存使用率阈值
            ...options
        };
        
        // 状态
        this.errors = [];
        this.recentErrors = 0;
        this.recentErrorsTimer = null;
        this.isMonitoring = false;
        this.lastRestartTime = Date.now();
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化错误缓冲器
     */
    init() {
        try {
            // 设置全局未捕获异常处理
            this.setupGlobalErrorHandlers();
            
            // 启动资源监控
            this.startResourceMonitoring();
            
            // 启动错误恢复机制
            this.startErrorRecovery();
            
            this.emit('initialized');
        } catch (error) {
            // 初始化失败时的超级兜底
            this.handleCriticalError('ErrorBuffer初始化失败', error);
        }
    }
    
    /**
     * 设置全局错误处理程序
     */
    setupGlobalErrorHandlers() {
        try {
            // 处理未捕获的异常
            process.on('uncaughtException', (error, origin) => {
                this.handleUncaughtException(error, origin);
            });
            
            // 处理未处理的Promise拒绝
            process.on('unhandledRejection', (reason, promise) => {
                this.handleUnhandledRejection(reason, promise);
            });
            
            // 处理警告
            process.on('warning', (warning) => {
                this.handleWarning(warning);
            });
            
            // 处理进程信号
            process.on('SIGTERM', () => {
                this.handleShutdown('SIGTERM');
            });
            
            process.on('SIGINT', () => {
                this.handleShutdown('SIGINT');
            });
            
            // 处理退出
            process.on('exit', (code) => {
                this.handleExit(code);
            });
            
        } catch (error) {
            this.handleCriticalError('设置全局错误处理程序失败', error);
        }
    }
    
    /**
     * 处理未捕获的异常
     * @param {Error} error 错误对象
     * @param {string} origin 错误来源
     */
    handleUncaughtException(error, origin) {
        try {
            const errorInfo = {
                type: 'uncaughtException',
                message: error.message || '未捕获的异常',
                error: this.serializeError(error),
                origin,
                timestamp: new Date().toISOString(),
                memory: process.memoryUsage(),
                uptime: process.uptime()
            };
            
            this.addError(errorInfo);
            this.logError(errorInfo);
            this.emit('uncaughtException', errorInfo);
            
            // 尝试恢复
            this.attemptRecovery();
            
        } catch (recoveryError) {
            // 超级兜底：如果恢复也失败，尝试最基本的处理
            console.error('超级兜底：无法从致命错误中恢复:', recoveryError);
            this.emergencyShutdown();
        }
    }
    
    /**
     * 处理未处理的Promise拒绝
     * @param {*} reason 拒绝原因
     * @param {Promise} promise Promise对象
     */
    handleUnhandledRejection(reason, promise) {
        try {
            const errorInfo = {
                type: 'unhandledRejection',
                message: reason.message || 'Promise拒绝',
                reason: this.serializeError(reason),
                promise: promise.toString(),
                timestamp: new Date().toISOString(),
                memory: process.memoryUsage(),
                uptime: process.uptime()
            };
            
            this.addError(errorInfo);
            this.logError(errorInfo);
            this.emit('unhandledRejection', errorInfo);
            
            // Promise拒绝通常不会导致进程崩溃，所以不需要紧急恢复
            
        } catch (error) {
            this.handleCriticalError('处理未处理的Promise拒绝失败', error);
        }
    }
    
    /**
     * 处理警告
     * @param {Object} warning 警告对象
     */
    handleWarning(warning) {
        try {
            const warningInfo = {
                type: 'warning',
                warning: {
                    name: warning.name,
                    message: warning.message,
                    stack: warning.stack
                },
                timestamp: new Date().toISOString()
            };
            
            this.logWarning(warningInfo);
            this.emit('warning', warningInfo);
            
        } catch (error) {
            // 忽略警告处理的错误
        }
    }
    
    /**
     * 处理关机信号
     * @param {string} signal 信号名称
     */
    handleShutdown(signal) {
        try {
            this.emit('shutdown', { signal, timestamp: new Date().toISOString() });
            
            // 执行清理
            this.cleanup();
            
            // 延迟退出，确保清理完成
            setTimeout(() => {
                process.exit(0);
            }, 1000);
            
        } catch (error) {
            console.error('关机处理失败:', error);
            process.exit(1);
        }
    }
    
    /**
     * 处理进程退出
     * @param {number} code 退出码
     */
    handleExit(code) {
        try {
            const exitInfo = {
                type: 'exit',
                code,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            };
            
            this.logInfo(exitInfo);
            this.emit('exit', exitInfo);
            
        } catch (error) {
            // 忽略退出处理的错误
        }
    }
    
    /**
     * 添加错误到历史记录
     * @param {Object} errorInfo 错误信息
     */
    addError(errorInfo) {
        try {
            this.errors.push(errorInfo);
            
            // 限制错误历史记录数量
            if (this.errors.length > this.config.maxErrorHistory) {
                this.errors.shift();
            }
            
            // 更新最近错误计数
            this.recentErrors++;
            
            // 重置最近错误计时器
            if (this.recentErrorsTimer) {
                clearTimeout(this.recentErrorsTimer);
            }
            
            // 5秒内的错误才算连续错误
            this.recentErrorsTimer = setTimeout(() => {
                this.recentErrors = 0;
            }, 5000);
            
        } catch (error) {
            // 如果添加错误也失败，尝试最基本的记录
            console.error('添加错误到历史记录失败:', error);
        }
    }
    
    /**
     * 记录错误到日志系统
     * @param {Object} errorInfo 错误信息
     */
    logError(errorInfo) {
        try {
            // 使用现有的日志系统记录错误
            // 提取错误对象（如果有）
            const error = errorInfo.error instanceof Error ? errorInfo.error : null;
            
            // 构建日志消息
            const message = `致命错误缓冲库捕获到${errorInfo.type}错误: ${errorInfo.message || '未知错误'}`;
            
            logger.error('SYSTEM', message, error);
        } catch (error) {
            // 如果日志系统失败，回退到控制台
            console.error('错误日志记录失败:', error);
            console.error('错误信息:', JSON.stringify(errorInfo, null, 2));
        }
    }
    
    /**
     * 记录警告到日志系统
     * @param {Object} warningInfo 警告信息
     */
    logWarning(warningInfo) {
        try {
            // 构建警告消息
            const message = `致命错误缓冲库警告 - ${warningInfo.type}: ${warningInfo.message || '无详细信息'}`;
            logger.warn('SYSTEM', message, null);
        } catch (error) {
            // 忽略警告日志记录错误
        }
    }
    
    /**
     * 记录信息到日志系统
     * @param {Object} infoInfo 信息
     */
    logInfo(infoInfo) {
        try {
            // 构建信息消息
            const message = `致命错误缓冲库信息 - ${infoInfo.type}: ${infoInfo.message || '无详细信息'}`;
            logger.info('SYSTEM', message, null);
        } catch (error) {
            // 忽略信息日志记录错误
        }
    }
    
    /**
     * 尝试从错误中恢复
     */
    attemptRecovery() {
        try {
            if (!this.config.autoRecover) {
                return;
            }
            
            this.emit('recoveryAttempt');
            
            // 检查连续错误数
            if (this.recentErrors >= this.config.restartAfterErrors) {
                this.considerRestart();
                return;
            }
            
            // 清理内存
            this.cleanupMemory();
            
            // 重置状态
            this.recentErrors = 0;
            
            this.emit('recovered');
            
        } catch (error) {
            this.handleCriticalError('恢复尝试失败', error);
        }
    }
    
    /**
     * 考虑重启应用
     */
    considerRestart() {
        try {
            const now = Date.now();
            
            // 防止频繁重启
            if (now - this.lastRestartTime < 60000) { // 1分钟内不重复重启
                this.handleCriticalError('短时间内已重启过，取消重启', new Error('Too many restarts'));
                return;
            }
            
            this.emit('restarting', { reason: '连续错误数过多', errors: this.recentErrors });
            
            // 记录重启信息
            this.logInfo({
                type: 'restart',
                reason: '连续错误数过多',
                errors: this.recentErrors,
                timestamp: new Date().toISOString()
            });
            
            // 执行重启
            this.restart();
            
        } catch (error) {
            this.handleCriticalError('重启考虑失败', error);
        }
    }
    
    /**
     * 重启应用
     */
    restart() {
        try {
            this.lastRestartTime = Date.now();
            
            // 执行清理
            this.cleanup();
            
            // 使用node的child_process重启
            const { spawn } = require('child_process');
            const args = process.argv.slice(1);
            const newProcess = spawn(process.execPath, args, {
                detached: true,
                stdio: 'inherit'
            });
            
            newProcess.unref();
            
            // 退出当前进程
            process.exit(0);
            
        } catch (error) {
            this.handleCriticalError('重启失败', error);
        }
    }
    
    /**
     * 清理内存
     */
    cleanupMemory() {
        try {
            // 强制垃圾回收（如果可用）
            if (global.gc) {
                global.gc();
            }
            
            // 清理缓存
            if (require.cache) {
                // 只清理非核心模块
                Object.keys(require.cache).forEach((key) => {
                    if (!key.includes('node_modules')) {
                        delete require.cache[key];
                    }
                });
            }
            
        } catch (error) {
            console.error('内存清理失败:', error);
        }
    }
    
    /**
     * 启动资源监控
     */
    startResourceMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        
        // 每秒检查一次资源使用情况
        setInterval(() => {
            try {
                this.checkResources();
            } catch (error) {
                console.error('资源监控失败:', error);
            }
        }, 1000);
    }
    
    /**
     * 检查资源使用情况
     */
    checkResources() {
        try {
            // 检查内存使用情况
            const memoryUsage = process.memoryUsage();
            const totalMemory = os.totalmem();
            const memoryUsageRatio = memoryUsage.rss / totalMemory;
            
            if (memoryUsageRatio > this.config.memoryThreshold) {
                this.handleMemoryPressure(memoryUsage, memoryUsageRatio);
            }
            
            // 检查CPU使用情况（简单实现）
            const cpuUsage = process.cpuUsage();
            
            // 可以添加更多资源检查
            
        } catch (error) {
            console.error('资源检查失败:', error);
        }
    }
    
    /**
     * 处理内存压力
     * @param {Object} memoryUsage 内存使用情况
     * @param {number} memoryUsageRatio 内存使用率
     */
    handleMemoryPressure(memoryUsage, memoryUsageRatio) {
        try {
            this.emit('memoryPressure', { memoryUsage, memoryUsageRatio, timestamp: new Date().toISOString() });
            
            // 记录内存压力
            this.logInfo({
                type: 'memoryPressure',
                memoryUsage,
                memoryUsageRatio,
                timestamp: new Date().toISOString()
            });
            
            // 清理内存
            this.cleanupMemory();
            
        } catch (error) {
            this.handleCriticalError('内存压力处理失败', error);
        }
    }
    
    /**
     * 启动错误恢复机制
     */
    startErrorRecovery() {
        // 可以添加定期恢复检查
    }
    
    /**
     * 处理致命错误
     * @param {string} message 错误消息
     * @param {Error} error 错误对象
     */
    handleCriticalError(message, error) {
        try {
            const criticalErrorInfo = {
                type: 'critical',
                message,
                error: this.serializeError(error),
                timestamp: new Date().toISOString(),
                memory: process.memoryUsage(),
                uptime: process.uptime()
            };
            
            this.addError(criticalErrorInfo);
            this.logError(criticalErrorInfo);
            this.emit('criticalError', criticalErrorInfo);
            
            // 尝试紧急恢复
            this.emergencyRecover();
            
        } catch (finalError) {
            // 终极兜底：如果所有处理都失败，尝试最基本的退出
            console.error('终极兜底：无法处理致命错误:', finalError);
            this.emergencyShutdown();
        }
    }
    
    /**
     * 紧急恢复
     */
    emergencyRecover() {
        try {
            // 清理所有资源
            this.cleanup();
            
            // 重置状态
            this.errors = [];
            this.recentErrors = 0;
            
            // 重新初始化
            this.init();
            
        } catch (error) {
            this.emergencyShutdown();
        }
    }
    
    /**
     * 紧急关闭
     */
    emergencyShutdown() {
        try {
            console.error('执行紧急关闭...');
            
            // 记录紧急关闭
            this.logInfo({
                type: 'emergencyShutdown',
                timestamp: new Date().toISOString(),
                reason: '无法从致命错误中恢复'
            });
            
            // 立即退出
            process.exit(1);
            
        } catch (error) {
            // 如果紧急关闭也失败，强制退出
            process.abort();
        }
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        try {
            // 停止资源监控
            this.isMonitoring = false;
            
            // 清理定时器
            if (this.recentErrorsTimer) {
                clearTimeout(this.recentErrorsTimer);
                this.recentErrorsTimer = null;
            }
            
            // 移除事件监听器
            this.removeAllListeners();
            
            // 可以添加更多清理操作
            
        } catch (error) {
            console.error('清理失败:', error);
        }
    }
    
    /**
     * 序列化错误对象，确保可以被JSON.stringify处理
     * @param {*} error 错误对象
     * @returns {Object} 序列化后的错误信息
     */
    serializeError(error) {
        try {
            if (!error || typeof error !== 'object') {
                return { message: String(error) };
            }
            
            const serialized = {
                message: error.message || 'Unknown error',
                name: error.name || 'Error',
                stack: error.stack || ''
            };
            
            // 添加其他属性
            for (const key in error) {
                if (error.hasOwnProperty(key) && !serialized[key]) {
                    try {
                        serialized[key] = JSON.stringify(error[key]);
                    } catch (e) {
                        serialized[key] = String(error[key]);
                    }
                }
            }
            
            return serialized;
            
        } catch (e) {
            return { message: 'Failed to serialize error', original: String(error) };
        }
    }
    
    /**
     * 获取错误统计信息
     * @returns {Object} 错误统计信息
     */
    getStats() {
        try {
            return {
                totalErrors: this.errors.length,
                recentErrors: this.recentErrors,
                errorTypes: this.getErrorTypes(),
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime(),
                lastRestartTime: this.lastRestartTime
            };
        } catch (error) {
            return { error: 'Failed to get stats', message: error.message };
        }
    }
    
    /**
     * 获取错误类型统计
     * @returns {Object} 错误类型统计
     */
    getErrorTypes() {
        try {
            const types = {};
            
            this.errors.forEach(error => {
                const type = error.type || 'unknown';
                types[type] = (types[type] || 0) + 1;
            });
            
            return types;
            
        } catch (error) {
            return { error: 'Failed to get error types' };
        }
    }
}

// 创建单例实例
const errorBuffer = new ErrorBuffer();

// 导出错误缓冲器
module.exports = {
    ErrorBuffer,
    errorBuffer,
    // 便捷方法：包装函数执行
    wrap: (fn, options = {}) => {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                errorBuffer.handleCriticalError(`Wrapped function failed: ${fn.name}`, error);
                
                // 返回默认值
                return options.defaultValue;
            }
        };
    },
    // 便捷方法：包装Promise
    wrapPromise: (promise, options = {}) => {
        return promise.catch(error => {
            errorBuffer.handleCriticalError('Wrapped promise failed', error);
            return options.defaultValue;
        });
    },
    // 便捷方法：初始化错误缓冲器
    init: (options = {}) => {
        return new ErrorBuffer(options);
    }
};

// 导出全局实例
module.exports.default = errorBuffer;