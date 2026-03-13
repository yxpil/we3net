const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const net = require('net');
const crypto = require('crypto');
const os = require('os');
const { logger } = require('../Tools/Logs');

/**
 * 数据包查询模块
 * 负责从局域网抓取和管理其他用户的数据包
 * 
 * @author yxpil
 * @responsibility 负责查询和管理数据包信息
 * @domain yxpil.com
 * @created 2026-03-13
 * @last-modified 2026-03-13
 * @branch main
 * 
 * @moduleDescription
 * 数据包查询核心模块，提供以下功能：
 * - 数据包监听和抓取
 * - 数据包解析和验证
 * - 数据包查询和过滤
 * - 数据包管理和缓存
 * - 数据包分类和版本追踪
 * - 查询结果缓存
 * - 统计信息
 * 
 * @usage
 * 作为数据包查询服务，为应用提供数据包信息检索能力
 */
class LookupPackage {
    constructor() {
        // 初始化模块
        this.listeners = {};
        this.packages = [];
        this.isListening = false;
        this.udpSocket = null;
        this.port = 5726;
        this.maxPackages = 1000;
        this.packageCache = new Map();
        
        // 设备列表
        this.devices = new Map();
        this.lastSeenTimeout = 30000; // 设备超时时间（毫秒）
        
        // 初始化统计信息
        this.stats = {
            totalReceived: 0,
            validPackages: 0,
            invalidPackages: 0,
            uniqueDevices: new Set(),
            uniqueUsers: new Set()
        };
    }

    /**
     * 初始化数据包查询模块
     * @param {Object} options 配置选项
     */
    initialize(options = {}) {
        this.port = options.port || this.port;
        this.maxPackages = options.maxPackages || this.maxPackages;
        
        logger.info('SYSTEM', '数据包查询模块初始化完成', {
            port: this.port,
            maxPackages: this.maxPackages
        });
    }

    /**
     * 开始监听UDP广播数据包
     */
    startListening() {
        if (this.isListening) {
            logger.warn('SYSTEM', '数据包监听功能已在运行中', null);
            return;
        }

        this.isListening = true;
        
        // 创建UDP服务器用于监听广播数据包
        const dgram = require('dgram');
        this.udpSocket = dgram.createSocket('udp4');
        
        this.udpSocket.on('listening', () => {
            try {
                // 绑定成功后再允许广播
                this.udpSocket.setBroadcast(true);
                const address = this.udpSocket.address();
                logger.info('NETWORK', `开始监听UDP广播端口 ${address.port}`, {
                    address: address.address,
                    port: address.port
                });
            } catch (error) {
                logger.error('NETWORK', '设置UDP广播失败', error);
            }
        });
        
        this.udpSocket.on('message', (message, remote) => {
            this.handleIncomingPacket(message, remote);
        });
        
        this.udpSocket.on('error', (error) => {
            logger.error('NETWORK', 'UDP监听错误', error);
            this.stopListening();
        });
        
        // 绑定到指定端口
        this.udpSocket.bind(this.port);
        
        // 启动设备超时检查
        this.startDeviceTimeoutCheck();
    }

    /**
     * 处理接收到的数据包
     * @param {Buffer} message 接收到的数据包
     * @param {Object} remote 远程地址信息
     * @param {string} protocol 协议类型
     */
    handleIncomingPacket(message, remote, port = null, protocol = 'udp') {
        try {
            // 增加总接收数统计
            this.stats.totalReceived++;
            
            // 解析数据包
            let packetData;
            try {
                packetData = JSON.parse(message.toString());
            } catch (error) {
                logger.error('PARSER', '数据包解析失败', {
                    error: error.message,
                    remote: remote,
                    protocol: protocol
                });
                this.stats.invalidPackages++;
                return;
            }
            
            // 验证数据包
            if (this.validatePackage(packetData)) {
                this.processValidPacket(packetData, remote, protocol);
            } else {
                logger.warn('VALIDATOR', '数据包验证失败', {
                    remote: remote,
                    protocol: protocol
                });
                this.stats.invalidPackages++;
            }
        } catch (error) {
            logger.error('SYSTEM', '处理数据包时发生错误', error);
            this.stats.invalidPackages++;
        }
    }

    /**
     * 验证数据包格式和完整性
     * @param {Object} packetData 数据包
     * @returns {boolean} 是否有效
     */
    validatePackage(packetData) {
        // 检查基本结构
        if (!packetData || typeof packetData !== 'object') {
            return false;
        }
        
        // 检查header
        if (!packetData.header || typeof packetData.header !== 'object') {
            return false;
        }
        
        const requiredHeaderFields = ['version', 'timestamp', 'type', 'onlyID', 'userID'];
        for (const field of requiredHeaderFields) {
            if (!packetData.header.hasOwnProperty(field)) {
                return false;
            }
        }
        
        // 检查payload
        if (!packetData.payload || typeof packetData.payload !== 'object') {
            return false;
        }
        
        // 检查footer
        if (!packetData.footer || typeof packetData.footer !== 'object') {
            return false;
        }
        
        // 验证校验和
        if (packetData.footer.checksum && packetData.payload.customData) {
            const calculatedChecksum = this.calculateChecksum(packetData.payload.customData);
            if (packetData.footer.checksum !== calculatedChecksum) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 处理有效的数据包
     * @param {Object} packetData 数据包
     * @param {Object} remote 远程地址信息
     * @param {string} protocol 协议类型
     */
    processValidPacket(packetData, remote, protocol) {
        // 增加有效数据包统计
        this.stats.validPackages++;
        
        // 更新唯一设备和用户统计
        this.stats.uniqueDevices.add(packetData.header.onlyID);
        this.stats.uniqueUsers.add(packetData.header.userID);
        
        // 添加到数据包列表
        const packageWithMeta = {
            ...packetData,
            _meta: {
                remoteAddress: remote.address || remote,
                remotePort: remote.port || null,
                protocol: protocol,
                receivedTime: new Date().toISOString(),
                isValid: true
            }
        };
        
        // 限制数据包数量
        if (this.packages.length >= this.maxPackages) {
            this.packages.shift();
        }
        
        this.packages.push(packageWithMeta);
        
        // 缓存数据包（按设备ID）
        this.cachePackage(packageWithMeta);
        
        // 更新设备信息
        this.updateDeviceInfo(packetData, remote);
        
        logger.info('NETWORK', '接收到有效数据包', {
            onlyID: packetData.header.onlyID,
            userID: packetData.header.userID,
            type: packetData.header.type,
            remote: remote.address || remote,
            protocol: protocol
        });
        
        // 根据数据包类型触发不同事件
        switch (packetData.header.type) {
            case 'device-discovery':
                this.emit('deviceDiscovered', packetData, remote);
                break;
            case 'handshake-response':
                this.emit('handshakeResponse', packetData, remote);
                break;
            default:
                this.emit('packageReceived', packageWithMeta);
                break;
        }
    }
    
    /**
     * 更新设备信息
     * @param {Object} packetData 数据包
     * @param {Object} remote 远程地址信息
     */
    updateDeviceInfo(packetData, remote) {
        const onlyID = packetData.header.onlyID;
        const now = new Date().toISOString();
        
        const deviceInfo = {
            onlyID: onlyID,
            userID: packetData.header.userID,
            ipAddress: remote.address,
            port: remote.port,
            lastSeen: now,
            firstSeen: now,
            networkStatus: packetData.payload.networkStatus,
            systemInfo: packetData.payload.systemInfo,
            packageType: packetData.header.type
        };
        
        // 如果设备已存在，更新信息，否则添加新设备
        if (this.devices.has(onlyID)) {
            const existingDevice = this.devices.get(onlyID);
            deviceInfo.firstSeen = existingDevice.firstSeen;
            deviceInfo.seenCount = (existingDevice.seenCount || 0) + 1;
            
            this.devices.set(onlyID, deviceInfo);
            this.emit('deviceUpdated', deviceInfo);
        } else {
            deviceInfo.seenCount = 1;
            this.devices.set(onlyID, deviceInfo);
            this.emit('deviceDiscovered', deviceInfo);
        }
    }

    /**
     * 计算数据包校验和
     * @param {Object} data 要计算校验和的数据
     * @returns {string} 校验和
     */
    calculateChecksum(data) {
        const strData = JSON.stringify(data);
        const hash = crypto.createHash('sha256');
        hash.update(strData);
        return hash.digest('hex');
    }

    /**
     * 缓存数据包
     * @param {Object} packetData 数据包
     */
    cachePackage(packetData) {
        const onlyID = packetData.header.onlyID;
        if (!this.packageCache.has(onlyID)) {
            this.packageCache.set(onlyID, []);
        }
        
        const devicePackages = this.packageCache.get(onlyID);
        devicePackages.push(packetData);
        
        // 限制每个设备的缓存数量
        if (devicePackages.length > 50) {
            devicePackages.shift();
        }
    }

    /**
     * 查询所有数据包
     * @returns {Array} 所有数据包列表
     */
    getAllPackages() {
        return [...this.packages];
    }

    /**
     * 根据设备ID查询数据包
     * @param {string} onlyID 设备唯一标识
     * @returns {Array} 该设备的所有数据包
     */
    getPackagesByDevice(onlyID) {
        return this.packages.filter(pkg => pkg.header.onlyID === onlyID);
    }

    /**
     * 根据用户ID查询数据包
     * @param {string} userID 用户标识
     * @returns {Array} 该用户的所有数据包
     */
    getPackagesByUser(userID) {
        return this.packages.filter(pkg => pkg.header.userID === userID);
    }

    /**
     * 根据数据包类型查询
     * @param {string} type 数据包类型
     * @returns {Array} 该类型的所有数据包
     */
    getPackagesByType(type) {
        return this.packages.filter(pkg => pkg.header.type === type);
    }

    /**
     * 查询最近的数据包
     * @param {number} count 数据包数量
     * @returns {Array} 最近的数据包列表
     */
    getRecentPackages(count = 10) {
        return this.packages.slice(-count).reverse();
    }

    /**
     * 根据时间范围查询数据包
     * @param {Date} startTime 开始时间
     * @param {Date} endTime 结束时间
     * @returns {Array} 时间范围内的数据包
     */
    getPackagesByTimeRange(startTime, endTime) {
        return this.packages.filter(pkg => {
            const packetTime = new Date(pkg.header.timestamp);
            return packetTime >= startTime && packetTime <= endTime;
        });
    }

    /**
     * 高级查询（支持多条件过滤）
     * @param {Object} filters 过滤条件
     * @returns {Array} 符合条件的数据包
     */
    queryPackages(filters) {
        return this.packages.filter(pkg => {
            let match = true;
            
            // 设备ID过滤
            if (filters.onlyID && pkg.header.onlyID !== filters.onlyID) {
                match = false;
            }
            
            // 用户ID过滤
            if (filters.userID && pkg.header.userID !== filters.userID) {
                match = false;
            }
            
            // 类型过滤
            if (filters.type && pkg.header.type !== filters.type) {
                match = false;
            }
            
            // 协议过滤
            if (filters.protocol && pkg._meta.protocol !== filters.protocol) {
                match = false;
            }
            
            // 时间范围过滤
            if (filters.startTime) {
                const packetTime = new Date(pkg.header.timestamp);
                if (packetTime < filters.startTime) {
                    match = false;
                }
            }
            
            if (filters.endTime) {
                const packetTime = new Date(pkg.header.timestamp);
                if (packetTime > filters.endTime) {
                    match = false;
                }
            }
            
            // 自定义数据过滤
            if (filters.customData) {
                for (const key in filters.customData) {
                    if (filters.customData.hasOwnProperty(key)) {
                        if (!pkg.payload.customData || pkg.payload.customData[key] !== filters.customData[key]) {
                            match = false;
                            break;
                        }
                    }
                }
            }
            
            return match;
        });
    }

    /**
     * 获取已发现的设备列表
     * @returns {Array} 设备列表
     */
    getDevices() {
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
     * 获取网络上的所有用户
     * @returns {Array} 用户列表
     */
    getUsers() {
        const userMap = new Map();
        
        // 按用户ID分组设备
        this.devices.forEach(device => {
            const userID = device.userID;
            if (!userMap.has(userID)) {
                userMap.set(userID, {
                    userID: userID,
                    devices: [],
                    lastSeen: device.lastSeen
                });
            }
            
            const user = userMap.get(userID);
            user.devices.push(device.onlyID);
            
            // 更新最后看到的时间
            if (new Date(device.lastSeen) > new Date(user.lastSeen)) {
                user.lastSeen = device.lastSeen;
            }
        });
        
        return Array.from(userMap.values());
    }
    
    /**
     * 清除设备列表
     */
    clearDevices() {
        this.devices.clear();
        this.stats.uniqueDevices.clear();
        logger.info('SYSTEM', '设备列表已清除', null);
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.stats,
            uniqueDevices: this.stats.uniqueDevices.size,
            uniqueUsers: this.stats.uniqueUsers.size,
            currentPackages: this.packages.length,
            cacheSize: this.packageCache.size,
            isListening: this.isListening
        };
    }

    /**
     * 清除所有数据包
     */
    clearPackages() {
        this.packages = [];
        this.packageCache.clear();
        
        // 重置统计信息
        this.stats = {
            ...this.stats,
            totalReceived: 0,
            validPackages: 0,
            invalidPackages: 0,
            uniqueDevices: new Set(),
            uniqueUsers: new Set()
        };
        
        logger.info('SYSTEM', '所有数据包已清除', null);
    }

    /**
     * 开始设备超时检查
     */
    startDeviceTimeoutCheck() {
        this.deviceTimeoutInterval = setInterval(() => {
            this.checkDeviceTimeouts();
        }, 5000); // 每5秒检查一次
    }
    
    /**
     * 检查设备超时
     */
    checkDeviceTimeouts() {
        const now = new Date().getTime();
        const timeoutTime = now - this.lastSeenTimeout;
        
        Array.from(this.devices.keys()).forEach(onlyID => {
            const device = this.devices.get(onlyID);
            if (new Date(device.lastSeen).getTime() < timeoutTime) {
                // 设备超时
                this.devices.delete(onlyID);
                this.stats.uniqueDevices.delete(onlyID);
                
                logger.info('NETWORK', '设备已超时', {
                    onlyID: onlyID,
                    userID: device.userID
                });
                
                // 触发设备离线事件
                this.emit('deviceOffline', device);
            }
        });
    }
    
    /**
     * 停止监听数据包
     */
    stopListening() {
        if (!this.isListening) {
            logger.warn('SYSTEM', '数据包监听功能未在运行中', null);
            return;
        }
        
        this.isListening = false;
        
        // 关闭UDP socket
        if (this.udpSocket) {
            this.udpSocket.close();
            this.udpSocket = null;
        }
        
        // 停止设备超时检查
        if (this.deviceTimeoutInterval) {
            clearInterval(this.deviceTimeoutInterval);
            this.deviceTimeoutInterval = null;
        }
        
        logger.info('SYSTEM', 'UDP广播监听已停止', null);
    }

    /**
     * 注册事件监听器
     * @param {string} event 事件名称
     * @param {Function} callback 回调函数
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * 移除事件监听器
     * @param {string} event 事件名称
     * @param {Function} callback 回调函数
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * 触发事件
     * @param {string} event 事件名称
     * @param {*} data 事件数据
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error('SYSTEM', '事件回调执行失败', error);
                }
            });
        }
    }

    /**
     * 销毁数据包查询模块
     */
    destroy() {
        this.stopListening();
        this.clearPackages();
        this.listeners = {};
        
        logger.info('SYSTEM', '数据包查询模块已销毁', null);
    }
}

// 创建单例实例
const lookupPackage = new LookupPackage();

// 导出模块
module.exports = {
    LookupPackage,
    lookupPackage
};