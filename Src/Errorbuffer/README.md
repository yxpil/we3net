# 致命错误缓冲库 (ErrorBuffer)

提供全方位的错误捕获、处理和恢复机制，确保程序在各种错误情况下都能继续运行。

## 功能特性

### 🔍 错误捕获
- **全局错误捕获**：捕获未处理的异常 (`uncaughtException`)
- **Promise拒绝处理**：捕获未处理的Promise拒绝 (`unhandledRejection`)
- **进程信号处理**：处理终止信号 (`SIGTERM`, `SIGINT`)
- **警告处理**：捕获Node.js系统警告 (`warning`)
- **进程退出处理**：处理进程正常退出 (`exit`)

### 🛡️ 错误处理
- **超级兜底机制**：确保在任何情况下都能进行基本的错误处理
- **错误序列化**：将复杂的错误对象转换为可序列化的格式
- **错误历史记录**：维护错误历史，支持查看和分析
- **错误类型统计**：统计不同类型错误的发生次数

### 📊 资源监控
- **内存监控**：实时监控内存使用情况
- **内存压力处理**：当内存使用率超过阈值时自动清理内存
- **资源使用报告**：提供当前内存使用和进程运行时间信息

### 🔄 自动恢复
- **错误恢复尝试**：在捕获到错误后尝试恢复程序正常运行
- **内存清理**：清理未使用的内存和缓存
- **进程重启**：当连续错误数达到阈值时考虑自动重启进程

### 📝 日志记录
- **集成现有日志系统**：与项目中的日志工具无缝集成
- **结构化日志**：记录详细的错误信息和上下文
- **多级别日志**：支持错误、警告和信息级别的日志记录

## 安装和使用

### 安装

将ErrorBuffer库添加到您的项目中：

```javascript
const { ErrorBuffer, errorBuffer, wrap } = require('./Src/Errorbuffer');
```

### 快速开始

#### 使用默认实例

```javascript
// 导入库
const { errorBuffer } = require('./Src/Errorbuffer');

// 监听事件
errorBuffer.on('uncaughtException', (errorInfo) => {
  console.log('捕获到未处理的异常:', errorInfo);
});

errorBuffer.on('recovered', () => {
  console.log('程序已从错误中恢复');
});

errorBuffer.on('memoryPressure', (info) => {
  console.log('检测到内存压力:', info);
});

// 开始使用
errorBuffer.init();
```

#### 创建自定义实例

```javascript
// 导入库
const { ErrorBuffer } = require('./Src/Errorbuffer');

// 创建自定义实例
const customBuffer = new ErrorBuffer({
  maxErrorHistory: 100,       // 最大错误历史记录数
  autoRecover: true,          // 启用自动恢复
  restartAfterErrors: 10,     // 连续错误数达到此值时考虑重启
  memoryThreshold: 0.8,       // 内存使用率阈值（0-1）
  maxErrorLogSize: 10 * 1024 * 1024, // 最大错误日志大小
});

// 使用自定义实例
customBuffer.init();
```

### 包装函数错误处理

```javascript
// 导入库
const { wrap } = require('./Src/Errorbuffer');

// 创建一个可能出错的函数
function errorProneFunction() {
  if (Math.random() > 0.5) {
    throw new Error('随机错误');
  }
  return '成功结果';
}

// 使用wrap包装函数
const safeFunction = wrap(errorProneFunction, {
  defaultValue: '默认值',  // 出错时返回的默认值
  onError: (error) => {     // 错误处理回调
    console.log('函数执行出错:', error);
  }
});

// 安全地调用函数
async function test() {
  const result = await safeFunction();
  console.log('函数执行结果:', result);
}

test();
```

## API 参考

### ErrorBuffer 类

#### 构造函数

```javascript
new ErrorBuffer(options)
```

**参数：**
- `options`：配置选项对象
  - `maxErrorHistory`：最大错误历史记录数（默认：50）
  - `autoRecover`：是否自动恢复（默认：true）
  - `restartAfterErrors`：连续错误数达到此值时考虑重启（默认：5）
  - `memoryThreshold`：内存使用率阈值（0-1，默认：0.9）
  - `maxErrorLogSize`：最大错误日志大小（默认：10MB）

#### 方法

##### 初始化

```javascript
errorBuffer.init()
```
初始化错误缓冲器，设置全局错误处理程序和资源监控。

##### 获取统计信息

```javascript
errorBuffer.getStats()
```
返回错误统计信息，包括总错误数、最近错误数、错误类型等。

##### 清理资源

```javascript
errorBuffer.cleanup()
```
清理资源和状态，准备退出。

##### 尝试恢复

```javascript
errorBuffer.attemptRecovery()
```
尝试从错误中恢复，包括清理内存和重置状态。

#### 事件

##### initialized

```javascript
errorBuffer.on('initialized', () => { ... })
```
错误缓冲器初始化完成时触发。

##### uncaughtException

```javascript
errorBuffer.on('uncaughtException', (errorInfo) => { ... })
```
捕获到未处理的异常时触发。

##### unhandledRejection

```javascript
errorBuffer.on('unhandledRejection', (errorInfo) => { ... })
```
捕获到未处理的Promise拒绝时触发。

##### recovered

```javascript
errorBuffer.on('recovered', () => { ... })
```
成功从错误中恢复时触发。

##### memoryPressure

```javascript
errorBuffer.on('memoryPressure', (info) => { ... })
```
检测到内存压力时触发。

### wrap 函数

```javascript
wrap(func, options)
```
包装函数以增强错误处理能力。

**参数：**
- `func`：要包装的函数
- `options`：配置选项
  - `defaultValue`：出错时返回的默认值
  - `onError`：错误处理回调函数

**返回值：**
- 包装后的函数，具有增强的错误处理能力

## 错误信息结构

```javascript
{
  type: 'uncaughtException',      // 错误类型
  message: '错误消息',           // 错误描述
  error: {                        // 序列化的错误对象
    message: '错误消息',
    stack: '错误堆栈',
    name: '错误名称'
  },
  timestamp: '2026-03-13T09:22:45.672Z', // 时间戳
  memory: {                       // 内存使用情况
    rss: 54063104,
    heapTotal: 16633856,
    heapUsed: 8029712,
    external: 1640147,
    arrayBuffers: 10527
  },
  uptime: 4.218618,               // 进程运行时间（秒）
  // 其他类型特定的字段
}
```

## 示例应用

### 基本使用示例

```javascript
// 导入库
const { errorBuffer } = require('./Src/Errorbuffer');

// 初始化
errorBuffer.init();

// 监听事件
errorBuffer.on('uncaughtException', (errorInfo) => {
  console.log('捕获到错误:', errorInfo.type);
  console.log('错误消息:', errorInfo.message);
});

errorBuffer.on('recovered', () => {
  console.log('程序已恢复正常运行');
});

// 模拟一个会出错的操作
setInterval(() => {
  if (Math.random() > 0.8) {
    // 模拟一个未处理的异常
    throw new Error('随机模拟错误');
  }
  console.log('程序正常运行中...');
}, 1000);
```

### 高级配置示例

```javascript
// 导入库
const { ErrorBuffer } = require('./Src/Errorbuffer');

// 创建自定义实例
const customBuffer = new ErrorBuffer({
  maxErrorHistory: 100,      // 保留更多错误历史
  restartAfterErrors: 10,    // 更多连续错误才考虑重启
  memoryThreshold: 0.8,      // 更早检测内存压力
  autoRecover: true          // 启用自动恢复
});

// 监听自定义事件
customBuffer.on('memoryPressure', (info) => {
  console.log(`内存压力警告: ${(info.memoryUsageRatio * 100).toFixed(2)}%`);
});

customBuffer.on('restart', () => {
  console.log('程序将在连续错误后重启');
});

// 初始化并启动应用
customBuffer.init();

// 应用逻辑...
```

## 与其他模块集成

### 与日志系统集成

ErrorBuffer自动与项目中的日志系统集成，使用`logger`模块记录错误信息：

```javascript
// 日志输出示例
[2026-03-13 17:22:45.672] [ERROR] [SYSTEM] [云湖] [pid:23772] - 致命错误缓冲库捕获到uncaughtException错误: 测试全局错误
```

### 与监控系统集成

```javascript
// 导入库
const { errorBuffer } = require('./Src/Errorbuffer');

// 与监控系统集成
errorBuffer.on('uncaughtException', (errorInfo) => {
  // 发送错误信息到监控系统
  monitoringService.sendError(errorInfo);
});

errorBuffer.on('memoryPressure', (info) => {
  // 发送内存压力警告到监控系统
  monitoringService.sendAlert('memoryPressure', info);
});

// 初始化
errorBuffer.init();
```

## 性能和安全性

### 性能考虑
- 错误处理逻辑经过优化，对正常程序运行影响极小
- 资源监控采用低频率轮询，避免性能开销
- 错误历史记录有大小限制，防止内存泄漏

### 安全建议
- 定期检查错误日志，及时发现潜在问题
- 根据实际需求调整内存阈值，避免频繁的内存清理
- 合理配置重启策略，避免过多的进程重启
- 在生产环境中监控错误缓冲器的性能

## 测试

运行测试脚本验证功能：

```bash
node Src/Errorbuffer/test.js
```

测试涵盖以下功能：
- 全局错误捕获
- Promise拒绝捕获
- 包装函数错误处理
- 错误统计信息
- 资源监控
- 自定义错误缓冲器

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 版本历史

### v1.0.0
- 初始版本
- 支持全局错误捕获
- 支持Promise拒绝处理
- 支持资源监控
- 支持自动恢复
- 集成日志系统