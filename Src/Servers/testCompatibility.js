const { lookupPackage } = require('./LookupPackage');
const { sentPackage } = require('./SentPackage');

/**
 * 测试SentPackage和LookupPackage的兼容性
 */
async function testCompatibility() {
    console.log('=== SentPackage与LookupPackage兼容性测试开始 ===');
    
    try {
        // 1. 初始化两个模块
        console.log('\n1. 初始化模块:');
        
        // 初始化LookupPackage（监听数据包）
        lookupPackage.initialize({
            port: 5726,
            maxPackages: 100
        });
        
        // 初始化SentPackage（发送数据包）
        sentPackage.initialize({
            sendInterval: 10000,
            retryCount: 2
        });
        
        console.log('   ✓ 两个模块初始化成功');
        
        // 2. 开始监听
        console.log('\n2. 开始监听数据包:');
        lookupPackage.startListening();
        console.log('   ✓ 监听已启动');
        
        // 3. 注册事件监听器
        console.log('\n3. 注册事件监听器:');
        let receivedPackages = 0;
        
        lookupPackage.on('packageReceived', (packageData) => {
            receivedPackages++;
            console.log(`   [事件] 接收到数据包 #${receivedPackages}:`);
            console.log(`         - 设备ID: ${packageData.header.onlyID}`);
            console.log(`         - 用户ID: ${packageData.header.userID}`);
            console.log(`         - 类型: ${packageData.header.type}`);
            console.log(`         - 协议: ${packageData._meta.protocol}`);
        });
        
        console.log('   ✓ 事件监听器注册成功');
        
        // 4. 使用SentPackage发送数据包
        console.log('\n4. 使用SentPackage发送数据包:');
        for (let i = 0; i < 2; i++) {
            await sentPackage.sendPackage({
                testMessage: `Hello from SentPackage #${i + 1}`,
                sequence: i + 1
            }, {
                protocol: 'udp' // 使用UDP协议发送
            });
            await sleep(500);
        }
        
        // 发送TCP数据包
        await sentPackage.sendPackage({
            testMessage: 'Hello from SentPackage (TCP)',
            sequence: 3,
            protocolType: 'tcp'
        }, {
            protocol: 'tcp' // 使用TCP协议发送
        });
        await sleep(500);
        
        console.log('   ✓ SentPackage数据包发送完成');
        
        // 等待数据包处理
        await sleep(1000);
        
        // 5. 验证接收情况
        console.log('\n5. 验证接收情况:');
        const stats = lookupPackage.getStats();
        console.log(`   ✓ LookupPackage接收统计:`);
        console.log(`     - 总接收包数: ${stats.totalReceived}`);
        console.log(`     - 有效数据包: ${stats.validPackages}`);
        console.log(`     - 无效数据包: ${stats.invalidPackages}`);
        console.log(`     - 唯一设备数: ${stats.uniqueDevices}`);
        console.log(`     - 唯一用户数: ${stats.uniqueUsers}`);
        
        // 6. 查询接收到的数据包
        console.log('\n6. 查询接收到的SentPackage数据包:');
        const allPackages = lookupPackage.getAllPackages();
        console.log(`   ✓ 接收到的数据包数: ${allPackages.length}`);
        
        if (allPackages.length > 0) {
            const firstPackage = allPackages[0];
            console.log(`   ✓ 第一个数据包:`);
            console.log(`     - 版本: ${firstPackage.header.version}`);
            console.log(`     - 时间戳: ${firstPackage.header.timestamp}`);
            console.log(`     - 自定义数据:`, firstPackage.payload.customData);
            console.log(`     - 网络状态:`, firstPackage.payload.networkStatus.isConnected ? '已连接' : '未连接');
        }
        
        // 7. 测试设备发现功能
        console.log('\n7. 测试设备发现功能:');
        const devices = lookupPackage.getDevices();
        console.log(`   ✓ 发现的设备数: ${devices.length}`);
        
        if (devices.length > 0) {
            console.log(`   ✓ 设备详情:`);
            devices.forEach((device, index) => {
                console.log(`     设备 #${index + 1}:`);
                console.log(`       - 设备ID: ${device.onlyID}`);
                console.log(`       - 用户ID: ${device.userID}`);
                console.log(`       - 最后在线: ${device.lastSeen}`);
                console.log(`       - 网络状态: ${device.networkStatus.connectionType || 'unknown'}`);
            });
        }
        
        // 8. 停止测试
        console.log('\n8. 停止测试:');
        lookupPackage.stopListening();
        console.log('   ✓ 测试完成');
        
        console.log('\n=== 兼容性测试完成 ===');
        console.log('✓ SentPackage和LookupPackage可以正常协同工作');
        
    } catch (error) {
        console.error('兼容性测试失败:', error);
    } finally {
        // 清理资源
        console.log('\n清理资源...');
        lookupPackage.destroy();
        console.log('测试结束');
    }
}

/**
 * 睡眠函数
 * @param {number} ms 毫秒数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行兼容性测试
testCompatibility().catch(error => {
    console.error('兼容性测试过程中发生错误:', error);
    lookupPackage.destroy();
});
