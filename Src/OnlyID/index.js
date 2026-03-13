const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SystemInfo = require('./system-info');

/**
 * OnlyID生成器
 * 根据主板型号和序列号生成唯一ID
 * 支持跨平台（Windows/macOS/Linux）
 */
class OnlyID {
    constructor() {
        this.cachePath = path.join(__dirname, '.onlyid-cache.json');
    }

    /**
     * 生成唯一ID
     * @param {Object} options 配置选项
     * @param {boolean} options.useCache 是否使用缓存（默认：true）
     * @param {string} options.hashAlgorithm 哈希算法（默认：'sha256'）
     * @returns {string} 生成的唯一ID
     */
    async generate(options = {}) {
        const { useCache = true, hashAlgorithm = 'sha256' } = options;

        // 获取当前设备的主板信息
        const currentMotherboardInfo = await SystemInfo.getMotherboardInfo();
        const { manufacturer, model, serialNumber } = currentMotherboardInfo;

        // 构建唯一ID的输入字符串
        const inputString = `${manufacturer}-${model}-${serialNumber}`;

        // 生成当前设备的唯一ID
        const hash = crypto.createHash(hashAlgorithm);
        hash.update(inputString);
        const currentId = hash.digest('hex');

        // 检查缓存
        if (useCache) {
            const cacheContent = this.getCacheContent();
            if (cacheContent) {
                // 验证缓存的硬件信息与当前硬件信息是否一致
                const { id: cachedId, motherboardInfo: cachedMotherboardInfo } = cacheContent;
                
                if (this.isMotherboardInfoSame(cachedMotherboardInfo, currentMotherboardInfo)) {
                    // 设备未更换，使用缓存的ID
                    return cachedId;
                } else {
                    // 设备已更换，清除旧缓存并生成新ID
                    this.clearCache();
                    console.log('检测到设备更换，已生成新的OnlyID');
                }
            }
        }

        // 缓存新的ID和硬件信息
        if (useCache) {
            this.cacheId(currentId, currentMotherboardInfo);
        }

        return currentId;
    }

    /**
     * 获取缓存的完整内容
     * @returns {Object|null} 缓存的完整内容或null
     */
    getCacheContent() {
        try {
            if (fs.existsSync(this.cachePath)) {
                const cacheContent = fs.readFileSync(this.cachePath, 'utf8');
                return JSON.parse(cacheContent);
            }
            return null;
        } catch (error) {
            console.error('读取OnlyID缓存失败:', error);
            return null;
        }
    }

    /**
     * 获取缓存的唯一ID
     * @returns {string|null} 缓存的ID或null
     */
    getCachedId() {
        const cacheContent = this.getCacheContent();
        return cacheContent?.id || null;
    }

    /**
     * 比较两个主板信息是否相同
     * @param {Object} info1 主板信息对象1
     * @param {Object} info2 主板信息对象2
     * @returns {boolean} 是否相同
     */
    isMotherboardInfoSame(info1, info2) {
        if (!info1 || !info2) return false;
        
        return (
            info1.manufacturer === info2.manufacturer &&
            info1.model === info2.model &&
            info1.serialNumber === info2.serialNumber
        );
    }

    /**
     * 缓存唯一ID和硬件信息
     * @param {string} id 要缓存的ID
     * @param {Object} motherboardInfo 主板信息对象
     */
    cacheId(id, motherboardInfo) {
        try {
            const cacheData = {
                id,
                motherboardInfo,
                generatedAt: new Date().toISOString()
            };
            fs.writeFileSync(this.cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
        } catch (error) {
            console.error('写入OnlyID缓存失败:', error);
        }
    }

    /**
     * 清除缓存的唯一ID
     */
    clearCache() {
        try {
            if (fs.existsSync(this.cachePath)) {
                fs.unlinkSync(this.cachePath);
            }
        } catch (error) {
            console.error('清除OnlyID缓存失败:', error);
        }
    }

    /**
     * 验证OnlyID的有效性
     * @param {string} id 要验证的ID
     * @returns {boolean} 是否有效
     */
    async validate(id) {
        try {
            const currentId = await this.generate({ useCache: true });
            return id === currentId;
        } catch (error) {
            console.error('验证OnlyID失败:', error);
            return false;
        }
    }

    /**
     * 获取详细的ID信息
     * @returns {Object} 包含ID和相关信息的对象
     */
    async getDetailedInfo() {
        const id = await this.generate();
        const systemInfo = SystemInfo.getSystemInfo();
        const motherboardInfo = await SystemInfo.getMotherboardInfo();

        return {
            onlyId: id,
            system: systemInfo,
            motherboard: motherboardInfo,
            cached: this.getCachedId() !== null
        };
    }
}

// 导出单例和类
const onlyIdGenerator = new OnlyID();

module.exports = {
    OnlyID,
    onlyId: onlyIdGenerator
};
