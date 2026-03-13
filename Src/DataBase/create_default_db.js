// 创建默认数据库示例

const { createDatabase } = require('./index');
const { logger } = require('../Tools/Logs');
const fs = require('fs');
const path = require('path');

async function createDefaultDatabase() {
    logger.info('SYSTEM', '创建默认数据库示例');
    
    try {
        // 创建数据库实例（使用默认配置）
        const db = createDatabase();
        
        // 验证数据库文件是否存在
        const dbPath = path.join(__dirname, '../../Data', 'app.db');
        if (fs.existsSync(dbPath)) {
            logger.info('SYSTEM', `默认数据库文件已创建: ${dbPath}`);
            logger.info('SYSTEM', `文件大小: ${fs.statSync(dbPath).size} 字节`);
        } else {
            logger.error('SYSTEM', `数据库文件不存在: ${dbPath}`);
        }
        
        // 列出数据库中的表格
        const existingTables = db._getExistingTables();
        logger.info('SYSTEM', `数据库中存在的表格: ${existingTables.join(', ')}`);
        
        // 关闭数据库连接
        db.close();
        
        logger.info('SYSTEM', '创建默认数据库示例完成');
        
    } catch (error) {
        logger.error('SYSTEM', '创建默认数据库失败', error);
        process.exit(1);
    }
}

// 运行示例
if (require.main === module) {
    createDefaultDatabase();
}
