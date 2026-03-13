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
     * 获取有效的广播地址列表
     * @returns {Array} 广播地址列表
     */
    getBroadcastAddresses() {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        const broadcastAddresses = [];
        
        for (const iface in interfaces) {
            interfaces[iface].forEach(ipInfo => {
                if (ipInfo.family === 'IPv4' && !ipInfo.internal) {
                    // 如果有广播地址，使用它
                    if (ipInfo.broadcast) {
                        broadcastAddresses.push(ipInfo.broadcast);
                    } else {
                        // 否则计算广播地址（简单实现：将最后一位改为255）
                        const parts = ipInfo.address.split('.');
                        if (parts.length === 4) {
                            parts[3] = '255';
                            broadcastAddresses.push(parts.join('.'));
                        }
                    }
                }
            });
        }
        
        // 确保至少有一个广播地址（localhost用于测试）
        if (broadcastAddresses.length === 0) {
            broadcastAddresses.push('127.0.0.1');
        }
        
        return broadcastAddresses;
    }
    
    /**
     * 初始化UDP socket
     * @returns {Promise} 初始化完成的Promise
     */
    initUDPSocket() {
        // 如果socket已经存在且正在初始化中，返回现有的Promise
        if (this.udpInitPromise) {
            return this.udpInitPromise;
        }
        
        // 如果socket已经存在且初始化完成，返回已解析的Promise
        if (this.udpSocket && this.udpSocket.address()) {
            return Promise.resolve();
        }
        
        // 创建新的Promise来跟踪初始化过程
        this.udpInitPromise = new Promise((resolve) => {
            if (this.udpSocket) {
                // socket存在但可能没有绑定，关闭它
                this.udpSocket.close();
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
                    
                    // 获取所有广播地址
                    this.broadcastAddresses = this.getBroadcastAddresses();
                    logger.debug('NETWORK', 'UDP socket已绑定并启用广播', {
                        address: this.udpSocket.address().address,
                        port: this.udpSocket.address().port,
                        broadcastAddresses: this.broadcastAddresses
                    });
                    
                    resolve();
                } catch (error) {
                    logger.error('NETWORK', '设置UDP广播失败', error);
                    resolve(); // 即使设置广播失败，也完成初始化
                }
            });
        });
        
        return this.udpInitPromise;
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
    async sendUDPPacket(data, options = {}) {
        const { port = this.broadcastPort } = options;
        
        try {
            // 确保UDP socket已完全初始化
            await this.initUDPSocket();
            
            const message = Buffer.from(JSON.stringify(data));
            
            // 获取广播地址列表
            const broadcastAddresses = this.broadcastAddresses || this.getBroadcastAddresses();
            
            logger.debug('NETWORK', 'UDP广播发送配置', {
                addresses: broadcastAddresses,
                port: port,
                messageSize: message.length
            });
            
            // 依次尝试向每个广播地址发送
            let anySuccess = false;
            
            for (const host of broadcastAddresses) {
                try {
                    const success = await new Promise((resolve) => {
                        this.udpSocket.send(message, port, host, (err) => {
                            if (err) {
                                logger.debug('NETWORK', '发送UDP广播到地址失败', {
                                    error: err.message,
                                    host: host,
                                    port: port,
                                    errno: err.errno,
                                    syscall: err.syscall
                                });
                                resolve(false);
                            } else {
                                logger.debug('NETWORK', 'UDP广播到地址成功', {
                                    host: host,
                                    port: port
                                });
                                resolve(true);
                            }
                        });
                    });
                    
                    if (success) {
                        anySuccess = true;
                    }
                } catch (err) {
                    logger.error('NETWORK', '发送UDP广播到地址异常', {
                        error: err.message,
                        host: host,
                        port: port
                    });
                }
            }
            
            if (anySuccess) {
                logger.info('NETWORK', 'UDP广播发送成功', {
                    addresses: broadcastAddresses,
                    port: port
                });
                return true;
            } else {
                logger.error('NETWORK', 'UDP广播到所有地址都失败', {
                    addresses: broadcastAddresses,
                    port: port
                });
                return false;
            }
        } catch (error) {
            logger.error('NETWORK', '发送UDP广播异常', {
                error: error.message,
                port: port,
                stack: error.stack
            });
            return false;
        }
    }
    
    /**
     * 直接发送UDP数据包到特定设备
     * @param {Object} data 要发送的数据
     * @param {string} host 目标主机地址
     * @param {number} port 目标端口
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendUDPPacketDirect(data, host, port) {
        try {
            // 确保UDP socket已完全初始化
            await this.initUDPSocket();
            
            const message = Buffer.from(JSON.stringify(data));
            
            return new Promise((resolve) => {
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
        } catch (error) {
            logger.error('NETWORK', '直接发送UDP数据包异常', {
                error: error.message,
                host: host,
                port: port
            });
            return false;
        }
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
     * 发送设备发现广播（支持多协议自动回退）
     * @param {Array<string>} preferredProtocols 首选协议列表
     * @returns {Promise<boolean>} 发送是否成功
     */
    async discoverDevices(preferredProtocols = ['icmp', 'mdns', 'tcp-scan', 'udp']) {
        // 创建设备发现数据包
        const discoveryPacket = await this.createPackage({
            type: 'device-discovery',
            action: 'discover'
        });
        
        discoveryPacket.header.type = 'device-discovery';
        
        logger.info('NETWORK', '开始设备发现', { protocols: preferredProtocols });
        
        // 尝试每种协议，直到成功
        for (const protocol of preferredProtocols) {
            try {
                logger.debug('NETWORK', `尝试使用${protocol}协议进行设备发现`, null);
                
                let success = false;
                switch (protocol) {
                    case 'icmp':
                        success = await this.sendICMPDiscovery(discoveryPacket);
                        break;
                    case 'mdns':
                        success = await this.sendMDNSDiscovery(discoveryPacket);
                        break;
                    case 'tcp-scan':
                        success = await this.sendTCPScanDiscovery(discoveryPacket);
                        break;
                    case 'udp':
                        success = await this.sendUDPPacket(discoveryPacket);
                        break;
                    default:
                        logger.warn('NETWORK', `不支持的发现协议: ${protocol}`, null);
                        continue;
                }
                
                if (success) {
                    logger.info('NETWORK', `${protocol}协议设备发现成功`, null);
                    return true;
                }
            } catch (error) {
                logger.error('NETWORK', `${protocol}协议设备发现失败`, {
                    error: error.message
                });
            }
        }
        
        logger.error('NETWORK', '所有协议的设备发现都失败', null);
        return false;
    }
    
    /**
     * 获取已发现的设备列表
     * @returns {Array} 设备列表
     */
    getDiscoveredDevices() {
        return Array.from(this.devices.values());
    }
    
    /**
     * 发送ICMP设备发现请求
     * @param {Object} discoveryPacket 发现数据包
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendICMPDiscovery(discoveryPacket) {
        // 使用Node.js的child_process执行ping命令
        const { exec } = require('child_process');
        
        return new Promise((resolve) => {
            // 构建网络范围（简单实现：将最后一位改为1-254）
            const os = require('os');
            const interfaces = os.networkInterfaces();
            const networkRanges = [];
            
            // 收集所有网络接口的网络范围
            for (const iface in interfaces) {
                interfaces[iface].forEach(ipInfo => {
                    if (ipInfo.family === 'IPv4' && !ipInfo.internal) {
                        const parts = ipInfo.address.split('.');
                        if (parts.length === 4) {
                            // 计算网络范围
                            const networkRange = `${parts[0]}.${parts[1]}.${parts[2]}`;
                            networkRanges.push(networkRange);
                        }
                    }
                });
            }
            
            if (networkRanges.length === 0) {
                logger.warn('NETWORK', '无法确定网络范围，ICMP发现失败', null);
                resolve(false);
                return;
            }
            
            // 对每个网络范围执行ping扫描
            let totalSuccess = false;
            
            // 只扫描第一个网络范围（简单实现）
            const networkRange = networkRanges[0];
            
            // 在Windows上使用ping命令
            const pingCommand = process.platform === 'win32' 
                ? `ping -n 1 -w 1000 ${networkRange}.255` 
                : `ping -c 1 -W 1 ${networkRange}.255`;
            
            logger.debug('NETWORK', `执行ICMP广播: ${pingCommand}`, null);
            
            exec(pingCommand, (error, stdout, stderr) => {
                if (error) {
                    logger.error('NETWORK', 'ICMP广播执行失败', {
                        error: error.message
                    });
                    
                    // 在某些系统上，ping广播会返回错误代码，但实际上可能已发送
                    // 检查是否有响应
                    if (stdout.includes('Reply from')) {
                        logger.debug('NETWORK', 'ICMP广播收到响应', null);
                        totalSuccess = true;
                    }
                } else {
                    logger.debug('NETWORK', 'ICMP广播执行成功', null);
                    totalSuccess = true;
                }
                
                // ICMP主要用于发现设备，然后使用TCP发送实际的发现数据包
                if (totalSuccess) {
                    // 发送TCP发现数据包到活跃的IP地址
                    this.scanActiveIPs(networkRange, discoveryPacket);
                }
                
                resolve(totalSuccess);
            });
        });
    }
    
    /**
     * 扫描活跃的IP地址并发送发现数据包
     * @param {string} networkRange 网络范围（如192.168.1）
     * @param {Object} discoveryPacket 发现数据包
     */
    async scanActiveIPs(networkRange, discoveryPacket) {
        const { exec } = require('child_process');
        
        // 使用arp命令获取活跃设备列表
        const arpCommand = process.platform === 'win32' 
            ? 'arp -a' 
            : 'arp -n';
        
        exec(arpCommand, (error, stdout, stderr) => {
            if (error) {
                logger.error('NETWORK', '获取ARP表失败', {
                    error: error.message
                });
                return;
            }
            
            // 解析ARP表，提取IP地址
            const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
            const ips = [];
            let match;
            
            while ((match = ipRegex.exec(stdout)) !== null) {
                const ip = match[1];
                if (!ips.includes(ip)) {
                    ips.push(ip);
                }
            }
            
            logger.debug('NETWORK', `扫描到${ips.length}个活跃IP地址`, { ips: ips });
            
            // 向每个活跃IP发送TCP发现数据包
            ips.forEach(ip => {
                this.sendTCPPacketDirect(discoveryPacket, ip, this.broadcastPort)
                    .catch(error => {
                        logger.debug('NETWORK', `向${ip}发送TCP发现包失败`, {
                            error: error.message
                        });
                    });
            });
        });
    }
    
    /**
     * 发送mDNS设备发现请求
     * @param {Object} discoveryPacket 发现数据包
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendMDNSDiscovery(discoveryPacket) {
        // mDNS/ZeroConf发现实现
        // 这里使用简化的DNS-SD实现
        const dgram = require('dgram');
        
        return new Promise((resolve) => {
            try {
                const socket = dgram.createSocket('udp4');
                
                // 构建mDNS查询
                const mdnsMessage = Buffer.from(JSON.stringify({
                    type: 'mdns-query',
                    service: '_yxpillow._tcp.local',
                    discoveryData: discoveryPacket
                }));
                
                // 发送到mDNS多播地址
                socket.send(mdnsMessage, 5353, '224.0.0.251', (err) => {
                    socket.close();
                    
                    if (err) {
                        logger.error('NETWORK', 'mDNS发现发送失败', {
                            error: err.message
                        });
                        resolve(false);
                    } else {
                        logger.debug('NETWORK', 'mDNS发现请求发送成功', null);
                        resolve(true);
                    }
                });
            } catch (error) {
                logger.error('NETWORK', 'mDNS发现异常', {
                    error: error.message
                });
                resolve(false);
            }
        });
    }
    
    /**
     * 发送TCP端口扫描设备发现请求
     * @param {Object} discoveryPacket 发现数据包
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendTCPScanDiscovery(discoveryPacket) {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        const networkRanges = [];
        
        // 收集所有网络接口的网络范围
        for (const iface in interfaces) {
            interfaces[iface].forEach(ipInfo => {
                if (ipInfo.family === 'IPv4' && !ipInfo.internal) {
                    const parts = ipInfo.address.split('.');
                    if (parts.length === 4) {
                        const networkRange = `${parts[0]}.${parts[1]}.${parts[2]}`;
                        networkRanges.push(networkRange);
                    }
                }
            });
        }
        
        if (networkRanges.length === 0) {
            logger.warn('NETWORK', '无法确定网络范围，TCP扫描发现失败', null);
            return false;
        }
        
        // 只扫描第一个网络范围（简单实现）
        const networkRange = networkRanges[0];
        
        logger.debug('NETWORK', `开始TCP端口扫描: ${networkRange}.1-254:${this.broadcastPort}`, null);
        
        // 扫描前10个IP地址（简单实现）
        let successCount = 0;
        
        for (let i = 1; i <= 10; i++) {
            const ip = `${networkRange}.${i}`;
            
            try {
                const success = await this.sendTCPPacketDirect(discoveryPacket, ip, this.broadcastPort);
                if (success) {
                    successCount++;
                }
            } catch (error) {
                // 忽略单个IP的错误
            }
        }
        
        logger.debug('NETWORK', `TCP端口扫描完成，成功${successCount}个`, null);
        return successCount > 0;
    }
    
    /**
     * 直接发送TCP数据包到特定设备
     * @param {Object} data 要发送的数据
     * @param {string} host 目标主机地址
     * @param {number} port 目标端口
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendTCPPacketDirect(data, host, port) {
        const net = require('net');
        
        return new Promise((resolve) => {
            const client = new net.Socket();
            client.setTimeout(2000);
            
            client.connect(port, host, () => {
                // 连接成功，发送数据
                client.write(JSON.stringify(data));
                client.end();
                resolve(true);
            });
            
            client.on('error', (error) => {
                // 忽略连接错误
                client.destroy();
                resolve(false);
            });
            
            client.on('timeout', () => {
                client.destroy();
                resolve(false);
            });
        });
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
