/**
 * 网络配置管理模块
 * 负责管理net.ini配置文件
 * 
 * @author yxpil
 * @responsibility 负责网络配置的读取、解析和管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 网络配置管理核心模块，提供以下功能：
 * - INI 配置文件解析
 * - 网络参数管理（IP、端口、协议等）
 * - 配置验证和默认值处理
 * - 配置热重载
 * - 多环境配置支持
 * - 配置备份和恢复
 * 
 * @usage
 * 通过 NetworkConfigManager 类实例化使用，提供统一的配置管理接口
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../Tools/Logs.js');

class NetworkConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../../Data/net.ini');
        this.config = {};
        this.loadConfig();
    }

    /**
     * 加载配置文件
     */
    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                // 如果文件不存在，创建默认配置
                this.createDefaultConfig();
                return;
            }

            const content = fs.readFileSync(this.configPath, 'utf8');
            this.config = this.parseINI(content);
            logger.info('NETWORK', '网络配置加载成功', { path: this.configPath });
        } catch (error) {
            logger.error('NETWORK', '网络配置加载失败', error);
            this.createDefaultConfig();
        }
    }

    /**
     * 创建默认配置
     */
    createDefaultConfig() {
        this.config = {
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
            Sharing: {
                BroadcastIdentity: true,
                ShareVideoWithNonFriends: true,
                SharePostsWithNonFriends: true
            },
            STUN: {
                STUNServer: 'stun.l.google.com:19302'
            }
        };

        this.saveConfig();
        logger.info('NETWORK', '创建默认网络配置', null);
    }

    /**
     * 解析INI文件内容
     */
    parseINI(content) {
        const result = {};
        let currentSection = null;

        const lines = content.split('\n');
        for (let line of lines) {
            line = line.trim();
            
            // 跳过空行和注释
            if (!line || line.startsWith('#') || line.startsWith(';')) {
                continue;
            }

            // 处理节(section)
            if (line.startsWith('[') && line.endsWith(']')) {
                currentSection = line.slice(1, -1);
                result[currentSection] = {};
                continue;
            }

            // 处理键值对
            if (currentSection && line.includes('=')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                
                // 转换布尔值
                let finalValue;
                if (value.toLowerCase() === 'true') {
                    finalValue = true;
                } else if (value.toLowerCase() === 'false') {
                    finalValue = false;
                } else {
                    finalValue = value;
                }

                result[currentSection][key.trim()] = finalValue;
            }
        }

        return result;
    }

    /**
     * 生成INI文件内容
     */
    generateINI() {
        let content = '';
        const sections = Object.keys(this.config);

        for (const section of sections) {
            content += `[${section}]\n`;
            
            // 添加节注释
            switch (section) {
                case 'Network':
                    content += '# 网络连接设置\n';
                    break;
                case 'Sharing':
                    content += '# 内容分享设置\n';
                    break;
                case 'STUN':
                    content += '# STUN服务器设置\n';
                    break;
            }

            const keys = Object.keys(this.config[section]);
            for (const key of keys) {
                const value = this.config[section][key];
                content += `${key}=${value}\n`;
            }

            content += '\n';
        }

        return content.trim();
    }

    /**
     * 保存配置到文件
     */
    saveConfig() {
        try {
            const content = this.generateINI();
            fs.writeFileSync(this.configPath, content, 'utf8');
            logger.info('NETWORK', '网络配置保存成功', { path: this.configPath });
        } catch (error) {
            logger.error('NETWORK', '网络配置保存失败', error);
            throw error;
        }
    }

    /**
     * 获取完整配置
     */
    getFullConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     * 获取指定节的配置
     */
    getSection(section) {
        return this.config[section] ? JSON.parse(JSON.stringify(this.config[section])) : null;
    }

    /**
     * 获取指定配置项
     */
    getConfig(section, key) {
        return this.config[section] && this.config[section][key] !== undefined 
            ? this.config[section][key] 
            : null;
    }

    /**
     * 设置配置项
     */
    setConfig(section, key, value) {
        if (!this.config[section]) {
            this.config[section] = {};
        }

        this.config[section][key] = value;
        this.saveConfig();
        
        logger.info('NETWORK', '配置项更新', { section, key, value });
    }

    /**
     * 批量更新配置
     */
    updateConfigBatch(configData) {
        for (const section in configData) {
            if (!this.config[section]) {
                this.config[section] = {};
            }

            for (const key in configData[section]) {
                this.config[section][key] = configData[section][key];
            }
        }

        this.saveConfig();
        logger.info('NETWORK', '批量配置更新完成', { sections: Object.keys(configData) });
    }

    /**
     * 重置配置到默认值
     */
    resetToDefault() {
        this.createDefaultConfig();
        logger.info('NETWORK', '配置已重置为默认值', null);
    }

    /**
     * 验证配置值
     */
    validateConfig(section, key, value) {
        // 布尔值验证
        if (key.includes('UPnP') || key.includes('PCP') || key.includes('Listen') || 
            key.includes('Destroy') || key.includes('Allow') || key.includes('Share') || 
            key.includes('Broadcast')) {
            return typeof value === 'boolean';
        }

        // STUN服务器格式验证
        if (key === 'STUNServer') {
            return typeof value === 'string' && value.includes(':');
        }

        return true;
    }
}

module.exports = NetworkConfigManager;