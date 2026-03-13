

/**
 * 日志工具模块
 * 
 * @author yxpil
 * @responsibility 负责系统日志记录和管理，支持多级别、多类型的日志存储
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 日志管理核心模块，提供以下功能：
 * - 多级别日志记录（TRACE < DEBUG < INFO < WARN < ERROR < FATAL）
 * - 多类型日志分类（NETWORK / SYSTEM / BUSINESS / UNKNOWN）
 * - 按日期和级别分文件存储
 * - 日志文件自动轮转
 * - 格式化日志输出
 * - 日志级别过滤
 * 
 * @usage
 * 通过 logger 对象直接使用，如：logger.info('SYSTEM', '系统启动', data)
 */

const fs = require('fs');
const path = require('path');
const { format } = require('date-fns'); // 需安装：npm install date-fns

/**
 * 日志工具类 - 按级别分文件存储日志
 * 支持级别：TRACE < DEBUG < INFO < WARN < ERROR < FATAL
 * 支持类型：NETWORK / SYSTEM / BUSINESS / UNKNOWN
 */
class Logger {
    /**
     * 构造函数
     * @param {Object} options 配置项
     * @param {string} options.logDir 日志根目录（默认：./logs）
     * @param {string} options.level 日志输出级别（默认：INFO）
     * @param {boolean} options.enableConsole 是否输出到控制台（默认：true）
     */
    constructor(options = {}) {
        // 默认配置
        this.config = {
            logDir: options.logDir || path.join(process.cwd(), 'logs'),
            level: options.level || 'INFO',
            enableConsole: options.enableConsole !== false,
        };

        // 日志级别映射（数字越大级别越高）
        this.levelMap = {
            TRACE: 0,
            DEBUG: 1,
            INFO: 2,
            WARN: 3,
            ERROR: 4,
            FATAL: 5,
        };

        // 错误类型映射
        this.typeMap = {
            NETWORK: 'network', // 网络相关错误
            SYSTEM: 'system',   // 系统/环境错误
            BUSINESS: 'business', // 业务逻辑错误
            UNKNOWN: 'unknown'  // 未知错误
        };

        // 初始化日志目录
        this.initLogDir();
    }

    /**
     * 初始化日志目录（按级别+类型分层）
     */
    initLogDir() {
        // 创建根目录
        if (!fs.existsSync(this.config.logDir)) {
            fs.mkdirSync(this.config.logDir, { recursive: true });
        }

        // 为每个级别创建子目录
        Object.keys(this.levelMap).forEach(level => {
            const levelDir = path.join(this.config.logDir, level.toLowerCase());
            if (!fs.existsSync(levelDir)) {
                fs.mkdirSync(levelDir, { recursive: true });
            }

            // 为每个类型在级别目录下创建子目录
            Object.keys(this.typeMap).forEach(type => {
                const typeDir = path.join(levelDir, this.typeMap[type]);
                if (!fs.existsSync(typeDir)) {
                    fs.mkdirSync(typeDir, { recursive: true });
                }
            });
        });
    }

    /**
     * 格式化日志内容
     * @param {string} level 日志级别
     * @param {string} type 错误类型
     * @param {string} message 日志消息
     * @param {Error} error 错误对象（可选）
     * @returns {string} 格式化后的日志字符串
     */
    formatLog(level, type, message, error = null) {
        const now = new Date();
        const timestamp = format(now, 'yyyy-MM-dd HH:mm:ss.SSS'); // 精确到毫秒
        const pid = process.pid; // 进程ID
        const hostname = require('os').hostname(); // 主机名

        // 基础日志内容
        let logContent = `[${timestamp}] [${level}] [${type}] [${hostname}] [pid:${pid}] - ${message}`;

        // 追加错误栈（如果有错误对象）
        if (error) {
            logContent += `\nError: ${error.message}\nStack: ${error.stack}`;
        }

        return logContent + '\n'; // 每行日志结尾换行
    }

    /**
     * 获取日志文件路径
     * @param {string} level 日志级别
     * @param {string} type 错误类型
     * @returns {string} 日志文件完整路径
     */
    getLogFilePath(level, type) {
        const date = format(new Date(), 'yyyy-MM-dd'); // 按日期分文件
        const levelDir = level.toLowerCase();
        const typeDir = this.typeMap[type] || this.typeMap.UNKNOWN;

        return path.join(
            this.config.logDir,
            levelDir,
            typeDir,
            `${date}.log` // 文件名格式：2026-02-11.log
        );
    }

    /**
     * 核心日志写入方法
     * @param {string} level 日志级别
     * @param {string} type 错误类型
     * @param {string} message 日志消息
     * @param {Error} error 错误对象（可选）
     */
    log(level, type, message, error = null) {
        // 1. 验证级别（低于配置级别则不输出）
        const targetLevel = this.levelMap[level] || this.levelMap.INFO;
        const configLevel = this.levelMap[this.config.level] || this.levelMap.INFO;
        if (targetLevel < configLevel) return;

        // 2. 格式化类型（默认UNKNOWN）
        const logType = Object.keys(this.typeMap).includes(type) ? type : 'UNKNOWN';

        // 3. 格式化日志内容
        const logContent = this.formatLog(level, logType, message, error);

        // 4. 输出到控制台（如果开启）
        if (this.config.enableConsole) {
            const consoleMethod = this.getConsoleMethod(level);
            console[consoleMethod](logContent);
        }

        // 5. 写入文件（异步写入，避免阻塞）
        const logPath = this.getLogFilePath(level, logType);
        fs.appendFile(logPath, logContent, 'utf8', (err) => {
            if (err) {
                console.error(`日志写入失败 [${logPath}]:`, err);
            }
        });
    }

    /**
     * 获取控制台输出方法（映射级别到console方法）
     * @param {string} level 日志级别
     * @returns {string} console方法名
     */
    getConsoleMethod(level) {
        switch (level) {
            case 'TRACE':
            case 'DEBUG':
                return 'log';
            case 'INFO':
                return 'info';
            case 'WARN':
                return 'warn';
            case 'ERROR':
            case 'FATAL':
                return 'error';
            default:
                return 'log';
        }
    }

    // ===== 快捷方法 =====
    trace(type, message, error) {
        this.log('TRACE', type, message, error);
    }

    debug(type, message, error) {
        this.log('DEBUG', type, message, error);
    }

    info(type, message, error) {
        this.log('INFO', type, message, error);
    }

    warn(type, message, error) {
        this.log('WARN', type, message, error);
    }

    error(type, message, error) {
        this.log('ERROR', type, message, error);
    }

    fatal(type, message, error) {
        this.log('FATAL', type, message, error);
    }
}

// 导出单例（全局使用）
const logger = new Logger({
    logDir: path.join(__dirname, '../../Logs'), // 统一日志目录到项目根目录下的Logs
    level: 'DEBUG',       // 输出DEBUG及以上级别日志
    enableConsole: true   // 同时输出到控制台
});

module.exports = { Logger, logger };