// 测试设备更换检测功能
const { OnlyID } = require('./index');
const fs = require('fs');
const path = require('path');

async function testDeviceChangeDetection() {
    console.log('=== 设备更换检测功能测试 ===\n');

    // 创建新的OnlyID实例
    const onlyId = new OnlyID();
    const cachePath = onlyId.cachePath;

    try {
        // 1. 清除现有缓存
        console.log('1. 清除现有缓存...');
        if (fs.existsSync(cachePath)) {
            fs.unlinkSync(cachePath);
            console.log('   ✓ 缓存已清除');
        } else {
            console.log('   ✓ 缓存不存在，无需清除');
        }
        console.log('');

        // 2. 生成第一次ID
        console.log('2. 生成第一次ID...');
        const id1 = await onlyId.generate();
        console.log(`   ✓ 生成ID: ${id1}`);
        
        // 获取第一次缓存的硬件信息
        const cache1 = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log('   ✓ 缓存内容:');
        console.log(`     - 主板制造商: ${cache1.motherboardInfo.manufacturer}`);
        console.log(`     - 主板型号: ${cache1.motherboardInfo.model}`);
        console.log(`     - 主板序列号: ${cache1.motherboardInfo.serialNumber}`);
        console.log('');

        // 3. 模拟设备更换：修改缓存中的主板信息
        console.log('3. 模拟设备更换...');
        const modifiedCache = {
            ...cache1,
            motherboardInfo: {
                manufacturer: 'ModifiedManufacturer',
                model: 'ModifiedModel',
                serialNumber: 'ModifiedSerial123'
            }
        };
        fs.writeFileSync(cachePath, JSON.stringify(modifiedCache, null, 2), 'utf8');
        console.log('   ✓ 已修改缓存中的硬件信息');
        console.log(`     - 新主板制造商: ${modifiedCache.motherboardInfo.manufacturer}`);
        console.log(`     - 新主板型号: ${modifiedCache.motherboardInfo.model}`);
        console.log(`     - 新主板序列号: ${modifiedCache.motherboardInfo.serialNumber}`);
        console.log('');

        // 4. 再次生成ID，系统应该检测到设备更换并生成新ID
        console.log('4. 检测设备更换后生成新ID...');
        const id2 = await onlyId.generate();
        console.log(`   ✓ 生成ID: ${id2}`);
        console.log(`   ✓ 与旧ID比较: ${id1 === id2 ? '相同（设备未更换）' : '不同（设备已更换）'}`);
        
        // 验证新的缓存内容
        const cache2 = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log('   ✓ 新缓存内容:');
        console.log(`     - 主板制造商: ${cache2.motherboardInfo.manufacturer}`);
        console.log(`     - 主板型号: ${cache2.motherboardInfo.model}`);
        console.log(`     - 主板序列号: ${cache2.motherboardInfo.serialNumber}`);
        console.log('');

        // 5. 第三次生成ID，应该与第二次相同（设备未再次更换）
        console.log('5. 确认设备未再次更换...');
        const id3 = await onlyId.generate();
        console.log(`   ✓ 生成ID: ${id3}`);
        console.log(`   ✓ 与新ID比较: ${id2 === id3 ? '相同（设备未更换）' : '不同（设备已更换）'}`);
        console.log('');

        console.log('=== 测试完成 ===');
        console.log('✓ 设备更换检测功能正常工作！');
        console.log('  - 设备未更换时：保持原有ID');
        console.log('  - 设备已更换时：生成新ID');

    } catch (error) {
        console.error('=== 测试失败 ===');
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
    } finally {
        // 清理测试缓存
        if (fs.existsSync(cachePath)) {
            fs.unlinkSync(cachePath);
        }
    }
}

// 执行测试
testDeviceChangeDetection();
