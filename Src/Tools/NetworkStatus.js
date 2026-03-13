const { execSync } = require('child_process');
const os = require('os');
const dns = require('dns');
const { promisify } = require('util');
const dnsLookup = promisify(dns.lookup);

/**
 * 网络连接状态检测工具
 * 用于检测设备的网络连接状态
 */
class NetworkStatus {
    constructor() {
        // 移除了net-ping依赖
    }

    /**
     * 检查网络连接状态
     * @returns {Promise<Object>} 网络状态对象
     */
    async checkNetworkStatus() {
        try {
            // 检测基本的网络连接
            const isOnline = await this.isOnline();
            
            if (!isOnline) {
                return {
                    isConnected: false,
                    connectionType: 'none',
                    ipAddresses: {},
                    dnsStatus: 'failed',
                    latency: null
                };
            }

            // 检测连接类型
            const connectionType = await this.getConnectionType();
            
            // 获取IP地址
            const ipAddresses = this.getIPAddresses();
            
            // 检测DNS
            const dnsStatus = await this.checkDNS();
            
            // 测量延迟
            const latency = await this.measureLatency();

            return {
                isConnected: true,
                connectionType,
                ipAddresses,
                dnsStatus,
                latency
            };
        } catch (error) {
            console.error('检查网络状态失败:', error);
            return {
                isConnected: false,
                connectionType: 'unknown',
                ipAddresses: {},
                dnsStatus: 'failed',
                latency: null
            };
        }
    }

    /**
     * 检测是否在线
     * @returns {Promise<boolean>} 是否在线
     */
    async isOnline() {
        if (os.platform() === 'win32') {
            return this.isOnlineWindows();
        } else if (os.platform() === 'darwin') {
            return this.isOnlineMac();
        } else if (os.platform() === 'linux') {
            return this.isOnlineLinux();
        }

        // 通用方法：DNS解析
        try {
            await dns.promises.lookup('www.baidu.com');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Windows平台检测是否在线
     * @returns {Promise<boolean>}
     */
    isOnlineWindows() {
        try {
            execSync('ping -n 1 www.baidu.com', { encoding: 'utf8', timeout: 2000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Mac平台检测是否在线
     * @returns {Promise<boolean>}
     */
    isOnlineMac() {
        try {
            execSync('ping -c 1 www.baidu.com', { encoding: 'utf8', timeout: 2000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Linux平台检测是否在线
     * @returns {Promise<boolean>}
     */
    isOnlineLinux() {
        try {
            execSync('ping -c 1 www.baidu.com', { encoding: 'utf8', timeout: 2000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取连接类型
     * @returns {Promise<string>} 连接类型
     */
    async getConnectionType() {
        if (os.platform() === 'win32') {
            return this.getConnectionTypeWindows();
        } else if (os.platform() === 'darwin') {
            return this.getConnectionTypeMac();
        } else if (os.platform() === 'linux') {
            return this.getConnectionTypeLinux();
        }

        return 'unknown';
    }

    /**
     * Windows平台获取连接类型
     * @returns {string}
     */
    getConnectionTypeWindows() {
        try {
            const output = execSync('netsh interface show interface', { encoding: 'utf8' });
            if (output.includes('Wi-Fi') && output.includes('Connected')) {
                return 'wifi';
            } else if (output.includes('Ethernet') && output.includes('Connected')) {
                return 'ethernet';
            }
        } catch (error) {
            console.error('获取Windows连接类型失败:', error);
        }
        return 'unknown';
    }

    /**
     * Mac平台获取连接类型
     * @returns {string}
     */
    getConnectionTypeMac() {
        try {
            const output = execSync('networksetup -listallhardwareports', { encoding: 'utf8' });
            if (output.includes('Wi-Fi') || output.includes('AirPort')) {
                return 'wifi';
            } else if (output.includes('Ethernet')) {
                return 'ethernet';
            }
        } catch (error) {
            console.error('获取Mac连接类型失败:', error);
        }
        return 'unknown';
    }

    /**
     * Linux平台获取连接类型
     * @returns {string}
     */
    getConnectionTypeLinux() {
        try {
            const output = execSync('ip link show', { encoding: 'utf8' });
            if (output.includes('wlan') && output.includes('UP')) {
                return 'wifi';
            } else if (output.includes('eth') && output.includes('UP')) {
                return 'ethernet';
            }
        } catch (error) {
            console.error('获取Linux连接类型失败:', error);
        }
        return 'unknown';
    }

    /**
     * 获取IP地址
     * @returns {Object} IP地址对象
     */
    getIPAddresses() {
        const interfaces = os.networkInterfaces();
        const result = {
            ipv4: [],
            ipv6: [],
            lanIPv4: [],
            wanIPv4: [],
            wanIPv6: []
        };

        for (const [name, addresses] of Object.entries(interfaces)) {
            for (const addr of addresses) {
                const ip = addr.address;
                const family = addr.family;

                // 跳过回环地址
                if (ip === '127.0.0.1' || ip === '::1') {
                    continue;
                }

                if (family === 'IPv4') {
                    result.ipv4.push(ip);
                    
                    // 判断是否为局域网IPv4
                    if (ip.startsWith('192.168.') || ip.startsWith('10.') || 
                        (ip.startsWith('172.') && this.isPrivateIPv4(ip))) {
                        result.lanIPv4.push(ip);
                    } else {
                        result.wanIPv4.push(ip);
                    }
                } else if (family === 'IPv6') {
                    result.ipv6.push(ip);
                    
                    // 跳过本地链路IPv6
                    if (!ip.startsWith('fe80:')) {
                        result.wanIPv6.push(ip);
                    }
                }
            }
        }

        return result;
    }

    /**
     * 判断是否为私有IPv4地址
     * @param {string} ip IPv4地址
     * @returns {boolean} 是否为私有地址
     */
    isPrivateIPv4(ip) {
        const parts = ip.split('.');
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);

        // 172.16.0.0 - 172.31.255.255
        if (first === 172 && second >= 16 && second <= 31) {
            return true;
        }

        return false;
    }

    /**
     * 检测DNS
     * @returns {Promise<string>} DNS状态
     */
    async checkDNS() {
        try {
            await dns.promises.lookup('www.baidu.com');
            await dns.promises.lookup('www.google.com');
            return 'ok';
        } catch (error) {
            return 'failed';
        }
    }

    /**
     * 测量网络延迟
     * @returns {Promise<number|null>} 延迟时间（毫秒）或null
     */
    async measureLatency() {
        if (os.platform() === 'win32') {
            return this.measureLatencyWindows();
        } else if (os.platform() === 'darwin') {
            return this.measureLatencyMac();
        } else if (os.platform() === 'linux') {
            return this.measureLatencyLinux();
        }
        return null;
    }

    /**
     * Windows平台测量延迟
     * @returns {Promise<number|null>} 延迟时间（毫秒）或null
     */
    measureLatencyWindows() {
        try {
            const output = execSync('ping -n 1 -w 1000 www.baidu.com', { encoding: 'utf8' });
            const latencyMatch = output.match(/时间=(\d+)ms/);
            if (latencyMatch && latencyMatch[1]) {
                return parseInt(latencyMatch[1]);
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Mac平台测量延迟
     * @returns {Promise<number|null>} 延迟时间（毫秒）或null
     */
    measureLatencyMac() {
        try {
            const output = execSync('ping -c 1 -W 1 www.baidu.com', { encoding: 'utf8' });
            const latencyMatch = output.match(/time=(\d+\.\d+)/);
            if (latencyMatch && latencyMatch[1]) {
                return Math.round(parseFloat(latencyMatch[1]));
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Linux平台测量延迟
     * @returns {Promise<number|null>} 延迟时间（毫秒）或null
     */
    measureLatencyLinux() {
        try {
            const output = execSync('ping -c 1 -W 1 www.baidu.com', { encoding: 'utf8' });
            const latencyMatch = output.match(/time=(\d+\.\d+)/);
            if (latencyMatch && latencyMatch[1]) {
                return Math.round(parseFloat(latencyMatch[1]));
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}

// 导出单例
const networkStatus = new NetworkStatus();

module.exports = { NetworkStatus, networkStatus };
