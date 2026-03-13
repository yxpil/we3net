const { lookupPackage } = require('./LookupPackage');
const { sentPackage } = require('./SentPackage');
const dgram = require('dgram');
const net = require('net');
const crypto = require('crypto');

/**
 * 测试LookupPackage模块
 */
async function testLookupPackage() {
    console.log('=== LookupPackage测试开始 ===');
    
    try {
        // 1. 初始化模块
        console.log('\n1. 初始化数据包查询模块:');
        lookupPackage.initialize({
            port: 5726,
            maxPackages: 100
        });
        console.log('   ✓ 初始化成功');
        
        // 2. 开始监听
        console.log('\n2. 开始监听数据包:');
        lookupPackage.startListening();
        console.log('   ✓ 监听已启动');
        
        // 3. 发送测试数据包
        console.log('\n3. 发送测试数据包:');
        await sendTestPackets();
        console.log('   ✓ 测试数据包发送完成');
        
        // 等待数据包处理
        await sleep(1000);
        
        // 4. 查询数据包
        console.log('\n4. 查询数据包:');
        testQueries();
        
        // 5. 获取设备和用户信息
        console.log('\n5. 获取设备和用户信息:');
        testGetDevicesAndUsers();
        
        // 6. 获取统计信息
        console.log('\n6. 获取统计信息:');
        const stats = lookupPackage.getStats();
        console.log('   ✓ 统计信息:');
        console.log('     - 总接收包数:', stats.totalReceived);
        console.log('     - 有效数据包:', stats.validPackages);
        console.log('     - 无效数据包:', stats.invalidPackages);
        console.log('     - 唯一设备数:', stats.uniqueDevices);
        console.log('     - 唯一用户数:', stats.uniqueUsers);
        console.log('     - 当前数据包数:', stats.currentPackages);
        console.log('     - 缓存大小:', stats.cacheSize);
        console.log('     - 是否监听中:', stats.isListening);
        
        // 7. 清除数据包
        console.log('\n7. 清除数据包:');
        lookupPackage.clearPackages();
        console.log('   ✓ 数据包已清除');
        
        // 8. 停止监听
        console.log('\n8. 停止监听:');
        lookupPackage.stopListening();
        console.log('   ✓ 监听已停止');
        
        console.log('\n=== LookupPackage测试完成 ===');
        console.log('✓ 所有测试已执行');
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        // 清理资源
        console.log('\n清理资源...');
        lookupPackage.destroy();
        console.log('测试结束');
    }
}

/**
 * 发送测试数据包
 */
async function sendTestPackets() {
    // 发送有效的数据包
    await sendValidPacket();
    
    // 发送另一个有效的数据包（不同设备）
    await sendValidPacket('device2', 'user2');
    
    // 发送无效的数据包
    await sendInvalidPacket();
}

/**
 * 发送有效的数据包
 * @param {string} deviceId 设备ID
 * @param {string} userId 用户ID
 */
async function sendValidPacket(deviceId = 'test-device', userId = 'test-user') {
    // 创建模拟数据包
    const testData = { test: 'Hello World', value: 123 };
    const checksum = crypto.createHash('sha256').update(JSON.stringify(testData)).digest('hex');
    
    const packetData = {
        header: {
            version: '1.0',
            timestamp: new Date().toISOString(),
            type: 'device-status',
            onlyID: deviceId,
            userID: userId
        },
        payload: {
            userInfo: { nickname: userId },
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
    
    // 使用UDP发送
    await sendUDP(packetData);
    
    // 使用TCP发送
    await sendTCP(packetData);
}

/**
 * 发送无效的数据包
 */
async function sendInvalidPacket() {
    const invalidPacket = {
        // 缺少必要字段的数据包
        header: {
            version: '1.0',
            timestamp: new Date().toISOString()
            // 缺少type, onlyID, userID
        },
        payload: {},
        footer: {}
    };
    
    await sendUDP(invalidPacket);
}

/**
 * 使用UDP发送数据包
 * @param {Object} data 数据包
 */
async function sendUDP(data) {
    return new Promise((resolve) => {
        const client = dgram.createSocket('udp4');
        const message = Buffer.from(JSON.stringify(data));
        
        client.send(message, 5726, 'localhost', (err) => {
            client.close();
            resolve();
        });
    });
}

/**
 * 使用TCP发送数据包
 * @param {Object} data 数据包
 */
async function sendTCP(data) {
    return new Promise((resolve) => {
        const client = net.createConnection({ port: 5726 }, () => {
            client.write(JSON.stringify(data));
            client.end();
        });
        
        client.on('end', () => {
            resolve();
        });
        
        client.on('error', () => {
            // 忽略错误
            resolve();
        });
    });
}

/**
 * 测试数据包查询功能
 */
function testQueries() {
    const allPackages = lookupPackage.getAllPackages();
    console.log('   ✓ 所有数据包数:', allPackages.length);
    
    if (allPackages.length > 0) {
        const firstPackage = allPackages[0];
        
        // 按设备查询
        const devicePackages = lookupPackage.getPackagesByDevice(firstPackage.header.onlyID);
        console.log('   ✓ 按设备查询数:', devicePackages.length);
        
        // 按用户查询
        const userPackages = lookupPackage.getPackagesByUser(firstPackage.header.userID);
        console.log('   ✓ 按用户查询数:', userPackages.length);
        
        // 按类型查询
        const typePackages = lookupPackage.getPackagesByType(firstPackage.header.type);
        console.log('   ✓ 按类型查询数:', typePackages.length);
        
        // 查询最近的数据包
        const recentPackages = lookupPackage.getRecentPackages(5);
        console.log('   ✓ 最近数据包数:', recentPackages.length);
        
        // 高级查询
        const advancedQuery = lookupPackage.queryPackages({
            onlyID: firstPackage.header.onlyID,
            userID: firstPackage.header.userID,
            type: firstPackage.header.type
        });
        console.log('   ✓ 高级查询数:', advancedQuery.length);
    }
}

/**
 * 测试获取设备和用户信息
 */
function testGetDevicesAndUsers() {
    const devices = lookupPackage.getDevices();
    console.log('   ✓ 检测到的设备数:', devices.length);
    
    const users = lookupPackage.getUsers();
    console.log('   ✓ 检测到的用户数:', users.length);
    
    if (devices.length > 0) {
        console.log('   ✓ 第一个设备:', {
            onlyID: devices[0].onlyID,
            userID: devices[0].userID,
            lastSeen: devices[0].lastSeen
        });
    }
}

/**
 * 睡眠函数
 * @param {number} ms 毫秒数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行测试
testLookupPackage().catch(error => {
    console.error('测试过程中发生错误:', error);
    lookupPackage.destroy();
});
