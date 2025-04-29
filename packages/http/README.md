# @iocore/http

[![npm version](https://badge.fury.io/js/%40iocore%2Fhttp.svg)](https://badge.fury.io/js/%40iocore%2Fhttp)

IoCore 的 HTTP 服务器模块。

基于 Koa 和 find-my-way，提供了一个健壮且高效的 HTTP 服务器框架，集成了 IoCore 的组件化和依赖注入特性，支持 Controller、Middleware 和路由参数注入。

## 安装

```bash
npm install @iocore/http @iocore/component koa koa-compose find-my-way --save
# or
yarn add @iocore/http @iocore/component koa koa-compose find-my-way
```

## 依赖

*   `@iocore/component`: IoCore 核心组件系统。
*   `koa`: 下一代 Node.js web 框架。
*   `koa-compose`: 组合 Koa 中间件。
*   `find-my-way`: 高性能的 HTTP 路由器。

## 配置

通过环境变量 `IOCORE_HTTP_CONFIGS` 配置 HTTP 服务器。该变量应包含一个 JSON 字符串。

```typescript
import { Config, HTTPVersion } from 'find-my-way';

export type IOCORE_HTTP_CONFIGS = {
  port: number; // 服务器监听的端口
  keys?: string[]; // Koa 的签名密钥 (用于 cookie 签名等)，默认自动生成
  defaultSuffix?: string; // 绑定 Controller 时，如果 url 以此后缀结尾，则自动移除 (默认 '/index')
} & Omit<Config<HTTPVersion.V1>, 'defaultRoute'>; // find-my-way 的配置选项 (除了 defaultRoute)
```

**示例 `.env` 文件:**

```env
IOCORE_HTTP_CONFIGS='{"port":3000,"ignoreTrailingSlash":true,"caseSensitive":false}'
```

`find-my-way` 的配置选项包括 `ignoreTrailingSlash`, `ignoreDuplicateSlashes`, `maxParamLength`, `allowUnsafeRegex`, `caseSensitive` 等。详情请参阅 [find-my-way 文档](https://github.com/delvedor/find-my-way/blob/main/docs/api.md#constructor)。

## 使用

### 定义 Controller 和 Middleware

Controller 和 Middleware 都是 IoCore 组件，继承自相应的基类。

```typescript
import { Application } from '@iocore/component';
import Http, {
  Controller,
  Middleware,
  Next,
  Context,
} from '@iocore/http';

// --- 中间件定义 ---
class LoggerMiddleware extends Middleware {
  // 从 Koa Context 注入数据
  @Middleware.InComing.Head('user-agent')
  private userAgent: string;

  async use(ctx: Context, next: Next) {
    const start = Date.now();
    console.log(`--> ${ctx.method} ${ctx.path} (User-Agent: ${this.userAgent})`);
    await next();
    const ms = Date.now() - start;
    console.log(`<-- ${ctx.method} ${ctx.path} - ${ctx.status} (${ms}ms)`);
  }
}

@Middleware.Dependencies(LoggerMiddleware) // 声明依赖，确保 LoggerMiddleware 先执行
class AuthMiddleware extends Middleware {
  @Middleware.InComing.Query('token')
  private token: string;

  async use(ctx: Context, next: Next) {
    if (this.token === 'valid-token') {
      ctx.state.user = { id: '123', name: 'Admin' };
      await next();
    } else {
      ctx.status = 401;
      ctx.body = 'Unauthorized';
    }
  }
}

// --- Controller 定义 ---
@Controller.Method('GET') // 响应 GET 请求
@Controller.Middleware(AuthMiddleware) // 应用 AuthMiddleware (LoggerMiddleware 会自动因依赖关系先执行)
class UserController extends Controller {
  // 从 URL 路径参数注入
  @Controller.InComing.Path('userId')
  private userId: string;

  // 从上游中间件设置的 ctx.state 注入
  // @Controller.InComing.State('user') // State 注入当前版本似乎在 router.ts 未实现
  // private currentUser: { id: string, name: string };

  async response(next: Next): Promise<any> {
    const currentUser = this.ctx.state.user; // 手动从 ctx.state 获取
    return {
      message: `Hello User ${this.userId}! Welcome, ${currentUser.name}!`,
    };
  }
}

@Controller.Method('POST') // 响应 POST 请求
class DataController extends Controller {
  // 注入解析后的请求体 (需要配合 koa-body 等中间件使用)
  @Controller.InComing.Body
  private data: any;

  response(next: Next) {
    console.log('Received data:', this.data);
    return { received: true, data: this.data };
  }
}

// 标记为弃用，将不会被绑定
@Controller.Method('GET')
@Controller.Deprecated
class OldController extends Controller {
  response(next: Next) {
    return 'This is deprecated';
  }
}

// --- 启动应用 ---
@Application.Inject(Http)
class MyApp extends Application {
  @Application.Inject(Http)
  private http: Http;

  public async main() {
    // --- 添加全局 Koa 中间件 (例如 body-parser) ---
    // 需要先安装: npm install koa-body
    try {
      const { koaBody } = await import('koa-body');
      // 在路由处理前添加 (prefix hook)
      this.http.hooks.add('prefix', koaBody());
      console.log('koa-body middleware added.');
    } catch (e) {
      console.warn('koa-body not installed, POST body parsing might not work.');
    }

    // --- 绑定 Controller ---
    // 将 /users/:userId 路径绑定到 UserController
    const unbindUser = await this.http.bind('/users/:userId', UserController);

    // 将 /data 路径绑定到 DataController
    const unbindData = await this.http.bind('/data', DataController);

    // OldController 不会被绑定，因为标记了 @Controller.Deprecated
    await this.http.bind('/old', OldController);

    console.log(`HTTP server listening on port ${this.http.props.port}`);

    // 可以选择性地解绑路由
    // if (unbindUser) unbindUser();
  }
}

Application.start(MyApp);
```

### `Http` 类

核心 HTTP 服务器组件。

*   **`constructor()`**: 解析环境变量配置。
*   **`initialize(): Promise<void>`**: 初始化 Koa 应用、find-my-way 路由器和 HTTP 服务器，并开始监听指定端口。IoCore 会自动调用。
*   **`terminate(): void`**: 关闭 HTTP 服务器。IoCore 会自动调用。
*   **`koa: Koa`**: Koa 应用实例。
*   **`app: Instance`** (find-my-way 实例): 路由器实例，可以用于更底层的路由操作。
*   **`server: Server`**: Node.js HTTP 服务器实例。
*   **`props: IOCORE_HTTP_CONFIGS`**: 加载的配置。
*   **`hooks: HttpMiddlewareHooks`**: 用于添加全局前置/后置 Koa 中间件的 Hook 点。
*   **`bind<T extends INewAble<Controller>>(url: string, controller: T): Promise<void | (() => void)>`**: 将一个 URL 路径绑定到一个 `Controller` 类。它会自动处理 `@Controller.Method`、`@Controller.Middleware` 和 `@Controller.Deprecated` 装饰器，并将解析后的中间件和 Controller 处理逻辑注册到路由器。返回一个可选的解绑函数。
    *   URL 路径支持 find-my-way 的参数语法 (例如 `/users/:id`)。
    *   如果 URL 以配置的 `defaultSuffix` (默认为 '/index') 结尾，该后缀会被自动移除。
    *   URL 中的 `[param]` 会被自动替换为 `:param`。

### `Controller` (抽象类)

继承自 `Router`。

*   **`abstract response(next: Next): T | Promise<T>`**: 实现此方法来处理请求并返回响应体。如果方法返回 `undefined`，则不会修改 `ctx.body`。
*   **`static Method(...args: HTTPMethod[]): ClassDecorator`**: 类装饰器，指定 Controller 处理的 HTTP 方法 (例如 'GET', 'POST')。
*   **`static Middleware(...args: IMiddleware[]): ClassDecorator`**: 类装饰器，将 Koa 中间件或自定义 `Middleware` 类关联到 Controller。
*   **`static Deprecated: ClassDecorator`**: 类装饰器，标记 Controller 为弃用，`http.bind` 将忽略它。
*   **`ctx: Context`** (注入): 当前请求的 Koa 上下文。
*   **`@Controller.InComing...`**: 属性装饰器，用于从 Koa Context 注入数据。

### `Middleware` (抽象类)

继承自 `Router`。用于创建可复用的、支持依赖注入的自定义中间件。

*   **`abstract use(ctx: Context, next: Next): Promise<unknown>`**: 实现此方法来定义中间件逻辑。调用 `await next()` 将控制权传递给下一个中间件。
*   **`static Dependencies(...args: IMiddleware[]): ClassDecorator`**: 类装饰器，声明当前中间件依赖的其他中间件（可以是 Koa 中间件或自定义 `Middleware` 类）。绑定 Controller 时会自动处理依赖顺序。
*   **`ctx: Context`** (注入): 当前请求的 Koa 上下文。
*   **`@Middleware.InComing...`**: 属性装饰器，用于从 Koa Context 注入数据。

### `Router` (基类，`Controller` 和 `Middleware` 继承)

*   **`static readonly InComing`**: 包含一组属性装饰器，用于将 Koa `Context` 中的数据注入到 `Controller` 或 `Middleware` 的属性中。
    *   `Head(key?: string)`: 从 `ctx.headers` 或 `ctx.request.headers` 注入。
    *   `Query(key?: string)`: 从 `ctx.query` 或 `ctx.request.query` 注入。
    *   `Path(key?: string)`: 从 `ctx.params` (URL 路径参数) 注入。
    *   `Body()`: 注入 `ctx.request.body` (需要配合 body 解析中间件)。
    *   所有装饰器都支持可选的回调函数进行数据转换/校验。

### `HttpMiddlewareHooks`

一个单例组件，用于管理全局 Koa 中间件。

*   **`add(type: 'prefix' | 'suffix', ...middlewares: Middleware[]): this`**: 添加全局中间件。
    *   `prefix`: 在 find-my-way 路由处理 **之前** 执行。
    *   `suffix`: 在 find-my-way 路由处理 **之后** 执行 (如果路由未匹配或路由处理器调用了 `next()`)。
*   **`del(type: 'prefix' | 'suffix', ...middlewares: Middleware[]): this`**: 移除全局中间件。
*   **`compose(type: 'prefix' | 'suffix'): Middleware`**: (内部使用) 获取组合后的中间件函数。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
