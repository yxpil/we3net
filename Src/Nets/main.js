/**
 * 网络服务主模块
 * 
 * @author yxpil
 * @responsibility 负责 HTTP 服务器、API 接口和核心业务逻辑处理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 网络服务核心模块，提供以下功能：
 * - HTTP 服务器创建和管理
 * - RESTful API 接口实现
 * - 业务逻辑处理中心
 * - 模块间协调和调度
 * - 请求路由和处理
 * - 响应格式化和错误处理
 * 
 * @usage
 * 作为主服务器模块运行，处理所有网络请求和业务逻辑
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { logger } = require('../Tools/Logs.js'); // 使用统一日志系统
const SystemInfo = require('./Systeminfo.js'); // 系统信息模块
const HealthCheck = require('./health.js'); // 健康检查模块
const UserInfoManager = require('./userinfo.js'); // 用户信息管理模块
const ThemeManager = require('./themeManager.js'); // 主题管理模块
const NetworkConfigManager = require('./networkConfig.js'); // 网络配置管理模块
const PluginManager = require('./plugmanager.js'); // 插件管理模块
const IniConfigParser = require('./configParser.js'); // INI配置文件解析器
const HolePunchManager = require('./holePunchManager.js'); // UPnP/PCP端口映射管理器

// 加载网络配置
const configPath = path.join(__dirname, '../../Data/net.ini');
const configParser = new IniConfigParser(configPath);
const serverConfig = configParser.getServerConfig();
const securityConfig = configParser.getSecurityConfig();

const PORT = serverConfig.port;
const HOST = serverConfig.host;

// 模拟5秒启动延时
const STARTUP_DELAY = 0;

// 服务器状态
let serverReady = false;
let serverStartTime = Date.now();

/**
 * 检查请求是否应该被允许访问
 * @param {string} clientIP - 客户端IP地址
 * @param {string} endpoint - 端点路径
 * @returns {boolean} - 是否允许访问
 */
function isRequestAllowed(clientIP, endpoint) {
    // 本地IP总是允许
    if (configParser.isTrustedProxy(clientIP)) {
        return true;
    }
    
    // 如果外部访问被禁用，拒绝所有非本地请求
    if (!securityConfig.allowExternalAccess) {
        logger.warn('SECURITY', '外部访问被禁用，拒绝访问', { ip: clientIP, endpoint });
        return false;
    }
    
    // 检查是否是本地专用端点
    const localOnlyEndpoints = [
        '/network/config',
        '/network/config/',
        '/network/config/update',
        '/network/config/batch',
        '/network/config/reset',
        '/userinfo/full',
        '/userinfo/update',
        '/userinfo/avatar'
    ];
    
    if (localOnlyEndpoints.some(pattern => endpoint.startsWith(pattern))) {
        if (securityConfig.localOnlyEndpoints) {
            logger.warn('SECURITY', '外部IP尝试访问本地专用端点', { ip: clientIP, endpoint });
            return false;
        }
    }
    
    return true;
}

// 初始化系统信息和健康检查模块
const systemInfo = new SystemInfo();
const healthCheck = new HealthCheck();
const userInfoManager = new UserInfoManager(); // 初始化用户信息管理模块
const themeManager = new ThemeManager(); // 初始化主题管理模块
const networkConfigManager = new NetworkConfigManager(); // 初始化网络配置管理模块
const pluginManager = new PluginManager(); // 初始化插件管理模块
const holePunchManager = new HolePunchManager(); // 初始化端口映射管理器
const ContentManager = require('./contentManager.js'); // 初始化内容管理模块
const contentManager = new ContentManager(); // 初始化内容管理器

// 创建HTTP服务器
const server = http.createServer(async (req, res) => {
    const url = req.url;
    const method = req.method;
    
    // 获取客户端IP地址
    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    // 检查访问权限
    if (!isRequestAllowed(clientIP, url)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: '访问被拒绝',
            message: '外部访问被禁用或IP不在信任列表中',
            ip: clientIP
        }));
        return;
    }
    
    logger.info('NETWORK', `HTTP ${method} ${url}`, { ip: clientIP, external: !configParser.isTrustedProxy(clientIP) });
    
    // 健康检查端点 - 保持原有功能，供加载进程使用
    if (url === '/health' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: serverReady ? 'healthy' : 'starting',
            uptime: Date.now() - serverStartTime,
            port: PORT,
            host: HOST,
            ready: serverReady,
            externalAccess: securityConfig.allowExternalAccess,
            localOnlyEndpoints: securityConfig.localOnlyEndpoints,
            success: true
        }));
        return;
    }
    
    // 网络配置管理端点 - 获取完整网络配置（仅本地访问）
    if (url === '/network/config' && method === 'GET') {
        // 安全检查已通过中间件处理
        try {
            const config = configParser.config;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                config: config,
                server: serverConfig,
                security: securityConfig,
                network: configParser.getNetworkConfig()
            }));
        } catch (error) {
            logger.error('NETWORK', '获取网络配置失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: '获取网络配置失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 网络配置管理端点 - 获取指定节配置（仅本地访问）
    if (url.startsWith('/network/config/') && method === 'GET') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试访问网络配置', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '访问被拒绝',
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const section = url.split('/network/config/')[1];
            const sectionConfig = networkConfigManager.getSection(section);
            
            if (sectionConfig) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(sectionConfig));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: '配置节不存在',
                    message: `未找到配置节: ${section}`
                }));
            }
        } catch (error) {
            logger.error('NETWORK', '获取网络配置节失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取网络配置失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 网络配置管理端点 - 更新单个配置项（仅本地访问）
    if (url === '/network/config/update' && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试更新网络配置', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const updateData = JSON.parse(body);
                    const { section, key, value } = updateData;
                    
                    if (!section || !key || value === undefined) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '缺少必要参数: section, key, value'
                        }));
                        return;
                    }
                    
                    // 验证配置值
                    if (!networkConfigManager.validateConfig(section, key, value)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '配置值验证失败'
                        }));
                        return;
                    }
                    
                    // 使用 configParser 更新配置，保持与加载时的一致性
                    if (!configParser.config[section]) {
                        configParser.config[section] = {};
                    }
                    configParser.config[section][key] = value;
                    
                    // 保存配置到文件
                    const success = configParser.saveConfig();
                    
                    if (!success) {
                        throw new Error('配置文件保存失败');
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: '配置更新成功'
                    }));
                    
                    logger.info('NETWORK', '网络配置更新成功', { section, key, value });
                } catch (error) {
                    logger.error('NETWORK', '网络配置更新失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '配置更新失败',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理网络配置更新请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 网络配置管理端点 - 批量更新配置（仅本地访问）
    if (url === '/network/config/batch' && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试批量更新网络配置', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const configData = JSON.parse(body);
                    
                    // 使用 configParser 更新配置，保持与加载时的一致性
                    for (const section in configData) {
                        for (const key in configData[section]) {
                            configParser.config[section][key] = configData[section][key];
                        }
                    }
                    
                    // 保存配置到文件
                    const success = configParser.saveConfig();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: '批量配置更新成功'
                    }));
                    
                    logger.info('NETWORK', '网络配置批量更新成功', { sections: Object.keys(configData) });
                } catch (error) {
                    logger.error('NETWORK', '网络配置批量更新失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '批量配置更新失败',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理网络配置批量更新请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 端口映射状态端点
    if (url === '/network/holepunch/status' && method === 'GET') {
        try {
            const status = holePunchManager.getPortMappingStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                status: status
            }));
        } catch (error) {
            logger.error('NETWORK', '获取端口映射状态失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: '获取端口映射状态失败',
                message: error.message
            }));
        }
        return;
    }

    // 创建端口映射端点
    if (url === '/network/holepunch/mapping' && method === 'POST') {
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const mappingData = JSON.parse(body);
                    const { protocol, internalPort, externalPort, description, duration } = mappingData;
                    
                    if (!protocol || !internalPort) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '缺少必要参数: protocol, internalPort'
                        }));
                        return;
                    }
                    
                    const mapping = await holePunchManager.createPortMapping(
                        protocol.toUpperCase(),
                        parseInt(internalPort),
                        externalPort ? parseInt(externalPort) : parseInt(internalPort),
                        description || 'Manual Mapping',
                        duration || 0
                    );
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: '端口映射创建成功',
                        mapping: mapping
                    }));
                    
                    logger.info('NETWORK', '端口映射创建成功', mapping);
                } catch (error) {
                    logger.error('NETWORK', '端口映射创建失败', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '端口映射创建失败',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理端口映射请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }

    // 删除端口映射端点
    if (url === '/network/holepunch/mapping' && method === 'DELETE') {
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const deleteData = JSON.parse(body);
                    const { protocol, internalPort } = deleteData;
                    
                    if (!protocol || !internalPort) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '缺少必要参数: protocol, internalPort'
                        }));
                        return;
                    }
                    
                    const success = await holePunchManager.deletePortMapping(
                        protocol.toUpperCase(),
                        parseInt(internalPort)
                    );
                    
                    if (success) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            message: '端口映射删除成功'
                        }));
                        logger.info('NETWORK', '端口映射删除成功', deleteData);
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '端口映射不存在'
                        }));
                    }
                } catch (error) {
                    logger.error('NETWORK', '端口映射删除失败', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '端口映射删除失败',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理端口映射删除请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }

    // 网络配置管理端点 - 重置配置（仅本地访问）
    if (url === '/network/config/reset' && method === 'POST') {
        try {
            // 使用 configParser 重置配置，保持与加载时的一致性
            configParser.config = configParser.getDefaultConfig();
            const success = configParser.saveConfig();
            
            if (!success) {
                throw new Error('配置文件重置失败');
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: '网络配置已重置为默认值'
            }));
            
            logger.info('NETWORK', '网络配置已重置为默认值', null);
        } catch (error) {
            logger.error('NETWORK', '网络配置重置失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '配置重置失败',
                error: error.message
            }));
        }
        return;
    }

    // 网络配置管理端点 - 更新网络配置（仅本地访问）
    if (url === '/network/config/network' && method === 'POST') {
        try {
            if (!isRequestAllowed(clientIP, url)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '外部IP无法访问此端点'
                }));
                return;
            }
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const networkConfig = JSON.parse(body);
                    const success = configParser.updateNetworkConfig(networkConfig);
                    
                    if (success) {
                        // 如果UPnP/PCP设置发生变化，重新初始化端口映射
                        if (networkConfig.activeUPnP !== undefined || networkConfig.activePCP !== undefined) {
                            try {
                                logger.info('NETWORK', '网络配置已更新，重新初始化端口映射');
                                await holePunchManager.initialize(configParser.getNetworkConfig());
                                
                                // 重新创建服务器端口映射
                                if (networkConfig.activeUPnP || networkConfig.activePCP) {
                                    await holePunchManager.createPortMapping('TCP', PORT, PORT, 'HTTP Server');
                                }
                            } catch (error) {
                                logger.error('NETWORK', '端口映射重新初始化失败', error);
                            }
                        }
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            message: '网络配置已更新'
                        }));
                        logger.info('NETWORK', '网络配置已更新', networkConfig);
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '网络配置更新失败'
                        }));
                    }
                } catch (error) {
                    logger.error('NETWORK', '网络配置更新失败', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '网络配置更新失败',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理网络配置更新请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }

    // 网络配置管理端点 - 更新服务器配置（仅本地访问）
    if (url === '/network/server/config' && method === 'POST') {
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const configData = JSON.parse(body);
                    const { host, port, externalAccess, maxConnections, timeout } = configData;
                    
                    // 验证配置
                    if (port && (port < 1 || port > 65535)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '端口号必须在1-65535之间'
                        }));
                        return;
                    }
                    
                    if (timeout && (timeout < 1000 || timeout > 300000)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '超时时间必须在1000-300000毫秒之间'
                        }));
                        return;
                    }
                    
                    // 更新配置
                    if (host !== undefined) configParser.config.Server.Host = host;
                    if (port !== undefined) configParser.config.Server.Port = port;
                    if (externalAccess !== undefined) configParser.config.Server.ExternalAccess = externalAccess;
                    if (maxConnections !== undefined) configParser.config.Server.MaxConnections = maxConnections;
                    if (timeout !== undefined) configParser.config.Server.Timeout = timeout;
                    
                    // 保存配置
                    if (configParser.saveConfig()) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            message: '服务器配置更新成功，重启后生效',
                            config: configParser.getServerConfig()
                        }));
                        
                        logger.info('NETWORK', '服务器配置更新成功', configData);
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '配置保存失败'
                        }));
                    }
                } catch (error) {
                    logger.error('NETWORK', '服务器配置更新失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '配置格式错误',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理服务器配置更新请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 详细健康检查端点 - 新增
    if (url === '/health/detailed' && method === 'GET') {
        const healthData = await healthCheck.performHealthCheck();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthData));
        return;
    }
    
    // 系统信息端点 - 新增
    if (url === '/systeminfo' && method === 'GET') {
        try {
            const systemData = await systemInfo.getSimpleSystemInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(systemData));
        } catch (error) {
            logger.error('NETWORK', '获取系统信息失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取系统信息失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 完整系统信息端点 - 新增
    if (url === '/systeminfo/full' && method === 'GET') {
        try {
            const systemData = await systemInfo.getFullSystemInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(systemData));
        } catch (error) {
            logger.error('NETWORK', '获取完整系统信息失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取完整系统信息失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 日志获取端点
    if (url.startsWith('/logs') && method === 'GET') {
        try {
            // 解析查询参数
            const params = new URLSearchParams(url.split('?')[1] || '');
            const level = params.get('level');
            const type = params.get('type');
            const limit = parseInt(params.get('limit')) || 1000; // 默认返回1000条
            
            // 日志根目录
            const logsDir = path.join(__dirname, '../../Logs');
            const logs = [];
            
            // 读取日志目录结构
            const levels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
            const types = ['network', 'system', 'business', 'unknown'];
            
            for (const logLevel of levels) {
                // 如果指定了级别且不匹配，则跳过
                if (level && logLevel !== level) {
                    continue;
                }
                
                const levelDir = path.join(logsDir, logLevel.toLowerCase());
                if (!fs.existsSync(levelDir)) {
                    continue;
                }
                
                for (const logType of types) {
                    // 如果指定了类型且不匹配，则跳过
                    if (type && logType.toUpperCase() !== type) {
                        continue;
                    }
                    
                    const typeDir = path.join(levelDir, logType);
                    if (!fs.existsSync(typeDir)) {
                        continue;
                    }
                    
                    // 读取目录下的所有日志文件
                    const files = fs.readdirSync(typeDir).filter(file => file.endsWith('.log'));
                    
                    for (const file of files) {
                        const filePath = path.join(typeDir, file);
                        try {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const lines = content.split('\n').filter(line => line.trim());
                            
                            // 解析日志行
                            for (const line of lines) {
                                try {
                                    // 匹配日志格式：[timestamp] [level] [type] [hostname] [pid] - message
                                    const logRegex = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]\s*\[(\w+)\]\s*\[(\w+)\]\s*\[(.*?)\]\s*\[pid:(\d+)\]\s*-\s*(.*)/;
                                    const match = line.match(logRegex);
                                    if (match) {
                                        logs.push({
                                            timestamp: match[1],
                                            level: match[2],
                                            type: match[3],
                                            hostname: match[4],
                                            pid: parseInt(match[5]),
                                            message: match[6]
                                        });
                                    }
                                } catch (e) {
                                    // 解析单条日志失败，跳过
                                    continue;
                                }
                            }
                        } catch (e) {
                            // 读取文件失败，跳过
                            continue;
                        }
                    }
                }
            }
            
            // 按时间戳排序，最新的日志在前
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // 限制返回的日志数量
            const paginatedLogs = logs.slice(0, limit);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(paginatedLogs));
            
        } catch (error) {
            logger.error('NETWORK', '获取日志失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取日志失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 清空日志端点
    if (url === '/logs/clear' && method === 'POST') {
        try {
            // 日志根目录
            const logsDir = path.join(__dirname, '../../Logs');
            
            // 读取日志目录结构
            const levels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
            const types = ['network', 'system', 'business', 'unknown'];
            
            let deletedFiles = 0;
            
            for (const logLevel of levels) {
                const levelDir = path.join(logsDir, logLevel.toLowerCase());
                if (!fs.existsSync(levelDir)) {
                    continue;
                }
                
                for (const logType of types) {
                    const typeDir = path.join(levelDir, logType);
                    if (!fs.existsSync(typeDir)) {
                        continue;
                    }
                    
                    // 删除目录下的所有日志文件
                    const files = fs.readdirSync(typeDir).filter(file => file.endsWith('.log'));
                    for (const file of files) {
                        const filePath = path.join(typeDir, file);
                        fs.unlinkSync(filePath);
                        deletedFiles++;
                    }
                }
            }
            
            logger.info('NETWORK', `已清空所有日志文件，共删除 ${deletedFiles} 个文件`, null);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: `已成功清空所有日志，共删除 ${deletedFiles} 个日志文件`
            }));
            
        } catch (error) {
            logger.error('NETWORK', '清空日志失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '清空日志失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 用户信息端点 - 获取用户信息（公开信息）
    if (url === '/userinfo' && method === 'GET') {
        try {
            const publicUserData = userInfoManager.getPublicUserInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(publicUserData));
            
            // 增加资料浏览次数
            userInfoManager.incrementProfileViews();
        } catch (error) {
            logger.error('NETWORK', '获取用户信息失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取用户信息失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 用户信息端点 - 获取完整用户信息（仅本地访问）
    if (url === '/userinfo/full' && method === 'GET') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试访问完整用户信息', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '访问被拒绝',
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const fullUserData = userInfoManager.getUserInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(fullUserData));
        } catch (error) {
            logger.error('NETWORK', '获取完整用户信息失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取用户信息失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 用户信息更新端点 - 更新用户信息（仅本地访问）
    if (url === '/userinfo/update' && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试更新用户信息', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const updateData = JSON.parse(body);
                    userInfoManager.updateUserInfoBatch(updateData);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: '用户信息更新成功'
                    }));
                    
                    logger.info('NETWORK', '用户信息更新成功', null);
                } catch (error) {
                    logger.error('NETWORK', '更新用户信息失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '数据格式错误',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理用户更新请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 头像上传端点 - 更新用户头像（仅本地访问）
    if (url === '/userinfo/avatar' && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试上传头像', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (!data.avatar) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: '缺少头像数据'
                        }));
                        return;
                    }
                    
                    userInfoManager.updateAvatar(data.avatar);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: '头像上传成功'
                    }));
                    
                    logger.info('NETWORK', '头像上传成功', null);
                } catch (error) {
                    logger.error('NETWORK', '头像上传失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: error.message || '头像上传失败'
                    }));
                }
            });
        } catch (error) {
            logger.error('NETWORK', '处理头像上传请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 获取单个帖子（所有人可访问）
    if (url.startsWith('/content/blogs/') && method === 'GET') {
        try {
            const id = url.split('/content/blogs/')[1];
            const blog = await contentManager.getBlogById(id);
            
            if (!blog) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '帖子不存在'
                }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: blog
            }));
        } catch (error) {
            logger.error('CONTENT', '获取帖子失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '获取帖子失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 获取单个视频（所有人可访问）
    if (url.startsWith('/content/videos/') && method === 'GET') {
        try {
            const id = url.split('/content/videos/')[1];
            const video = await contentManager.getVideoById(id);
            
            if (!video) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '视频不存在'
                }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: video
            }));
        } catch (error) {
            logger.error('CONTENT', '获取视频失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '获取视频失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 获取所有帖子（所有人可访问）
    if (url.startsWith('/content/blogs') && method === 'GET') {
        try {
            // 解析查询参数
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const limit = parseInt(urlObj.searchParams.get('limit') || req.headers['x-limit'] || '50');
            const offset = parseInt(urlObj.searchParams.get('offset') || req.headers['x-offset'] || '0');
            
            const result = await contentManager.getAllBlogs(limit, offset);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: result
            }));
        } catch (error) {
            logger.error('CONTENT', '获取帖子列表失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '获取帖子列表失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 获取所有视频（所有人可访问）
    if (url.startsWith('/content/videos') && method === 'GET') {
        try {
            // 解析查询参数
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const limit = parseInt(urlObj.searchParams.get('limit') || req.headers['x-limit'] || '50');
            const offset = parseInt(urlObj.searchParams.get('offset') || req.headers['x-offset'] || '0');
            
            const result = await contentManager.getAllVideos(limit, offset);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: result
            }));
        } catch (error) {
            logger.error('CONTENT', '获取视频列表失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '获取视频列表失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 创建新帖子（仅本地IP）
    if (url === '/content/blogs' && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试创建帖子', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const blogData = JSON.parse(body);
                    const blog = await contentManager.createBlog(blogData);
                    
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: '帖子创建成功',
                        data: blog
                    }));
                    
                    logger.info('CONTENT', '创建新帖子成功', { id: blog.id, title: blog.title });
                } catch (error) {
                    logger.error('CONTENT', '创建帖子失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: error.message || '创建帖子失败'
                    }));
                }
            });
        } catch (error) {
            logger.error('CONTENT', '处理创建帖子请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 创建新视频（仅本地IP）
    if (url === '/content/videos' && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试创建视频', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const videoData = JSON.parse(body);
                    const video = await contentManager.createVideo(videoData);
                    
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: '视频创建成功',
                        data: video
                    }));
                    
                    logger.info('CONTENT', '创建新视频成功', { id: video.id, title: video.title });
                } catch (error) {
                    logger.error('CONTENT', '创建视频失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: error.message || '创建视频失败'
                    }));
                }
            });
        } catch (error) {
            logger.error('CONTENT', '处理创建视频请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 删除博客（仅本地IP）
    if (url.startsWith('/content/blogs/') && method === 'DELETE') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试删除博客', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const id = url.split('/content/blogs/')[1];
            const success = await contentManager.deleteBlog(id);
            
            if (success) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: '博客删除成功'
                }));
                
                logger.info('CONTENT', '删除博客成功', { id });
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '博客不存在'
                }));
            }
        } catch (error) {
            logger.error('CONTENT', '删除博客失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '删除博客失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 删除视频（仅本地IP）
    if (url.startsWith('/content/videos/') && method === 'DELETE') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试删除视频', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const id = url.split('/content/videos/')[1];
            const success = await contentManager.deleteVideo(id);
            
            if (success) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: '视频删除成功'
                }));
                
                logger.info('CONTENT', '删除视频成功', { id });
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '视频不存在'
                }));
            }
        } catch (error) {
            logger.error('CONTENT', '删除视频失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '删除视频失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 搜索内容（所有人可访问）
    if (url === '/content/search' && method === 'GET') {
        try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const query = urlObj.searchParams.get('q') || '';
            const type = urlObj.searchParams.get('type') || 'all';
            const limit = parseInt(urlObj.searchParams.get('limit') || '20');
            
            if (!query.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '搜索查询不能为空'
                }));
                return;
            }
            
            const results = await contentManager.searchContent(query, type, limit);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: results,
                query: query,
                type: type,
                count: results.length
            }));
        } catch (error) {
            logger.error('CONTENT', '搜索内容失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '搜索内容失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 获取统计信息（所有人可访问）
    if (url === '/content/stats' && method === 'GET') {
        try {
            const stats = await contentManager.getStats();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: stats
            }));
        } catch (error) {
            logger.error('CONTENT', '获取统计信息失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '获取统计信息失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 内容管理API - 点赞视频（所有人可访问）
    if (url.startsWith('/content/videos/') && url.endsWith('/like') && method === 'POST') {
        try {
            const id = url.split('/content/videos/')[1].replace('/like', '');
            const video = await contentManager.likeVideo(id);
            
            if (!video) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '视频不存在'
                }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: '点赞成功',
                likes: video.likes
            }));
            
            logger.info('CONTENT', '视频点赞成功', { id, likes: video.likes });
        } catch (error) {
            logger.error('CONTENT', '视频点赞失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '点赞失败',
                error: error.message
            }));
        }
        return;
    }
    
    // 主题管理端点 - 获取当前主题
    if (url === '/theme/current' && method === 'GET') {
        try {
            const currentTheme = themeManager.getCurrentTheme();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(currentTheme));
        } catch (error) {
            logger.error('THEME', '获取主题失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取主题失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 主题管理端点 - 获取主题CSS（供前端直接引用）
    if (url === '/theme/css' && method === 'GET') {
        try {
            const themeCSS = themeManager.getThemeCSS();
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(themeCSS);
        } catch (error) {
            logger.error('THEME', '获取主题CSS失败', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('/* 主题CSS生成失败 */');
        }
        return;
    }
    
    // 主题管理端点 - 更新主题（仅本地访问）
    if (url === '/theme/update' && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试更新主题', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const themeData = JSON.parse(body);
                    const result = themeManager.updateTheme(themeData);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                    
                    if (result.success) {
                        logger.info('THEME', '主题更新成功', { theme: themeData.name });
                    } else {
                        logger.warn('THEME', '主题更新失败', result);
                    }
                } catch (error) {
                    logger.error('THEME', '主题数据解析失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '主题数据格式错误',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('THEME', '处理主题更新请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 主题管理端点 - 获取所有主题
    if (url === '/theme/list' && method === 'GET') {
        try {
            const themes = themeManager.getAllThemes();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ themes }));
        } catch (error) {
            logger.error('THEME', '获取主题列表失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '获取主题列表失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 主题管理端点 - 保存主题到文件（仅本地访问）
    if (url.startsWith('/theme/save/') && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试保存主题', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const themeId = url.split('/theme/save/')[1];
            if (!themeId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '缺少主题ID'
                }));
                return;
            }
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const themeData = JSON.parse(body);
                    const saved = themeManager.saveThemeToFile(themeId, themeData);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: saved,
                        message: saved ? '主题保存成功' : '主题保存失败'
                    }));
                } catch (error) {
                    logger.error('THEME', '主题保存数据解析失败', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: '主题数据格式错误',
                        error: error.message
                    }));
                }
            });
        } catch (error) {
            logger.error('THEME', '处理主题保存请求失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '服务器内部错误',
                error: error.message
            }));
        }
        return;
    }
    
    // 主题管理端点 - 从文件加载主题（仅本地访问）
    if (url.startsWith('/theme/load/') && method === 'GET') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试加载主题', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const themeId = url.split('/theme/load/')[1];
            if (!themeId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '缺少主题ID'
                }));
                return;
            }
            
            const themeData = themeManager.loadThemeFromFile(themeId);
            if (themeData) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(themeData));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '主题文件不存在'
                }));
            }
        } catch (error) {
            logger.error('THEME', '主题加载失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '主题加载失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 主题管理端点 - 删除主题文件（仅本地访问）
    if (url.startsWith('/theme/delete/') && method === 'DELETE') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试删除主题', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const themeId = url.split('/theme/delete/')[1];
            if (!themeId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: '缺少主题ID'
                }));
                return;
            }
            
            const deleted = themeManager.deleteThemeFile(themeId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: deleted,
                message: deleted ? '主题删除成功' : '主题删除失败'
            }));
        } catch (error) {
            logger.error('THEME', '主题删除失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '主题删除失败',
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 获取所有插件列表
    if (url === '/plugins' && method === 'GET') {
        try {
            const plugins = pluginManager.getAllPlugins();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                plugins: plugins,
                stats: pluginManager.getPluginStats()
            }));
        } catch (error) {
            logger.error('PLUGIN', '获取插件列表失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 搜索插件
    if (url.startsWith('/plugins/search') && method === 'GET') {
        try {
            const query = url.split('?q=')[1] || '';
            const plugins = pluginManager.searchPlugins(query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                plugins: plugins
            }));
        } catch (error) {
            logger.error('PLUGIN', '搜索插件失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 启动插件（仅本地访问）
    if (url.startsWith('/plugins/start/') && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试启动插件', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const pluginName = decodeURIComponent(url.split('/plugins/start/')[1]);
            const result = await pluginManager.startPlugin(pluginName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            logger.error('PLUGIN', '启动插件失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 停止插件（仅本地访问）
    if (url.startsWith('/plugins/stop/') && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试停止插件', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const pluginName = decodeURIComponent(url.split('/plugins/stop/')[1]);
            const result = await pluginManager.stopPlugin(pluginName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            logger.error('PLUGIN', '停止插件失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 重启插件（仅本地访问）
    if (url.startsWith('/plugins/restart/') && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试重启插件', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const pluginName = decodeURIComponent(url.split('/plugins/restart/')[1]);
            const result = await pluginManager.restartPlugin(pluginName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            logger.error('PLUGIN', '重启插件失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 删除插件（仅本地访问）
    if (url.startsWith('/plugins/delete/') && method === 'DELETE') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试删除插件', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const pluginName = decodeURIComponent(url.split('/plugins/delete/')[1]);
            const result = await pluginManager.deletePlugin(pluginName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            logger.error('PLUGIN', '删除插件失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 启用/禁用插件（仅本地访问）
    if (url.startsWith('/plugins/toggle/') && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试切换插件状态', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const parts = url.split('/plugins/toggle/')[1].split('?');
            const pluginName = decodeURIComponent(parts[0]);
            const enabled = parts[1] && parts[1].includes('enabled=true');
            
            const result = await pluginManager.togglePlugin(pluginName, enabled);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            logger.error('PLUGIN', '切换插件状态失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 插件管理端点 - 设置自动启动（仅本地访问）
    if (url.startsWith('/plugins/autostart/') && method === 'POST') {
        // 安全检查：只允许本地访问
        const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP)) {
            logger.warn('SECURITY', '非本地IP尝试设置插件自动启动', { ip: clientIP });
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: '此接口仅允许本地访问'
            }));
            return;
        }
        
        try {
            const parts = url.split('/plugins/autostart/')[1].split('?');
            const pluginName = decodeURIComponent(parts[0]);
            const autoStart = parts[1] && parts[1].includes('autoStart=true');
            
            const result = await pluginManager.setAutoStart(pluginName, autoStart);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            logger.error('PLUGIN', '设置插件自动启动失败', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: error.message
            }));
        }
        return;
    }
    
    // 静态文件服务
    if (url.startsWith('/static/')) {
        serveStaticFile(url, res);
        return;
    }
    
    // 插件文件服务
    if (url.startsWith('/plugins/')) {
        servePluginFile(url, res);
        return;
    }
    
    // 调试端点 - 检查插件路径
    if (url === '/debug/plugin-path' && method === 'GET') {
        const testPath = path.join(__dirname, '../Plugs/网络检测工具/index.html');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            testPath: testPath,
            exists: fs.existsSync(testPath),
            isFile: fs.existsSync(testPath) ? fs.statSync(testPath).isFile() : false,
            __dirname: __dirname,
            pluginsDir: path.join(__dirname, '../Plugs')
        }));
        return;
    }
    
    // 根路径返回状态
    if (url === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: 'HTTP Server Running',
            status: serverReady ? 'ready' : 'initializing',
            port: PORT,
            uptime: Date.now() - serverStartTime
        }));
        return;
    }
    
    // 404处理
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

// 静态文件服务函数
function serveStaticFile(url, res) {
    // 移除URL开头的/static/
    const relativePath = url.replace(/^\/static\//, '');
    const filePath = path.join(__dirname, '../../Static', relativePath);
    
    // 调试日志
    logger.info('STATIC', '请求静态文件', { 
        url: url, 
        relativePath: relativePath,
        filePath: filePath,
        staticDir: path.join(__dirname, '../../Static')
    });
    
    // 安全检查
    if (!filePath.startsWith(path.join(__dirname, '../../Static'))) {
        logger.warn('STATIC', '路径安全检查失败', { filePath: filePath });
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        logger.warn('STATIC', '文件不存在', { filePath: filePath });
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 File Not Found');
        return;
    }
    
    serveFile(filePath, res);
}

// 插件文件服务函数
function servePluginFile(url, res) {
    // 移除URL开头的/plugins/
    let relativePath = url.replace(/^\/plugins\//, '');
    
    // URL解码中文字符
    try {
        relativePath = decodeURIComponent(relativePath);
    } catch (e) {
        logger.warn('PLUGIN_STATIC', 'URL解码失败', { url: url, error: e.message });
    }
    
    const filePath = path.join(__dirname, '../Plugs', relativePath);
    
    // 调试日志
    logger.info('PLUGIN_STATIC', '请求插件文件', { 
        url: url, 
        decodedPath: relativePath,
        filePath: filePath,
        pluginsDir: path.join(__dirname, '../Plugs'),
        exists: fs.existsSync(filePath),
        isFile: fs.existsSync(filePath) ? fs.statSync(filePath).isFile() : false
    });
    
    // 安全检查
    const pluginsDir = path.join(__dirname, '../Plugs');
    if (!filePath.startsWith(pluginsDir)) {
        logger.warn('PLUGIN_STATIC', '路径安全检查失败', { filePath: filePath, pluginsDir: pluginsDir });
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        logger.warn('PLUGIN_STATIC', '插件文件不存在', { filePath: filePath });
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Plugin File Not Found');
        return;
    }
    
    serveFile(filePath, res);
}

// 通用文件服务函数
function serveFile(filePath, res) {
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            logger.error('STATIC', '读取文件失败', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
            return;
        }
        
        // 根据文件扩展名设置Content-Type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        logger.info('STATIC', '文件服务成功', { filePath: filePath, contentType: contentType });
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 启动服务器
const networkConfig = configParser.getNetworkConfig();
const listenAddress = getListenAddress(networkConfig);
const localIP = getLocalIPAddress(networkConfig);

server.listen(PORT, listenAddress, async () => {
    logger.info('NETWORK', `服务器启动中，监听 ${listenAddress}:${PORT}`, null);
    logger.info('NETWORK', `IPv4监听: ${networkConfig.listenIPv4 ? '启用' : '禁用'}`, null);
    logger.info('NETWORK', `IPv6监听: ${networkConfig.listenIPv6 ? '启用' : '禁用'}`, null);
    logger.info('NETWORK', `外部访问: ${securityConfig.allowExternalAccess ? '启用' : '禁用'}`, null);
    logger.info('NETWORK', `模拟启动延时: ${STARTUP_DELAY}ms`, null);
    
    // 模拟启动过程
    setTimeout(async () => {
        serverReady = true;
        logger.info('NETWORK', '✅ 服务器已就绪，可以处理请求', null);
        
        // 初始化端口映射
        if (configParser.config.Network) {
            try {
                const networkConfig = configParser.getNetworkConfig();
                logger.info('NETWORK', '开始初始化端口映射', networkConfig);
                
                const holePunchSuccess = await holePunchManager.initialize(networkConfig);
                if (holePunchSuccess) {
                    logger.info('NETWORK', '端口映射初始化成功');
                    
                    // 创建服务器端口映射
                    if (networkConfig.activeUPnP || networkConfig.activePCP) {
                        try {
                            await holePunchManager.createPortMapping('TCP', PORT, PORT, 'HTTP Server');
                            logger.info('NETWORK', `服务器端口 ${PORT} 映射创建成功`);
                        } catch (error) {
                            logger.warn('NETWORK', '服务器端口映射创建失败', error);
                        }
                    }
                } else {
                    logger.warn('NETWORK', '端口映射初始化失败，继续运行服务器');
                }
            } catch (error) {
                logger.error('NETWORK', '端口映射初始化错误', error);
            }
        }
        
        if (securityConfig.allowExternalAccess) {
            logger.info('NETWORK', `🌐 外部访问已启用，可通过任意IP访问`, null);
            logger.info('NETWORK', `🚀 本地访问: http://localhost:${PORT}/health`, null);
            logger.info('NETWORK', `🚀 外部访问: http://${localIP}:${PORT}/health`, null);
        } else {
            logger.info('NETWORK', `🔒 外部访问已禁用，仅本地访问`, null);
            logger.info('NETWORK', `🚀 访问 http://localhost:${PORT}/health 检查状态`, null);
        }
    }, STARTUP_DELAY);
});

/**
 * 根据IPv4/IPv6配置获取合适的监听地址
 * @param {Object} networkConfig - 网络配置
 * @returns {string} 监听地址
 */
function getListenAddress(networkConfig) {
    // 如果同时启用IPv4和IPv6，监听所有地址
    if (networkConfig.listenIPv4 && networkConfig.listenIPv6) {
        return '0.0.0.0'; // Node.js会自动处理双栈监听
    }
    
    // 如果只启用IPv6
    if (!networkConfig.listenIPv4 && networkConfig.listenIPv6) {
        return '::'; // IPv6任意地址
    }
    
    // 如果只启用IPv4或都未启用（默认IPv4）
    return '0.0.0.0'; // IPv4任意地址
}

/**
 * 获取本地IP地址（支持IPv4/IPv6配置）
 * @param {Object} networkConfig - 网络配置
 * @returns {string} 本地IP地址
 */
function getLocalIPAddress(networkConfig = null) {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    // 获取当前网络配置
    if (!networkConfig) {
        networkConfig = configParser.getNetworkConfig();
    }
    
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            // 跳过内部回环接口
            if (interface.internal) continue;
            
            // 根据配置选择IP类型
            if (networkConfig.listenIPv6 && interface.family === 'IPv6') {
                // 返回IPv6地址（去除zone标识）
                return interface.address.split('%')[0];
            }
            
            if (networkConfig.listenIPv4 && interface.family === 'IPv4') {
                return interface.address;
            }
        }
    }
    
    // 根据配置返回默认地址
    if (networkConfig.listenIPv6 && !networkConfig.listenIPv4) {
        return '::1'; // IPv6回环
    }
    
    return '127.0.0.1'; // IPv4回环（默认）
}

// 优雅关闭
process.on('SIGTERM', async () => {
    logger.info('NETWORK', '收到关闭信号，正在关闭...', null);
    
    // 清理端口映射
    try {
        logger.info('NETWORK', '正在清理端口映射...', null);
        await holePunchManager.cleanup();
        logger.info('NETWORK', '端口映射清理完成', null);
    } catch (error) {
        logger.error('NETWORK', '端口映射清理失败', error);
    }
    
    server.close(() => {
        logger.info('NETWORK', '服务器已关闭', null);
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('NETWORK', '收到中断信号，正在关闭...', null);
    
    // 清理端口映射
    try {
        logger.info('NETWORK', '正在清理端口映射...', null);
        await holePunchManager.cleanup();
        logger.info('NETWORK', '端口映射清理完成', null);
    } catch (error) {
        logger.error('NETWORK', '端口映射清理失败', error);
    }
    
    server.close(() => {
        logger.info('NETWORK', '服务器已关闭', null);
        process.exit(0);
    });
});

// 错误处理
server.on('error', (error) => {
    logger.error('NETWORK', '服务器错误', error);
    if (error.code === 'EADDRINUSE') {
        logger.error('NETWORK', `端口 ${PORT} 已被占用`, null);
    }
});

logger.info('NETWORK', `子进程已启动，PID: ${process.pid}`, null);