// DataBase/index.js - 统一的数据库管理库
// 包含FromLike解析和自动数据库管理功能

const sqlite = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { logger } = require('../Tools/Logs');

/**
 * FromLike格式解析器
 * 格式示例：
 * [table_name]
 * column1: type [constraints]
 * column2: type [constraints]
 */
class FromLikeParser {
    constructor() {
        this.logger = logger;
        this.logger.info('SYSTEM', 'FromLikeParser初始化完成');
    }
    
    /**
     * 解析FromLike文件
     * @param {string} filePath - FromLike文件路径
     * @returns {Object} - 解析后的表格定义
     */
    parseFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`FromLike文件不存在: ${filePath}`);
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            const result = this.parseContent(content);
            
            this.logger.info('SYSTEM', `FromLike文件解析成功: ${filePath}`);
            return result;
        } catch (error) {
            this.logger.error('SYSTEM', 'FromLike文件解析失败', error);
            throw error;
        }
    }
    
    /**
     * 解析FromLike内容
     * @param {string} content - FromLike格式的文本内容
     * @returns {Object} - 解析后的表格定义
     */
    parseContent(content) {
        const tables = {};
        let currentTable = null;
        
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 跳过空行和注释
            if (!line || line.startsWith('#')) {
                continue;
            }
            
            // 表格定义开始 [table_name]
            if (line.startsWith('[') && line.endsWith(']')) {
                currentTable = line.slice(1, -1).trim();
                tables[currentTable] = { columns: {}, indices: [] };
                this.logger.debug('SYSTEM', `开始解析表格: ${currentTable}`);
                continue;
            }
            
            // 列定义 column: type constraints
            if (currentTable && line.includes(':')) {
                const [columnPart, typePart] = line.split(':').map(part => part.trim());
                if (columnPart && typePart) {
                    // 处理索引定义 (INDEX 或 UNIQUE INDEX)
                    if (typePart.toUpperCase().startsWith('INDEX')) {
                        const indexMatch = typePart.match(/INDEX\s+(\w+)\s+ON\s+\(([^)]+)\)/i);
                        if (indexMatch) {
                            const indexName = indexMatch[1];
                            const columns = indexMatch[2].split(',').map(col => col.trim());
                            const isUnique = typePart.toUpperCase().startsWith('UNIQUE');
                            
                            tables[currentTable].indices.push({
                                name: indexName,
                                columns: columns,
                                unique: isUnique
                            });
                            
                            this.logger.debug('SYSTEM', 
                                `解析索引定义: ${indexName} ON ${currentTable} (${columns.join(', ')})`
                            );
                        } else {
                            this.logger.warn('SYSTEM', `无效的索引定义: ${line}`);
                        }
                    } else {
                        // 解析列约束
                        const columnDef = this._parseColumnDefinition(columnPart, typePart);
                        tables[currentTable].columns[columnDef.name] = columnDef.type;
                        
                        this.logger.debug('SYSTEM', 
                            `解析列定义: ${columnDef.name} ${columnDef.type}`
                        );
                    }
                } else {
                    this.logger.warn('SYSTEM', `无效的行格式: ${line}`);
                }
            }
        }
        
        this.logger.debug('SYSTEM', `FromLike内容解析完成，共${Object.keys(tables).length}个表格`);
        return tables;
    }
    
    /**
     * 解析列定义
     * @private
     * @param {string} columnName - 列名
     * @param {string} columnType - 列类型和约束
     * @returns {Object} - 解析后的列定义
     */
    _parseColumnDefinition(columnName, columnType) {
        // 简单的列解析，后续可以扩展更复杂的约束处理
        return {
            name: columnName,
            type: columnType
        };
    }
    
    /**
     * 从对象生成FromLike内容
     * @param {Object} tables - 表格定义对象
     * @returns {string} - FromLike格式的文本
     */
    generateContent(tables) {
        let content = '';
        
        for (const [tableName, tableDef] of Object.entries(tables)) {
            content += `[${tableName}]\n`;
            
            // 生成列定义
            for (const [columnName, columnType] of Object.entries(tableDef.columns)) {
                content += `${columnName}: ${columnType}\n`;
            }
            
            // 生成索引定义
            for (const index of tableDef.indices || []) {
                const indexType = index.unique ? 'UNIQUE INDEX' : 'INDEX';
                content += `${indexType} ${index.name} ON (${index.columns.join(', ')})\n`;
            }
            
            content += '\n';
        }
        
        return content;
    }
    
    /**
     * 保存表格定义到FromLike文件
     * @param {string} filePath - 文件路径
     * @param {Object} tables - 表格定义对象
     */
    saveFile(filePath, tables) {
        try {
            const content = this.generateContent(tables);
            fs.writeFileSync(filePath, content, 'utf8');
            this.logger.info('SYSTEM', `表格定义已保存到FromLike文件: ${filePath}`);
        } catch (error) {
            this.logger.error('SYSTEM', '保存FromLike文件失败', error);
            throw error;
        }
    }
}

/**
 * 自动数据库管理器
 * 支持从FromLike文件自动创建和更新表格
 */
class AutoDatabaseManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.fromLikePath - FromLike文件路径
     * @param {string} options.dbName - 数据库文件名
     * @param {string} options.dbPath - 数据库文件路径
     */
    constructor(options = {}) {
        this.fromLikePath = options.fromLikePath || path.join(__dirname, 'FromLike');
        this.dbName = options.dbName || 'app.db';
        this.dbPath = options.dbPath || path.join(__dirname, '../../Data');
        this.dbFile = path.join(this.dbPath, this.dbName);
        
        this.logger = logger;
        this.parser = new FromLikeParser();
        this.db = null;
        this.models = {};
        
        this.logger.info('SYSTEM', 'AutoDatabaseManager初始化完成');
        this._init();
    }
    
    /**
     * 初始化数据库
     * @private
     */
    _init() {
        try {
            // 确保数据库目录存在
            if (!fs.existsSync(this.dbPath)) {
                fs.mkdirSync(this.dbPath, { recursive: true });
                this.logger.info('SYSTEM', `创建数据库目录: ${this.dbPath}`);
            }
            
            // 连接数据库
            this.db = sqlite(this.dbFile);
            this.logger.info('SYSTEM', `数据库连接成功: ${this.dbFile}`);
            
            // 启用外键约束
            this.db.pragma('foreign_keys = ON');
            
            // 解析FromLike文件
            this.tables = this.parser.parseFile(this.fromLikePath);
            
            // 自动维护表格结构
            this._autoMaintainTables();
            
            // 初始化模型
            this._initModels();
            
        } catch (error) {
            this.logger.error('SYSTEM', '数据库初始化失败', error);
            throw error;
        }
    }
    
    /**
     * 自动维护表格结构
     * @private
     */
    _autoMaintainTables() {
        try {
            this.logger.info('SYSTEM', '开始自动维护表格结构');
            
            // 获取现有表格
            const existingTables = this._getExistingTables();
            
            for (const [tableName, tableDef] of Object.entries(this.tables)) {
                this.logger.debug('SYSTEM', `处理表格: ${tableName}`);
                
                if (existingTables.includes(tableName)) {
                    // 表格存在，检查结构差异
                    // 对于SQLite，我们只能添加新列，不能修改现有列的类型或约束
                    // 所以我们只检查需要添加的列
                    this._updateTable(tableName, tableDef);
                } else {
                    // 表格不存在，创建新表格
                    this._createTable(tableName, tableDef);
                }
            }
            
            this.logger.info('SYSTEM', '表格结构维护完成');
        } catch (error) {
            this.logger.error('SYSTEM', '自动维护表格结构失败', error);
            throw error;
        }
    }
    
    /**
     * 获取现有表格列表
     * @private
     * @returns {Array} - 表格名称数组
     */
    _getExistingTables() {
        const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
        const result = this.db.prepare(sql).all();
        return result.map(row => row.name);
    }
    
    /**
     * 获取表格的现有列信息
     * @private
     * @param {string} tableName - 表格名称
     * @returns {Object} - 列信息对象
     */
    _getExistingColumns(tableName) {
        const sql = `PRAGMA table_info(${tableName})`;
        const result = this.db.prepare(sql).all();
        const columns = {};
        
        result.forEach(column => {
            columns[column.name] = {
                type: column.type,
                notnull: column.notnull,
                dflt_value: column.dflt_value,
                pk: column.pk
            };
        });
        
        return columns;
    }
    
    /**
     * 创建新表格
     * @private
     * @param {string} tableName - 表格名称
     * @param {Object} tableDef - 表格定义
     */
    _createTable(tableName, tableDef) {
        try {
            // 构建CREATE TABLE语句
            let columnsSql = [];
            
            for (const [columnName, columnType] of Object.entries(tableDef.columns)) {
                columnsSql.push(`${columnName} ${columnType}`);
            }
            
            const sql = `CREATE TABLE ${tableName} (${columnsSql.join(', ')})`;
            this.db.prepare(sql).run();
            
            this.logger.info('SYSTEM', `表格创建成功: ${tableName}`);
            
            // 创建索引
            this._createIndices(tableName, tableDef.indices || []);
            
        } catch (error) {
            this.logger.error('SYSTEM', `创建表格失败: ${tableName}`, error);
            throw error;
        }
    }
    
    /**
     * 更新现有表格
     * @private
     * @param {string} tableName - 表格名称
     * @param {Object} tableDef - 表格定义
     */
    _updateTable(tableName, tableDef) {
        try {
            const existingColumns = this._getExistingColumns(tableName);
            
            // 检查需要添加的列
            for (const [columnName, columnType] of Object.entries(tableDef.columns)) {
                if (!existingColumns[columnName]) {
                    // 添加新列
                    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
                    this.db.prepare(sql).run();
                    this.logger.info('SYSTEM', `表格${tableName}添加列: ${columnName}`);
                } else {
                    // 检查列类型和约束是否一致
                    const existingType = existingColumns[columnName].type;
                    const existingConstraints = this._getColumnConstraints(existingColumns[columnName]);
                    const expectedConstraints = this._parseColumnConstraints(columnType);
                    
                    // 这里可以添加更复杂的类型和约束检查
                    // 由于SQLite的ALTER TABLE限制，我们可能需要重新创建表格来更改现有列
                    // 简化起见，我们只记录不匹配的情况
                    if (existingType !== expectedConstraints.type) {
                        this.logger.warn('SYSTEM', 
                            `表格${tableName}列${columnName}类型不匹配`, 
                            { expected: expectedConstraints.type, actual: existingType }
                        );
                    }
                }
            }
            
            // 创建索引
            this._createIndices(tableName, tableDef.indices || []);
            
        } catch (error) {
            this.logger.error('SYSTEM', `更新表格失败: ${tableName}`, error);
            throw error;
        }
    }
    
    /**
     * 获取列的约束信息
     * @private
     * @param {Object} columnInfo - 列信息对象
     * @returns {Object} - 约束信息
     */
    _getColumnConstraints(columnInfo) {
        const constraints = {
            type: columnInfo.type,
            notnull: columnInfo.notnull,
            default: columnInfo.dflt_value,
            primaryKey: columnInfo.pk
        };
        return constraints;
    }
    
    /**
     * 解析列类型和约束
     * @private
     * @param {string} columnDef - 列定义字符串
     * @returns {Object} - 解析后的列信息
     */
    _parseColumnConstraints(columnDef) {
        // 简单解析列类型和约束
        const parts = columnDef.split(/\s+/);
        const type = parts[0];
        const constraints = {
            type: type,
            notnull: parts.includes('NOT NULL') || parts.includes('NOTNULL'),
            unique: parts.includes('UNIQUE'),
            primaryKey: parts.includes('PRIMARY') && parts.includes('KEY')
        };
        
        // 解析默认值
        const defaultIndex = parts.indexOf('DEFAULT');
        if (defaultIndex !== -1 && parts.length > defaultIndex + 1) {
            constraints.default = parts.slice(defaultIndex + 1).join(' ');
        }
        
        return constraints;
    }
    
    /**
     * 创建索引
     * @private
     * @param {string} tableName - 表格名称
     * @param {Array} indices - 索引定义数组
     */
    _createIndices(tableName, indices) {
        try {
            // 获取现有索引
            const existingIndices = this._getExistingIndices(tableName);
            
            for (const index of indices) {
                if (!existingIndices.includes(index.name)) {
                    const indexType = index.unique ? 'UNIQUE INDEX' : 'INDEX';
                    const sql = `${indexType} ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
                    this.db.prepare(sql).run();
                    this.logger.info('SYSTEM', `表格${tableName}创建索引: ${index.name}`);
                }
            }
        } catch (error) {
            this.logger.error('SYSTEM', `创建索引失败: ${tableName}`, error);
            // 索引创建失败不中断程序
        }
    }
    
    /**
     * 获取现有索引
     * @private
     * @param {string} tableName - 表格名称
     * @returns {Array} - 索引名称数组
     */
    _getExistingIndices(tableName) {
        const sql = `PRAGMA index_list(${tableName})`;
        const result = this.db.prepare(sql).all();
        return result.map(index => index.name);
    }
    
    /**
     * 初始化模型
     * @private
     */
    _initModels() {
        for (const tableName of Object.keys(this.tables)) {
            this.models[tableName] = this._createModel(tableName);
        }
        this.logger.info('SYSTEM', `模型初始化完成，共${Object.keys(this.models).length}个模型`);
    }
    
    /**
     * 创建模型
     * @private
     * @param {string} tableName - 表格名称
     * @returns {Object} - 模型对象
     */
    _createModel(tableName) {
        const model = {
            tableName: tableName,
            dbManager: this,
            
            /**
             * 创建记录
             * @param {Object} data - 数据对象
             * @returns {number} - 插入的ID
             */
            create: function(data) {
                const columns = Object.keys(data);
                const placeholders = columns.map(() => '?').join(', ');
                const values = columns.map(col => data[col]);
                
                const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                const result = this.dbManager.db.prepare(sql).run(values);
                
                this.dbManager.logger.debug('SYSTEM', `插入记录到${this.tableName}`, { id: result.lastInsertRowid });
                return result.lastInsertRowid;
            },
            
            /**
             * 查询记录
             * @param {Object} options - 查询选项
             * @returns {Array|Object} - 查询结果
             */
            find: function(options = {}) {
                const where = options.where || {};
                const orderBy = options.orderBy || '';
                const limit = options.limit || 0;
                const offset = options.offset || 0;
                const single = options.single || false;
                
                let sql = `SELECT * FROM ${this.tableName}`;
                const params = [];
                
                // 构建WHERE子句
                if (Object.keys(where).length > 0) {
                    const whereClauses = [];
                    for (const [key, value] of Object.entries(where)) {
                        whereClauses.push(`${key} = ?`);
                        params.push(value);
                    }
                    sql += ` WHERE ${whereClauses.join(' AND ')}`;
                }
                
                // 构建ORDER BY子句
                if (orderBy) {
                    sql += ` ORDER BY ${orderBy}`;
                }
                
                // 构建LIMIT和OFFSET子句
                if (limit > 0) {
                    sql += ` LIMIT ${limit}`;
                    if (offset > 0) {
                        sql += ` OFFSET ${offset}`;
                    }
                }
                
                this.dbManager.logger.debug('SYSTEM', `查询${this.tableName}`, { sql, params });
                
                const stmt = this.dbManager.db.prepare(sql);
                return single ? stmt.get(params) : stmt.all(params);
            },
            
            /**
             * 更新记录
             * @param {Object} data - 数据对象
             * @param {Object} where - 条件对象
             * @returns {number} - 影响的行数
             */
            update: function(data, where) {
                const setClauses = Object.keys(data).map(key => `${key} = ?`);
                const whereClauses = Object.keys(where).map(key => `${key} = ?`);
                
                const sql = `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
                const params = [...Object.values(data), ...Object.values(where)];
                
                const result = this.dbManager.db.prepare(sql).run(params);
                this.dbManager.logger.debug('SYSTEM', `更新${this.tableName}记录`, { affectedRows: result.changes });
                return result.changes;
            },
            
            /**
             * 删除记录
             * @param {Object} where - 条件对象
             * @returns {number} - 影响的行数
             */
            delete: function(where) {
                const whereClauses = Object.keys(where).map(key => `${key} = ?`);
                const sql = `DELETE FROM ${this.tableName} WHERE ${whereClauses.join(' AND ')}`;
                const params = Object.values(where);
                
                const result = this.dbManager.db.prepare(sql).run(params);
                this.dbManager.logger.debug('SYSTEM', `删除${this.tableName}记录`, { affectedRows: result.changes });
                return result.changes;
            }
        };
        
        return model;
    }
    
    /**
     * 获取模型
     * @param {string} tableName - 表格名称
     * @returns {Object} - 模型对象
     */
    model(tableName) {
        if (!this.models[tableName]) {
            throw new Error(`模型不存在: ${tableName}`);
        }
        return this.models[tableName];
    }
    
    /**
     * 关闭数据库连接
     */
    close() {
        if (this.db) {
            this.db.close();
            this.logger.info('SYSTEM', '数据库连接已关闭');
        }
    }
    
    /**
     * 重新加载FromLike文件并更新表格
     */
    reload() {
        this.logger.info('SYSTEM', '重新加载FromLike文件并更新表格');
        this.tables = this.parser.parseFile(this.fromLikePath);
        this._autoMaintainTables();
        this._initModels();
    }
}

/**
 * 创建自动数据库实例
 * @param {Object} options - 配置选项
 * @param {string} options.fromLikePath - FromLike文件路径
 * @param {string} options.dbName - 数据库文件名
 * @param {string} options.dbPath - 数据库文件路径
 * @returns {AutoDatabaseManager} - 数据库管理器实例
 */
function createDatabase(options = {}) {
    return new AutoDatabaseManager(options);
}

/**
 * 解析FromLike文件
 * @param {string} filePath - FromLike文件路径
 * @returns {Object} - 解析后的表格定义
 */
function parseFromLike(filePath) {
    const parser = new FromLikeParser();
    return parser.parseFile(filePath);
}

/**
 * 从对象生成FromLike内容
 * @param {Object} tables - 表格定义对象
 * @returns {string} - FromLike格式的文本
 */
function generateFromLike(tables) {
    const parser = new FromLikeParser();
    return parser.generateContent(tables);
}

/**
 * 保存表格定义到FromLike文件
 * @param {string} filePath - 文件路径
 * @param {Object} tables - 表格定义对象
 */
function saveFromLike(filePath, tables) {
    const parser = new FromLikeParser();
    parser.saveFile(filePath, tables);
}

// 导出模块
module.exports = {
    createDatabase,
    parseFromLike,
    generateFromLike,
    saveFromLike,
    AutoDatabaseManager,
    FromLikeParser
};

// 示例用法（仅在直接运行时执行）
if (require.main === module) {
    try {
        logger.info('SYSTEM', '数据库管理库示例运行');
        
        // 创建数据库实例
        const db = createDatabase();
        
        // 获取用户模型
        const userModel = db.model('users');
        const friendModel = db.model('friends');
        const messageModel = db.model('messages');
        
        // 创建用户
        logger.info('SYSTEM', '创建测试用户');
        const userId = userModel.create({
            user_id: `user_${Date.now()}`,
            username: 'test_user',
            password: 'password123',
            email: `test_${Date.now()}@example.com`
        });
        logger.info('SYSTEM', `用户创建成功，ID: ${userId}`);
        
        // 查询用户
        logger.info('SYSTEM', '查询测试用户');
        const user = userModel.find({ where: { id: userId }, single: true });
        logger.info('SYSTEM', '查询到用户:', user);
        
        // 创建好友
        logger.info('SYSTEM', '创建测试好友');
        const friendId = friendModel.create({
            friend_id: `friend_${Date.now()}`,
            user_id: user.user_id,
            friend_name: '测试好友',
            friend_ipv4: '192.168.1.100',
            friend_ipv6: '2001:db8::1',
            friend_avatar: 'base64_avatar_data',
            status: 'online'
        });
        logger.info('SYSTEM', `好友创建成功，ID: ${friendId}`);
        
        // 创建消息
        logger.info('SYSTEM', '创建测试消息');
        const messageId = messageModel.create({
            message_id: `msg_${Date.now()}`,
            sender_id: user.user_id,
            receiver_id: `friend_${Date.now()}`,
            content: '这是一条测试消息',
            type: 'text',
            status: 'sent'
        });
        logger.info('SYSTEM', `消息创建成功，ID: ${messageId}`);
        
        // 查询所有好友
        logger.info('SYSTEM', '查询所有好友');
        const friends = friendModel.find();
        logger.info('SYSTEM', `共有${friends.length}个好友`, friends);
        
        // 关闭数据库连接
        db.close();
        logger.info('SYSTEM', '数据库管理库示例运行完成');
        
    } catch (error) {
        logger.error('SYSTEM', '数据库管理库示例运行失败', error);
        process.exit(1);
    }
}