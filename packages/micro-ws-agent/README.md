# @iocore/micro-ws-agent

[![npm version](https://badge.fury.io/js/%40iocore%2Fmicro-ws-agent.svg)](https://badge.fury.io/js/%40iocore%2Fmicro-ws-agent)

IoCore 微服务 WebSocket Agent (客户端/服务端)。

该模块允许你构建一个 IoCore 微服务，该服务通过 WebSocket 与注册中心 (`@iocore/micro-ws-registry`) 通信以实现服务发现，并能处理来自其他 Agent 或客户端的请求。

支持两种主要的服务模式：

1.  **WebSocket Service (`Service`)**: 处理纯粹的 WebSocket 消息，适用于 RPC 风格的调用。
2.  **HTTP-like Controller (`Controller`)**: 模拟 HTTP 请求/响应模式，通过 WebSocket 传输，支持中间件和类似 Koa 的上下文 (`Context`)。

## 安装

```bash
npm install @iocore/micro-ws-agent @iocore/logger @iocore/micro-ws @iocore/component detect-port retry --save
# or
yarn add @iocore/micro-ws-agent @iocore/logger @iocore/micro-ws @iocore/component detect-port retry
```

## 依赖

*   `@iocore/logger`
*   `@iocore/micro-ws`
*   `@iocore/component`
*   `detect-port` (用于自动检测可用端口)
*   `retry` (用于注册中心重连)

## 配置

通过环境变量 `IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS` 配置 Agent。该变量应包含一个 JSON 字符串。

```typescript
export type IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS = {
  registry: string; // 注册中心地址 (例如 'ws://localhost:8427')
  namespace: string; // 当前服务的命名空间 (例如 'user-service')
  port?: number; // 可选，指定服务监听的端口，若不指定或端口被占用则自动选择可用端口
};
```

**示例 `.env` 文件:**

```env
IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS='{"registry":"ws://localhost:8427","namespace":"user-service","port":9001}'
```

## 使用

通常，Agent 会作为一个独立的 IoCore 应用启动，并定义自己的服务或控制器。

```typescript
import { Application } from '@iocore/component';
import MicroWebSocketAgent, {
  Service,
  Controller,
  ControllerRequest,
  ControllerResponse,
  Context,
  Next,
  Middleware,
} from '@iocore/micro-ws-agent';

// --- 定义 WebSocket Service ---
class MyWsService extends Service {
  exec(name: string) {
    // 可以通过 this.fetch 调用其他服务
    // const result = await this.fetch('other-service/someApi', [arg1]);
    return `Hello from WebSocket Service, ${name}!`;
  }
}

// --- 定义 HTTP-like Controller 和 Middleware ---
class MyMiddleware extends Middleware {
  @Middleware.InComing.Head('x-request-id') // 从 Header 注入
  private requestId: string;

  async use(ctx: Context, next: Next) {
    console.log('Middleware Start, Request ID:', this.requestId);
    ctx.state.middlewareData = 'Data from middleware'; // 向下传递数据
    await next();
    console.log('Middleware End');
  }
}

@Controller.Middleware(MyMiddleware) // 应用中间件
class MyController extends Controller {
  @Controller.InComing.Path('id') // 从 URL 路径参数注入
  private userId: string;

  @Controller.InComing.Query('sort') // 从 URL 查询参数注入
  private sortBy: string;

  @Controller.InComing.Body // 注入请求体
  private requestBody: { message: string };

  @Controller.InComing.State('middlewareData') // 从 ctx.state 注入 (由上游中间件设置)
  private dataFromMiddleware: string;

  async response(): Promise<ControllerResponse> {
    console.log('Controller Executing...');
    console.log('User ID:', this.userId);
    console.log('Sort By:', this.sortBy);
    console.log('Request Body:', this.requestBody);
    console.log('Data from Middleware:', this.dataFromMiddleware);

    // 可以调用其他服务
    // const wsResult = await this.fetch('my-ws-service/exec', ['controller']);

    return {
      body: {
        success: true,
        data: `Processed user ${this.userId}, sorted by ${this.sortBy}. Message: ${this.requestBody?.message}`,
        // wsResult,
      },
      headers: {
        'X-Custom-Header': 'Value from controller',
      },
      // 设置 cookie 等...
    };
  }
}

// --- 启动 Agent 应用 ---
@Application.Inject(MicroWebSocketAgent)
class AgentApp extends Application {
  @Application.Inject(MicroWebSocketAgent)
  private agent: MicroWebSocketAgent;

  public async main() {
    // 绑定 WebSocket Service
    this.agent.wsBinding('/my-ws-service', MyWsService);

    // 绑定 HTTP-like Controller
    this.agent.httpBinding('/users/:id', MyController);

    console.log(`Agent '${this.agent.props.namespace}' ready.`);

    // 示例：Agent 内部调用自己的服务
    try {
      const result = await this.agent.fetch('user-service/my-ws-service', ['internal call']);
      console.log('Internal WS call result:', result);

      const httpResult = await this.agent.fetch('user-service/users/123?sort=desc', [
        {
          headers: { 'x-request-id': 'abc-123' },
          query: { sort: 'desc' }, // 查询参数也可以在这里提供
          params: { id: '123' }, // 路径参数也可以在这里提供
          cookie: { session: 'xyz' },
          body: { message: 'Hello from internal fetch' },
        } as ControllerRequest,
      ]);
      console.log('Internal HTTP call result:', httpResult);
    } catch (error) {
      console.error('Internal fetch failed:', error);
    }
  }
}

Application.start(AgentApp);
```

### `MicroWebSocketAgent` 类

*   **`constructor()`**: 解析环境变量配置。
*   **`initialize(): Promise<void>`**: 启动 WebSocket 服务器，自动选择端口，连接到注册中心并注册命名空间。IoCore 会自动调用。
*   **`terminate(): void`**: 关闭服务器，断开与注册中心的连接。IoCore 会自动调用。
*   **`props: IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS`**: 加载的配置。
*   **`registry: Channel | undefined`**: 到注册中心的 WebSocket 通道。
*   **`where(namespace: string): Promise<Channel>`**: 通过注册中心查找指定命名空间的服务地址，并建立连接（或返回已有的连接）。
*   **`createFetcher<R = any>(protocol: string, url: string, props: any[] = [], timeout?: number): Promise<R>`**: 通过命名空间调用其他服务。`protocol` 通常是 'ws' 或 'http'（模拟）。URL 格式如 `ws://other-service/api/path` 或 `http://other-service/users/:id`。
    *   对于 `ws` 协议，`props` 是直接传递给目标 `Service` 的 `exec` 方法的参数列表。
    *   对于 `http` 协议，`props` 应该是一个包含单个 `ControllerRequest` 对象的数组，模拟 HTTP 请求的各个部分。
*   **`fetch<R = any>(url: string, props: any[] = [], timeout?: number): Promise<R>`**: `createFetcher` 的快捷方式，默认协议为 `ws`。
*   **`wsBinding<T extends Service>(url: string, clazz: INewAble<T>): void`**: 将一个 URL 路径绑定到一个 `Service` 类。当收到该路径的 `ws` 协议请求时，会自动实例化该类并调用其 `exec` 方法。
*   **`httpBinding<T extends Controller>(url: string, clazz: INewAble<T>): Promise<void>`**: 将一个 URL 路径（支持参数，如 `/users/:id`）绑定到一个 `Controller` 类。当收到该路径的 `http` 协议请求时，会执行关联的中间件链和 Controller 的 `response` 方法，模拟 HTTP 处理流程。

### `Service` (抽象类)

继承自 `BaseContext`。

*   **`abstract exec(...args: any[]): unknown | Promise<unknown>`**: 实现此方法来处理 `ws` 请求。参数 (`args`) 来自 `fetch` 调用。
*   **`channel: Channel`** (注入): 当前请求的 WebSocket 通道。
*   **`agent: MicroWebSocketAgent`** (注入): Agent 实例。
*   **`fetch<R = any>(...)`**: 调用其他服务。

### `Controller` (抽象类)

继承自 `Router`。

*   **`abstract response(): ControllerResponse | Promise<ControllerResponse>`**: 实现此方法来生成模拟的 HTTP 响应。
*   **`static Middleware(...args: IMiddleware[]): ClassDecorator`**: 类装饰器，用于关联中间件到 Controller。
*   **`channel: Channel`** (注入)
*   **`agent: MicroWebSocketAgent`** (注入)
*   **`fetch<R = any>(...)`**: 调用其他服务。
*   **`@Controller.InComing...`**: 属性装饰器，用于从请求上下文注入数据 (见下方 `Router`)。

### `Middleware` (抽象类)

继承自 `Router`。

*   **`abstract use(ctx: Context, next: Next): Promise<unknown>`**: 实现此方法来定义中间件逻辑。调用 `next()` 将控制权传递给下一个中间件或 Controller。
*   **`static Dependencies(...args: IMiddleware[]): ClassDecorator`**: 类装饰器，用于声明当前中间件依赖的其他中间件。Agent 会自动处理依赖顺序。
*   **`channel: Channel`** (注入)
*   **`agent: MicroWebSocketAgent`** (注入)
*   **`fetch<R = any>(...)`**: 调用其他服务。
*   **`@Middleware.InComing...`**: 属性装饰器，用于从请求上下文注入数据 (见下方 `Router`)。

### `Router` (基类，`Controller` 和 `Middleware` 继承)

*   **`static readonly InComing`**: 包含一组属性装饰器，用于将 `Context` 中的数据注入到 `Controller` 或 `Middleware` 的属性中。
    *   `Head(key?: string)`: 从 `ctx.headers` 注入。
    *   `Query(key?: string)`: 从 `ctx.query` 注入。
    *   `Path(key?: string)`: 从 `ctx.params` (URL 路径参数) 注入。
    *   `Cookie(key?: string)`: 从 `ctx.cookie` 注入。
    *   `Body()`: 注入整个 `ctx.body`。
    *   `State(key?: string)`: 从 `ctx.state` (中间件共享数据) 注入。
    *   所有装饰器都支持可选的回调函数进行数据转换/校验。

### `Context`

类似 Koa 的上下文对象，在 HTTP 模拟处理流程中使用。

*   `headers: Record<string, string | string[]>`
*   `query: Record<string, string | string[]>`
*   `params: Record<string, string>`
*   `cookie: Record<string, string>`
*   `body: any`
*   `state: Record<string, any>`: 用于在中间件之间传递数据。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
