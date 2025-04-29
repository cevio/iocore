# @iocore/demodulator

[![npm version](https://badge.fury.io/js/%40iocore%2Fdemodulator.svg)](https://badge.fury.io/js/%40iocore%2Fdemodulator)

IoCore 的请求/响应解调器模块。

提供了一个抽象类 `Demodulator`，用于在任何支持双向通信的流上实现可靠的、带超时的请求/响应模式，并能处理中止信号 (`AbortController`)。

## 安装

```bash
npm install @iocore/demodulator --save
# or
yarn add @iocore/demodulator
```

## 依赖

无外部 IoCore 或 Node.js 模块依赖。

## 使用

需要继承 `Demodulator` 类并实现两个抽象方法：

*   `post<T = any>(data: IDemodulatorMessage<T>): void`: 定义如何将封装后的消息 (`IDemodulatorMessage`) 发送到通信对端。
*   `exec(data: any): Promise<any>`: 定义当接收到对端的请求时，如何执行实际的处理逻辑并返回结果。

**示例：使用 Worker 线程实现 Demodulator**

```typescript
import { Demodulator, Exception, IDemodulatorMessage } from '@iocore/demodulator';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

// --- 定义 WorkerDemodulator --- (通用部分)
class WorkerDemodulator extends Demodulator {
  private worker: Worker | null = null;

  // 在主线程中实现：将消息发送给 Worker
  protected post<T = any>(data: IDemodulatorMessage<T>): void {
    if (isMainThread && this.worker) {
      this.worker.postMessage(data);
    } else if (!isMainThread && parentPort) {
      // 在 Worker 线程中实现：将消息发送给主线程
      parentPort.postMessage(data);
    }
  }

  // 子类需要实现具体的请求处理逻辑
  protected exec(data: any): Promise<any> {
    throw new Error("Method 'exec' must be implemented by subclasses.");
  }

  // 辅助方法：设置 Worker 实例 (主线程用)
  setWorker(worker: Worker) {
    if (!isMainThread) return;
    this.worker = worker;
    this.worker.on('message', (msg) => this.receive(msg));
    this.worker.on('error', (err) => console.error('Worker error:', err));
    this.worker.on('exit', (code) => console.log(`Worker exited with code ${code}`));
  }

  // 辅助方法：监听父端口 (Worker 线程用)
  listenParentPort() {
    if (isMainThread || !parentPort) return;
    parentPort.on('message', (msg) => this.receive(msg));
  }
}

// --- 主线程逻辑 --- (MainThreadApp.ts)
if (isMainThread) {
  class MainThreadApp extends WorkerDemodulator {
    constructor() {
      super();
      const worker = new Worker(__filename); // 启动 Worker
      this.setWorker(worker);
    }

    // 主线程处理来自 Worker 的请求
    protected async exec(data: { command: string; payload: any }): Promise<any> {
      console.log('[Main] Received exec request from Worker:', data);
      if (data.command === 'multiply') {
        if (typeof data.payload?.a !== 'number' || typeof data.payload?.b !== 'number') {
          throw new Exception(400, 'Invalid payload for multiply');
        }
        return data.payload.a * data.payload.b;
      } else if (data.command === 'longTask') {
        // 模拟耗时任务
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'Long task finished successfully';
      }
      throw new Exception(404, 'Unknown command');
    }

    async run() {
      console.log('[Main] Sending request to Worker...');
      try {
        // 1. 正常请求
        const result = await this.send({ task: 'add', params: [10, 5] }, 5000).response<number>();
        console.log(`[Main] Worker responded with result: ${result}`);

        // 2. 请求 Worker 执行 longTask，并在 1 秒后中止
        console.log('[Main] Sending long task request to Worker, will abort in 1s...');
        const longTaskRequest = this.send({ task: 'longTask' }, 5000);
        setTimeout(() => {
          console.log('[Main] Aborting long task request...');
          longTaskRequest.abort();
        }, 1000);
        await longTaskRequest.response(); // 等待响应 (会抛出 AbortException)

      } catch (error) {
        if (error instanceof Exception) {
          console.error(`[Main] Caught Exception: ${error.message} (Code: ${error.status})`);
        } else {
          console.error('[Main] Caught Unknown Error:', error);
        }
      }
    }
  }

  const mainApp = new MainThreadApp();
  mainApp.run();

} else {
  // --- Worker 线程逻辑 --- (也在同一个文件，由 isMainThread 区分)
  class WorkerApp extends WorkerDemodulator {
    constructor() {
      super();
      this.listenParentPort();
      console.log('[Worker] Worker thread started.');
    }

    // Worker 处理来自主线程的请求
    protected async exec(data: { task: string; params: any[] }): Promise<any> {
      console.log('[Worker] Received exec request from Main:', data);
      if (data.task === 'add') {
        return data.params.reduce((a, b) => a + b, 0);
      } else if (data.task === 'longTask') {
        console.log('[Worker] Starting long task...');
        // 模拟长时间任务，这个任务会被主线程中止
        await new Promise(resolve => setTimeout(resolve, 5000)); // 模拟 5 秒任务
        console.log('[Worker] Long task finished (should have been aborted).');
        return 'Worker long task completed'; // 正常情况下不会执行到这里
      }
      // Worker 也可以调用主线程
      // const mainResult = await this.send({ command: 'multiply', payload: { a: 5, b: 3 } }).response<number>();
      // console.log('[Worker] Main responded to multiply:', mainResult);
      throw new Exception(404, 'Unknown task');
    }
  }

  new WorkerApp();
}
```

### `Demodulator` 类 (抽象类)

*   **`protected abstract post<T = any>(data: IDemodulatorMessage<T>): void`**: **必须实现**。定义如何将 `IDemodulatorMessage` 发送给对端。
*   **`protected abstract exec(data: any): Promise<any>`**: **必须实现**。定义如何处理收到的请求 (`data` 是 `IDemodulatorMessage.data`) 并返回结果。如果执行出错，应抛出 `Exception` 或其他错误。
*   **`protected send<T = any>(data: T, timeout = 30000): { abort: () => void, response: <U = any>() => Promise<U> }`**: 向对端发送请求。
    *   `data`: 要发送的数据。
    *   `timeout`: 超时时间 (毫秒)，默认为 30 秒。
    *   返回一个对象：
        *   `abort(): void`: 调用此函数可以中止请求。会向对端发送一个 ABORT 消息。
        *   `response<U = any>(): Promise<U>`: 返回一个 Promise，用于等待对端的响应。如果成功，Promise resolve 为响应数据；如果发生错误、超时或中止，Promise reject 相应的 `Exception` (`TimeoutException`, `AbortException`)。
*   **`public receive(msg: IDemodulatorMessage): void`**: 当从对端收到消息时，调用此方法。它会根据消息的 `mode` (REQUEST, RESPONSE, ABORT) 自动分发处理逻辑。

### `IDemodulatorMessage` 接口

内部消息格式。

*   `id: number`: 唯一消息 ID。
*   `mode: DEMODULATOR_MODE`: 消息类型 (REQUEST, RESPONSE, ABORT)。
*   `twoway: boolean`: 是否需要响应 (REQUEST 通常为 true，RESPONSE/ABORT 为 false)。
*   `data?: any`: 实际传输的数据。
    *   对于 REQUEST: 是 `send` 方法的 `data` 参数。
    *   对于 RESPONSE: 是包含 `{ status, data, message }` 的对象。
    *   对于 ABORT: 是要中止的请求的 `id`。

### `Exception` 类

自定义异常基类。

*   `constructor(status: number | string, msg: string)`
*   `status: number | string`: 错误状态码或标识符。
*   `message: string`: 错误消息。

### `TimeoutException` 类 (继承自 `Exception`)

请求超时异常。`status` 固定为 `'ETIMEDOUT'`。

### `AbortException` 类 (继承自 `Exception`)

请求被中止异常。`status` 固定为 `'ECONNABORTED'`。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
