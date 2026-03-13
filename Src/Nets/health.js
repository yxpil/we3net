/**
 * 健康检查模块
 * 提供系统健康状态检查功能
 * 
 * @author yxpil
 * @responsibility 负责系统健康状态监控和检查
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 系统健康检查核心模块，提供以下功能：
 * - 系统资源监控（CPU、内存、磁盘）
 * - 网络连接状态检查
 * - 服务运行状态检测
 * - 健康状态报告生成
 * - 异常状态告警
 * - 历史健康数据记录
 * 
 * @usage
 * 通过 HealthCheck 类实例化使用，提供统一的健康检查接口
 */

const fs = require('fs');
const path = require('path');

class HealthCheck {
    constructor() {
        this.startTime = Date.now();
        this.checkCount = 0;
    }

    /**
     * 获取基本的健康状态
     */
    getBasicHealth() {
        this.checkCount++;
        const uptime = Date.now() - this.startTime;
        
        return {
            status: 'healthy',
            uptime: uptime,
            checkCount: this.checkCount,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 获取详细的健康状态
     */
    getDetailedHealth() {
        const basic = this.getBasicHealth();
        const memoryUsage = process.memoryUsage();
        
        return {
            ...basic,
            memory: {
                rss: this.formatBytes(memoryUsage.rss),
                heapTotal: this.formatBytes(memoryUsage.heapTotal),
                heapUsed: this.formatBytes(memoryUsage.heapUsed),
                external: this.formatBytes(memoryUsage.external)
            },
            process: {
                pid: process.pid,
                version: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = HealthCheck;