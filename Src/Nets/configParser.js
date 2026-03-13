/**
 * 配置文件解析器模块
 * 
 * @author yxpil
 * @responsibility 负责 INI 格式配置文件的解析和管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * INI 配置文件解析器，提供以下功能：
 * - INI 文件格式解析
 * - 配置项读取和写入
 * - 配置文件验证
 * - 默认值处理
 * - 配置文件备份
 * 
 * @usage
 * 通过 IniConfigParser 类实例化使用，如：new IniConfigParser(configPath)
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../Tools/Logs.js');

/**
 * INI配置文件解析器
 * 用于解析net.ini等配置文件
 */
class IniConfigParser {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = {};
        this.loadConfig();
    }

    /**
     * 加载配置文件
     */
    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                logger.warn('CONFIG', '配置文件不存在，使用默认配置', { path: this.configPath });
                this.config = this.getDefaultConfig();
                return;
            }

            const content = fs.readFileSync(this.configPath, 'utf8');
            this.config = this.parseIni(content);
            logger.info('CONFIG', '配置文件加载成功', { path: this.configPath });
        } catch (error) {
            logger.error('CONFIG', '配置文件加载失败，使用默认配置', error);
            this.config = this.getDefaultConfig();
        }
    }

    /**
     * 解析INI格式内容
     */
    parseIni(content) {
        const result = {};
        let currentSection = null;

        const lines = content.split('\n');
        for (let line of lines) {
            line = line.trim();
            
            // 跳过空行和注释
            if (!line || line.startsWith('#') || line.startsWith(';')) {
                continue;
            }

            // 处理节标题 [Section]
            if (line.startsWith('[') && line.endsWith(']')) {
                currentSection = line.slice(1, -1);
                result[currentSection] = {};
                continue;
            }

            // 处理键值对 key=value
            if (currentSection && line.includes('=')) {
                const equalIndex = line.indexOf('=');
                const key = line.slice(0, equalIndex).trim();
                let value = line.slice(equalIndex + 1).trim();

                // 移除行尾注释
                const commentIndex = value.indexOf('#');
                if (commentIndex !== -1) {
                    value = value.slice(0, commentIndex).trim();
                }

                // 类型转换
                value = this.convertValue(value);
                result[currentSection][key] = value;
            }
        }

        return result;
    }

    /**
     * 值类型转换
     */
    convertValue(value) {
        // 布尔值
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        
        // 数字
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        
        // 数组（逗号分隔）
        if (value.includes(',')) {
            return value.split(',').map(v => this.convertValue(v.trim()));
        }
        
        // 字符串
        return value;
    }

    /**
     * 获取默认配置
     */
    getDefaultConfig() {
        return {
            Network: {
                ActiveUPnP: true,
                ActivePCP: true,
                DestroyUPnPOnExit: true,
                DestroyPCPOnExit: true,
                ListenIPv4: true,
                ListenIPv6: true,
                UDPHolePunching: true,
                AllowAsRelay: true
            },
            Server: {
                Host: '0.0.0.0',
                Port: 5726,
                ExternalAccess: true,
                MaxConnections: 100,
                Timeout: 30000
            },
            Security: {
                AllowExternalAccess: true,
                LocalOnlyEndpoints: true,
                TrustedProxies: ['127.0.0.1', '::1'],
                RateLimiting: true
            },
            Sharing: {
                BroadcastIdentity: true,
                ShareVideoWithNonFriends: true,
                SharePostsWithNonFriends: true
            },
            STUN: {
                STUNServer: 'stun.example.com:3478'
            }
        };
    }

    /**
     * 获取配置值
     */
    get(section, key, defaultValue = null) {
        if (this.config[section] && this.config[section][key] !== undefined) {
            return this.config[section][key];
        }
        return defaultValue;
    }

    /**
     * 获取整个节的配置
     */
    getSection(section) {
        return this.config[section] || {};
    }

    /**
     * 获取服务器配置
     */
    getServerConfig() {
        const serverSection = this.getSection('Server');
        return {
            host: serverSection.Host || '0.0.0.0',
            port: serverSection.Port || 5726,
            externalAccess: serverSection.ExternalAccess !== false,
            maxConnections: serverSection.MaxConnections || 100,
            timeout: serverSection.Timeout || 30000
        };
    }

    /**
     * 获取安全配置
     */
    getSecurityConfig() {
        const securitySection = this.getSection('Security');
        return {
            allowExternalAccess: securitySection.AllowExternalAccess !== false,
            localOnlyEndpoints: securitySection.LocalOnlyEndpoints !== false,
            trustedProxies: securitySection.TrustedProxies || ['127.0.0.1', '::1'],
            rateLimiting: securitySection.RateLimiting !== false
        };
    }

    /**
     * 获取网络配置
     */
    getNetworkConfig() {
        const networkSection = this.getSection('Network');
        return {
            activeUPnP: networkSection.ActiveUPnP !== false,
            activePCP: networkSection.ActivePCP !== false,
            destroyUPnPOnExit: networkSection.DestroyUPnPOnExit !== false,
            destroyPCPOnExit: networkSection.DestroyPCPOnExit !== false,
            listenIPv4: networkSection.ListenIPv4 !== false,
            listenIPv6: networkSection.ListenIPv6 !== false,
            udpHolePunching: networkSection.UDPHolePunching !== false,
            allowAsRelay: networkSection.AllowAsRelay !== false
        };
    }

    /**
     * 检查IP是否在信任代理列表中
     */
    isTrustedProxy(ip) {
        const securityConfig = this.getSecurityConfig();
        const trustedProxies = securityConfig.trustedProxies;
        
        // 处理IPv6映射地址
        if (ip.startsWith('::ffff:')) {
            ip = ip.slice(7);
        }
        
        return trustedProxies.includes(ip);
    }

    /**
     * 检查是否应该允许外部访问
     */
    shouldAllowExternalAccess() {
        const serverConfig = this.getServerConfig();
        const securityConfig = this.getSecurityConfig();
        
        return serverConfig.externalAccess && securityConfig.allowExternalAccess;
    }

    /**
     * 获取网络配置
     */
    getNetworkConfig() {
        const networkSection = this.config.Network || {};
        return {
            activeUPnP: networkSection.ActiveUPnP !== false,
            activePCP: networkSection.ActivePCP !== false,
            destroyUPnPOnExit: networkSection.DestroyUPnPOnExit !== false,
            destroyPCPOnExit: networkSection.DestroyPCPOnExit !== false,
            listenIPv4: networkSection.ListenIPv4 !== false,
            listenIPv6: networkSection.ListenIPv6 !== false,
            udpHolePunching: networkSection.UDPHolePunching !== false,
            allowAsRelay: networkSection.AllowAsRelay !== false,
            broadcastIdentity: networkSection.BroadcastIdentity !== false,
            shareVideoWithNonFriends: networkSection.ShareVideoWithNonFriends !== false,
            sharePostsWithNonFriends: networkSection.SharePostsWithNonFriends !== false,
            stunServer: networkSection.STUNServer || 'stun.l.google.com:19302'
        };
    }

    /**
     * 更新网络配置
     */
    updateNetworkConfig(networkConfig) {
        if (!this.config.Network) {
            this.config.Network = {};
        }
        
        const networkSection = this.config.Network;
        
        if (networkConfig.activeUPnP !== undefined) {
            networkSection.ActiveUPnP = networkConfig.activeUPnP;
        }
        if (networkConfig.activePCP !== undefined) {
            networkSection.ActivePCP = networkConfig.activePCP;
        }
        if (networkConfig.destroyUPnPOnExit !== undefined) {
            networkSection.DestroyUPnPOnExit = networkConfig.destroyUPnPOnExit;
        }
        if (networkConfig.destroyPCPOnExit !== undefined) {
            networkSection.DestroyPCPOnExit = networkConfig.destroyPCPOnExit;
        }
        if (networkConfig.listenIPv4 !== undefined) {
            networkSection.ListenIPv4 = networkConfig.listenIPv4;
        }
        if (networkConfig.listenIPv6 !== undefined) {
            networkSection.ListenIPv6 = networkConfig.listenIPv6;
        }
        if (networkConfig.udpHolePunching !== undefined) {
            networkSection.UDPHolePunching = networkConfig.udpHolePunching;
        }
        if (networkConfig.allowAsRelay !== undefined) {
            networkSection.AllowAsRelay = networkConfig.allowAsRelay;
        }
        if (networkConfig.broadcastIdentity !== undefined) {
            networkSection.BroadcastIdentity = networkConfig.broadcastIdentity;
        }
        if (networkConfig.shareVideoWithNonFriends !== undefined) {
            networkSection.ShareVideoWithNonFriends = networkConfig.shareVideoWithNonFriends;
        }
        if (networkConfig.sharePostsWithNonFriends !== undefined) {
            networkSection.SharePostsWithNonFriends = networkConfig.sharePostsWithNonFriends;
        }
        if (networkConfig.stunServer !== undefined) {
            networkSection.STUNServer = networkConfig.stunServer;
        }
        
        return this.saveConfig();
    }

    /**
     * 保存配置到文件
     */
    saveConfig() {
        try {
            const iniContent = this.serializeIni(this.config);
            fs.writeFileSync(this.configPath, iniContent, 'utf8');
            logger.info('CONFIG', '配置文件保存成功', { path: this.configPath });
            return true;
        } catch (error) {
            logger.error('CONFIG', '配置文件保存失败', error);
            return false;
        }
    }

    /**
     * 序列化配置为INI格式
     */
    serializeIni(config) {
        let result = '';
        
        for (const [section, keys] of Object.entries(config)) {
            result += `[${section}]\n`;
            
            for (const [key, value] of Object.entries(keys)) {
                if (Array.isArray(value)) {
                    result += `${key}=${value.join(',')}\n`;
                } else {
                    result += `${key}=${value}\n`;
                }
            }
            
            result += '\n';
        }
        
        return result.trim();
    }
}

module.exports = IniConfigParser;