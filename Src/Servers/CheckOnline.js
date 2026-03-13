// CheckOnline.js - 轮询库，用于检查IP/IPv6和端口是否开放

const net = require('net');

/**
 * 检查特定主机和端口是否可达
 * @param {string} host - IP地址或主机名 (支持IPv4和IPv6)
 * @param {number} port - 端口号
 * @param {number} timeout - 连接超时时间 (毫秒)
 * @returns {Promise<boolean>} - 返回Promise，成功时解析为true，失败时解析为false
 */
function checkPort(host, port, timeout = 1000) {
    return new Promise((resolve) => {
        const socket = net.createConnection(port, host);
        
        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

/**
 * 轮询检查器类
 */
class PortPoller {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.host - 要检查的主机 (IP/IPv6)
     * @param {number} [options.port=5726] - 要检查的端口，默认为5726
     * @param {number} [options.interval=5000] - 轮询间隔时间 (毫秒)
     * @param {number} [options.timeout=1000] - 连接超时时间 (毫秒)
     * @param {Function} [options.onStatusChange] - 状态变化回调函数
     * @param {Function} [options.onPoll] - 每次轮询回调函数
     */
    constructor(options) {
        this.host = options.host;
        this.port = options.port || 5726;
        this.interval = options.interval || 5000;
        this.timeout = options.timeout || 1000;
        this.onStatusChange = options.onStatusChange;
        this.onPoll = options.onPoll;
        
        this._timer = null;
        this._isRunning = false;
        this._lastStatus = null;
        this._pollCount = 0;
    }
    
    /**
     * 启动轮询
     */
    start() {
        if (this._isRunning) {
            return;
        }
        
        this._isRunning = true;
        this._poll();
        
        // 设置定时器
        this._timer = setInterval(() => {
            this._poll();
        }, this.interval);
    }
    
    /**
     * 停止轮询
     */
    stop() {
        if (!this._isRunning) {
            return;
        }
        
        this._isRunning = false;
        clearInterval(this._timer);
        this._timer = null;
    }
    
    /**
     * 执行单次检查
     * @returns {Promise<boolean>} - 返回Promise，成功时解析为true，失败时解析为false
     */
    async check() {
        return await checkPort(this.host, this.port, this.timeout);
    }
    
    /**
     * 获取当前状态
     * @returns {Object} - 包含状态信息的对象
     */
    getStatus() {
        return {
            host: this.host,
            port: this.port,
            isRunning: this._isRunning,
            interval: this.interval,
            timeout: this.timeout,
            lastStatus: this._lastStatus,
            pollCount: this._pollCount
        };
    }
    
    /**
     * 内部轮询方法
     * @private
     */
    async _poll() {
        try {
            const status = await checkPort(this.host, this.port, this.timeout);
            this._pollCount++;
            
            // 通知每次轮询结果
            if (typeof this.onPoll === 'function') {
                this.onPoll(status, this.getStatus());
            }
            
            // 检查状态变化
            if (status !== this._lastStatus) {
                this._lastStatus = status;
                
                // 通知状态变化
                if (typeof this.onStatusChange === 'function') {
                    this.onStatusChange(status, this.getStatus());
                }
            }
        } catch (error) {
            console.error('轮询检查出错:', error);
        }
    }
}

/**
 * 创建并启动轮询检查器
 * @param {Object} options - 配置选项
 * @returns {PortPoller} - 返回PortPoller实例
 */
function createPoller(options) {
    const poller = new PortPoller(options);
    poller.start();
    return poller;
}

/**
 * 一次性检查特定主机和端口是否可达
 * @param {string} host - IP地址或主机名 (支持IPv4和IPv6)
 * @param {number} [port=5726] - 端口号，默认为5726
 * @param {number} [timeout=1000] - 连接超时时间 (毫秒)
 * @returns {Promise<boolean>} - 返回Promise，成功时解析为true，失败时解析为false
 */
function checkOnce(host, port = 5726, timeout = 1000) {
    return checkPort(host, port, timeout);
}

module.exports = {
    PortPoller,
    createPoller,
    checkOnce
};

// 示例用法
if (require.main === module) {
    // 示例1: 使用createPoller创建并启动轮询
    const poller = createPoller({
        host: '127.0.0.1',
        port: 5726,
        interval: 3000,
        timeout: 1000,
        onStatusChange: (status, info) => {
            console.log(`状态变化: ${status ? '开放' : '关闭'}`, info);
        },
        onPoll: (status, info) => {
            console.log(`轮询结果: ${status ? '开放' : '关闭'}`, info);
        }
    });
    
    // 10秒后停止轮询
    setTimeout(() => {
        poller.stop();
        console.log('轮询已停止');
        
        // 示例2: 一次性检查
        checkOnce('::1', 5726).then(status => {
            console.log('IPv6本地地址检查结果:', status ? '开放' : '关闭');
        });
    }, 10000);
}
