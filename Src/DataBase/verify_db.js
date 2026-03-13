// 验证数据库结构的简单脚本

const { createDatabase } = require('./index');
const { logger } = require('../Tools/Logs');
const fs = require('fs');
const path = require('path');

async function verifyDatabase() {
    logger.info('SYSTEM', '验证数据库结构');
    
    try {
        // 检查数据库文件是否存在
        const dbPath = path.join(__dirname, '../../Data', 'app.db');
        if (fs.existsSync(dbPath)) {
            logger.info('SYSTEM', `数据库文件存在: ${dbPath}`);
            logger.info('SYSTEM', `文件大小: ${fs.statSync(dbPath).size} 字节`);
        } else {
            logger.error('SYSTEM', `数据库文件不存在: ${dbPath}`);
            return;
        }
        
        // 连接数据库
        const db = createDatabase();
        
        // 获取所有表格
        const tables = db._getExistingTables();
        logger.info('SYSTEM', `数据库中的表格: ${tables.join(', ')}`);
        
        // 检查每个表格的结构
        for (const tableName of tables) {
            logger.info('SYSTEM', `\n=== 表格 ${tableName} 结构 ===`);
            const columns = db._getExistingColumns(tableName);
            
            for (const [columnName, columnInfo] of Object.entries(columns)) {
                logger.info('SYSTEM', `${columnName}: ${columnInfo.type} (NOT NULL: ${columnInfo.notnull}, DEFAULT: ${columnInfo.dflt_value}, PK: ${columnInfo.pk})`);
            }
        }
        
        // 关闭连接
        db.close();
        logger.info('SYSTEM', '\n数据库验证完成');
        
    } catch (error) {
        logger.error('SYSTEM', '数据库验证失败', error);
    }
}

// 运行验证
if (require.main === module) {
    verifyDatabase();
}
