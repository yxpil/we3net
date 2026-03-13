/**
 * 主页面功能组件
 * 包含密码验证、日志显示、系统状态等核心功能
 * 适配现代化黑白圆角药丸风格设计
 */

// 密码测试功能
async function testPassword() {
    const password = document.getElementById('passwordInput').value;
    const resultDiv = document.getElementById('passwordResult');
    
    if (!password) {
        showResult('passwordResult', '请输入密码进行测试', 'warning');
        return;
    }

    try {
        // 模拟密码验证（实际使用时替换为真实的API调用）
        const result = await simulatePasswordValidation(password);
        
        if (result.valid) {
            const strengthInfo = result.strength;
            showResult('passwordResult', 
                `<div class="password-result">
                    <div class="result-icon">✅</div>
                    <div class="result-content">
                        <div class="result-title">密码验证通过</div>
                        <div class="result-details">
                            <div class="strength-level">强度等级: ${strengthInfo.level}</div>
                            <div class="strength-score">评分: ${strengthInfo.score}/100</div>
                            <div class="strength-desc">${strengthInfo.desc}</div>
                        </div>
                    </div>
                </div>`, 
                'success'
            );
        } else {
            const errors = result.errors.join('<br>• ');
            showResult('passwordResult', 
                `<div class="password-result">
                    <div class="result-icon">❌</div>
                    <div class="result-content">
                        <div class="result-title">密码验证失败</div>
                        <div class="result-errors">
                            <div class="error-list">${errors}</div>
                        </div>
                    </div>
                </div>`, 
                'error'
            );
        }
    } catch (error) {
        showResult('passwordResult', 
            `<div class="password-result">
                <div class="result-icon">⚠️</div>
                <div class="result-content">
                    <div class="result-title">验证出错</div>
                    <div class="result-error">${error.message}</div>
                </div>
            </div>`, 
            'error'
        );
    }
}

// 模拟密码验证函数（实际使用时替换为真实的API调用）
async function simulatePasswordValidation(password) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const errors = [];
            let score = 0;
            
            // 长度检查
            if (password.length < 8) {
                errors.push('密码长度至少需要8个字符');
            } else {
                score += 20;
            }
            
            // 复杂度检查
            if (!/[a-z]/.test(password)) {
                errors.push('需要包含小写字母');
            } else {
                score += 15;
            }
            
            if (!/[A-Z]/.test(password)) {
                errors.push('需要包含大写字母');
            } else {
                score += 15;
            }
            
            if (!/\d/.test(password)) {
                errors.push('需要包含数字');
            } else {
                score += 15;
            }
            
            if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                errors.push('需要包含特殊字符');
            } else {
                score += 15;
            }
            
            // 常见密码检查
            const commonPasswords = ['123456', 'password', '12345678', 'qwerty', 'abc123'];
            if (commonPasswords.includes(password.toLowerCase())) {
                errors.push('密码过于常见，不够安全');
            } else {
                score += 20;
            }
            
            let level, desc;
            if (score >= 80) {
                level = '强';
                desc = '密码强度很好，安全性高';
            } else if (score >= 60) {
                level = '中等';
                desc = '密码强度一般，建议增强';
            } else if (score >= 40) {
                level = '弱';
                desc = '密码强度较弱，需要改进';
            } else {
                level = '很弱';
                desc = '密码强度严重不足';
            }
            
            resolve({
                valid: errors.length === 0,
                strength: { level, score, desc },
                errors
            });
        }, 500);
    });
}

// 快速密码测试
async function testQuickPassword(password) {
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.value = password;
        passwordInput.focus();
    }
    await testPassword();
}

// 显示日志功能
async function showLogs(level) {
    const resultDiv = document.getElementById('logResult');
    if (!resultDiv) return;

    try {
        // 模拟日志获取（实际使用时替换为真实的API调用）
        const logs = await simulateLogGeneration(level);
        
        if (logs.length > 0) {
            resultDiv.innerHTML = logs.join('\n');
            resultDiv.style.display = 'block';
            resultDiv.scrollTop = resultDiv.scrollHeight;
            
            // 显示成功提示
            if (window.navigation) {
                window.navigation.showNotification(`已获取 ${level} 级别日志`, 'success');
            }
        } else {
            resultDiv.innerHTML = '暂无日志数据';
            resultDiv.style.display = 'block';
        }
    } catch (error) {
        resultDiv.innerHTML = `获取日志出错: ${error.message}`;
        resultDiv.style.display = 'block';
        
        if (window.navigation) {
            window.navigation.showNotification('获取日志失败', 'error');
        }
    }
}

// 模拟日志生成函数
async function simulateLogGeneration(level) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const timestamp = new Date().toLocaleTimeString('zh-CN');
            const logTemplates = {
                'INFO': [
                    `[${timestamp}] [INFO] 系统启动成功`,
                    `[${timestamp}] [INFO] 密码验证模块已加载`,
                    `[${timestamp}] [INFO] 侧边栏导航初始化完成`,
                    `[${timestamp}] [INFO] 系统时间同步成功`,
                    `[${timestamp}] [INFO] 所有模块加载完成`
                ],
                'WARN': [
                    `[${timestamp}] [WARN] 检测到内存使用率较高 (85%)`,
                    `[${timestamp}] [WARN] 网络连接不稳定`,
                    `[${timestamp}] [WARN] 某些功能可能需要更新`,
                    `[${timestamp}] [WARN] 磁盘空间不足 (剩余 2GB)`
                ],
                'ERROR': [
                    `[${timestamp}] [ERROR] 无法加载某些组件`,
                    `[${timestamp}] [ERROR] 网络请求超时 (30s)`,
                    `[${timestamp}] [ERROR] 文件读取失败: 权限不足`,
                    `[${timestamp}] [ERROR] 数据库连接失败`
                ],
                'DEBUG': [
                    `[${timestamp}] [DEBUG] 当前页面: ${window.navigation ? window.navigation.currentPage : 'unknown'}`,
                    `[${timestamp}] [DEBUG] 导航项数量: ${document.querySelectorAll('.pill-nav-item').length}`,
                    `[${timestamp}] [DEBUG] 页面数量: ${document.querySelectorAll('.page').length}`,
                    `[${timestamp}] [DEBUG] 系统信息已加载`,
                    `[${timestamp}] [DEBUG] 内存使用: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
                ]
            };

            resolve(logTemplates[level] || logTemplates['INFO']);
        }, 300);
    });
}

// 显示结果函数（适配药丸风格）
function showResult(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // 清除之前的样式
    element.className = 'result-container';
    
    // 添加结果类型样式
    const typeClass = `result-${type}`;
    element.classList.add(typeClass);
    
    // 设置内容
    element.innerHTML = message;
    element.style.display = 'block';
    
    // 添加淡入动画
    element.style.opacity = '0';
    element.style.transform = 'translateY(10px)';
    
    requestAnimationFrame(() => {
        element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    });
}

// 显示版本信息
function displayVersionInfo() {
    try {
        if (window.process && window.process.versions) {
            const versions = window.process.versions;
            
            const electronElement = document.getElementById('electronVersion');
            const nodeElement = document.getElementById('nodeVersion');
            const chromeElement = document.getElementById('chromeVersion');
            
            if (electronElement) electronElement.textContent = versions.electron || '未知';
            if (nodeElement) nodeElement.textContent = versions.node || '未知';
            if (chromeElement) chromeElement.textContent = versions.chrome || '未知';
        }
    } catch (error) {
        console.warn('无法获取版本信息:', error);
    }
}

// 回车键支持
document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                testPassword();
            }
        });
    }
    
    // 显示版本信息
    displayVersionInfo();
    
    // 添加页面加载动画
    document.body.classList.add('pill-fade-in');
});

// 添加CSS样式
const additionalStyles = `
    .result-container {
        margin-top: 16px;
        padding: 20px;
        border-radius: 16px;
        border: 2px solid;
        background: #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    
    .result-success {
        border-color: #16a34a;
        background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
    }
    
    .result-error {
        border-color: #dc2626;
        background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
    }
    
    .result-warning {
        border-color: #d97706;
        background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);
    }
    
    .password-result {
        display: flex;
        align-items: flex-start;
        gap: 16px;
    }
    
    .result-icon {
        font-size: 24px;
        flex-shrink: 0;
        margin-top: 2px;
    }
    
    .result-content {
        flex: 1;
    }
    
    .result-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #000000;
    }
    
    .result-details,
    .result-errors {
        font-size: 14px;
        line-height: 1.6;
        color: #333333;
    }
    
    .strength-level,
    .strength-score,
    .strength-desc {
        margin-bottom: 4px;
    }
    
    .error-list {
        padding-left: 20px;
    }
    
    .error-list div {
        margin-bottom: 4px;
        position: relative;
    }
    
    .error-list div::before {
        content: '•';
        position: absolute;
        left: -12px;
        color: #dc2626;
        font-weight: bold;
    }
    
    .log-output {
        background: #f8f8f8;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        line-height: 1.5;
        max-height: 400px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-all;
    }
    
    .system-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .info-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .info-item:last-child {
        border-bottom: none;
    }
    
    .info-item strong {
        min-width: 120px;
        color: #666666;
        font-weight: 500;
    }
`;

// 添加样式到页面
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// 导出功能供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testPassword,
        testQuickPassword,
        showLogs,
        showResult,
        displayVersionInfo
    };
}