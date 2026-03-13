const { lookupPackage } = require('./LookupPackage');
const { sentPackage } = require('./SentPackage');

/**
 * 测试重构后的UDP广播和设备发现功能
 */
async function testUDPRefactor() {
    console.log('=== UDP广播和设备发现功能测试开始 ===');
    
    try {
        // 1. 初始化两个模块
        console.log('\n1. 初始化模块:');
        
        // 初始化LookupPackage（监听UDP广播）
        lookupPackage.initialize({
            port: 5726,
            maxPackages: 100
        });
        
        // 初始化SentPackage（发送UDP广播）
        sentPackage.initialize({
            sendInterval: 10000,
            retryCount: 1
        });
        
        console.log('   ✓ 两个模块初始化成功');
        
        // 2. 注册事件监听器
        console.log('\n2. 注册事件监听器:');
        
        // LookupPackage事件
        lookupPackage.on('packageReceived', (packageData) => {
            console.log(`   [LookupPackage事件] 收到数据包:`);
            console.log(`         - 类型: ${packageData.header.type}`);
            console.log(`         - 设备: ${packageData.header.onlyID}`);
            console.log(`         - 用户: ${packageData.header.userID}`);
            console.log(`         - 协议: ${packageData._meta.protocol}`);
        });
        
        lookupPackage.on('deviceDiscovered', (deviceInfo) => {
            console.log(`   [LookupPackage事件] 发现设备:`);
            console.log(`         - 设备ID: ${deviceInfo.onlyID}`);
            console.log(`         - 用户ID: ${deviceInfo.userID}`);
            console.log(`         - IP地址: ${deviceInfo.ipAddress}`);
            console.log(`         - 端口: ${deviceInfo.port}`);
        });
        
        // SentPackage事件
        console.log('   ✓ 事件监听器注册成功');
        
        // 3. 开始监听
        console.log('\n3. 开始监听UDP广播:');
        lookupPackage.startListening();
        console.log('   ✓ LookupPackage监听已启动');
        
        // 4. 发送设备发现广播
        console.log('\n4. 发送设备发现广播:');
        const discoveryResult = await sentPackage.discoverDevices();
        console.log(`   ✓ 设备发现广播发送${discoveryResult ? '成功' : '失败'}`);
        
        // 5. 发送普通数据包
        console.log('\n5. 发送普通数据包:');
        const sendResult = await sentPackage.sendPackage({
            testMessage: 'Hello from SentPackage',
            timestamp: new Date().toISOString()
        });
        console.log(`   ✓ 普通数据包发送${sendResult ? '成功' : '失败'}`);
        
        // 等待处理
        await sleep(2000);
        
        // 6. 验证设备发现
        console.log('\n6. 验证设备发现:');
        const lookupDevices = lookupPackage.getDevices();
        const sentDevices = sentPackage.getDiscoveredDevices();
        
        console.log(`   ✓ LookupPackage发现 ${lookupDevices.length} 个设备`);
        console.log(`   ✓ SentPackage发现 ${sentDevices.length} 个设备`);
        
        if (lookupDevices.length > 0) {
            console.log('   ✓ 发现的设备详情:');
            lookupDevices.forEach((device, index) => {
                console.log(`     设备 ${index + 1}:`);
                console.log(`       - 设备ID: ${device.onlyID}`);
                console.log(`       - 用户ID: ${device.userID}`);
                console.log(`       - IP地址: ${device.ipAddress}`);
                console.log(`       - 最后在线: ${device.lastSeen}`);
            });
        }
        
        // 7. 查看统计信息
        console.log('\n7. 统计信息:');
        const lookupStats = lookupPackage.getStats();
        const sentStats = sentPackage.getStats();
        
        console.log('   ✓ LookupPackage统计:');
        console.log(`     - 总接收包数: ${lookupStats.totalReceived}`);
        console.log(`     - 有效数据包: ${lookupStats.validPackages}`);
        console.log(`     - 唯一设备数: ${lookupStats.uniqueDevices}`);
        console.log(`     - 当前数据包数: ${lookupStats.currentPackages}`);
        
        console.log('   ✓ SentPackage统计:');
        console.log(`     - 总发送包数: ${sentStats.totalPackages}`);
        console.log(`     - 成功发送数: ${sentStats.successPackages}`);
        console.log(`     - 失败发送数: ${sentStats.failedPackages}`);
        
        // 8. 测试直接设备通信
        console.log('\n8. 测试设备信息查询:');
        if (sentDevices.length > 0) {
            const deviceID = sentDevices[0].onlyID;
            const deviceInfo = lookupPackage.getDeviceByID(deviceID);
            
            if (deviceInfo) {
                console.log(`   ✓ 根据设备ID ${deviceID} 查询设备信息成功:`);
                console.log(`     - 用户ID: ${deviceInfo.userID}`);
                console.log(`     - IP地址: ${deviceInfo.ipAddress}`);
            }
        }
        
        console.log('\n=== UDP广播和设备发现功能测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error);
        console.error('错误详情:', error.stack);
    } finally {
        // 清理资源
        console.log('\n清理资源...');
        lookupPackage.stopListening();
        lookupPackage.destroy();
        console.log('测试结束');
    }
}

/**
 * 睡眠函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行测试
testUDPRefactor().catch(error => {
    console.error('测试过程中发生错误:', error);
    lookupPackage.stopListening();
    lookupPackage.destroy();
});
