const { lookupPackage } = require('./LookupPackage');
const { sentPackage } = require('./SentPackage');

/**
 * 测试localhost上的UDP通信
 */
async function testLocalhost() {
    console.log('=== localhost UDP通信测试开始 ===');
    
    try {
        // 1. 初始化模块
        console.log('\n1. 初始化模块:');
        
        // 初始化LookupPackage（监听UDP）
        lookupPackage.initialize({
            port: 5726,
            maxPackages: 100
        });
        
        // 初始化SentPackage（发送UDP）
        sentPackage.initialize({
            sendInterval: 10000,
            retryCount: 1,
            broadcastAddress: '127.0.0.1' // 直接使用localhost
        });
        
        console.log('   ✓ 两个模块初始化成功');
        
        // 2. 注册事件监听器
        console.log('\n2. 注册事件监听器:');
        
        lookupPackage.on('packageReceived', (packageData) => {
            console.log(`   [事件] 收到数据包:`);
            console.log(`         - 类型: ${packageData.header.type}`);
            console.log(`         - 设备: ${packageData.header.onlyID}`);
            console.log(`         - 用户: ${packageData.header.userID}`);
            console.log(`         - 消息: ${JSON.stringify(packageData.payload.data)}`);
        });
        
        console.log('   ✓ 事件监听器注册成功');
        
        // 3. 开始监听
        console.log('\n3. 开始监听UDP:');
        lookupPackage.startListening();
        console.log('   ✓ LookupPackage监听已启动');
        
        // 4. 发送正确格式的UDP数据包到localhost
        console.log('\n4. 发送正确格式的UDP数据包到localhost:');
        
        // 使用createPackage创建符合格式要求的数据包
        const testPackage = await sentPackage.createPackage({
            data: 'Hello from localhost test',
            timestamp: new Date().toISOString()
        });
        
        // 直接使用sendUDPPacketDirect发送到localhost
        const sendResult = await sentPackage.sendUDPPacketDirect(
            testPackage,
            '127.0.0.1',
            5726
        );
        
        console.log(`   ✓ UDP数据包发送${sendResult ? '成功' : '失败'}`);
        
        // 等待处理
        await sleep(2000);
        
        // 5. 查看统计信息
        console.log('\n5. 统计信息:');
        const lookupStats = lookupPackage.getStats();
        const sentStats = sentPackage.getStats();
        
        console.log('   ✓ LookupPackage统计:');
        console.log(`     - 总接收包数: ${lookupStats.totalReceived}`);
        console.log(`     - 有效数据包: ${lookupStats.validPackages}`);
        
        console.log('   ✓ SentPackage统计:');
        console.log(`     - 总发送包数: ${sentStats.totalPackages}`);
        console.log(`     - 成功发送数: ${sentStats.successPackages}`);
        
        console.log('\n=== localhost UDP通信测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        // 清理资源
        console.log('\n清理资源...');
        lookupPackage.stopListening();
        lookupPackage.destroy();
    }
}

/**
 * 睡眠函数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行测试
testLocalhost();
