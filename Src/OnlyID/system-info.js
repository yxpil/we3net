const { execSync } = require('child_process');
const os = require('os');

/**
 * 系统信息获取工具
 * 用于获取主板型号和序列号等硬件信息
 */
class SystemInfo {
    /**
     * 获取主板信息（型号和序列号）
     * @returns {Object} 包含型号和序列号的对象
     */
    static async getMotherboardInfo() {
        if (os.platform() === 'win32') {
            return this.getMotherboardInfoWindows();
        } else if (os.platform() === 'darwin') {
            return this.getMotherboardInfoMac();
        } else if (os.platform() === 'linux') {
            return this.getMotherboardInfoLinux();
        } else {
            throw new Error(`不支持的操作系统: ${os.platform()}`);
        }
    }

    /**
     * 获取Windows系统的主板信息
     * @returns {Object} 包含型号和序列号的对象
     */
    static getMotherboardInfoWindows() {
        try {
            // 使用wmic命令获取主板信息
            const manufacturer = execSync('wmic baseboard get manufacturer', { encoding: 'utf8' }).split('\n')[1]?.trim() || '';
            const model = execSync('wmic baseboard get product', { encoding: 'utf8' }).split('\n')[1]?.trim() || '';
            const serialNumber = execSync('wmic baseboard get serialnumber', { encoding: 'utf8' }).split('\n')[1]?.trim() || '';

            return {
                manufacturer,
                model,
                serialNumber
            };
        } catch (error) {
            console.error('获取Windows主板信息失败:', error);
            return {
                manufacturer: 'Unknown',
                model: 'Unknown',
                serialNumber: 'Unknown'
            };
        }
    }

    /**
     * 获取macOS系统的主板信息
     * @returns {Object} 包含型号和序列号的对象
     */
    static getMotherboardInfoMac() {
        try {
            // 使用system_profiler命令获取主板信息
            const systemProfile = execSync('system_profiler SPHardwareDataType', { encoding: 'utf8' });
            const manufacturer = 'Apple';
            const model = systemProfile.match(/Model Name: (.+)/)?.[1]?.trim() || 'Unknown';
            const serialNumber = systemProfile.match(/Serial Number \(system\): (.+)/)?.[1]?.trim() || 'Unknown';

            return {
                manufacturer,
                model,
                serialNumber
            };
        } catch (error) {
            console.error('获取macOS主板信息失败:', error);
            return {
                manufacturer: 'Apple',
                model: 'Unknown',
                serialNumber: 'Unknown'
            };
        }
    }

    /**
     * 获取Linux系统的主板信息
     * @returns {Object} 包含型号和序列号的对象
     */
    static getMotherboardInfoLinux() {
        try {
            // 使用dmidecode命令获取主板信息
            const manufacturer = execSync('sudo dmidecode -t baseboard | grep Manufacturer', { encoding: 'utf8' }).split(':')[1]?.trim() || 'Unknown';
            const model = execSync('sudo dmidecode -t baseboard | grep Product', { encoding: 'utf8' }).split(':')[1]?.trim() || 'Unknown';
            const serialNumber = execSync('sudo dmidecode -t baseboard | grep Serial', { encoding: 'utf8' }).split(':')[1]?.trim() || 'Unknown';

            return {
                manufacturer,
                model,
                serialNumber
            };
        } catch (error) {
            console.error('获取Linux主板信息失败:', error);
            return {
                manufacturer: 'Unknown',
                model: 'Unknown',
                serialNumber: 'Unknown'
            };
        }
    }

    /**
     * 获取系统基本信息
     * @returns {Object} 系统信息对象
     */
    static getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem()
        };
    }
}

module.exports = SystemInfo;
