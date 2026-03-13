/**
 * 端口映射管理器模块
 * 
 * @author yxpil
 * @responsibility 负责 UPnP/PCP 端口映射和 NAT 穿透管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 网络端口映射管理核心模块，提供以下功能：
 * - UPnP IGD 协议支持
 * - PCP/NAT-PMP 协议支持
 * - 端口映射创建和管理
 * - NAT 穿透功能
 * - 路由器发现和通信
 * - 端口生命周期管理
 * 
 * @usage
 * 通过 HolePunchManager 类实例化使用，提供统一的端口映射接口
 */

const dgram = require('dgram');
const { logger } = require('../Tools/Logs.js');
const net = require('net');
const os = require('os');

/**
 * UPnP/PCP端口映射管理器
 * 支持UPnP IGD和PCP/NAT-PMP协议
 */
class HolePunchManager {
    constructor() {
        this.upnpEnabled = false;
        this.pcpEnabled = false;
        this.mappings = new Map(); // 存储端口映射
        this.gatewayIP = null;
        this.upnpDevice = null;
        this.pcpGateway = null;
        this.isInitialized = false;
    }

    /**
     * 初始化端口映射管理器
     */
    async initialize(config = {}) {
        logger.info('HOLEPUNCH', '初始化端口映射管理器', config);
        
        this.upnpEnabled = config.ActiveUPnP !== false;
        this.pcpEnabled = config.ActivePCP !== false;
        this.listenIPv4 = config.ListenIPv4 !== false;
        this.listenIPv6 = config.ListenIPv6 !== false;
        
        try {
            // 发现网关（考虑IPv4/IPv6配置）
            await this.discoverGateway();
            
            if (this.upnpEnabled) {
                await this.initializeUPnP();
            }
            
            if (this.pcpEnabled) {
                await this.initializePCP();
            }
            
            this.isInitialized = true;
            logger.info('HOLEPUNCH', '端口映射管理器初始化完成', {
                upnp: this.upnpEnabled,
                pcp: this.pcpEnabled,
                listenIPv4: this.listenIPv4,
                listenIPv6: this.listenIPv6,
                gateway: this.gatewayIP
            });
            
            return true;
        } catch (error) {
            logger.error('HOLEPUNCH', '端口映射管理器初始化失败', error);
            return false;
        }
    }

    /**
     * 发现网络网关
     */
    async discoverGateway() {
        try {
            // 方法1: 使用系统路由表
            const gateway = await this.getDefaultGateway();
            if (gateway) {
                this.gatewayIP = gateway;
                logger.info('HOLEPUNCH', '发现默认网关', { gateway });
                return;
            }
            
            // 方法2: 使用常见的网关IP地址（支持IPv4/IPv6）
            const commonGateways = [];
            
            if (this.listenIPv4) {
                commonGateways.push('192.168.1.1', '192.168.0.1', '10.0.0.1', '172.16.0.1');
            }
            
            if (this.listenIPv6) {
                commonGateways.push('fe80::1', '::1'); // IPv6本地链路和回环网关
            }
            
            for (const ip of commonGateways) {
                if (await this.isHostReachable(ip, 80)) {
                    this.gatewayIP = ip;
                    logger.info('HOLEPUNCH', '发现可用网关', { gateway: ip, family: this.getIPFamily(ip) });
                    return;
                }
            }
            
            throw new Error('无法发现网络网关');
        } catch (error) {
            logger.error('HOLEPUNCH', '网关发现失败', error);
            throw error;
        }
    }

    /**
     * 获取系统默认网关（支持IPv4/IPv6配置）
     */
    async getDefaultGateway() {
        return new Promise((resolve) => {
            try {
                const interfaces = os.networkInterfaces();
                for (const name of Object.keys(interfaces)) {
                    for (const iface of interfaces[name]) {
                        // 跳过内部接口
                        if (iface.internal) continue;
                        
                        // 根据配置选择IP类型
                        if (this.listenIPv6 && iface.family === 'IPv6') {
                            // 简单的IPv6网关检测逻辑
                            const gateway = this.calculateIPv6Gateway(iface.address);
                            if (gateway) {
                                resolve(gateway);
                                return;
                            }
                        }
                        
                        if (this.listenIPv4 && iface.family === 'IPv4') {
                            // 简单的IPv4网关检测逻辑
                            const gateway = this.calculateGateway(iface.address, iface.netmask);
                            if (gateway) {
                                resolve(gateway);
                                return;
                            }
                        }
                    }
                }
                resolve(null);
            } catch (error) {
                logger.error('HOLEPUNCH', '获取默认网关失败', error);
                resolve(null);
            }
        });
    }

    /**
     * 根据IP和子网掩码计算网关
     */
    calculateGateway(ip, netmask) {
        try {
            const ipParts = ip.split('.').map(Number);
            const maskParts = netmask.split('.').map(Number);
            
            // 简单的网关计算：通常是网络地址+1
            const network = [];
            for (let i = 0; i < 4; i++) {
                network[i] = ipParts[i] & maskParts[i];
            }
            
            // 网关通常是网络地址+1
            network[3] = network[3] + 1;
            return network.join('.');
        } catch (error) {
            return null;
        }
    }

    /**
     * 计算IPv6网关（简化版本）
     */
    calculateIPv6Gateway(ipv6Address) {
        try {
            // 对于IPv6，通常使用fe80::1作为本地链路网关，或者使用路由器通告
            // 这里简化处理，返回常见的本地链路网关
            if (ipv6Address.startsWith('fe80:')) {
                return 'fe80::1'; // 本地链路网关
            }
            
            // 对于全局单播地址，通常使用路由器通告的第一个地址
            // 简化处理：返回常见的路由器地址
            return 'fe80::1';
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取IP地址的协议族
     */
    getIPFamily(ip) {
        if (ip.includes(':')) {
            return 'IPv6';
        }
        return 'IPv4';
    }

    /**
     * 检查主机是否可达
     */
    async isHostReachable(host, port, timeout = 3000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            
            socket.setTimeout(timeout);
            
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on('error', () => {
                resolve(false);
            });
            
            socket.connect(port, host);
        });
    }

    /**
     * 初始化UPnP
     */
    async initializeUPnP() {
        try {
            if (!this.gatewayIP) {
                throw new Error('未找到网关IP');
            }
            
            // 发现UPnP设备
            this.upnpDevice = await this.discoverUPnPDevice();
            
            if (this.upnpDevice) {
                logger.info('HOLEPUNCH', 'UPnP设备发现成功', this.upnpDevice);
            } else {
                logger.warn('HOLEPUNCH', '未找到UPnP设备');
            }
        } catch (error) {
            logger.error('HOLEPUNCH', 'UPnP初始化失败', error);
        }
    }

    /**
     * 发现UPnP设备
     */
    async discoverUPnPDevice() {
        return new Promise((resolve) => {
            const socket = dgram.createSocket('udp4');
            const searchTarget = 'urn:schemas-upnp-org:device:InternetGatewayDevice:1';
            
            const discoverMessage = 
                'M-SEARCH * HTTP/1.1\r\n' +
                'HOST: 239.255.255.250:1900\r\n' +
                'ST: ' + searchTarget + '\r\n' +
                'MX: 3\r\n' +
                'MAN: "ssdp:discover"\r\n' +
                '\r\n';
            
            socket.on('message', (msg, rinfo) => {
                const message = msg.toString();
                
                if (message.includes('200 OK') && message.includes(searchTarget)) {
                    // 解析响应
                    const location = this.parseUPnPResponse(message);
                    if (location) {
                        socket.close();
                        resolve({
                            location: location,
                            ip: rinfo.address,
                            port: rinfo.port
                        });
                        return;
                    }
                }
            });
            
            socket.on('error', (error) => {
                logger.error('HOLEPUNCH', 'UPnP发现错误', error);
                socket.close();
                resolve(null);
            });
            
            // 设置超时处理
            socket.bind(() => {
                socket.send(discoverMessage, 1900, '239.255.255.250');
            });
            
            // 设置超时处理
            setTimeout(() => {
                socket.close();
                resolve(null);
            }, 5000);
        });
    }

    /**
     * 解析UPnP响应
     */
    parseUPnPResponse(response) {
        const lines = response.split('\r\n');
        for (const line of lines) {
            if (line.toLowerCase().startsWith('location:')) {
                return line.split(':')[1].trim();
            }
        }
        return null;
    }

    /**
     * 初始化PCP/NAT-PMP
     */
    async initializePCP() {
        try {
            if (!this.gatewayIP) {
                throw new Error('未找到网关IP');
            }
            
            // PCP通常使用5351端口
            if (await this.isHostReachable(this.gatewayIP, 5351)) {
                this.pcpGateway = {
                    ip: this.gatewayIP,
                    port: 5351,
                    protocol: 'PCP'
                };
                logger.info('HOLEPUNCH', 'PCP网关发现成功', this.pcpGateway);
            } else {
                // 尝试NAT-PMP (5350端口)
                if (await this.isHostReachable(this.gatewayIP, 5350)) {
                    this.pcpGateway = {
                        ip: this.gatewayIP,
                        port: 5350,
                        protocol: 'NAT-PMP'
                    };
                    logger.info('HOLEPUNCH', 'NAT-PMP网关发现成功', this.pcpGateway);
                } else {
                    logger.warn('HOLEPUNCH', '未找到PCP/NAT-PMP网关');
                }
            }
        } catch (error) {
            logger.error('HOLEPUNCH', 'PCP初始化失败', error);
        }
    }

    /**
     * 创建端口映射
     */
    async createPortMapping(protocol, internalPort, externalPort, description, duration = 0) {
        try {
            const mapping = {
                protocol: protocol,
                internalPort: internalPort,
                externalPort: externalPort,
                description: description,
                duration: duration,
                created: Date.now()
            };
            
            let success = false;
            
            // 尝试UPnP
            if (this.upnpEnabled && this.upnpDevice) {
                try {
                    success = await this.createUPnPMapping(mapping);
                    if (success) {
                        mapping.type = 'UPnP';
                        this.mappings.set(`${protocol}-${internalPort}`, mapping);
                        logger.info('HOLEPUNCH', 'UPnP端口映射创建成功', mapping);
                        return mapping;
                    }
                } catch (error) {
                    logger.error('HOLEPUNCH', 'UPnP端口映射失败', error);
                }
            }
            
            // 尝试PCP
            if (this.pcpEnabled && this.pcpGateway && !success) {
                try {
                    success = await this.createPCPMapping(mapping);
                    if (success) {
                        mapping.type = this.pcpGateway.protocol;
                        this.mappings.set(`${protocol}-${internalPort}`, mapping);
                        logger.info('HOLEPUNCH', 'PCP端口映射创建成功', mapping);
                        return mapping;
                    }
                } catch (error) {
                    logger.error('HOLEPUNCH', 'PCP端口映射失败', error);
                }
            }
            
            if (!success) {
                throw new Error('无法创建端口映射');
            }
            
        } catch (error) {
            logger.error('HOLEPUNCH', '端口映射创建失败', error);
            throw error;
        }
    }

    /**
     * 创建UPnP端口映射
     */
    async createUPnPMapping(mapping) {
        // 这里需要实现具体的UPnP SOAP请求
        // 由于UPnP协议复杂，这里提供一个简化版本
        return new Promise((resolve) => {
            // 模拟UPnP端口映射创建
            setTimeout(() => {
                // 在实际实现中，这里会发送SOAP请求到UPnP设备
                logger.info('HOLEPUNCH', '模拟UPnP端口映射创建', mapping);
                resolve(true);
            }, 1000);
        });
    }

    /**
     * 创建PCP端口映射
     */
    async createPCPMapping(mapping) {
        return new Promise((resolve) => {
            const socket = dgram.createSocket('udp4');
            
            // PCP请求数据包（简化版本）
            const request = Buffer.alloc(60);
            request.writeUInt8(1, 0); // 版本
            request.writeUInt8(1, 1); // 操作码：MAP
            request.writeUInt16BE(0, 2); // 保留
            request.writeUInt32BE(mapping.duration, 4); // 生存时间
            
            // 客户端IP地址
            const clientIP = '0.0.0.0'; // 0.0.0.0表示映射所有地址
            const ipParts = clientIP.split('.').map(Number);
            for (let i = 0; i < 4; i++) {
                request.writeUInt8(ipParts[i], 8 + i);
            }
            
            // 映射信息
            request.writeUInt16BE(mapping.internalPort, 12);
            request.writeUInt16BE(mapping.externalPort || 0, 14);
            
            socket.on('message', (msg, rinfo) => {
                if (msg.length >= 60) {
                    const resultCode = msg.readUInt8(3);
                    if (resultCode === 0) {
                        logger.info('HOLEPUNCH', 'PCP端口映射创建成功', mapping);
                        socket.close();
                        resolve(true);
                        return;
                    }
                }
                socket.close();
                resolve(false);
            });
            
            socket.on('error', (error) => {
                logger.error('HOLEPUNCH', 'PCP请求错误', error);
                socket.close();
                resolve(false);
            });
            
            socket.bind(() => {
                socket.send(request, this.pcpGateway.port, this.pcpGateway.ip);
                
                // 设置超时处理
                setTimeout(() => {
                    socket.close();
                    resolve(false);
                }, 5000);
            });
        });
    }

    /**
     * 删除端口映射
     */
    async deletePortMapping(protocol, internalPort) {
        try {
            const key = `${protocol}-${internalPort}`;
            const mapping = this.mappings.get(key);
            
            if (!mapping) {
                logger.warn('HOLEPUNCH', '端口映射不存在', { protocol, internalPort });
                return false;
            }
            
            let success = false;
            
            if (mapping.type === 'UPnP') {
                success = await this.deleteUPnPMapping(mapping);
            } else if (mapping.type === 'PCP' || mapping.type === 'NAT-PMP') {
                success = await this.deletePCPMapping(mapping);
            }
            
            if (success) {
                this.mappings.delete(key);
                logger.info('HOLEPUNCH', '端口映射删除成功', mapping);
            }
            
            return success;
            
        } catch (error) {
            logger.error('HOLEPUNCH', '端口映射删除失败', error);
            return false;
        }
    }

    /**
     * 删除UPnP端口映射
     */
    async deleteUPnPMapping(mapping) {
        // 这里需要实现具体的UPnP删除请求
        return new Promise((resolve) => {
            setTimeout(() => {
                logger.info('HOLEPUNCH', '模拟UPnP端口映射删除', mapping);
                resolve(true);
            }, 500);
        });
    }

    /**
     * 删除PCP端口映射
     */
    async deletePCPMapping(mapping) {
        // PCP删除映射：发送duration为0的请求
        const deleteMapping = { ...mapping, duration: 0 };
        return this.createPCPMapping(deleteMapping);
    }

    /**
     * 获取端口映射状态
     */
    getPortMappingStatus() {
        const status = {
            upnp: {
                enabled: this.upnpEnabled,
                available: !!this.upnpDevice,
                device: this.upnpDevice
            },
            pcp: {
                enabled: this.pcpEnabled,
                available: !!this.pcpGateway,
                gateway: this.pcpGateway
            },
            mappings: Array.from(this.mappings.values()),
            gateway: this.gatewayIP
        };
        
        return status;
    }

    /**
     * 清理所有端口映射
     */
    async cleanup() {
        logger.info('HOLEPUNCH', '开始清理端口映射', { count: this.mappings.size });
        
        const promises = [];
        for (const [key, mapping] of this.mappings) {
            promises.push(this.deletePortMapping(mapping.protocol, mapping.internalPort));
        }
        
        await Promise.allSettled(promises);
        
        logger.info('HOLEPUNCH', '端口映射清理完成');
    }
}

module.exports = HolePunchManager;