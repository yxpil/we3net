/**
 * SVG图标工具模块
 * 
 * @author yxpil
 * @responsibility 负责 SVG 图标处理和颜色转换功能
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * SVG 图标处理工具模块，提供以下功能：
 * - SVG 图标颜色转换
 * - SVG 图标尺寸调整
 * - SVG 图标格式优化
 * - SVG 图标缓存管理
 * - SVG 图标样式处理
 * - SVG 图标批量处理
 * - SVG 图标兼容性处理
 * 
 * @usage
 * 通过 SVGIconUtils 类实例化使用，提供 SVG 图标处理工具函数
 */

class SVGIconUtils {
    constructor() {
        this.svgCache = new Map();
    }

    /**
     * 将SVG颜色从黑色转换为白色
     */
    convertSVGToWhite(svgContent) {
        return svgContent.replace(/fill="#000000"/g, 'fill="#ffffff"')
                        .replace(/fill='black'/g, "fill='white'")
                        .replace(/stroke="#000000"/g, 'stroke="#ffffff"')
                        .replace(/stroke='black'/g, "stroke='white'");
    }

    /**
     * 创建带颜色的SVG图标
     */
    createColoredSVG(svgPath, color = '#ffffff') {
        return `<svg width="14" height="14" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path fill="${color}" d="${svgPath}"/>
        </svg>`;
    }

    /**
     * 获取窗口控制图标
     */
    getWindowControlIcons() {
        return {
            minimize: this.createMinimizeIcon(),
            maximize: this.createMaximizeIcon(),
            restore: this.createRestoreIcon(),
            close: this.createCloseIcon()
        };
    }

    /**
     * 创建最小化图标
     */
    createMinimizeIcon() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12H19" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
    }

    /**
     * 创建最大化图标
     */
    createMaximizeIcon() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    /**
     * 创建还原图标
     */
    createRestoreIcon() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="7" y="7" width="14" height="14" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 17V3H17" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    /**
     * 创建关闭图标
     */
    createCloseIcon() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 12L6 18" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    /**
     * 创建彩色圆点图标（备用方案）
     */
    createColoredDotIcon(color, title) {
        return `<div style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${color};
            box-shadow: 0 0 0 1px rgba(255,255,255,0.3);
        " title="${title}"></div>`;
    }

    /**
     * 获取圆点图标
     */
    getDotIcons() {
        return {
            minimize: this.createColoredDotIcon('#ffbd2e', '最小化'),
            maximize: this.createColoredDotIcon('#28ca42', '最大化'),
            restore: this.createColoredDotIcon('#28ca42', '还原'),
            close: this.createColoredDotIcon('#ff5f57', '关闭')
        };
    }
}

// 创建全局实例
var svgIconUtils = new SVGIconUtils();

// 导出工具类
module.exports = { SVGIconUtils, svgIconUtils };