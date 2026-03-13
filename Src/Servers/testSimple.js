const { lookupPackage } = require('./LookupPackage');
const dgram = require('dgram');
const net = require('net');
const crypto = require('crypto');

/**
 * 简单测试，直接发送符合格式的数据包
 */
async function testSimple() {
    console.log('=== 简单兼容性测试开始 ===');
    
    try {
        // 1. 初始化和启动监听
        lookupPackage.initialize({
            port: 5726
        });
        lookupPackage.startListening();
        
        console.log('\n1. 监听已启动');
        
        // 2. 注册事件监听器
        let receivedCount = 0;
        
        lookupPackage.on('packageReceived', (packageData) => {
            receivedCount++;
            console.log(`\n2. 接收到有效数据包 #${receivedCount}:`);
            console.log(`   - 设备ID: ${packageData.header.onlyID}`);
            console.log(`   - 用户ID: ${packageData.header.userID}`);
            console.log(`   - 类型: ${packageData.header.type}`);
            console.log(`   - 协议: ${packageData._meta.protocol}`);
            console.log(`   - 自定义数据:`, packageData.payload.customData);
        });
        
        // 3. 发送UDP测试数据包
        console.log('\n3. 发送UDP测试数据包:');
        await sendValidUDPPacket();
        
        // 4. 发送TCP测试数据包
        console.log('\n4. 发送TCP测试数据包:');
        await sendValidTCPPacket();
        
        // 等待处理
        await sleep(2000);
        
        // 5. 显示统计信息
        console.log('\n5. 统计信息:');
        const stats = lookupPackage.getStats();
        console.log(`   - 总接收包数: ${stats.totalReceived}`);
        console.log(`   - 有效数据包: ${stats.validPackages}`);
        console.log(`   - 无效数据包: ${stats.invalidPackages}`);
        console.log(`   - 唯一设备数: ${stats.uniqueDevices}`);
        
        console.log('\n=== 简单兼容性测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        // 清理资源
        lookupPackage.destroy();
    }
}

/**
 * 发送有效的UDP数据包
 */
async function sendValidUDPPacket() {
    const client = dgram.createSocket('udp4');
    
    // 创建符合格式的数据包
    const testData = { test: 'Hello UDP', value: 123 };
    const checksum = crypto.createHash('sha256').update(JSON.stringify(testData)).digest('hex');
    
    const packetData = {
        header: {
            version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'device-status',
            onlyID: 'test-device-123',
            userID: 'test-user'
        },
        payload: {
            userInfo: { nickname: 'test-user' },
            networkStatus: {
                isConnected: true,
                connectionType: 'wifi',
                ipAddresses: { ipv4: '192.168.1.100' },
                dnsStatus: 'ok',
                latency: 50
            },
            systemInfo: {
                platform: 'win32',
                arch: 'x64',
                nodeVersion: 'v16.0.0'
            },
            customData: testData
        },
        footer: {
            checksum: checksum,
            retryCount: 0
        }
    };
    
    const message = Buffer.from(JSON.stringify(packetData));
    
    return new Promise((resolve) => {
        client.send(message, 5726, 'localhost', (err) => {
            client.close();
            if (err) {
                console.error('   ✗ UDP发送失败:', err.message);
                resolve(false);
            } else {
                console.log('   ✓ UDP数据包发送成功');
                resolve(true);
            }
        });
    });
}

/**
 * 发送有效的TCP数据包
 */
async function sendValidTCPPacket() {
    const client = net.createConnection({ port: 5726 }, () => {
        // 创建符合格式的数据包
        const testData = { test: 'Hello TCP', value: 456 };
        const checksum = crypto.createHash('sha256').update(JSON.stringify(testData)).digest('hex');
        
        const packetData = {
            header: {
                version: '1.0',
                timestamp: new Date().toISOString(),
                type: 'device-status',
                onlyID: 'test-device-456',
                userID: 'test-user'
            },
            payload: {
                userInfo: { nickname: 'test-user' },
                networkStatus: {
                    isConnected: true,
                    connectionType: 'ethernet',
                    ipAddresses: { ipv4: '192.168.1.101' },
                    dnsStatus: 'ok',
                    latency: 10
                },
                systemInfo: {
                    platform: 'win32',
                    arch: 'x64',
                    nodeVersion: 'v16.0.0'
                },
                customData: testData
            },
            footer: {
                checksum: checksum,
                retryCount: 0
            }
        };
        
        client.write(JSON.stringify(packetData));
        client.end();
        console.log('   ✓ TCP数据包发送成功');
    });
    
    return new Promise((resolve) => {
        client.on('end', () => {
            resolve(true);
        });
        
        client.on('error', (err) => {
            console.error('   ✗ TCP发送失败:', err.message);
            resolve(false);
        });
    });
}

/**
 * 睡眠函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行测试
testSimple().catch(error => {
    console.error('测试失败:', error);
    lookupPackage.destroy();
});
