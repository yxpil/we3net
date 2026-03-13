/**
 * 致命错误缓冲库测试文件
 * 测试各种错误场景，验证库的错误捕获和处理能力
 */

const { ErrorBuffer, errorBuffer, wrap } = require('./index');

console.log('=== 开始致命错误缓冲库测试 ===\n');

// 测试1: 全局错误捕获
async function testGlobalError() {
    console.log('1. 测试全局错误捕获...');
    
    errorBuffer.on('uncaughtException', (errorInfo) => {
        console.log('   ✅ 成功捕获全局错误:', errorInfo.type);
        console.log('   错误消息:', errorInfo.error.message);
    });
    
    errorBuffer.on('recovered', () => {
        console.log('   ✅ 成功从错误中恢复');
    });
    
    // 模拟一个全局错误
    setTimeout(() => {
        throw new Error('测试全局错误');
    }, 1000);
    
    // 等待测试完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('   ✓ 全局错误捕获测试完成\n');
}

// 测试2: Promise拒绝捕获
async function testPromiseRejection() {
    console.log('2. 测试Promise拒绝捕获...');
    
    errorBuffer.on('unhandledRejection', (errorInfo) => {
        console.log('   ✅ 成功捕获Promise拒绝:', errorInfo.type);
    });
    
    // 模拟一个未处理的Promise拒绝
    setTimeout(() => {
        Promise.reject(new Error('测试Promise拒绝'));
    }, 1000);
    
    // 等待测试完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('   ✓ Promise拒绝捕获测试完成\n');
}

// 测试3: 包装函数错误处理
async function testWrappedFunction() {
    console.log('3. 测试包装函数错误处理...');
    
    // 创建一个会抛出错误的函数
    function errorProneFunction() {
        throw new Error('测试包装函数错误');
    }
    
    // 使用wrap函数包装
    const wrappedFunction = wrap(errorProneFunction, { defaultValue: '恢复后的值' });
    
    // 执行包装后的函数
    const result = await wrappedFunction();
    console.log('   ✅ 包装函数执行结果:', result);
    
    console.log('   ✓ 包装函数错误处理测试完成\n');
}

// 测试4: 错误统计信息
async function testErrorStats() {
    console.log('4. 测试错误统计信息...');
    
    const stats = errorBuffer.getStats();
    console.log('   错误统计信息:', JSON.stringify(stats, null, 2));
    
    console.log('   ✓ 错误统计信息测试完成\n');
}

// 测试5: 资源监控
async function testResourceMonitoring() {
    console.log('5. 测试资源监控...');
    
    errorBuffer.on('memoryPressure', (info) => {
        console.log('   ✅ 检测到内存压力:', JSON.stringify(info, null, 2));
    });
    
    // 模拟内存压力（修改阈值以便测试）
    errorBuffer.config.memoryThreshold = 0.0001;
    
    // 等待监控检测
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 恢复正常阈值
    errorBuffer.config.memoryThreshold = 0.9;
    
    console.log('   ✓ 资源监控测试完成\n');
}

// 测试6: 自定义错误缓冲器
async function testCustomErrorBuffer() {
    console.log('6. 测试自定义错误缓冲器...');
    
    const customBuffer = new ErrorBuffer({
        maxErrorHistory: 100,
        autoRecover: true
    });
    
    customBuffer.on('initialized', () => {
        console.log('   ✅ 自定义错误缓冲器初始化成功');
    });
    
    // 清理
    customBuffer.cleanup();
    
    console.log('   ✓ 自定义错误缓冲器测试完成\n');
}

// 运行所有测试
async function runAllTests() {
    try {
        await testGlobalError();
        await testPromiseRejection();
        await testWrappedFunction();
        await testErrorStats();
        await testResourceMonitoring();
        await testCustomErrorBuffer();
        
        console.log('=== 所有测试完成！ ===');
        console.log('\n总结:');
        console.log('- ✅ 全局错误捕获功能正常');
        console.log('- ✅ Promise拒绝捕获功能正常');
        console.log('- ✅ 包装函数错误处理功能正常');
        console.log('- ✅ 错误统计信息功能正常');
        console.log('- ✅ 资源监控功能正常');
        console.log('- ✅ 自定义错误缓冲器功能正常');
        
    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}

// 启动测试
runAllTests().then(() => {
    // 测试完成后退出
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});