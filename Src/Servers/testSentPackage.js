// SentPackage.js测试文件
const { sentPackage } = require('./SentPackage');

async function testSentPackage() {
    console.log('=== SentPackage测试开始 ===\n');

    try {
        // 测试1：初始化模块
        console.log('1. 初始化数据包发送模块:');
        sentPackage.initialize({
            sendInterval: 10000, // 测试用发送间隔：10秒
            retryCount: 2 // 测试用重试次数：2次
        });
        console.log('   ✓ 初始化成功\n');

        // 测试2：获取设备唯一标识
        console.log('2. 获取设备唯一标识:');
        const onlyID = await sentPackage.getOnlyID();
        console.log(`   ✓ 获取成功: ${onlyID}\n`);

        // 测试3：获取用户信息
        console.log('3. 获取用户信息:');
        const userInfo = sentPackage.getUserInfo();
        console.log(`   ✓ 获取成功: 用户名 - ${userInfo?.nickname}\n`);

        // 测试4：检测网络状态
        console.log('4. 检测网络状态:');
        const networkStatus = await sentPackage.checkNetworkStatus();
        console.log(`   ✓ 检测成功:`);
        console.log(`     - 连接状态: ${networkStatus.isConnected ? '已连接' : '未连接'}`);
        console.log(`     - 连接类型: ${networkStatus.connectionType}`);
        console.log(`     - DNS状态: ${networkStatus.dnsStatus}`);
        console.log(`     - 延迟: ${networkStatus.latency ? networkStatus.latency + 'ms' : '未知'}\n`);

        // 测试5：创建数据包
        console.log('5. 创建数据包:');
        const customData = { test: 'Hello World', value: 123 };
        const packageData = await sentPackage.createPackage(customData);
        console.log('   ✓ 创建成功:');
        console.log(`     - 版本: ${packageData.header.version}`);
        console.log(`     - 时间戳: ${packageData.header.timestamp}`);
        console.log(`     - 设备ID: ${packageData.header.onlyID}`);
        console.log(`     - 用户ID: ${packageData.header.userID}`);
        console.log(`     - 自定义数据: ${JSON.stringify(packageData.payload.customData)}`);
        console.log(`     - 校验和: ${packageData.footer.checksum}\n`);

        // 测试6：添加数据包到发送队列
        console.log('6. 添加数据包到发送队列:');
        sentPackage.addToQueue({ queueTest: 'Queue Item 1' });
        sentPackage.addToQueue({ queueTest: 'Queue Item 2' });
        const stats = sentPackage.getStats();
        console.log(`   ✓ 添加成功: 队列大小 - ${stats.queueSize}\n`);

        // 测试7：处理发送队列
        console.log('7. 处理发送队列:');
        console.log('   注意：此测试可能会因网络配置或服务器状态而失败');
        await sentPackage.processQueue();
        console.log(`   ✓ 处理完成`);

        // 测试8：获取统计信息
        console.log('8. 获取统计信息:');
        const finalStats = sentPackage.getStats();
        console.log('   ✓ 统计信息:');
        console.log(`     - 总发送包数: ${finalStats.totalPackages}`);
        console.log(`     - 成功发送数: ${finalStats.successPackages}`);
        console.log(`     - 失败发送数: ${finalStats.failedPackages}`);
        console.log(`     - 重试次数: ${finalStats.retryCount}`);
        console.log(`     - 当前队列大小: ${finalStats.queueSize}\n`);

        // 测试9：重置统计信息
        console.log('9. 重置统计信息:');
        sentPackage.resetStats();
        const resetStats = sentPackage.getStats();
        console.log(`   ✓ 重置成功: 总发送包数 - ${resetStats.totalPackages}\n`);

        console.log('=== SentPackage测试完成 ===');
        console.log('✓ 所有测试已执行');

    } catch (error) {
        console.error('=== 测试失败 ===');
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
    } finally {
        // 清理资源
        console.log('\n清理资源...');
        sentPackage.stopAutoSend();
        console.log('测试结束');
    }
}

// 执行测试
testSentPackage();
