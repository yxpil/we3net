// DataBase/example.js - 数据库管理库使用示例

const { createDatabase } = require('./index');
const { logger } = require('../Tools/Logs');

// 简单的使用示例
async function exampleUsage() {
    logger.info('SYSTEM', '数据库管理库使用示例');
    
    try {
        // 创建数据库实例
        // 自动读取 FromLike 文件并维护表格结构
        const db = createDatabase({
            // 可选配置
            // dbName: 'myapp.db',  // 数据库文件名，默认app.db
            // fromLikePath: './FromLike'  // FromLike文件路径，默认当前目录
        });
        
        // 获取模型（自动根据FromLike定义创建）
        const userModel = db.model('users');
        const friendModel = db.model('friends');
        const messageModel = db.model('messages');
        const telemetryServerModel = db.model('telemetry_servers');
        const corsConfigModel = db.model('cors_config');
        const auxiliaryServerModel = db.model('auxiliary_servers');
        const accountModel = db.model('accounts');
        
        logger.info('SYSTEM', '数据库模型加载完成');
        logger.info('SYSTEM', `可用模型: ${Object.keys(db.models).join(', ')}`);
        
        // 1. 创建用户示例
        logger.info('SYSTEM', '=== 创建用户示例 ===');
        const newUser = {
            user_id: `user_${Date.now()}`,
            username: 'demo_user',
            password: 'secure_password',
            email: `demo_${Date.now()}@example.com`
        };
        
        const userId = userModel.create(newUser);
        logger.info('SYSTEM', `用户创建成功，ID: ${userId}`);
        
        // 2. 查询用户示例
        logger.info('SYSTEM', '=== 查询用户示例 ===');
        const foundUser = userModel.find({
            where: { id: userId },
            single: true
        });
        logger.info('SYSTEM', `查询到用户: ${JSON.stringify(foundUser, null, 2)}`);
        
        // 3. 更新用户示例
        logger.info('SYSTEM', '=== 更新用户示例 ===');
        const updateResult = userModel.update(
            { username: 'updated_demo_user' },
            { id: userId }
        );
        logger.info('SYSTEM', `用户更新成功，影响行数: ${updateResult}`);
        
        // 4. 创建好友示例
        logger.info('SYSTEM', '=== 创建好友示例 ===');
        const newFriend = {
            friend_id: `friend_${Date.now()}`,
            user_id: foundUser.user_id,
            friend_name: 'Demo Friend',
            friend_ipv4: '192.168.1.100',
            friend_ipv6: '2001:db8::1',
            friend_avatar: 'base64_avatar_data',
            status: 'online'
        };
        
        const friendId = friendModel.create(newFriend);
        logger.info('SYSTEM', `好友创建成功，ID: ${friendId}`);
        
        // 5. 创建遥测服务器示例
        logger.info('SYSTEM', '=== 创建遥测服务器示例 ===');
        const newTelemetryServer = {
            server_id: `telemetry_${Date.now()}`,
            server_name: '主遥测服务器',
            server_address: 'telemetry.example.com',
            server_port: 443,
            protocol: 'HTTPS',
            enabled: 1
        };
        
        const telemetryServerId = telemetryServerModel.create(newTelemetryServer);
        logger.info('SYSTEM', `遥测服务器创建成功，ID: ${telemetryServerId}`);
        
        // 6. 创建辅助服务器示例
        logger.info('SYSTEM', '=== 创建辅助服务器示例 ===');
        const newAuxiliaryServer = {
            server_id: `aux_${Date.now()}`,
            server_name: '用户自定义服务器',
            server_address: 'custom.example.com',
            server_port: 8080,
            protocol: 'HTTP',
            description: '用于获取好友IP地址的辅助服务器',
            user_defined: 1,
            ddns_supported: 1,
            status: 'active'
        };
        
        const auxiliaryServerId = auxiliaryServerModel.create(newAuxiliaryServer);
        logger.info('SYSTEM', `辅助服务器创建成功，ID: ${auxiliaryServerId}`);
        
        // 7. 创建账号示例
        logger.info('SYSTEM', '=== 创建账号示例 ===');
        const newAccount = {
            account_id: `account_${Date.now()}`,
            username: 'cloud_user',
            password_hash: 'hashed_password_123',
            salt: 'random_salt_456',
            email: `cloud_${Date.now()}@example.com`,
            phone: '13800138000',
            status: 'active'
        };
        
        const accountId = accountModel.create(newAccount);
        logger.info('SYSTEM', `账号创建成功，ID: ${accountId}`);
        
        // 8. 查询辅助服务器示例
        logger.info('SYSTEM', '=== 查询辅助服务器示例 ===');
        const activeAuxServers = auxiliaryServerModel.find({
            where: { status: 'active', user_defined: 1 },
            orderBy: 'created_at DESC',
            limit: 10
        });
        logger.info('SYSTEM', `活跃的辅助服务器: ${JSON.stringify(activeAuxServers, null, 2)}`);
        
        // 9. 删除测试数据示例
        logger.info('SYSTEM', '=== 清理测试数据示例 ===');
        
        // 删除账号
        accountModel.delete({ id: accountId });
        logger.info('SYSTEM', '账号已删除');
        
        // 删除辅助服务器
        auxiliaryServerModel.delete({ id: auxiliaryServerId });
        logger.info('SYSTEM', '辅助服务器已删除');
        
        // 删除遥测服务器
        telemetryServerModel.delete({ id: telemetryServerId });
        logger.info('SYSTEM', '遥测服务器已删除');
        
        // 删除好友
        friendModel.delete({ friend_id: newFriend.friend_id });
        logger.info('SYSTEM', '好友已删除');
        
        // 删除用户
        userModel.delete({ id: userId });
        logger.info('SYSTEM', '用户已删除');
        
        // 关闭数据库连接
        db.close();
        
        logger.info('SYSTEM', '数据库管理库使用示例完成');
        
    } catch (error) {
        logger.error('SYSTEM', '示例运行失败', error);
        process.exit(1);
    }
}

// 运行示例
if (require.main === module) {
    exampleUsage();
}

module.exports = { exampleUsage };
