/**
 * 主题管理器模块
 * 
 * @author yxpil
 * @responsibility 负责应用程序主题的管理和应用
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 主题管理核心模块，提供以下功能：
 * - 主题文件管理（保存、加载、删除）
 * - 主题配置解析
 * - 主题应用和切换
 * - 主题预览功能
 * - 主题版本管理
 * - 主题兼容性检查
 * - 默认主题管理
 * 
 * @usage
 * 通过 ThemeManager 类实例化使用，提供统一的主题管理接口
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../Tools/Logs.js');

/**
 * 主题管理器
 * 负责管理应用主题的保存、加载和应用
 */
class ThemeManager {
    constructor() {
        this.themesDir = path.join(__dirname, '../../Data/Theam');
        this.currentThemeFile = path.join(this.themesDir, 'current_theme.json');
        this.defaultTheme = {
            name: '默认主题',
            type: 'light',
            styles: {
                primaryColor: '#000000',
                secondaryColor: '#333333',
                backgroundColor: '#ffffff',
                textColor: '#333333',
                cardBackground: '#ffffff',
                borderColor: '#e0e0e0',
                shadowColor: 'rgba(0, 0, 0, 0.1)'
            },
            background: {
                type: 'none', // 'none', 'color', 'gradient', 'image'
                value: '',
                opacity: 1,
                blur: 0
            },
            customCSS: ''
        };
        this.currentTheme = this.defaultTheme;
        this.init();
    }

    /**
     * 初始化主题管理器
     */
    init() {
        // 确保主题目录存在
        if (!fs.existsSync(this.themesDir)) {
            fs.mkdirSync(this.themesDir, { recursive: true });
            logger.info('THEME', '创建主题目录', { path: this.themesDir });
        }

        // 加载当前主题
        this.loadCurrentTheme();
    }

    /**
     * 加载当前主题
     */
    loadCurrentTheme() {
        try {
            if (fs.existsSync(this.currentThemeFile)) {
                const themeData = fs.readFileSync(this.currentThemeFile, 'utf8');
                const loadedTheme = JSON.parse(themeData);
                
                // 合并默认主题，确保所有字段都存在
                this.currentTheme = this.mergeTheme(this.defaultTheme, loadedTheme);
                logger.info('THEME', '主题加载成功', { theme: this.currentTheme.name });
            } else {
                // 使用默认主题
                this.currentTheme = { ...this.defaultTheme };
                this.saveCurrentTheme();
                logger.info('THEME', '使用默认主题', null);
            }
        } catch (error) {
            logger.error('THEME', '主题加载失败', error);
            this.currentTheme = { ...this.defaultTheme };
        }
    }

    /**
     * 保存当前主题
     */
    saveCurrentTheme() {
        try {
            const themeData = JSON.stringify(this.currentTheme, null, 2);
            fs.writeFileSync(this.currentThemeFile, themeData, 'utf8');
            logger.info('THEME', '主题保存成功', { theme: this.currentTheme.name });
            return true;
        } catch (error) {
            logger.error('THEME', '主题保存失败', error);
            return false;
        }
    }

    /**
     * 获取当前主题
     */
    getCurrentTheme() {
        return { ...this.currentTheme };
    }

    /**
     * 更新主题
     */
    updateTheme(themeData) {
        try {
            // 验证主题数据
            if (!this.validateTheme(themeData)) {
                throw new Error('主题数据格式无效');
            }

            this.currentTheme = this.mergeTheme(this.defaultTheme, themeData);
            const saved = this.saveCurrentTheme();
            
            if (saved) {
                logger.info('THEME', '主题更新成功', { theme: this.currentTheme.name });
                return { success: true, message: '主题更新成功' };
            } else {
                throw new Error('主题保存失败');
            }
        } catch (error) {
            logger.error('THEME', '主题更新失败', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 获取主题CSS样式
     */
    getThemeCSS() {
        const theme = this.currentTheme;
        const styles = theme.styles;
        
        let css = `
            /* 主题样式 */
            :root {
                --primary-color: ${styles.primaryColor};
                --secondary-color: ${styles.secondaryColor};
                --background-color: ${styles.backgroundColor};
                --text-color: ${styles.textColor};
                --card-background: ${styles.cardBackground};
                --border-color: ${styles.borderColor};
                --shadow-color: ${styles.shadowColor};
            }
            
            body {
                background-color: var(--background-color) !important;
                color: var(--text-color) !important;
            }
            
            .window-header {
                background-color: var(--primary-color) !important;
            }
            
            .sidebar {
                background-color: var(--card-background) !important;
                border-color: var(--border-color) !important;
            }
            
            .sidebar h2 {
                color: var(--text-color) !important;
            }
            
            .nav-item {
                color: var(--text-color) !important;
                border-color: var(--border-color) !important;
            }
            
            .nav-item:hover {
                background-color: var(--secondary-color) !important;
                color: var(--background-color) !important;
            }
            
            .nav-item.active {
                background-color: var(--primary-color) !important;
                color: var(--background-color) !important;
            }
            
            .content-area {
                background-color: var(--background-color) !important;
            }
            
            .window-title h1 {
                color: var(--background-color) !important;
            }
            
            .window-btn {
                background-color: var(--background-color) !important;
                border-color: var(--border-color) !important;
            }
            
            .window-btn:hover {
                background-color: var(--secondary-color) !important;
            }
        `;

        // 添加背景样式
        if (theme.background.type !== 'none' && theme.background.value) {
            css += this.getBackgroundCSS(theme.background);
        }

        // 添加自定义CSS
        if (theme.customCSS) {
            css += `\n/* 自定义CSS */\n${theme.customCSS}`;
        }

        return css;
    }

    /**
     * 获取背景CSS样式
     */
    getBackgroundCSS(background) {
        let css = `
            /* 背景样式 */
            body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
        `;

        switch (background.type) {
            case 'color':
                css += `
                background-color: ${background.value};
                opacity: ${background.opacity};
                `;
                break;
            
            case 'gradient':
                css += `
                background: ${background.value};
                opacity: ${background.opacity};
                `;
                break;
            
            case 'image':
                css += `
                background-image: url(${background.value});
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                opacity: ${background.opacity};
                `;
                
                if (background.blur > 0) {
                    css += `
                filter: blur(${background.blur}px);
                    `;
                }
                break;
        }

        css += `
            }
            
            body {
                background-attachment: fixed;
            }
        `;

        return css;
    }

    /**
     * 验证主题数据
     */
    validateTheme(themeData) {
        if (!themeData || typeof themeData !== 'object') {
            return false;
        }

        // 检查必需的字段
        const requiredFields = ['name', 'type'];
        for (const field of requiredFields) {
            if (!themeData[field] || typeof themeData[field] !== 'string') {
                return false;
            }
        }

        // 检查样式字段（如果有的话）
        if (themeData.styles && typeof themeData.styles === 'object') {
            const styleFields = ['primaryColor', 'secondaryColor', 'backgroundColor', 'textColor'];
            for (const field of styleFields) {
                if (themeData.styles[field] && !this.isValidColor(themeData.styles[field])) {
                    return false;
                }
            }
        }

        // 检查背景字段（如果有的话）
        if (themeData.background && typeof themeData.background === 'object') {
            const background = themeData.background;
            if (background.type && !['none', 'color', 'gradient', 'image'].includes(background.type)) {
                return false;
            }
            if (background.opacity && (typeof background.opacity !== 'number' || background.opacity < 0 || background.opacity > 1)) {
                return false;
            }
            if (background.blur && (typeof background.blur !== 'number' || background.blur < 0)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 验证颜色值
     */
    isValidColor(color) {
        // 支持十六进制、rgb、rgba、hsl、hsla
        const colorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$|^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$|^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-9.]+\s*\)$|^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$|^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[0-9.]+\s*\)$/;
        return colorRegex.test(color);
    }

    /**
     * 合并主题（确保所有字段都存在）
     */
    mergeTheme(defaultTheme, customTheme) {
        const merged = { ...defaultTheme };
        
        // 合并基本字段
        if (customTheme.name) merged.name = customTheme.name;
        if (customTheme.type) merged.type = customTheme.type;
        
        // 合并样式
        if (customTheme.styles) {
            merged.styles = { ...defaultTheme.styles, ...customTheme.styles };
        }
        
        // 合并背景
        if (customTheme.background) {
            merged.background = { ...defaultTheme.background, ...customTheme.background };
        }
        
        // 合并自定义CSS
        if (customTheme.customCSS !== undefined) {
            merged.customCSS = customTheme.customCSS;
        }
        
        return merged;
    }

    /**
     * 获取所有保存的主题
     */
    getAllThemes() {
        try {
            const themes = [];
            
            // 读取主题目录下的所有JSON文件
            if (fs.existsSync(this.themesDir)) {
                const files = fs.readdirSync(this.themesDir);
                files.forEach(file => {
                    if (file.endsWith('.json') && file !== 'current_theme.json') {
                        try {
                            const filePath = path.join(this.themesDir, file);
                            const themeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            themes.push({
                                id: file.replace('.json', ''),
                                ...themeData
                            });
                        } catch (error) {
                            logger.error('THEME', `读取主题文件失败: ${file}`, error);
                        }
                    }
                });
            }
            
            return themes;
        } catch (error) {
            logger.error('THEME', '获取主题列表失败', error);
            return [];
        }
    }

    /**
     * 保存主题到文件
     */
    saveThemeToFile(themeId, themeData) {
        try {
            const filePath = path.join(this.themesDir, `${themeId}.json`);
            const dataToSave = { ...themeData };
            delete dataToSave.id; // 不保存ID字段
            
            fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
            logger.info('THEME', `主题保存到文件: ${themeId}`, null);
            return true;
        } catch (error) {
            logger.error('THEME', `主题保存到文件失败: ${themeId}`, error);
            return false;
        }
    }

    /**
     * 从文件加载主题
     */
    loadThemeFromFile(themeId) {
        try {
            const filePath = path.join(this.themesDir, `${themeId}.json`);
            if (fs.existsSync(filePath)) {
                const themeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return { id: themeId, ...themeData };
            }
            return null;
        } catch (error) {
            logger.error('THEME', `从文件加载主题失败: ${themeId}`, error);
            return null;
        }
    }

    /**
     * 删除主题文件
     */
    deleteThemeFile(themeId) {
        try {
            const filePath = path.join(this.themesDir, `${themeId}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info('THEME', `主题文件删除成功: ${themeId}`, null);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('THEME', `主题文件删除失败: ${themeId}`, error);
            return false;
        }
    }
}

module.exports = ThemeManager;