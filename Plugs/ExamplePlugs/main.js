// ExamplePlugs 插件主逻辑

// 插件信息
const pluginInfo = {
    name: 'ExamplePlugs',
    version: '1.0.0',
    author: 'YXPIL',
    description: '示例插件，展示插件系统的基本功能',
    dependencies: [],
    main: 'main.js',
    entry: 'index.html'
};

// HTTP服务器配置
let httpServer = null;
const serverPort = 3000;
const serverUrl = `http://localhost:${serverPort}`;

// 启动HTTP服务器
function startHttpServer() {
    const http = require('http');
    
    // 创建HTTP服务器
    httpServer = http.createServer((req, res) => {
        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // 处理OPTIONS请求
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // 路由处理
        if (req.url === '/api/hello' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'Hello from ExamplePlugs HTTP Server!',
                timestamp: new Date().toISOString(),
                serverInfo: {
                    name: 'ExamplePlugs HTTP Server',
                    version: '1.0.0',
                    port: serverPort
                }
            }));
            return;
        }
        
        if (req.url === '/api/data' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                data: [
                    { id: 1, name: 'Item 1', value: Math.random() * 100 },
                    { id: 2, name: 'Item 2', value: Math.random() * 100 },
                    { id: 3, name: 'Item 3', value: Math.random() * 100 }
                ],
                timestamp: new Date().toISOString()
            }));
            return;
        }
        
        if (req.url === '/api/submit' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Data submitted successfully',
                        receivedData: data,
                        timestamp: new Date().toISOString()
                    }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid JSON format',
                        error: error.message
                    }));
                }
            });
            return;
        }
        
        // 404处理
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'API endpoint not found'
        }));
    });
    
    // 启动服务器
    httpServer.listen(serverPort, () => {
        console.log(`HTTP Server started at ${serverUrl}`);
        console.log('Available endpoints:');
        console.log('  GET  /api/hello - Test endpoint');
        console.log('  GET  /api/data - Get data');
        console.log('  POST /api/submit - Submit data');
    });
}

// 停止HTTP服务器
function stopHttpServer() {
    if (httpServer) {
        httpServer.close(() => {
            console.log('HTTP Server stopped');
        });
        httpServer = null;
    }
}

// 插件API方法
const pluginApi = {
    // 获取插件信息
    getInfo: () => pluginInfo,
    
    // 获取服务器URL
    getServerUrl: () => serverUrl,
    
    // 获取服务器状态
    getServerStatus: () => {
        return {
            isRunning: httpServer !== null,
            port: serverPort,
            url: serverUrl
        };
    },
    
    // 获取插件状态
    getStatus: () => {
        return {
            name: pluginInfo.name,
            version: pluginInfo.version,
            isRunning: httpServer !== null,
            serverPort: serverPort,
            serverUrl: serverUrl
        };
    },
    
    // 启动插件
    start: () => {
        if (!httpServer) {
            startHttpServer();
        }
        return { success: true, message: '插件启动成功' };
    },
    
    // 停止插件
    stop: () => {
        stopHttpServer();
        return { success: true, message: '插件停止成功' };
    }
};

// 导出插件API，适配plugmanager.js的要求
module.exports = {
    ...pluginApi,
    info: pluginInfo
};

// 自动启动HTTP服务器（当plugmanager.js执行此文件时会自动运行）
console.log('ExamplePlugs 正在启动...');
startHttpServer();
console.log('ExamplePlugs 启动完成');

// 如果直接运行此文件，已经在上面启动了服务器