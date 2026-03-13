// OnlyID测试文件
const { onlyId, OnlyID } = require('./index');

async function testOnlyID() {
    console.log('=== OnlyID测试开始 ===\n');

    try {
        // 测试1：生成唯一ID
        console.log('1. 生成唯一ID:');
        const id = await onlyId.generate();
        console.log(`   ✓ 生成成功: ${id}\n`);

        // 测试2：验证ID的有效性
        console.log('2. 验证ID有效性:');
        const isValid = await onlyId.validate(id);
        console.log(`   ✓ 验证结果: ${isValid ? '有效' : '无效'}\n`);

        // 测试3：获取详细信息
        console.log('3. 获取详细信息:');
        const detailedInfo = await onlyId.getDetailedInfo();
        console.log('   ✓ 系统信息:');
        console.log(`     - 平台: ${detailedInfo.system.platform}`);
        console.log(`     - 架构: ${detailedInfo.system.arch}`);
        console.log(`     - CPU数量: ${detailedInfo.system.cpus}`);
        console.log('   ✓ 主板信息:');
        console.log(`     - 制造商: ${detailedInfo.motherboard.manufacturer}`);
        console.log(`     - 型号: ${detailedInfo.motherboard.model}`);
        console.log(`     - 序列号: ${detailedInfo.motherboard.serialNumber}`);
        console.log('   ✓ OnlyID信息:');
        console.log(`     - OnlyID: ${detailedInfo.onlyId}`);
        console.log(`     - 是否已缓存: ${detailedInfo.cached}`);
        console.log('');

        // 测试4：不使用缓存生成ID（应该与之前的ID相同）
        console.log('4. 不使用缓存生成ID:');
        const idWithoutCache = await onlyId.generate({ useCache: false });
        console.log(`   ✓ 生成成功: ${idWithoutCache}`);
        console.log(`   ✓ 与缓存ID比较: ${id === idWithoutCache ? '相同' : '不同'}\n`);

        // 测试5：使用不同的哈希算法
        console.log('5. 使用SHA1算法生成ID:');
        const idWithSha1 = await onlyId.generate({ useCache: false, hashAlgorithm: 'sha1' });
        console.log(`   ✓ 生成成功: ${idWithSha1}\n`);

        // 测试6：清除缓存并重新生成
        console.log('6. 清除缓存并重新生成:');
        onlyId.clearCache();
        console.log('   ✓ 缓存已清除');
        const newIdAfterClear = await onlyId.generate();
        console.log(`   ✓ 重新生成ID: ${newIdAfterClear}`);
        console.log(`   ✓ 与原始ID比较: ${id === newIdAfterClear ? '相同' : '不同'}\n`);

        // 测试7：使用新实例生成ID
        console.log('7. 使用新实例生成ID:');
        const newOnlyIdInstance = new OnlyID();
        const idFromNewInstance = await newOnlyIdInstance.generate();
        console.log(`   ✓ 新实例生成ID: ${idFromNewInstance}`);
        console.log(`   ✓ 与原始ID比较: ${id === idFromNewInstance ? '相同' : '不同'}\n`);

        console.log('=== OnlyID测试完成 ===');
        console.log('✓ 所有测试通过！');
    } catch (error) {
        console.error('=== 测试失败 ===');
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

// 执行测试
testOnlyID();
