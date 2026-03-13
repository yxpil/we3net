/**
 * 用户信息管理模块
 * User Information Management Module
 * 用于读取、解析和管理 User.ini 文件中的用户信息
 * 
 * @author yxpil
 * @responsibility 负责用户信息的读取、解析和管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 用户信息管理核心模块，提供以下功能：
 * - User.ini 文件解析
 * - 用户信息读取和更新
 * - 用户配置管理
 * - 用户权限验证
 * - 用户偏好设置
 * - 用户数据加密
 * - 多用户支持
 * 
 * @usage
 * 通过 UserInfoManager 类实例化使用，提供统一的用户信息管理接口
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../Tools/Logs.js');

class UserInfoManager {
    constructor() {
        this.iniFilePath = path.join(__dirname, '../../Data/User.ini');
        this.userData = null;
        this.loadUserInfo();
    }

    /**
     * 加载用户信息
     */
    loadUserInfo() {
        try {
            if (!fs.existsSync(this.iniFilePath)) {
                logger.warn('USERINFO', 'User.ini 文件不存在，创建默认配置', null);
                this.createDefaultUserInfo();
                return;
            }

            const iniContent = fs.readFileSync(this.iniFilePath, 'utf-8');
            this.userData = this.parseIniFile(iniContent);
            logger.info('USERINFO', '用户信息加载成功', { nickname: this.userData.UserInfo?.Nickname });
        } catch (error) {
            logger.error('USERINFO', '加载用户信息失败', error);
            this.createDefaultUserInfo();
        }
    }

    /**
     * 创建默认用户信息
     */
    createDefaultUserInfo() {
        const defaultUserInfo = {
            UserInfo: {
                Nickname: '新用户',
                Gender: '未知',
                Age: '18',
                Birthday: '2000-01-01',
                BloodType: '未知',
                Zodiac: '水瓶座',
                Constellation: 'Aquarius',
                Element: '未知',
                Hobbies: '阅读,音乐,电影',
                FavoriteFoods: '中餐,西餐,日料',
                Personality: '这是一个新用户，还没有填写个人简介。',
                Tags: '新用户',
                Motto: '生活美好，未来可期',
                Location: '地球',
                Occupation: '学生',
                Email: 'user@example.com',
                Phone: '13800138000',
                Website: '',
                GitHub: '',
                WeChat: '',
                QQ: '',
                Avatar: '' // 头像Base64数据
            },
            Preferences: {
                Theme: 'light',
                Language: 'zh-CN',
                Timezone: 'Asia/Shanghai',
                Currency: 'CNY',
                UnitSystem: 'metric',
                DateFormat: 'YYYY-MM-DD',
                TimeFormat: '24h'
            },
            Privacy: {
                ShowAge: 'true',
                ShowBirthday: 'false',
                ShowLocation: 'true',
                ShowEmail: 'false',
                ShowPhone: 'false',
                AllowSearch: 'true',
                AllowFriendRequests: 'true'
            },
            Statistics: {
                LoginCount: '0',
                LastLogin: new Date().toISOString(),
                AccountCreated: new Date().toISOString(),
                ProfileViews: '0',
                FriendCount: '0',
                PostCount: '0',
                PhotoCount: '0'
            }
        };

        this.userData = defaultUserInfo;
        this.saveUserInfo();
    }

    /**
     * 解析 INI 文件内容
     */
    parseIniFile(content) {
        const result = {};
        let currentSection = null;

        const lines = content.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 跳过空行和注释
            if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('#')) {
                continue;
            }

            // 处理节标题 [Section]
            if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
                currentSection = trimmedLine.slice(1, -1);
                result[currentSection] = {};
                continue;
            }

            // 处理键值对 Key=Value
            const equalIndex = trimmedLine.indexOf('=');
            if (equalIndex !== -1 && currentSection) {
                const key = trimmedLine.slice(0, equalIndex).trim();
                const value = trimmedLine.slice(equalIndex + 1).trim();
                
                if (key && value !== undefined) {
                    result[currentSection][key] = value;
                }
            }
        }

        return result;
    }

    /**
     * 保存用户信息到文件
     */
    saveUserInfo() {
        try {
            const iniContent = this.generateIniContent(this.userData);
            
            // 确保目录存在
            const dir = path.dirname(this.iniFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.iniFilePath, iniContent, 'utf-8');
            logger.info('USERINFO', '用户信息保存成功', null);
        } catch (error) {
            logger.error('USERINFO', '保存用户信息失败', error);
            throw error;
        }
    }

    /**
     * 生成 INI 文件内容
     */
    generateIniContent(data) {
        let content = '';
        
        for (const [section, values] of Object.entries(data)) {
            content += `[${section}]\n`;
            
            for (const [key, value] of Object.entries(values)) {
                content += `${key}=${value}\n`;
            }
            
            content += '\n';
        }

        return content.trim();
    }

    /**
     * 获取用户信息
     */
    getUserInfo() {
        return this.userData;
    }

    /**
     * 更新用户信息
     */
    updateUserInfo(section, key, value) {
        if (!this.userData[section]) {
            this.userData[section] = {};
        }
        
        this.userData[section][key] = value;
        this.saveUserInfo();
        
        logger.info('USERINFO', '用户信息更新成功', { section, key });
    }

    /**
     * 批量更新用户信息
     */
    updateUserInfoBatch(updates) {
        for (const [section, values] of Object.entries(updates)) {
            if (!this.userData[section]) {
                this.userData[section] = {};
            }
            
            for (const [key, value] of Object.entries(values)) {
                this.userData[section][key] = value;
            }
        }
        
        this.saveUserInfo();
        logger.info('USERINFO', '用户信息批量更新成功', null);
    }

    /**
     * 获取用户基本信息（公开信息）
     */
    getPublicUserInfo() {
        if (!this.userData.UserInfo) return null;
        
        const userInfo = this.userData.UserInfo;
        const privacy = this.userData.Privacy || {};
        
        return {
            nickname: userInfo.Nickname,
            gender: privacy.ShowGender === 'true' ? userInfo.Gender : null,
            age: privacy.ShowAge === 'true' ? userInfo.Age : null,
            location: privacy.ShowLocation === 'true' ? userInfo.Location : null,
            occupation: privacy.ShowOccupation === 'true' ? userInfo.Occupation : null,
            avatar: userInfo.Avatar || '/Static/Images/icon.png',
            motto: userInfo.Motto,
            tags: userInfo.Tags,
            element: userInfo.Element,
            zodiac: userInfo.Zodiac,
            constellation: userInfo.Constellation
        };
    }

    /**
     * 更新用户头像
     */
    updateAvatar(base64Data) {
        if (!base64Data || typeof base64Data !== 'string') {
            throw new Error('头像数据格式错误');
        }

        // 验证base64格式
        if (!base64Data.startsWith('data:image/')) {
            throw new Error('头像必须是图片格式');
        }

        // 限制头像大小（最大2MB）
        const base64Length = base64Data.length;
        const fileSizeInBytes = Math.ceil(base64Length * 3 / 4) - (base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0);
        const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

        if (fileSizeInMB > 2) {
            throw new Error('头像文件过大，请上传小于2MB的图片');
        }

        this.userData.UserInfo.Avatar = base64Data;
        this.saveUserInfo();
        
        logger.info('USERINFO', '用户头像更新成功', { size: `${fileSizeInMB.toFixed(2)}MB` });
    }

    /**
     * 获取用户详细信息
     */
    getDetailedUserInfo() {
        return this.userData;
    }

    /**
     * 获取用户偏好设置
     */
    getUserPreferences() {
        return this.userData.Preferences || {};
    }

    /**
     * 获取用户隐私设置
     */
    getUserPrivacy() {
        return this.userData.Privacy || {};
    }

    /**
     * 获取用户统计信息
     */
    getUserStatistics() {
        return this.userData.Statistics || {};
    }

    /**
     * 更新登录统计
     */
    updateLoginStats() {
        if (!this.userData.Statistics) {
            this.userData.Statistics = {};
        }
        
        const stats = this.userData.Statistics;
        stats.LastLogin = new Date().toISOString();
        stats.LoginCount = String(parseInt(stats.LoginCount || '0') + 1);
        
        this.saveUserInfo();
    }

    /**
     * 增加资料浏览次数
     */
    incrementProfileViews() {
        if (!this.userData.Statistics) {
            this.userData.Statistics = {};
        }
        
        const stats = this.userData.Statistics;
        stats.ProfileViews = String(parseInt(stats.ProfileViews || '0') + 1);
        
        this.saveUserInfo();
    }
}

module.exports = UserInfoManager;