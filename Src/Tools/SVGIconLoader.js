/**
 * SVG图标加载器模块
 * 
 * @author yxpil
 * @responsibility 负责 SVG 图标文件的加载、缓存和转换
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * SVG 图标管理核心模块，提供以下功能：
 * - SVG 文件加载和解析
 * - SVG 图标缓存管理
 * - SVG 图标格式转换
 * - 图标尺寸调整
 * - 图标颜色修改
 * - 图标缓存优化
 * - 批量图标加载
 * 
 * @usage
 * 通过 SVGIconLoader 类实例化使用，提供统一的 SVG 图标管理接口
 */

const fs = require('fs');
const path = require('path');

class SVGIconLoader {
    constructor() {
        this.svgCache = new Map();
        this.svgPath = path.join(__dirname, '../../Static/Svgs/Controls');
    }

    /**
     * 读取SVG文件内容
     */
    async loadSVGFile(filename) {
        try {
            const filePath = path.join(this.svgPath, filename);
            if (this.svgCache.has(filename)) {
                return this.svgCache.get(filename);
            }

            const svgContent = fs.readFileSync(filePath, 'utf8');
            const whiteSvg = this.convertToWhite(svgContent);
            this.svgCache.set(filename, whiteSvg);
            return whiteSvg;
        } catch (error) {
            console.error(`加载SVG文件失败: ${filename}`, error);
            return this.getFallbackIcon();
        }
    }

    /**
     * 将SVG颜色转换为白色
     */
    convertToWhite(svgContent) {
        return svgContent.replace(/fill="#000000"/g, 'fill="#ffffff"')
                        .replace(/fill='black'/g, "fill='white'")
                        .replace(/fill:black/g, 'fill:white');
    }

    /**
     * 获取回退图标（当文件加载失败时）
     */
    getFallbackIcon() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#ffffff" stroke-width="2"/>
        </svg>`;
    }

    /**
     * 获取窗口控制图标
     */
    async getWindowControlIcons() {
        return {
            minimize: await this.loadSVGFile('minimize.svg'),
            maximize: await this.loadSVGFile('maximize.svg'),
            restore: await this.loadSVGFile('restore.svg'),
            close: await this.loadSVGFile('close.svg')
        };
    }

    /**
     * 直接获取图标内容（同步版本）
     */
    getIconSync(filename) {
        try {
            if (this.svgCache.has(filename)) {
                return this.svgCache.get(filename);
            }

            const filePath = path.join(this.svgPath, filename);
            const svgContent = fs.readFileSync(filePath, 'utf8');
            const whiteSvg = this.convertToWhite(svgContent);
            this.svgCache.set(filename, whiteSvg);
            return whiteSvg;
        } catch (error) {
            console.error(`同步加载SVG文件失败: ${filename}`, error);
            return this.getFallbackIcon();
        }
    }

    /**
     * 同步获取窗口控制图标
     */
    getWindowControlIconsSync() {
        return {
            minimize: this.getIconSync('minimize.svg'),
            maximize: this.getIconSync('maximize.svg'),
            restore: this.getIconSync('restore.svg'),
            close: this.getIconSync('close.svg')
        };
    }
}

// 创建全局实例
var svgIconLoader = new SVGIconLoader();

// 导出工具类
module.exports = { SVGIconLoader, svgIconLoader };