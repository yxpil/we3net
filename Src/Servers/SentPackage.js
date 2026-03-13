const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { onlyId } = require('../OnlyID');
const UserInfoManager = require('../Nets/userinfo');
const { networkStatus } = require('../Tools/NetworkStatus');
const { logger } = require('../Tools/Logs');

/**
 * 数据包发送模块
 * 负责数据包的发送和传输管理，集成OnlyID、用户信息和网络状态检测
 * 
 * @author yxpil
 * @responsibility 负责数据包的发送和传输管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 数据包发送核心模块，提供以下功能：
 * - 数据包封装和发送
 * - 传输协议管理
 * - 发送状态追踪
 * - 重传机制
 * - 数据包压缩
 * - 发送队列管理
 * - 传输异常处理
 * - 发送性能统计
 * - 网络状态自动检测
 * - 用户信息集成
 * - OnlyID设备标识
 * 
 * @usage
 * 作为数据包发送服务，为应用提供数据包传输能力
 */
class SentPackage {
    constructor() {
        // 初始化模块
        this.userInfoManager = new UserInfoManager();
        this.packageQueue = [];
        this.isRunning = false;
        this.sendInterval = null;
        this.defaultSendInterval = 6000; // 默认发送间隔：6秒
        this.retryCount = 3; // 默认重试次数
        this.udpSocket = null;
        this.broadcastPort = 5726;
        this.broadcastAddress = '255.255.255.255';
        
        // 初始化发送统计
        this.stats = {
            totalPackages: 0,
            successPackages: 0,
            failedPackages: 0,
            retryCount: 0
        };
        
        // 初始化设备列表
        this.devices = new Map();
    }

    /**
     * 初始化数据包发送模块
     * @param {Object} options 配置选项
     */
    initialize(options = {}) {
        this.sendInterval = options.sendInterval || this.defaultSendInterval;
        this.retryCount = options.retryCount || this.retryCount;
        this.broadcastPort = options.broadcastPort || this.broadcastPort;
        this.broadcastAddress = options.broadcastAddress || this.broadcastAddress;
        
        // 初始化UDP socket用于广播
        this.initUDPSocket();
        
        logger.info('SYSTEM', '数据包发送模块初始化完成', {
            sendInterval: this.sendInterval,
            retryCount: this.retryCount,
            broadcastPort: this.broadcastPort,
            broadcastAddress: this.broadcastAddress
        });
    }
    
    /**
     * 初始化UDP socket
     */
    initUDPSocket() {
        if (this.udpSocket) {
            return;
        }
        
        const dgram = require('dgram');
        this.udpSocket = dgram.createSocket('udp4');
        
        // 监听来自其他设备的响应
        this.udpSocket.on('message', (message, remote) => {
            this.handleIncomingMessage(message, remote);
        });
        
        this.udpSocket.on('error', (error) => {
            logger.error('NETWORK', 'UDP socket错误', error);
        });
        
        // 绑定到随机端口以便接收响应
        this.udpSocket.bind(() => {
            try {
                // 绑定成功后再允许广播
                this.udpSocket.setBroadcast(true);
                logger.debug('NETWORK', 'UDP socket已绑定并启用广播', {
                    address: this.udpSocket.address().address,
                    port: this.udpSocket.address().port
                });
            } catch (error) {
                logger.error('NETWORK', '设置UDP广播失败', error);
            }
        });
    }
    
    /**
     * 处理接收到的UDP消息
     * @param {Buffer} message 接收到的消息
     * @param {Object} remote 远程地址信息
     */
    handleIncomingMessage(message, remote) {
        try {
            const packetData = JSON.parse(message.toString());
            
            // 只处理设备发现和握手消息
            if (packetData.header && packetData.header.type === 'device-discovery') {
                this.handleDeviceDiscovery(packetData, remote);
            } else if (packetData.header && packetData.header.type === 'handshake-response') {
                this.handleHandshakeResponse(packetData, remote);
            }
        } catch (error) {
            logger.debug('NETWORK', '处理UDP消息失败', {
                error: error.message,
                remote: remote.address
            });
        }
    }
    
    /**
     * 处理设备发现消息
     * @param {Object} packetData 数据包
     * @param {Object} remote 远程地址信息
     */
    handleDeviceDiscovery(packetData, remote) {
        // 记录发现的设备
        this.devices.set(packetData.header.onlyID, {
            onlyID: packetData.header.onlyID,
            userID: packetData.header.userID,
            ipAddress: remote.address,
            port: packetData._meta?.remotePort || remote.port,
            lastSeen: new Date().toISOString(),
            networkStatus: packetData.payload.networkStatus,
            systemInfo: packetData.payload.systemInfo
        });
        
        logger.debug('NETWORK', '发现设备', {
            onlyID: packetData.header.onlyID,
            userID: packetData.header.userID,
            ipAddress: remote.address
        });
        
        // 发送握手响应
        this.sendHandshakeResponse(packetData.header.onlyID, remote);
    }
    
    /**
     * 处理握手响应消息
     * @param {Object} packetData 数据包
     * @param {Object} remote 远程地址信息
     */
    handleHandshakeResponse(packetData, remote) {
        // 记录设备信息
        this.devices.set(packetData.header.onlyID, {
            onlyID: packetData.header.onlyID,
            userID: packetData.header.userID,
            ipAddress: remote.address,
            port: packetData._meta?.remotePort || remote.port,
            lastSeen: new Date().toISOString(),
            networkStatus: packetData.payload.networkStatus,
            systemInfo: packetData.payload.systemInfo
        });
        
        logger.debug('NETWORK', '收到握手响应', {
            onlyID: packetData.header.onlyID,
            userID: packetData.header.userID,
            ipAddress: remote.address
        });
    }
    
    /**
     * 发送握手响应
     * @param {string} targetOnlyID 目标设备ID
     * @param {Object} remote 远程地址信息
     */
    async sendHandshakeResponse(targetOnlyID, remote) {
        // 创建握手响应数据包
        const handshakePacket = await this.createPackage({
            type: 'handshake-response',
            targetOnlyID: targetOnlyID
        });
        
        handshakePacket.header.type = 'handshake-response';
        
        // 直接发送到请求设备
        this.sendUDPPacketDirect(handshakePacket, remote.address, remote.port);
    }

    /**
     * 开始自动发送数据包
     */
    startAutoSend() {
        if (this.isRunning) {
            logger.warn('SYSTEM', '自动发送功能已在运行中', null);
            return;
        }

        this.isRunning = true;
        
        // 立即发送一次
        this.sendPackage();
        
        // 设置定时发送
        this.sendIntervalId = setInterval(() => {
            this.sendPackage();
        }, this.sendInterval);
        
        logger.info('SYSTEM', '自动发送功能已启动', {
            sendInterval: this.sendInterval
        });
    }

    /**
     * 停止自动发送数据包
     */
    stopAutoSend() {
        if (!this.isRunning) {
            logger.warn('SYSTEM', '自动发送功能未在运行中', null);
            return;
        }

        this.isRunning = false;
        clearInterval(this.sendIntervalId);
        this.sendIntervalId = null;
        
        logger.info('SYSTEM', '自动发送功能已停止', null);
    }

    /**
     * 获取设备唯一标识
     * @returns {Promise<string>} OnlyID
     */
    async getOnlyID() {
        try {
            return await onlyId.generate();
        } catch (error) {
            logger.error('SYSTEM', '获取OnlyID失败', error);
            return null;
        }
    }

    /**
     * 获取用户信息
     * @param {boolean} publicOnly 是否只获取公开信息
     * @returns {Object} 用户信息
     */
    getUserInfo(publicOnly = true) {
        try {
            if (publicOnly) {
                return this.userInfoManager.getPublicUserInfo();
            } else {
                return this.userInfoManager.getUserInfo();
            }
        } catch (error) {
            logger.error('SYSTEM', '获取用户信息失败', error);
            return null;
        }
    }

    /**
     * 检测网络连接状态
     * @returns {Promise<Object>} 网络状态对象
     */
    async checkNetworkStatus() {
        try {
            return await networkStatus.checkNetworkStatus();
        } catch (error) {
            logger.error('SYSTEM', '检测网络状态失败', error);
            return {
                isConnected: false,
                connectionType: 'none',
                ipAddresses: {},
                dnsStatus: 'failed',
                latency: null
            };
        }
    }

    /**
     * 创建数据包
     * @param {Object} customData 自定义数据
     * @returns {Promise<Object>} 完整的数据包
     */
    async createPackage(customData = {}) {
        // 获取设备唯一标识
        const onlyID = await this.getOnlyID();
        
        // 获取用户信息
        const userInfo = this.getUserInfo();
        
        // 获取网络状态
        const networkStatus = await this.checkNetworkStatus();
        
        // 创建数据包
        const packageData = {
            header: {
                version: '1.0',
                timestamp: new Date().toISOString(),
                type: 'device-status',
                onlyID: onlyID || 'unknown',
                userID: userInfo?.nickname || 'unknown'
            },
            payload: {
                userInfo: userInfo,
                networkStatus: networkStatus,
                systemInfo: {
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version
                },
                customData: customData
            },
            footer: {
                checksum: this.calculateChecksum(customData),
                retryCount: 0
            }
        };
        
        return packageData;
    }

    /**
     * 计算数据包校验和
     * @param {Object} data 要计算校验和的数据
     * @returns {string} 校验和
     */
    calculateChecksum(data) {
        const crypto = require('crypto');
        const strData = JSON.stringify(data);
        const hash = crypto.createHash('sha256');
        hash.update(strData);
        return hash.digest('hex');
    }

    /**
     * 发送数据包
     * @param {Object} customData 自定义数据
     * @param {Object} options 发送选项
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendPackage(customData = {}, options = {}) {
        // 检测网络连接状态
        const networkStatus = await this.checkNetworkStatus();
        
        if (!networkStatus.isConnected) {
            logger.warn('NETWORK', '网络未连接，无法发送数据包', null);
            return false;
        }
        
        // 增加总发送次数统计
        this.stats.totalPackages++;
        
        // 创建数据包
        const packageData = await this.createPackage(customData);
        
        // 发送数据包（使用新的sendPacket方法，支持多种协议）
        const success = await this.sendPacket(packageData, options);
        
        if (success) {
            logger.info('NETWORK', '数据包发送成功', {
                onlyID: packageData.header.onlyID,
                userID: packageData.header.userID,
                protocol: options.protocol || 'http'
            });
            this.stats.successPackages++;
        } else {
            logger.error('NETWORK', '数据包发送失败', {
                onlyID: packageData.header.onlyID,
                userID: packageData.header.userID,
                protocol: options.protocol || 'http'
            });
            this.stats.failedPackages++;
        }
        
        return success;
    }

    /**
     * 发送HTTP请求
     * @param {Object} data 要发送的数据
     * @param {Object} options 发送选项
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendHTTPRequest(data, options = {}) {
        const { url = 'http://localhost:5726/api/data', method = 'POST', retry = 0 } = options;
        
        return new Promise((resolve) => {
            const protocol = url.startsWith('https') ? https : http;
            const requestOptions = {
                method: method,
                timeout: 10000
            };
            
            const req = protocol.request(url, requestOptions, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            
            req.on('error', (error) => {
                logger.error('NETWORK', '发送HTTP请求失败', {
                    error: error.message,
                    url: url
                });
                
                // 重试逻辑
                if (retry < this.retryCount) {
                    logger.info('NETWORK', `重试发送数据包 (${retry + 1}/${this.retryCount})`, {
                        url: url
                    });
                    this.stats.retryCount++;
                    
                    // 延迟重试
                    setTimeout(() => {
                        this.sendHTTPRequest(data, { ...options, retry: retry + 1 })
                            .then(resolve)
                            .catch(() => resolve(false));
                    }, 2000 * (retry + 1)); // 指数退避
                } else {
                    resolve(false);
                }
            });
            
            req.on('timeout', () => {
                req.destroy();
                logger.error('NETWORK', '发送HTTP请求超时', {
                    url: url
                });
                resolve(false);
            });
            
            // 发送数据
            req.write(JSON.stringify(data));
            req.end();
        });
    }
    
    /**
     * 发送UDP广播数据包
     * @param {Object} data 要发送的数据
     * @param {Object} options 发送选项
     * @returns {Promise<boolean>} 发送是否成功
     */
    sendUDPPacket(data, options = {}) {
        const { host = this.broadcastAddress, port = this.broadcastPort } = options;
        
        return new Promise((resolve) => {
            if (!this.udpSocket) {
                this.initUDPSocket();
            }
            
            const message = Buffer.from(JSON.stringify(data));
            
            this.udpSocket.send(message, port, host, (err) => {
                if (err) {
                    logger.error('NETWORK', '发送UDP广播失败', {
                        error: err.message,
                        host: host,
                        port: port
                    });
                    resolve(false);
                } else {
                    logger.info('NETWORK', 'UDP广播发送成功', {
                        host: host,
                        port: port
                    });
                    resolve(true);
                }
            });
        });
    }
    
    /**
     * 直接发送UDP数据包到特定设备
     * @param {Object} data 要发送的数据
     * @param {string} host 目标主机地址
     * @param {number} port 目标端口
     * @returns {Promise<boolean>} 发送是否成功
     */
    sendUDPPacketDirect(data, host, port) {
        return new Promise((resolve) => {
            if (!this.udpSocket) {
                this.initUDPSocket();
            }
            
            const message = Buffer.from(JSON.stringify(data));
            
            this.udpSocket.send(message, port, host, (err) => {
                if (err) {
                    logger.debug('NETWORK', '直接发送UDP数据包失败', {
                        error: err.message,
                        host: host,
                        port: port
                    });
                    resolve(false);
                } else {
                    logger.debug('NETWORK', '直接UDP数据包发送成功', {
                        host: host,
                        port: port
                    });
                    resolve(true);
                }
            });
        });
    }
    
    /**
     * 发送TCP数据包
     * @param {Object} data 要发送的数据
     * @param {Object} options 发送选项
     * @returns {Promise<boolean>} 发送是否成功
     */
    sendTCPPacket(data, options = {}) {
        const { host = 'localhost', port = 5726 } = options;
        const net = require('net');
        
        return new Promise((resolve) => {
            const client = net.createConnection({ port: port, host: host }, () => {
                client.write(JSON.stringify(data));
                client.end();
            });
            
            client.on('end', () => {
                logger.info('NETWORK', 'TCP数据包发送成功', {
                    host: host,
                    port: port
                });
                resolve(true);
            });
            
            client.on('error', (err) => {
                logger.error('NETWORK', '发送TCP数据包失败', {
                    error: err.message,
                    host: host,
                    port: port
                });
                resolve(false);
            });
            
            client.on('timeout', () => {
                client.destroy();
                logger.error('NETWORK', '发送TCP数据包超时', {
                    host: host,
                    port: port
                });
                resolve(false);
            });
        });
    }
    
    /**
     * 发送数据包（根据协议选择发送方式）
     * @param {Object} data 要发送的数据
     * @param {Object} options 发送选项
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendPacket(data, options = {}) {
        const { protocol = 'udp' } = options;
        
        switch (protocol.toLowerCase()) {
            case 'udp':
                return this.sendUDPPacket(data, options);
            case 'http':
            case 'https':
                return this.sendHTTPRequest(data, options);
            case 'tcp':
                return this.sendTCPPacket(data, options);
            default:
                logger.error('NETWORK', '不支持的发送协议', {
                    protocol: protocol
                });
                return false;
        }
    }

    /**
     * 发送设备发现广播
     * @returns {Promise<boolean>} 发送是否成功
     */
    async discoverDevices() {
        // 创建设备发现数据包
        const discoveryPacket = await this.createPackage({
            type: 'device-discovery',
            action: 'discover'
        });
        
        discoveryPacket.header.type = 'device-discovery';
        
        logger.info('NETWORK', '发送设备发现广播', null);
        
        // 发送广播
        return this.sendUDPPacket(discoveryPacket);
    }
    
    /**
     * 获取已发现的设备列表
     * @returns {Array} 设备列表
     */
    getDiscoveredDevices() {
        return Array.from(this.devices.values());
    }
    
    /**
     * 根据设备ID获取设备信息
     * @param {string} onlyID 设备唯一标识
     * @returns {Object|null} 设备信息或null
     */
    getDeviceByID(onlyID) {
        return this.devices.get(onlyID) || null;
    }
    
    /**
     * 将数据包添加到发送队列
     * @param {Object} customData 自定义数据
     */
    addToQueue(customData = {}) {
        this.packageQueue.push(customData);
        logger.info('SYSTEM', '数据包已添加到发送队列', {
            queueSize: this.packageQueue.length
        });
    }

    /**
     * 处理发送队列
     */
    async processQueue() {
        if (this.packageQueue.length === 0) {
            return;
        }
        
        logger.info('SYSTEM', `开始处理发送队列，队列大小: ${this.packageQueue.length}`, null);
        
        // 逐个发送队列中的数据包
        while (this.packageQueue.length > 0) {
            const customData = this.packageQueue.shift();
            await this.sendPackage(customData);
        }
        
        logger.info('SYSTEM', '发送队列处理完成', null);
    }

    /**
     * 获取发送统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.stats,
            queueSize: this.packageQueue.length,
            isRunning: this.isRunning
        };
    }

    /**
     * 重置发送统计信息
     */
    resetStats() {
        this.stats = {
            totalPackages: 0,
            successPackages: 0,
            failedPackages: 0,
            retryCount: 0
        };
        
        logger.info('SYSTEM', '发送统计信息已重置', null);
    }

    /**
     * 销毁数据包发送模块
     */
    destroy() {
        this.stopAutoSend();
        this.packageQueue = [];
        this.userInfoManager = null;
        
        logger.info('SYSTEM', '数据包发送模块已销毁', null);
    }
}

// 创建单例实例
const sentPackage = new SentPackage();

// 导出模块
module.exports = {
    SentPackage,
    sentPackage
};
