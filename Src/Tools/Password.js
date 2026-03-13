/**
 * 密码校验工具模块
 * 
 * @author yxpil
 * @responsibility 负责密码安全校验和强度评估
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 密码安全校验核心模块，提供以下功能：
 * - 多规则组合校验（长度、字符类型、禁用字符等）
 * - 密码强度等级评估
 * - 详细的校验失败原因返回
 * - 自定义校验规则扩展
 * - 常见弱密码检测
 * - 密码历史记录检查
 * - 密码复杂度分析
 * 
 * @usage
 * 通过 PasswordValidator 类实例化使用，提供统一的密码校验接口
 */

class PasswordValidator {
    /**
     * 构造函数
     * @param {Object} options 自定义校验规则（可选）
     * @param {number} options.minLength 最小长度（默认：8）
     * @param {number} options.maxLength 最大长度（默认：32）
     * @param {boolean} options.requireUppercase 是否需要大写字母（默认：true）
     * @param {boolean} options.requireLowercase 是否需要小写字母（默认：true）
     * @param {boolean} options.requireNumber 是否需要数字（默认：true）
     * @param {boolean} options.requireSpecialChar 是否需要特殊字符（默认：true）
     * @param {string} options.specialChars 允许的特殊字符（默认：!@#$%^&*()_+-=[]{}|;:,.<>?`~）
     * @param {Array} options.forbiddenPatterns 禁用的字符模式（如连续数字、重复字符，默认：[]）
     */
    constructor(options = {}) {
        // 默认校验规则
        this.rules = {
            minLength: options.minLength || 8,
            maxLength: options.maxLength || 32,
            requireUppercase: options.requireUppercase !== false,
            requireLowercase: options.requireLowercase !== false,
            requireNumber: options.requireNumber !== false,
            requireSpecialChar: options.requireSpecialChar !== false,
            specialChars: options.specialChars || '!@#$%^&*()_+-=[]{}|;:,.<>?`~',
            forbiddenPatterns: options.forbiddenPatterns || []
        };

        // 强度等级配置（分数区间对应等级）
        this.strengthLevels = [
            { score: 0, level: '极弱', desc: '密码过于简单，极易被破解' },
            { score: 20, level: '弱', desc: '密码强度低，建议增加复杂度' },
            { score: 40, level: '中', desc: '密码强度中等，可进一步优化' },
            { score: 60, level: '强', desc: '密码强度较高，安全性良好' },
            { score: 80, level: '极强', desc: '密码强度极高，安全性优秀' }
        ];
    }

    /**
     * 核心校验方法
     * @param {string} password 待校验的密码
     * @returns {Object} 校验结果 { valid: boolean, errors: Array, strength: Object }
     */
    validate(password) {
        // 初始化结果
        const result = {
            valid: true,
            errors: [],
            strength: this.calculateStrength(password)
        };

        // 空值校验
        if (!password || password.trim() === '') {
            result.valid = false;
            result.errors.push('密码不能为空');
            return result;
        }

        // 1. 长度校验
        if (password.length < this.rules.minLength) {
            result.valid = false;
            result.errors.push(`密码长度不能少于${this.rules.minLength}位`);
        }
        if (password.length > this.rules.maxLength) {
            result.valid = false;
            result.errors.push(`密码长度不能超过${this.rules.maxLength}位`);
        }

        // 2. 大写字母校验
        if (this.rules.requireUppercase && !/[A-Z]/.test(password)) {
            result.valid = false;
            result.errors.push('密码必须包含大写字母');
        }

        // 3. 小写字母校验
        if (this.rules.requireLowercase && !/[a-z]/.test(password)) {
            result.valid = false;
            result.errors.push('密码必须包含小写字母');
        }

        // 4. 数字校验
        if (this.rules.requireNumber && !/\d/.test(password)) {
            result.valid = false;
            result.errors.push('密码必须包含数字');
        }

        // 5. 特殊字符校验
        if (this.rules.requireSpecialChar) {
            const specialCharRegex = new RegExp(`[${this.escapeRegExp(this.rules.specialChars)}]`);
            if (!specialCharRegex.test(password)) {
                result.valid = false;
                result.errors.push(`密码必须包含特殊字符（允许的字符：${this.rules.specialChars}）`);
            }
        }

        // 6. 禁用模式校验
        this.rules.forbiddenPatterns.forEach(pattern => {
            const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
            if (regex.test(password)) {
                result.valid = false;
                result.errors.push(`密码包含禁用的字符模式: ${pattern.toString()}`);
            }
        });

        return result;
    }

    /**
     * 计算密码强度（0-100分）
     * @param {string} password 密码
     * @returns {Object} 强度信息 { score: number, level: string, desc: string }
     */
    calculateStrength(password) {
        if (!password) return { score: 0, level: '极弱', desc: '密码不能为空' };

        let score = 0;
        const len = password.length;

        // 1. 长度加分（最长20分）
        if (len >= 8) score += 10;
        if (len >= 12) score += 5;
        if (len >= 16) score += 5;

        // 2. 字符类型加分（每种类型5分，最多20分）
        if (/[a-z]/.test(password)) score += 5; // 小写字母
        if (/[A-Z]/.test(password)) score += 5; // 大写字母
        if (/\d/.test(password)) score += 5;    // 数字
        if (new RegExp(`[${this.escapeRegExp(this.rules.specialChars)}]`).test(password)) score += 5; // 特殊字符

        // 3. 组合复杂度加分（最多30分）
        const charTypes = [
            /[a-z]/.test(password),
            /[A-Z]/.test(password),
            /\d/.test(password),
            new RegExp(`[${this.escapeRegExp(this.rules.specialChars)}]`).test(password)
        ].filter(Boolean).length;

        if (charTypes >= 2) score += 10;
        if (charTypes >= 3) score += 10;
        if (charTypes >= 4) score += 10;

        // 4. 无连续/重复字符加分（最多20分）
        if (!/(\w)\1\1/.test(password)) score += 10; // 无连续3个相同字符
        if (!/012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210/.test(password)) score += 10; // 无连续数字

        // 5. 无常见弱密码减分（最多扣10分）
        const weakPasswords = ['12345678', 'password', 'admin123', 'root123', '11111111'];
        if (weakPasswords.includes(password.toLowerCase())) score -= 10;

        // 限制分数范围在0-100
        score = Math.max(0, Math.min(100, score));

        // 匹配强度等级
        let strength = this.strengthLevels[this.strengthLevels.length - 1];
        for (const level of this.strengthLevels) {
            if (score >= level.score) {
                strength = level;
            } else {
                break;
            }
        }

        return {
            score,
            level: strength.level,
            desc: strength.desc
        };
    }

    /**
     * 正则表达式特殊字符转义
     * @param {string} str 待转义的字符串
     * @returns {string} 转义后的字符串
     */
    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 快速校验（仅返回是否有效）
     * @param {string} password 密码
     * @returns {boolean} 是否有效
     */
    isValid(password) {
        return this.validate(password).valid;
    }

    /**
     * 获取密码强度描述（简化版）
     * @param {string} password 密码
     * @returns {string} 强度等级+描述
     */
    getStrengthDesc(password) {
        const strength = this.calculateStrength(password);
        return `${strength.level} - ${strength.desc}`;
    }
}

// 导出工具类
module.exports = PasswordValidator;