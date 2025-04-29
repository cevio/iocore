# @iocore/react

[![npm version](https://badge.fury.io/js/%40iocore%2Freact.svg)](https://badge.fury.io/js/%40iocore%2Freact)

用于构建单页应用程序（SPA）的 React 前端框架，集成了路由、请求、中间件和状态管理。

## 安装

```bash
npm install @iocore/react react react-dom qs path-to-regexp mitt --save
# or
yarn add @iocore/react react react-dom qs path-to-regexp mitt
```

## 依赖

*   `react`
*   `react-dom`
*   `qs` (用于查询字符串解析)
*   `path-to-regexp` (用于路由匹配和路径生成)
*   `mitt` (用于事件发布/订阅)

## 核心概念

### Application

`Application` 类是框架的核心，负责路由管理、中间件处理、页面渲染和导航。

```typescript
import { Application } from '@iocore/react';

// 创建应用实例，可以指定 URL 前缀
const app = new Application('/app');
```

### Controller

`Controller` 代表一个可路由的页面或组件集合。它使用 `path-to-regexp` 来定义带参数的路径，并可以附加中间件。

```typescript
import { Controller, defineController } from '@iocore/react';

// 定义一个 Controller
const userController = defineController< 'userId' | 'tab', 'sort' | 'filter' >(
  // 可以在这里添加 Controller 级别的中间件
);
```

### 路由

使用 `app.render()` 方法注册路由清单并启动应用。

```typescript
import React from 'react';
import { Application, defineController } from '@iocore/react';

const app = new Application();

// 定义 Controller
const homeController = defineController();
const userController = defineController<'userId'>();

// 路由清单 - 将路径与 Controller 关联
// 注意：Controller 本身不直接包含 React 组件，它主要用于路径匹配和中间件管理
const manifest = [
  { path: '/', controller: homeController },
  { path: '/users/:userId', controller: userController },
  // { path: '/about', controller: defineController() } // 可以直接定义
];

// --- React 组件 ---
function HomePage() {
  return <h1>Home</h1>;
}

function UserPage() {
  // 使用 hook 获取路由信息
  const location = app.useLocation();
  return <h1>User ID: {location.params.userId}</h1>;
}

function NotFoundPage() {
  return <h1>404 Not Found</h1>;
}

// --- 渲染逻辑组件 ---
// 这个组件负责根据当前 URL 和匹配到的 Controller 来决定渲染哪个页面组件
function AppRouter() {
  const location = app.useLocation(); // 获取当前路由信息

  // 尝试匹配已注册的 Controller
  const homeMatch = homeController.match(location.pathname);
  if (homeMatch) {
    // 如果匹配 HomeController (路径 '/')
    return <HomePage />;
  }

  const userMatch = userController.match(location.pathname);
  if (userMatch) {
    // 如果匹配 UserController (路径 '/users/:userId')
    // UserPage 内部会使用 useLocation() 获取 userId
    return <UserPage />;
  }

  // 如果以上都不匹配，渲染 NotFoundPage
  return <NotFoundPage />;
}


// --- 渲染应用 ---
app.render(
  document.getElementById('root'), // 挂载点
  manifest, // 路由清单
  <AppRouter /> // 提供一个 React 元素作为默认/回退组件。
                // 这个组件通常包含根据 app.useLocation() 和 controller.match()
                // 来决定实际渲染哪个页面组件的逻辑。
                // 如果 manifest 中的路由都未匹配，则直接渲染此组件。
);

```

**说明:**

*   `app.render` 的第三个参数 `notfound` (在示例中是 `<AppRouter />`) 是必需的，它定义了基础的渲染内容。
*   实际的页面组件切换逻辑通常放在这个 `notfound` 组件内部，通过 `app.useLocation()` 获取当前 URL，然后使用 `controller.match()` 来判断应该渲染哪个具体的页面组件 (如 `HomePage`, `UserPage` 等)。
*   `manifest` 的作用是让 `Application` 知道哪些路径对应哪些 `Controller`，以便在内部查找匹配项并应用相应的 `Controller` 级中间件。

### 中间件

中间件是 React 组件，可以在全局或特定路由（Controller）级别应用。它们接收 `PropsWithChildren<LocationProps>` 作为 props。

```typescript
import React, { PropsWithChildren } from 'react';
import { Middleware, LocationProps } from '@iocore/react';

// 定义全局中间件
const GlobalAuthMiddleware: Middleware = ({ children, pathname }) => {
  console.log('Global middleware for:', pathname);
  // 检查认证逻辑...
  const isAuthenticated = true; // 模拟认证状态
  if (!isAuthenticated && pathname !== '/login') {
     // 可以在中间件中重定向
     // app.redirect('/login'); // 假设 app 实例在作用域内可用
     // return null; // 或者不渲染子组件
  }
  return <>{children}</>; // 传递给下一个中间件或最终组件
};

// 定义路由中间件
const UserAccessMiddleware: Middleware<'userId'> = ({ children, params }) => {
  console.log('Checking access for user:', params.userId);
  // 检查用户权限...
  const hasAccess = true; // 模拟权限检查
  if (!hasAccess) {
    // return <h1>Access Denied for user {params.userId}</h1>; // 可以渲染错误信息
    return null;
  }
  return <>{children}</>;
};

// 应用全局中间件 (在所有路由之前执行)
app.use('global', GlobalAuthMiddleware);

// 应用路由级别的中间件 (仅在匹配 Controller 后，但在渲染具体组件前执行)
// 注意：这个 'router' 级别的中间件会在 *所有* 匹配到的 Controller 的中间件 *之前* 执行
app.use('router', (props) => {
  console.log('Router level middleware for path:', props.pathname);
  return <>{props.children}</>;
});

// 应用 Controller 级别的中间件 (在 Controller 定义时传入)
const userController = defineController<'userId'>(UserAccessMiddleware); // 这个中间件仅在 /users/:userId 匹配时执行

```

中间件执行顺序：`global` -> `router` -> `controller`。它们形成一个嵌套结构，包裹着最终由 `AppRouter` 渲染的页面组件。

### 请求

`app.request` 提供了一组方法来发送 HTTP 请求 (`get`, `post`, `put`, `delete`)。它会自动处理响应状态码，并在出现错误时触发错误处理机制（如果配置了状态组件）。

```typescript
async function fetchData() {
  try {
    const { data } = await app.request.get<{ message: string }>('/api/data');
    console.log(data.message);

    await app.request.post('/api/users', { name: 'New User' });
  } catch (error) {
    // 错误会被 Exception 类包装
    console.error('Request failed:', error.status, error.message);
    // 如果注册了对应的 StatusListener，UI 会自动更新
  }
}
```

可以自定义响应处理逻辑：

```typescript
app.request.useCustomResponse((response: any) => {
  // 假设后端返回 { code: 0, result: ..., msg: '...' }
  if (response.code !== 0) {
    // 如果自定义逻辑抛出 Exception，也会触发 StatusListener
    throw new Exception(response.code || 500, response.msg || 'Server error');
  }
  return response.result; // 只返回需要的数据部分
});
```

### 导航

使用 `app.redirect()`、`app.replace()` 和 `app.reload()` 来控制浏览器历史记录和页面状态。这些方法会触发内部事件，最终导致 `AppRouter` 重新渲染。

```typescript
// 跳转到新 URL (添加到历史记录)
app.redirect('/profile');

// 替换当前 URL (不添加到历史记录)
app.replace('/settings');

// 重新加载当前路由的数据和视图 (不会刷新整个页面，仅触发 URL 变更处理)
app.reload();
```

URL 会自动添加在 `Application` 构造函数中定义的前缀。

### Hooks

*   `app.usePrefix(): string`: 获取 URL 前缀。
*   `app.useLocation(): LocationProps`: 获取当前位置信息（路径名、参数、查询、哈希）。这是驱动路由渲染的核心 Hook。
*   `app.useErrorClear(): () => void`: 获取一个函数，用于手动清除当前显示的错误状态。

```typescript
import React from 'react';

function MyComponent() {
  const prefix = app.usePrefix();
  const location = app.useLocation();
  const clearError = app.useErrorClear();

  return (
    <div>
      <p>Prefix: {prefix}</p>
      <p>Path: {location.pathname}</p>
      <p>Params: {JSON.stringify(location.params)}</p>
      <p>Query: {JSON.stringify(location.query)}</p>
      <button onClick={clearError}>Clear Error</button>
    </div>
  );
}
```

### 错误处理

可以通过 `app.addStatusListener()` 注册特定 HTTP 状态码对应的 React 组件。当 `app.request` 遇到相应的错误状态码，或者手动调用 `app.exceptable()` 时，会渲染对应的状态组件，覆盖当前的正常页面内容。

```typescript
import React from 'react';
import { IStatusComponentProps } from '@iocore/react';

function ForbiddenComponent({ status, message }: IStatusComponentProps) {
  const clearError = app.useErrorClear(); // 可以获取清除函数
  return (
    <div>
      <h1>{status}: {message || 'Forbidden'}</h1>
      <button onClick={clearError}>Go Back</button>
    </div>
  );
}

function ServerErrorComponent({ status, message }: IStatusComponentProps) {
  return <h1>{status}: {message || 'Internal Server Error'}</h1>;
}

app.addStatusListener(403, ForbiddenComponent);
app.addStatusListener(500, ServerErrorComponent);

// 手动触发错误显示
// app.exceptable(new Exception(403, 'You do not have permission.'));
```

调用 `app.useErrorClear()` 获取到的函数可以清除错误状态，恢复正常页面渲染。

### Controller 方法

*   `controller.path(params?: Record<P, string>): { toString: () => string, query: (q: Record<Q, string>) => { toString: () => string } }`: 根据参数生成 URL 路径。可以链式调用 `query()` 添加查询参数。用于生成链接或编程式导航。
    ```typescript
    const userProfileUrl = userController.path({ userId: '123', tab: 'profile' }).toString();
    // userProfileUrl = '/users/123' (假设 tab 不是路径参数)

    const userSettingsUrl = userController.path({ userId: '456' }).query({ tab: 'settings' }).toString();
    // userSettingsUrl = '/users/456?tab=settings'
    ```
*   `controller.match(path: string): MatchResult<Record<P, string>> | false`: 匹配给定的路径名是否符合 Controller 的路由规则。返回匹配结果（包含提取的参数）或 `false`。主要用于 `AppRouter` 组件内部判断渲染哪个页面。
    ```typescript
    const matchResult = userController.match('/users/789');
    if (matchResult) {
      console.log(matchResult.params.userId); // '789'
    }
    ```

## 完整 API

### `Application`

*   `constructor(prefix?: string)`
*   `addStatusListener(status: number, component: IStatusComponent): this`
*   `use(type: MiddlewareType, ...middleware: Middleware[]): this`: type 为 'global' 或 'router'。
*   `usePrefix(): string` (Hook)
*   `useLocation(): LocationProps` (Hook)
*   `useErrorClear(): () => void` (Hook)
*   `render<T extends HTMLElement>(id: T, manifest: { path: string, controller: Controller }[], notfound: ReactNode): () => void`: 渲染应用，返回一个卸载函数。`notfound` 参数是必需的，作为路由匹配和渲染的入口点/回退。
*   `joinUrl(url: string): string`: 将相对 URL 与前缀合并。
*   `redirect(url: string): this`
*   `replace(url: string): this`
*   `reload(): this`
*   `exceptable(e: Exception): void`: 手动触发错误状态。
*   `request: Request`: 请求实例。
*   `on(path: string, opts: object | Function, handler?: Function)`: 底层路由注册方法 (来自 Router 基类, 由 manifest 间接调用)。
*   `off(path: string)`: 底层路由注销方法 (来自 Router 基类)。
*   `find(path: string): { handler: Function, params: object } | null`: 底层路由查找方法 (来自 Router 基类)。

### `Controller<P, Q>`

*   `constructor(middlewares: Middleware<P, Q>[])`
*   `initialize(app: Application, path: string): () => void`: 由 `app.render` 内部调用，用于注册路由到 Application 的内部路由器。
*   `path(params?: Record<P, string>): ...`
*   `match(path: string): MatchResult<...> | false`

### `defineController<P, Q>(...middlewares: Middleware<P, Q>[]): Controller<P, Q>`

创建 Controller 实例的工厂函数。

### `Request`

*   `useCustomResponse<T = any>(callback: (data: T) => any): this`
*   `get<T = any>(url: string | { toString: () => string }, headers?: HeadersInit): Promise<RequestQueryProps<T>>`
*   `post<T = any>(url: string | { toString: () => string }, body: object, headers?: HeadersInit): Promise<RequestQueryProps<T>>`
*   `put<T = any>(url: string | { toString: () => string }, body: object, headers?: HeadersInit): Promise<RequestQueryProps<T>>`
*   `delete<T = any>(url: string | { toString: () => string }, headers?: HeadersInit): Promise<RequestQueryProps<T>>`

### `Exception`

*   `constructor(status: number, msg?: string)`
*   `status: number`
*   `message: string`
*   `timestamp: number`

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
