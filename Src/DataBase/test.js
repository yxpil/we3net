// test.js - 数据库管理库测试脚本
const { createDatabase, parseFromLike, generateFromLike } = require('./index');
const { logger } = require('../Tools/Logs');
const fs = require('fs');
const path = require('path');

// 测试配置
const testConfig = {
    testDbName: 'test.db',
    fromLikePath: path.join(__dirname, 'FromLike')
};

// 测试函数
async function runTests() {
    logger.info('SYSTEM', '开始数据库管理库测试');
    
    try {
        // 测试1: 解析FromLike文件
        logger.info('TEST', '测试1: 解析FromLike文件');
        const tables = parseFromLike(testConfig.fromLikePath);
        logger.info('TEST', `FromLike文件解析成功，共${Object.keys(tables).length}个表格`, tables);
        
        // 测试2: 创建数据库实例
        logger.info('TEST', '测试2: 创建数据库实例');
        const db = createDatabase({
            dbName: testConfig.testDbName
        });
        
        // 测试3: 验证模型创建
        logger.info('TEST', '测试3: 验证模型创建');
        const tableNames = Object.keys(tables);
        for (const tableName of tableNames) {
            try {
                const model = db.model(tableName);
                logger.info('TEST', `模型${tableName}创建成功`);
            } catch (error) {
                logger.error('TEST', `模型${tableName}创建失败`, error);
            }
        }
        
        // 测试4: CRUD操作
        logger.info('TEST', '测试4: CRUD操作');
        
        // 获取模型
        const userModel = db.model('users');
        const friendModel = db.model('friends');
        const messageModel = db.model('messages');
        
        // 创建测试用户
        logger.info('TEST', '创建测试用户');
        const userId = userModel.create({
            user_id: `test_user_${Date.now()}`,
            username: 'testuser',
            password: 'password123',
            email: `test_${Date.now()}@example.com`
        });
        logger.info('TEST', `用户创建成功，ID: ${userId}`);
        
        // 查询用户
        logger.info('TEST', '查询测试用户');
        const user = userModel.find({ where: { id: userId }, single: true });
        logger.info('TEST', '查询到用户:', user);
        
        // 更新用户
        logger.info('TEST', '更新测试用户');
        const updateResult = userModel.update(
            { username: 'updateduser' },
            { id: userId }
        );
        logger.info('TEST', `用户更新成功，影响行数: ${updateResult}`);
        
        // 创建好友
        logger.info('TEST', '创建测试好友');
        const friendId = friendModel.create({
            friend_id: `friend_${Date.now()}`,
            user_id: user.user_id,
            friend_name: 'Test Friend',
            friend_ipv4: '192.168.1.100',
            friend_ipv6: '2001:db8::1',
            friend_avatar: 'base64_avatar_data',
            status: 'online'
        });
        logger.info('TEST', `好友创建成功，ID: ${friendId}`);
        
        // 查询所有好友
        logger.info('TEST', '查询所有好友');
        const friends = friendModel.find({
            where: { user_id: user.user_id },
            orderBy: 'created_at DESC'
        });
        logger.info('TEST', `共有${friends.length}个好友`, friends);
        
        // 创建消息
        logger.info('TEST', '创建测试消息');
        const messageId = messageModel.create({
            message_id: `msg_${Date.now()}`,
            sender_id: user.user_id,
            receiver_id: `friend_${Date.now()}`,
            content: 'Hello, this is a test message!',
            type: 'text',
            status: 'sent'
        });
        logger.info('TEST', `消息创建成功，ID: ${messageId}`);
        
        // 查询消息
        logger.info('TEST', '查询测试消息');
        const messages = messageModel.find({
            where: { sender_id: user.user_id },
            orderBy: 'timestamp DESC'
        });
        logger.info('TEST', `共有${messages.length}条消息`, messages);
        
        // 测试5: 验证表格结构
        logger.info('TEST', '测试5: 验证表格结构');
        const existingTables = db._getExistingTables();
        logger.info('TEST', `数据库中存在的表格: ${existingTables.join(', ')}`);
        
        // 测试6: 清理测试数据
        logger.info('TEST', '测试6: 清理测试数据');
        
        // 删除消息
        const deleteMessagesResult = messageModel.delete({ sender_id: user.user_id });
        logger.info('TEST', `删除消息成功，影响行数: ${deleteMessagesResult}`);
        
        // 删除好友
        const deleteFriendsResult = friendModel.delete({ user_id: user.user_id });
        logger.info('TEST', `删除好友成功，影响行数: ${deleteFriendsResult}`);
        
        // 删除用户
        const deleteUserResult = userModel.delete({ id: userId });
        logger.info('TEST', `删除用户成功，影响行数: ${deleteUserResult}`);
        
        // 关闭数据库连接
        db.close();
        
        // 清理测试数据库文件
        const testDbPath = path.join(__dirname, '../../Data', testConfig.testDbName);
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
            logger.info('TEST', `测试数据库文件已清理: ${testDbPath}`);
        }
        
        logger.info('SYSTEM', '数据库管理库测试完成');
        logger.info('SYSTEM', '所有测试通过！');
        
    } catch (error) {
        logger.error('SYSTEM', '测试失败', error);
        process.exit(1);
    }
}

// 运行测试
runTests();
