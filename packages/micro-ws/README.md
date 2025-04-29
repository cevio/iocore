# @iocore/micro-ws

[![npm version](https://badge.fury.io/js/%40iocore%2Fmicro-ws.svg)](https://badge.fury.io/js/%40iocore%2Fmicro-ws)

IoCore 的底层 WebSocket 通信模块。

基于 `ws` 库，并集成了 `@iocore/demodulator`，提供了建立 WebSocket 连接、管理通道 (`Channel`)、绑定消息处理器以及进行带超时的请求-响应式通信 (`fetch`) 的能力。

## 安装

```bash
npm install @iocore/micro-ws ws @iocore/demodulator --save
# or
yarn add @iocore/micro-ws ws @iocore/demodulator
```

## 依赖

*   `ws`: Node.js WebSocket 库。
*   `@iocore/demodulator`: 用于实现请求/响应模式和超时控制。

## 使用

### 创建 WebSocket 服务器和客户端

```typescript
import MicroWebSocket, { Channel, Exception } from '@iocore/micro-ws';

// --- 服务端 --- (监听 8080)
const server = new MicroWebSocket({ port: 8080 });

// 监听连接事件
server.on('connect', (channel: Channel) => {
  console.log(`[Server] Client connected: ${channel.host}`);

  // 监听断开事件 (在 Channel 上)
  // 注意：'disconnect' 事件是在 MicroWebSocket 实例上触发的
});

server.on('disconnect', (channel: Channel) => {
  console.log(`[Server] Client disconnected: ${channel.host}`);
});

// 绑定一个处理函数 ('ws' 协议, '/greeting' 路径)
server.bind('ws', '/greeting', (channel: Channel, name: string) => {
  console.log(`[Server] Received greeting request for ${name} from ${channel.host}`);
  return `Hello, ${name}! This is server.`;
});

// 绑定一个模拟 HTTP GET 的处理函数
server.bind('http', '/users/:id', (channel: Channel, request: any) => {
  console.log(`[Server] Received HTTP-like request for user: ${request.params.id}`);
  // 在 micro-ws-agent 中，这里会是 ControllerRequest
  return {
    body: { userId: request.params.id, data: 'some user data' },
    headers: { 'X-Server-Time': Date.now().toString() },
  };
});

console.log('[Server] Listening on port 8080');

// --- 客户端 --- (连接到服务端)
const client = new MicroWebSocket({ port: 8081 }); // 客户端也需要监听一个端口以接收响应

async function runClient() {
  try {
    console.log('[Client] Connecting to server...');
    // 使用 use 获取到服务端的 Channel
    // 注意 host 格式为 IP:Port
    const serverChannel = await client.use('127.0.0.1:8080');
    console.log(`[Client] Connected to server: ${serverChannel.host}`);

    // 使用 fetch 发起请求 ('ws' 协议, '/greeting' 路径, 参数 ['Alice'])
    const { response } = serverChannel.fetch('ws', '/greeting', ['Alice'], 5000); // 5秒超时
    const greeting = await response<string>();
    console.log(`[Client] Received greeting: ${greeting}`);

    // 模拟 HTTP 请求
    const { response: httpResponse } = serverChannel.fetch('http', '/users/123', [
      // 参数是一个包含模拟请求对象的数组
      {
        headers: { 'X-Client-ID': 'client-abc' },
        query: { detail: 'true' },
        params: { id: '123' }, // 路径参数通常在这里传递
        cookie: { session: 'xyz' },
        body: { action: 'getUser' },
      },
    ]);
    const userData = await httpResponse<any>();
    console.log(`[Client] Received HTTP-like response:`, userData);

    // 断开连接
    serverChannel.disconnect();

  } catch (error) {
    if (error instanceof Exception) {
      console.error(`[Client] Error: ${error.message} (Code: ${error.code})`);
    } else {
      console.error('[Client] Unknown error:', error);
    }
  } finally {
    client.close();
    server.close();
  }
}

// 等待服务端启动后再运行客户端
setTimeout(runClient, 1000);
```

### `MicroWebSocket` 类 (继承自 `EventEmitter`)

*   **`constructor(options: ServerOptions)`**: 创建 WebSocket 服务器实例。`options` 是 `ws` 库的 `ServerOptions`。
*   **`server: WebSocketServer`**: 底层的 `ws` 服务器实例。
*   **`channels: Map<string, Channel>`**: 当前连接的客户端通道映射 (key 是 `host:port`)。
*   **`functions: Map<string, Map<string, IFunction>>`**: 存储绑定的处理函数。第一层 Map 的 key 是协议 (`protocol`)，第二层 Map 的 key 是命令/路径 (`cmd`/`key`)。
*   **`on(event: 'connect' | 'disconnect', listener: (channel: Channel) => void)`**: 监听客户端连接和断开事件。
*   **`use(host: string): Promise<Channel>`**: 获取到指定 `host` 的 `Channel`。如果连接不存在，则尝试建立新连接。它会处理并发连接请求，确保只建立一个连接。
*   **`bind<T = any>(protocol: string, key: string, callback: IFunction<T>): this`**: 绑定一个处理函数到指定的协议和 key (路径/命令)。`callback` 接收 `Channel` 和来自 `fetch` 的参数。
*   **`close(): void`**: 关闭 WebSocket 服务器。

### `Channel` 类 (继承自 `Demodulator`)

代表一个 WebSocket 连接通道。

*   **`constructor(host: string, socket: WebSocket, server: MicroWebSocket)`**: 由 `MicroWebSocket` 内部创建。
*   **`host: string`**: 对端地址 (`ip:port`)。
*   **`socket: WebSocket`**: 底层的 `ws` socket 实例。
*   **`server: MicroWebSocket`**: 创建此通道的服务器实例。
*   **`fetch(protocol: string, cmd: string, props: any[], timeout?: number): { id: number, response: <T>() => Promise<T> }`**: 向对端发送请求并等待响应。继承自 `Demodulator` 的 `send` 方法。
    *   `protocol`: 请求协议 (例如 'ws', 'http')。
    *   `cmd`: 命令或路径。
    *   `props`: 要传递的参数数组。
    *   `timeout`: 超时时间 (毫秒)。
    *   返回一个包含请求 ID 和一个用于获取响应 Promise 的 `response` 函数的对象。
*   **`disconnect(): void`**: 关闭当前通道的 WebSocket 连接。
*   **`protected post<T = any>(data: IDemodulatorMessage<T>): void`**: (内部方法) 发送原始消息到对端。
*   **`protected async exec(data: ChannelPostData): Promise<any>`**: (内部方法) 当接收到请求时，查找并执行 `MicroWebSocket` 实例上绑定的相应处理函数。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
