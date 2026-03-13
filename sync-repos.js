const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 自动同步脚本 - 国内优先，自动同步到本机并推送到国外仓库
 * 功能：
 * 1. 优先从国内仓库(Gitee)拉取最新代码
 * 2. 推送到国外仓库(GitHub)
 * 3. 支持手动运行或通过Git钩子自动触发
 */
class RepoSync {
    constructor() {
        this.rootDir = path.resolve(__dirname);
        this.gitConfig = {
            gitee: 'gitee',  // 国内仓库远程名
            github: 'origin' // 国外仓库远程名
        };
    }

    /**
     * 执行Git命令
     * @param {string} cmd Git命令
     * @param {boolean} silent 是否静默执行
     * @returns {string} 命令输出
     */
    executeGitCommand(cmd, silent = false) {
        if (!silent) {
            console.log(`🔧 执行Git命令: git ${cmd}`);
        }
        try {
            const result = execSync(`git ${cmd}`, {
                cwd: this.rootDir,
                encoding: 'utf8'
            });
            return result.trim();
        } catch (error) {
            console.error(`❌ Git命令执行失败: git ${cmd}`);
            console.error(`错误信息: ${error.stderr || error.message}`);
            throw error;
        }
    }

    /**
     * 检查Git仓库状态
     * @returns {boolean} 是否有未提交的更改
     */
    hasUncommittedChanges() {
        try {
            const status = this.executeGitCommand('status --porcelain', true);
            return status.length > 0;
        } catch (error) {
            console.error('❌ 检查仓库状态失败');
            return true; // 出错时假设存在未提交更改，避免强制覆盖
        }
    }

    /**
     * 检查远程仓库连接
     * @param {string} remoteName 远程仓库名
     * @returns {boolean} 连接是否正常
     */
    checkRemoteConnection(remoteName) {
        try {
            const remotes = this.executeGitCommand('remote -v', true);
            return remotes.toLowerCase().includes(remoteName.toLowerCase());
        } catch (error) {
            return false;
        }
    }

    /**
     * 从国内仓库拉取最新代码
     */
    pullFromGitee() {
        console.log('🇨🇳 正在从国内仓库(Gitee)拉取最新代码...');
        
        if (!this.checkRemoteConnection(this.gitConfig.gitee)) {
            console.error('❌ 国内仓库(Gitee)连接失败');
            throw new Error('Gitee仓库连接失败');
        }

        this.executeGitCommand(`pull ${this.gitConfig.gitee} main`);
        console.log('✅ 国内仓库代码拉取完成');
    }

    /**
     * 推送到国外仓库
     */
    pushToGithub() {
        console.log('🌍 正在推送到国外仓库(GitHub)...');
        
        if (!this.checkRemoteConnection(this.gitConfig.github)) {
            console.error('❌ 国外仓库(GitHub)连接失败');
            return;
        }

        this.executeGitCommand(`push ${this.gitConfig.github} main`);
        console.log('✅ 国外仓库代码推送完成');
    }

    /**
     * 自动同步主流程
     */
    sync() {
        console.log('🚀 开始自动同步仓库...');
        
        try {
            // 检查是否有未提交的更改
            if (this.hasUncommittedChanges()) {
                console.error('❌ 检测到未提交的更改，请先提交或保存更改');
                return;
            }

            // 1. 优先从国内仓库拉取
            this.pullFromGitee();

            // 2. 推送到国外仓库
            this.pushToGithub();

            console.log('🎉 自动同步完成！');
            return true;
        } catch (error) {
            console.error('💥 自动同步失败:', error.message);
            return false;
        }
    }

    /**
     * 安装Git钩子，实现自动触发
     */
    installGitHook() {
        console.log('🔗 正在安装Git钩子...');
        
        const hooksDir = path.join(this.rootDir, '.git', 'hooks');
        const postMergeHook = path.join(hooksDir, 'post-merge');
        
        // 确保钩子目录存在
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }
        
        // 创建post-merge钩子脚本
        const hookContent = `#!/bin/sh
# 自动同步钩子 - 从Gitee拉取后自动推送到GitHub
node "${path.resolve(__dirname, 'sync-repos.js')}"
`;
        
        fs.writeFileSync(postMergeHook, hookContent);
        
        // 设置执行权限
        try {
            fs.chmodSync(postMergeHook, '755');
            console.log('✅ Git钩子安装完成！');
            console.log('   现在当执行git pull时，会自动触发同步流程');
        } catch (error) {
            console.error('⚠️ 设置钩子执行权限失败，可能需要手动设置:', error.message);
            console.log('   请手动执行: chmod +x .git/hooks/post-merge');
        }
    }
}

// 主执行逻辑
const repoSync = new RepoSync();

// 处理命令行参数
const args = process.argv.slice(2);

if (args.includes('--install-hook')) {
    repoSync.installGitHook();
} else if (args.includes('--help')) {
    console.log('📘 自动同步脚本使用说明:');
    console.log('   node sync-repos.js               - 执行自动同步');
    console.log('   node sync-repos.js --install-hook - 安装Git钩子');
    console.log('   node sync-repos.js --help         - 显示帮助信息');
} else {
    repoSync.sync();
}
