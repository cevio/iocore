# @iocore/micro-ws-registry

[![npm version](https://badge.fury.io/js/%40iocore%2Fmicro-ws-registry.svg)](https://badge.fury.io/js/%40iocore%2Fmicro-ws-registry)

IoCore 微服务 WebSocket 注册中心。

基于 `@iocore/micro-ws`，提供了一个中心化的服务发现机制。各个微服务（Agent）启动时向注册中心报告自己的地址和命名空间，其他服务可以通过注册中心查询特定命名空间对应的服务地址。

## 安装

```bash
npm install @iocore/micro-ws-registry @iocore/boot @iocore/micro-ws @iocore/component --save
# or
yarn add @iocore/micro-ws-registry @iocore/boot @iocore/micro-ws @iocore/component
```

## 依赖

*   `@iocore/boot`
*   `@iocore/micro-ws`
*   `@iocore/component`

## 配置

通过环境变量 `IOCORE_MICRO_WEBSOCKET_REGISTRY_PORT` 配置注册中心监听的端口，默认为 `8427`。

**示例 `.env` 文件:**

```env
IOCORE_MICRO_WEBSOCKET_REGISTRY_PORT=8427
```

## 使用

通常，注册中心会作为一个独立的 IoCore 应用启动。

```typescript
import { Application } from '@iocore/component';
import MicroWsRegistry from '@iocore/micro-ws-registry';

@Application.Inject(MicroWsRegistry)
class RegistryApp extends Application {
  // 可以注入 MicroWsRegistry 实例来访问其方法
  @Application.Inject(MicroWsRegistry)
  private registry: MicroWsRegistry;

  public async main() {
    console.log('Registry is running...');
    // 例如，可以获取当前注册的命名空间列表
    console.log('Registered namespaces:', this.registry.namespaceToArray());
  }
}

// 启动注册中心应用
Application.start(RegistryApp);
```

### 内部机制

注册中心启动后，会监听指定的端口，并处理来自 Agent 的连接和消息：

*   **连接/断开**: 记录 Agent 的连接 (`+ host`) 和断开 (`- host`) 事件。如果 Agent 断开连接，会自动从注册信息中移除。
*   **`online` 事件**: Agent 连接后，会发送 `online` 事件，并携带其服务的命名空间 (namespace)。注册中心收到后，将 `namespace` 与 Agent 的 `host` (地址) 关联起来。
    ```typescript
    // Agent 端发送 online (由 @iocore/micro-ws-agent 自动处理)
    // channel.emit('ws', 'online', 'my-service-namespace');
    ```
*   **`where` 事件**: 其他服务可以向注册中心发送 `where` 事件，查询特定 `namespace` 对应的 `host`。
    ```typescript
    // 查询 'my-service-namespace' 对应的地址
    // const host = await registryChannel.fetch('ws', 'where', ['my-service-namespace']);
    ```

### `MicroWsRegistry` 类 (继承自 `@iocore/boot`)

*   **`constructor()`**: 初始化 WebSocket 服务器，设置端口，并监听连接/断开事件。
*   **`initialize(): void`**: 绑定 `online` 和 `where` 事件处理器。IoCore 会自动调用。
*   **`terminate(): void`**: 关闭 WebSocket 服务器。IoCore 会自动调用。
*   **`namespaceToArray(): { name: string, host: string }[]`**: 返回当前所有已注册的命名空间及其对应的 host 列表。
*   **`createFetcher<R = any>(protocol: string, url: string, props: any[] = [], timeout?: number): Promise<R>`**: 这是注册中心作为服务调用代理的核心方法。
    *   它接收一个目标服务的 URL (格式如 `ws://my-service-namespace/path/to/api`)。
    *   从 URL 中解析出 `namespace`。
    *   在内部 `namespaces` 映射中查找该 `namespace` 对应的 `host`。
    *   如果找到 `host`，则通过 `@iocore/micro-ws` 连接到目标 Agent。
    *   向目标 Agent 发起 `fetch` 请求 (调用 `channel.fetch`)，并将 `protocol`, `router` (URL 路径), `props` (参数) 和 `timeout` 传递过去。
    *   返回目标 Agent 的响应。
    *   如果找不到 `namespace`，则抛出 404 异常。

    **使用场景**: 一个服务 (如 API Gateway) 可以注入 `MicroWsRegistry`，然后使用 `createFetcher` 来调用其他微服务，而无需知道这些微服务的具体地址，只需知道它们的命名空间即可。
    ```typescript
    // 假设在 API Gateway 服务中
    @Application.Inject(MicroWsRegistry)
    private registry: MicroWsRegistry;

    async getUserData(userId: string): Promise<UserData> {
      // 调用 "user-service" 命名空间下的 /users API
      const userData = await this.registry.createFetcher<UserData>(
        'ws',
        'user-service/users',
        [userId] // 传递给目标 Agent 的参数
      );
      return userData;
    }
    ```

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
