/**
 * 系统信息模块
 * 
 * @author yxpil
 * @responsibility 负责收集和管理系统硬件、软件信息
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 系统信息收集模块，提供以下功能：
 * - 操作系统信息获取（平台、架构、版本等）
 * - CPU 信息收集（型号、核心数、使用率等）
 * - 内存信息统计（总内存、可用内存等）
 * - 磁盘空间监控
 * - 网络接口信息
 * - 系统运行时间
 * - 进程信息收集
 * 
 * @usage
 * 通过 SystemInfo 类实例化使用，提供统一的系统信息接口
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 系统信息工具类
 * 获取真实的系统硬件和运行状态信息
 */
class SystemInfo {
    constructor() {
        this.startTime = Date.now();
        this.processStartTime = process.uptime();
    }

    /**
     * 获取CPU信息
     */
    getCPUInfo() {
        const cpus = os.cpus();
        const cpuUsage = this.getCPUUsage();
        
        return {
            model: cpus[0].model,
            cores: cpus.length,
            speed: cpus[0].speed,
            usage: cpuUsage,
            loadAverage: os.loadavg()
        };
    }

    /**
     * 获取CPU使用率
     */
    getCPUUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (let type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);

        return Math.round(usage * 100) / 100;
    }

    /**
     * 获取内存信息
     */
    getMemoryInfo() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        
        return {
            total: this.formatBytes(total),
            free: this.formatBytes(free),
            used: this.formatBytes(used),
            usage: Math.round((used / total) * 100 * 100) / 100,
            totalBytes: total,
            freeBytes: free,
            usedBytes: used
        };
    }

    /**
     * 获取操作系统信息
     */
    getOSInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            uptime: this.formatUptime(os.uptime()),
            uptimeSeconds: os.uptime()
        };
    }

    /**
     * 获取网络接口信息（优化IP地址选择，优先显示局域网IP）
     */
    getNetworkInterfaces() {
        const interfaces = os.networkInterfaces();
        const result = {};
        const localIPs = {
            ipv4: [],
            ipv6: [],
            lanIPv4: [],
            wanIPv4: [],
            wanIPv6: []
        };
        
        // IP地址分类函数
        const classifyIP = (ip) => {
            // 本地回环
            if (ip.startsWith('127.') || ip === '::1') {
                return 'loopback';
            }
            
            // 局域网IPv4
            if (ip.startsWith('192.168.') || ip.startsWith('10.') || 
                (ip.startsWith('172.') && this.isPrivateIPv4(ip))) {
                return 'lan-ipv4';
            }
            
            // IPv6本地链路
            if (ip.startsWith('fe80:')) {
                return 'ipv6-link-local';
            }
            
            // 公网IPv4
            if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
                return 'wan-ipv4';
            }
            
            // 公网IPv6
            if (ip.includes(':') && !ip.startsWith('fe80:')) {
                return 'wan-ipv6';
            }
            
            return 'unknown';
        };
        
        for (let name in interfaces) {
            const addresses = interfaces[name];
            const interfaceInfo = {
                ipv4: [],
                ipv6: []
            };
            
            addresses.forEach(addr => {
                if (addr.internal) return; // 跳过内部地址
                
                const type = classifyIP(addr.address);
                
                if (addr.family === 'IPv4') {
                    interfaceInfo.ipv4.push(addr.address);
                    localIPs.ipv4.push(addr.address);
                    
                    if (type === 'lan-ipv4') {
                        localIPs.lanIPv4.push(addr.address);
                    } else if (type === 'wan-ipv4') {
                        localIPs.wanIPv4.push(addr.address);
                    }
                } else if (addr.family === 'IPv6') {
                    interfaceInfo.ipv6.push(addr.address);
                    localIPs.ipv6.push(addr.address);
                    
                    if (type === 'wan-ipv6') {
                        localIPs.wanIPv6.push(addr.address);
                    }
                }
            });
            
            if (interfaceInfo.ipv4.length > 0 || interfaceInfo.ipv6.length > 0) {
                result[name] = interfaceInfo;
            }
        }
        
        // 优先选择逻辑：局域网IPv4 > 公网IPv4 > 公网IPv6
        let primaryIPv4 = null;
        let primaryIPv6 = null;
        let networkType = 'none';
        
        if (localIPs.lanIPv4.length > 0) {
            primaryIPv4 = localIPs.lanIPv4[0];
            networkType = 'lan';
        } else if (localIPs.wanIPv4.length > 0) {
            primaryIPv4 = localIPs.wanIPv4[0];
            networkType = 'wan';
        }
        
        if (localIPs.wanIPv6.length > 0) {
            primaryIPv6 = localIPs.wanIPv6[0];
        }
        
        return {
            interfaces: result,
            localIPs: localIPs,
            primaryIPv4: primaryIPv4,
            primaryIPv6: primaryIPv6,
            networkType: networkType
        };
    }
    
    /**
     * 判断是否为私有IPv4地址
     */
    isPrivateIPv4(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        
        // 172.16.0.0 - 172.31.255.255
        if (first === 172 && second >= 16 && second <= 31) {
            return true;
        }
        
        return false;
    }

    /**
     * 获取磁盘信息
     */
    async getDiskInfo() {
        try {
            let result;
            
            if (process.platform === 'win32') {
                // Windows系统
                const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
                const lines = stdout.trim().split('\n').slice(1);
                
                result = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 3 && parts[1] && parts[2]) {
                        const free = parseInt(parts[1]);
                        const size = parseInt(parts[2]);
                        return {
                            path: parts[0],
                            size: this.formatBytes(size),
                            free: this.formatBytes(free),
                            used: this.formatBytes(size - free),
                            usage: Math.round(((size - free) / size) * 100 * 100) / 100
                        };
                    }
                    return null;
                }).filter(Boolean);
            } else {
                // Unix-like系统 (macOS, Linux)
                const { stdout } = await execAsync("df -k | tail -n +2 | awk '{print $1, $2, $3, $4, $6}'");
                const lines = stdout.trim().split('\n');
                
                result = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        const size = parseInt(parts[1]) * 1024;
                        const used = parseInt(parts[2]) * 1024;
                        const free = parseInt(parts[3]) * 1024;
                        
                        return {
                            path: parts[4],
                            size: this.formatBytes(size),
                            used: this.formatBytes(used),
                            free: this.formatBytes(free),
                            usage: Math.round((used / size) * 100 * 100) / 100
                        };
                    }
                    return null;
                }).filter(Boolean);
            }
            
            return result;
        } catch (error) {
            console.error('获取磁盘信息失败:', error);
            return [];
        }
    }

    /**
     * 获取进程信息
     */
    getProcessInfo() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            pid: process.pid,
            version: process.version,
            arch: process.arch,
            platform: process.platform,
            memory: {
                rss: this.formatBytes(memoryUsage.rss),
                heapTotal: this.formatBytes(memoryUsage.heapTotal),
                heapUsed: this.formatBytes(memoryUsage.heapUsed),
                external: this.formatBytes(memoryUsage.external)
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: this.formatUptime(process.uptime()),
            uptimeSeconds: process.uptime()
        };
    }

    /**
     * 获取HTTP服务器信息
     */
    getServerInfo() {
        return {
            port: process.env.PORT || 5726,
            host: process.env.HOST || 'localhost',
            uptime: this.formatUptime((Date.now() - this.startTime) / 1000),
            uptimeSeconds: (Date.now() - this.startTime) / 1000,
            status: 'running'
        };
    }

    /**
     * 获取完整的系统信息
     */
    async getFullSystemInfo() {
        const [diskInfo] = await Promise.all([
            this.getDiskInfo()
        ]);

        return {
            timestamp: new Date().toISOString(),
            os: this.getOSInfo(),
            cpu: this.getCPUInfo(),
            memory: this.getMemoryInfo(),
            network: this.getNetworkInterfaces(),
            disk: diskInfo,
            process: this.getProcessInfo(),
            server: this.getServerInfo()
        };
    }

    /**
     * 获取简化的系统信息（用于显示）
     */
    async getSimpleSystemInfo() {
        const memory = this.getMemoryInfo();
        const cpu = this.getCPUInfo();
        const osInfo = this.getOSInfo();
        const networkInfo = this.getNetworkInterfaces();
        const processInfo = this.getProcessInfo();
        const serverInfo = this.getServerInfo();

        return {
            os: {
                platform: osInfo.platform,
                arch: osInfo.arch,
                hostname: osInfo.hostname,
                uptime: osInfo.uptime
            },
            cpu: {
                model: cpu.model,
                cores: cpu.cores,
                usage: cpu.usage
            },
            memory: {
                total: memory.total,
                used: memory.used,
                free: memory.free,
                usage: memory.usage
            },
            network: {
                primaryIPv4: networkInfo.primaryIPv4,
                primaryIPv6: networkInfo.primaryIPv6,
                interfaceCount: Object.keys(networkInfo.interfaces).length
            },
            process: {
                pid: processInfo.pid,
                version: processInfo.version,
                uptime: processInfo.uptime,
                memory: processInfo.memory
            },
            server: serverInfo
        };
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * 格式化运行时间
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}天`);
        if (hours > 0) parts.push(`${hours}小时`);
        if (minutes > 0) parts.push(`${minutes}分钟`);
        if (secs > 0 && parts.length < 3) parts.push(`${secs}秒`);
        
        return parts.join('') || '0秒';
    }
}

module.exports = SystemInfo;