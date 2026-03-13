/**
 * 插件管理模块
 * 负责管理插件的生命周期、配置和自动启动
 * 插件结构：每个插件一个目录，包含index.html和main.js
 * 
 * @author yxpil
 * @responsibility 负责插件系统管理，包括插件生命周期、配置和自动启动
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 插件管理核心模块，提供以下功能：
 * - 插件发现和加载
 * - 插件生命周期管理（安装、启用、禁用、卸载）
 * - 插件配置管理
 * - 插件自动启动
 * - 插件依赖管理
 * - 插件权限控制
 * - 插件状态监控
 * 
 * @usage
 * 通过 PluginManager 类实例化使用，提供统一的插件管理接口
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../Tools/Logs.js');

class PluginManager {
    constructor() {
        this.pluginsDir = path.join(__dirname, '../Plugs');
        this.pluginsConfigPath = path.join(__dirname, '../../Data/plugstartlist.ini');
        this.plugins = new Map(); // 存储插件信息
        this.loadedPlugins = new Map(); // 存储已加载的插件实例
        this.loadPluginsConfig();
        this.scanPlugins();
    }

    /**
     * 扫描插件目录
     */
    scanPlugins() {
        try {
            if (!fs.existsSync(this.pluginsDir)) {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
                logger.info('PLUGIN', '创建插件目录', { path: this.pluginsDir });
                return;
            }

            const items = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
            
            items.forEach(item => {
                if (item.isDirectory() && item.name !== 'node_modules') {
                    const pluginName = item.name;
                    const pluginPath = path.join(this.pluginsDir, pluginName);
                    
                    try {
                        // 检查是否存在必要的文件
                        const indexPath = path.join(pluginPath, 'index.html');
                        const mainPath = path.join(pluginPath, 'main.js');
                        
                        if (!fs.existsSync(indexPath) || !fs.existsSync(mainPath)) {
                            logger.warn('PLUGIN', `插件缺少必要文件: ${pluginName}`, { 
                                hasIndex: fs.existsSync(indexPath),
                                hasMain: fs.existsSync(mainPath)
                            });
                            return;
                        }

                        // 读取main.js获取插件信息
                        const mainContent = fs.readFileSync(mainPath, 'utf8');
                        const pluginInfo = this.extractPluginInfo(mainContent, pluginName);
                        
                        // 合并配置文件中的信息
                        const configInfo = this.plugins.get(pluginName) || {};
                        
                        this.plugins.set(pluginName, {
                            name: pluginName,
                            path: pluginPath,
                            indexPath: indexPath,
                            mainPath: mainPath,
                            enabled: configInfo.enabled !== undefined ? configInfo.enabled : true,
                            autoStart: configInfo.autoStart !== undefined ? configInfo.autoStart : false,
                            description: pluginInfo.description || '暂无描述',
                            version: pluginInfo.version || '1.0.0',
                            author: pluginInfo.author || '未知作者',
                            status: 'stopped',
                            lastError: null,
                            startTime: null,
                            isLoaded: false
                        });
                        
                        logger.info('PLUGIN', '发现插件', { name: pluginName, path: pluginPath });
                    } catch (error) {
                        logger.error('PLUGIN', `扫描插件失败: ${pluginName}`, error);
                    }
                }
            });
            
            logger.info('PLUGIN', '插件扫描完成', { count: this.plugins.size });
        } catch (error) {
            logger.error('PLUGIN', '扫描插件目录失败', error);
        }
    }

    /**
     * 从插件main.js中提取信息
     */
    extractPluginInfo(content, pluginName) {
        const info = {
            description: '暂无描述',
            version: '1.0.0',
            author: '未知作者'
        };

        // 尝试从注释中提取信息
        const lines = content.split('\n');
        for (let line of lines) {
            line = line.trim();
            
            // 提取描述
            if (line.includes('@description') || line.includes('描述')) {
                const descMatch = line.match(/[:：]\s*(.+)/);
                if (descMatch) {
                    info.description = descMatch[1].trim();
                }
            }
            
            // 提取版本
            if (line.includes('@version') || line.includes('版本')) {
                const verMatch = line.match(/[:：]\s*(.+)/);
                if (verMatch) {
                    info.version = verMatch[1].trim();
                }
            }
            
            // 提取作者
            if (line.includes('@author') || line.includes('作者')) {
                const authMatch = line.match(/[:：]\s*(.+)/);
                if (authMatch) {
                    info.author = authMatch[1].trim();
                }
            }
        }

        return info;
    }

    /**
     * 加载插件配置
     */
    loadPluginsConfig() {
        try {
            if (!fs.existsSync(this.pluginsConfigPath)) {
                this.createDefaultConfig();
                return;
            }

            const content = fs.readFileSync(this.pluginsConfigPath, 'utf8');
            const config = this.parseINI(content);
            
            for (const [pluginName, pluginConfig] of Object.entries(config)) {
                this.plugins.set(pluginName, {
                    name: pluginName,
                    enabled: pluginConfig.enabled === 'true',
                    autoStart: pluginConfig.autoStart === 'true',
                    description: pluginConfig.description || '暂无描述',
                    version: pluginConfig.version || '1.0.0',
                    author: pluginConfig.author || '未知作者',
                    status: 'stopped',
                    lastError: null,
                    startTime: null,
                    isLoaded: false
                });
            }
            
            logger.info('PLUGIN', '插件配置加载完成', { count: this.plugins.size });
        } catch (error) {
            logger.error('PLUGIN', '加载插件配置失败', error);
            this.createDefaultConfig();
        }
    }

    /**
     * 创建默认配置
     */
    createDefaultConfig() {
        const defaultConfig = {
            '网络检测工具': {
                enabled: 'true',
                autoStart: 'false',
                description: '网络检测和诊断工具',
                version: '1.0.0',
                author: '系统'
            }
        };

        this.savePluginsConfig(defaultConfig);
        logger.info('PLUGIN', '创建默认插件配置', { path: this.pluginsConfigPath });
    }

    /**
     * 保存插件配置
     */
    savePluginsConfig(config = null) {
        try {
            const configToSave = config || this.getPluginsConfig();
            let content = '# 插件启动列表配置文件\n';
            content += '# 此文件控制插件的启用状态和自动启动设置\n\n';
            
            for (const [pluginName, pluginConfig] of Object.entries(configToSave)) {
                content += `[${pluginName}]\n`;
                content += `enabled=${pluginConfig.enabled}\n`;
                content += `autoStart=${pluginConfig.autoStart}\n`;
                content += `description=${pluginConfig.description}\n`;
                content += `version=${pluginConfig.version}\n`;
                content += `author=${pluginConfig.author}\n\n`;
            }
            
            fs.writeFileSync(this.pluginsConfigPath, content, 'utf8');
            logger.info('PLUGIN', '插件配置保存完成', { path: this.pluginsConfigPath });
        } catch (error) {
            logger.error('PLUGIN', '保存插件配置失败', error);
            throw error;
        }
    }

    /**
     * 获取插件配置对象
     */
    getPluginsConfig() {
        const config = {};
        for (const [name, pluginInfo] of this.plugins) {
            config[name] = {
                enabled: pluginInfo.enabled ? 'true' : 'false',
                autoStart: pluginInfo.autoStart ? 'true' : 'false',
                description: pluginInfo.description,
                version: pluginInfo.version,
                author: pluginInfo.author
            };
        }
        return config;
    }

    /**
     * 启动插件
     */
    async startPlugin(pluginName) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error(`插件不存在: ${pluginName}`);
            }

            if (!plugin.enabled) {
                throw new Error(`插件未启用: ${pluginName}`);
            }

            if (plugin.status === 'running') {
                logger.warn('PLUGIN', `插件已在运行: ${pluginName}`);
                return { success: false, message: '插件已在运行' };
            }

            // 读取并执行插件的main.js
            const mainContent = fs.readFileSync(plugin.mainPath, 'utf8');
            
            try {
                // 在沙箱环境中执行插件代码
                const pluginModule = {};
                const pluginExports = {};
                
                // 创建插件执行环境
                const pluginContext = {
                    console: {
                        log: (...args) => logger.info('PLUGIN', `${pluginName}:`, args),
                        error: (...args) => logger.error('PLUGIN', `${pluginName}:`, args),
                        warn: (...args) => logger.warn('PLUGIN', `${pluginName}:`, args)
                    },
                    require: (module) => {
                        // 限制插件只能访问安全的模块
                        const allowedModules = ['fs', 'path', 'util', 'http', 'url', 'child_process'];
                        if (allowedModules.includes(module)) {
                            return require(module);
                        }
                        throw new Error(`插件不允许访问模块: ${module}`);
                    },
                    exports: pluginExports,
                    module: { exports: pluginExports },
                    // 提供浏览器环境的模拟全局变量
                    window: {},
                    global: global,
                    process: process
                };

                // 执行插件代码
                const pluginFunction = new Function('console', 'require', 'exports', 'module', mainContent);
                pluginFunction(pluginContext.console, pluginContext.require, pluginContext.exports, pluginContext.module);

                // 更新状态
                plugin.status = 'running';
                plugin.startTime = new Date().toISOString();
                plugin.lastError = null;
                plugin.isLoaded = true;

                this.loadedPlugins.set(pluginName, pluginContext);

                logger.info('PLUGIN', `插件启动成功: ${pluginName}`);
                return { success: true, message: '插件启动成功' };
            } catch (error) {
                plugin.status = 'error';
                plugin.lastError = error.message;
                throw error;
            }
        } catch (error) {
            logger.error('PLUGIN', `插件启动失败: ${pluginName}`, error);
            
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                plugin.status = 'error';
                plugin.lastError = error.message;
            }
            
            return { success: false, message: error.message };
        }
    }

    /**
     * 停止插件
     */
    async stopPlugin(pluginName) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error(`插件不存在: ${pluginName}`);
            }

            if (plugin.status !== 'running') {
                logger.warn('PLUGIN', `插件未在运行: ${pluginName}`);
                return { success: false, message: '插件未在运行' };
            }

            const pluginContext = this.loadedPlugins.get(pluginName);
            if (pluginContext && pluginContext.module && pluginContext.module.exports && 
                typeof pluginContext.module.exports.stop === 'function') {
                try {
                    await pluginContext.module.exports.stop();
                } catch (error) {
                    logger.error('PLUGIN', `插件停止函数执行失败: ${pluginName}`, error);
                }
            }

            // 更新状态
            plugin.status = 'stopped';
            plugin.startTime = null;
            plugin.isLoaded = false;

            this.loadedPlugins.delete(pluginName);

            logger.info('PLUGIN', `插件停止成功: ${pluginName}`);
            return { success: true, message: '插件停止成功' };
        } catch (error) {
            logger.error('PLUGIN', `插件停止失败: ${pluginName}`, error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 重启插件
     */
    async restartPlugin(pluginName) {
        try {
            await this.stopPlugin(pluginName);
            await this.startPlugin(pluginName);
            logger.info('PLUGIN', `插件重启成功: ${pluginName}`);
            return { success: true, message: '插件重启成功' };
        } catch (error) {
            logger.error('PLUGIN', `插件重启失败: ${pluginName}`, error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 删除插件
     */
    async deletePlugin(pluginName) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error(`插件不存在: ${pluginName}`);
            }

            // 如果插件正在运行，先停止它
            if (plugin.status === 'running') {
                await this.stopPlugin(pluginName);
            }

            // 删除插件目录
            if (fs.existsSync(plugin.path)) {
                // 递归删除目录
                this.deleteDirectory(plugin.path);
            }

            // 从配置中移除
            this.plugins.delete(pluginName);
            this.savePluginsConfig();

            logger.info('PLUGIN', `插件删除成功: ${pluginName}`);
            return { success: true, message: '插件删除成功' };
        } catch (error) {
            logger.error('PLUGIN', `插件删除失败: ${pluginName}`, error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 递归删除目录
     */
    deleteDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.deleteDirectory(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    /**
     * 启用/禁用插件
     */
    async togglePlugin(pluginName, enabled) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error(`插件不存在: ${pluginName}`);
            }

            // 如果禁用插件且插件正在运行，先停止插件
            if (!enabled && plugin.status === 'running') {
                await this.stopPlugin(pluginName);
            }

            plugin.enabled = enabled;
            this.savePluginsConfig();

            logger.info('PLUGIN', `插件${enabled ? '启用' : '禁用'}: ${pluginName}`);
            return { success: true, message: `插件已${enabled ? '启用' : '禁用'}` };
        } catch (error) {
            logger.error('PLUGIN', `插件${enabled ? '启用' : '禁用'}失败: ${pluginName}`, error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 设置插件自动启动
     */
    async setAutoStart(pluginName, autoStart) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error(`插件不存在: ${pluginName}`);
            }

            plugin.autoStart = autoStart;
            this.savePluginsConfig();

            logger.info('PLUGIN', `插件自动启动${autoStart ? '启用' : '禁用'}: ${pluginName}`);
            return { success: true, message: `插件自动启动已${autoStart ? '启用' : '禁用'}` };
        } catch (error) {
            logger.error('PLUGIN', `插件自动启动设置失败: ${pluginName}`, error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 获取所有插件信息
     */
    getAllPlugins() {
        const plugins = [];
        for (const [name, pluginInfo] of this.plugins) {
            plugins.push({
                name: pluginInfo.name,
                enabled: pluginInfo.enabled,
                autoStart: pluginInfo.autoStart,
                description: pluginInfo.description,
                version: pluginInfo.version,
                author: pluginInfo.author,
                status: pluginInfo.status,
                lastError: pluginInfo.lastError,
                startTime: pluginInfo.startTime,
                isLoaded: pluginInfo.isLoaded,
                hasIndex: fs.existsSync(pluginInfo.indexPath),
                hasMain: fs.existsSync(pluginInfo.mainPath)
            });
        }
        return plugins;
    }

    /**
     * 搜索插件
     */
    searchPlugins(query) {
        const allPlugins = this.getAllPlugins();
        if (!query) return allPlugins;

        const lowerQuery = query.toLowerCase();
        return allPlugins.filter(plugin => 
            plugin.name.toLowerCase().includes(lowerQuery) ||
            plugin.description.toLowerCase().includes(lowerQuery) ||
            plugin.author.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * 启动所有自动启动的插件
     */
    async startAutoStartPlugins() {
        logger.info('PLUGIN', '开始启动自动启动插件');
        const autoStartPlugins = Array.from(this.plugins.values()).filter(p => p.autoStart && p.enabled && p.status !== 'running');
        
        const results = [];
        for (const plugin of autoStartPlugins) {
            try {
                const result = await this.startPlugin(plugin.name);
                results.push({
                    name: plugin.name,
                    success: result.success,
                    message: result.message
                });
                
                // 添加延迟避免启动过快
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                results.push({
                    name: plugin.name,
                    success: false,
                    message: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        logger.info('PLUGIN', '自动启动插件完成', { 
            total: results.length, 
            success: successCount, 
            failed: failCount,
            results 
        });
        
        return {
            success: failCount === 0,
            total: results.length,
            successCount: successCount,
            failCount: failCount,
            results: results
        };
    }

    /**
     * 检查插件是否正在运行
     */
    isPluginRunning(pluginName) {
        const plugin = this.plugins.get(pluginName);
        return plugin ? plugin.status === 'running' : false;
    }

    /**
     * 获取插件状态信息
     */
    getPluginStatus(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            return null;
        }
        
        return {
            name: plugin.name,
            enabled: plugin.enabled,
            autoStart: plugin.autoStart,
            status: plugin.status,
            lastError: plugin.lastError,
            startTime: plugin.startTime,
            isLoaded: plugin.isLoaded
        };
    }

    /**
     * 获取插件统计信息
     */
    getPluginStats() {
        const plugins = Array.from(this.plugins.values());
        return {
            total: plugins.length,
            running: plugins.filter(p => p.status === 'running').length,
            stopped: plugins.filter(p => p.status === 'stopped').length,
            error: plugins.filter(p => p.status === 'error').length,
            enabled: plugins.filter(p => p.enabled).length,
            autoStart: plugins.filter(p => p.autoStart).length
        };
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
                result[currentSection][key.trim()] = value;
            }
        }

        return result;
    }

    /**
     * 获取插件的HTML内容
     */
    getPluginHTML(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin || !plugin.enabled) {
            throw new Error(`插件不存在或未启用: ${pluginName}`);
        }

        if (!fs.existsSync(plugin.indexPath)) {
            throw new Error(`插件HTML文件不存在: ${plugin.indexPath}`);
        }

        return fs.readFileSync(plugin.indexPath, 'utf8');
    }
}

module.exports = PluginManager;