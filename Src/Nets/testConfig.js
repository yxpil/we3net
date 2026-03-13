/**
 * 测试配置模块
 * 
 * @author yxpil
 * @responsibility 负责定义系统测试用例和配置
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 测试配置定义模块，提供以下功能：
 * - 健康检查测试用例定义
 * - API 接口测试配置
 * - 预期结果定义
 * - 测试参数配置
 * - 测试流程定义
 * 
 * @usage
 * 作为测试配置文件，被测试模块引用执行系统测试
 */

const http = require('http');

// 测试配置
const tests = [
    {
        name: '健康检查',
        url: 'http://localhost:5726/health',
        expected: 'healthy'
    },
    {
        name: '网络配置',
        url: 'http://localhost:5726/network/config',
        expected: 'success'
    },
    {
        name: '系统信息',
        url: 'http://localhost:5726/systeminfo',
        expected: 'success'
    }
];

async function runTest(test) {
    return new Promise((resolve) => {
        const req = http.get(test.url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    const success = result.status === test.expected || result.success === true;
                    resolve({
                        name: test.name,
                        success: success,
                        statusCode: res.statusCode,
                        response: result
                    });
                } catch (error) {
                    resolve({
                        name: test.name,
                        success: false,
                        statusCode: res.statusCode,
                        error: error.message
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            resolve({
                name: test.name,
                success: false,
                error: error.message
            });
        });
        
        req.setTimeout(5000, () => {
            req.abort();
            resolve({
                name: test.name,
                success: false,
                error: '请求超时'
            });
        });
    });
}

async function runAllTests() {
    console.log('🚀 开始测试网络配置...\n');
    
    for (const test of tests) {
        console.log(`正在测试: ${test.name}`);
        const result = await runTest(test);
        
        if (result.success) {
            console.log(`✅ ${test.name} - 成功 (状态码: ${result.statusCode})`);
        } else {
            console.log(`❌ ${test.name} - 失败`);
            if (result.error) {
                console.log(`   错误: ${result.error}`);
            }
            if (result.statusCode) {
                console.log(`   状态码: ${result.statusCode}`);
            }
        }
        console.log('');
    }
    
    console.log('📝 配置信息:');
    console.log('- 服务器地址: 0.0.0.0:5726');
    console.log('- 外部访问: 已启用');
    console.log('- 本地专用端点: 已启用');
    console.log('- 信任代理: 127.0.0.1, ::1');
    
    console.log('\n🎯 测试完成！');
}

runAllTests().catch(console.error);