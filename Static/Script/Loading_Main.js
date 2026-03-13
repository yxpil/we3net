// 核心配置：接口地址（5726端口/static路由）
const CHECK_URL = 'http://localhost:5726/static';
// 轮询间隔（500ms查一次）
const CHECK_INTERVAL = 500;
const progressText = document.getElementById("progressText");
// 保存定时器ID，用于停止轮询
let pollTimer = null;

// 轮询检测接口状态
function checkServerStatus() {
    // 设置初始状态提示
    if (!progressText.textContent) {
        progressText.textContent = "开始检测服务状态...";
    }

    fetch(CHECK_URL)
        .then(response => {
            if (!response.ok) throw new Error(`接口响应异常: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // 检测到 progress: ok 说明启动完成
            if (data.progress === 'ok') {
                progressText.textContent = "准备就绪...";
                // 清除定时器，停止轮询
                if (pollTimer) clearTimeout(pollTimer);
                // 通知Electron关闭启动页、打开主窗口
                if (window.electronAPI) {
                    window.electronAPI.loadComplete();
                }
            } else {
                progressText.textContent = "等待服务就绪...";
                // 继续轮询
                pollTimer = setTimeout(checkServerStatus, CHECK_INTERVAL);
            }
        })
        .catch(error => {
            // 1. 打印完整错误信息到控制台（包含错误栈）
            console.error('服务检测出错:', error);
            // 2. 打印错误详情（方便快速查看关键信息）
            console.log('错误类型:', error.name);
            console.log('错误消息:', error.message);
            console.log('错误栈:', error.stack);

            // 区分不同错误类型，给出更明确的提示
            if (error.message.includes('Failed to fetch')) {
                progressText.textContent = "等待服务启动...";
            } else if (error.message.includes('JSON')) {
                progressText.textContent = "错误: 接口返回数据格式异常";
            } else {
                progressText.textContent = `服务启动中...(${error.message})`;
            }
            // 继续轮询
            pollTimer = setTimeout(checkServerStatus, CHECK_INTERVAL);
        });
}

// 启动轮询（替代之前的模拟进度）
checkServerStatus();