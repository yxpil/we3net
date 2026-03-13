const dgram = require('dgram');
const os = require('os');

// 测试UDP广播的基本功能
function testUDPBasic() {
    console.log('=== 基本UDP广播测试开始 ===');
    
    // 创建UDP socket用于接收
    const receiver = dgram.createSocket('udp4');
    
    // 监听端口
    receiver.bind(5726, () => {
        receiver.setBroadcast(true);
        console.log('接收端已启动，监听端口 5726');
    });
    
    // 监听消息
    receiver.on('message', (msg, rinfo) => {
        console.log(`\n接收到消息：`);
        console.log(`  来自：${rinfo.address}:${rinfo.port}`);
        console.log(`  内容：${msg.toString()}`);
    });
    
    receiver.on('error', (err) => {
        console.error('接收端错误：', err);
    });
    
    // 创建UDP socket用于发送
    const sender = dgram.createSocket('udp4');
    
    // 获取网络接口信息
    const interfaces = os.networkInterfaces();
    console.log('\n网络接口信息：');
    for (const iface in interfaces) {
        console.log(`  ${iface}:`);
        interfaces[iface].forEach(ipInfo => {
            if (ipInfo.family === 'IPv4' && !ipInfo.internal) {
                console.log(`    - ${ipInfo.address} (广播: ${ipInfo.broadcast})`);
            }
        });
    }
    
    // 发送测试消息
    setTimeout(() => {
        const message = Buffer.from('测试UDP广播消息');
        const broadcastAddr = '255.255.255.255';
        const port = 5726;
        
        console.log(`\n发送UDP广播到 ${broadcastAddr}:${port}`);
        
        sender.send(message, port, broadcastAddr, (err) => {
            if (err) {
                console.error('发送失败：', err);
                console.error('错误详情：');
                console.error('  errno:', err.errno);
                console.error('  code:', err.code);
                console.error('  syscall:', err.syscall);
            } else {
                console.log('发送成功！');
            }
            
            // 清理资源
            setTimeout(() => {
                sender.close();
                receiver.close();
                console.log('\n=== 基本UDP广播测试结束 ===');
            }, 2000);
        });
    }, 1000);
}

// 运行测试
testUDPBasic();
