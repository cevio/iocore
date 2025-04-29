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
const userController = defineController<'userId'>()

// 路由清单
const manifest = [
  { path: '/', controller: homeController },
  { path: '/users/:userId', controller: userController },
];

// 组件
function HomePage() {
  return <h1>Home</h1>;
}

function UserPage() {
  const location = app.useLocation();
  return <h1>User ID: {location.params.userId}</h1>;
}

function NotFoundPage() {
  return <h1>404 Not Found</h1>;
}

// 渲染应用
app.render(
  document.getElementById('root'),
  manifest,
  // 根据当前路由渲染不同的页面
  (() => {
    const location = app.useLocation();
    const homeMatch = homeController.match(location.pathname);
    if (homeMatch) return <HomePage />;

    const userMatch = userController.match(location.pathname);
    if (userMatch) return <UserPage />;

    return <NotFoundPage />;
  })()
);
```

### 中间件

中间件是 React 组件，可以在全局或特定路由（Controller）级别应用。它们接收 `PropsWithChildren<LocationProps>` 作为 props。

```typescript
import React, { PropsWithChildren } from 'react';
import { Middleware, LocationProps } from '@iocore/react';

// 定义全局中间件
const GlobalAuthMiddleware: Middleware = ({ children, pathname }) => {
  console.log('Global middleware for:', pathname);
  // 检查认证逻辑...
  return <>{children}</>;
};

// 定义路由中间件
const UserAccessMiddleware: Middleware<'userId'> = ({ children, params }) => {
  console.log('Checking access for user:', params.userId);
  // 检查用户权限...
  return <>{children}</>;
};

// 应用全局中间件
app.use('global', GlobalAuthMiddleware);

// 应用路由中间件 (在 Controller 定义时传入)
const userController = defineController<'userId'>(UserAccessMiddleware);

// 应用 Controller 级别的中间件，在 Router 级别执行
app.use('router', (props) => {
  console.log('Router level middleware');
  return <>{props.children}</>;
});
```

中间件执行顺序：`global` -> `router` -> `controller`。

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
  }
}
```

可以自定义响应处理逻辑：

```typescript
app.request.useCustomResponse((response: any) => {
  // 假设后端返回 { code: 0, result: ..., msg: '...' }
  if (response.code !== 0) {
    throw new Exception(response.code || 500, response.msg || 'Server error');
  }
  return response.result;
});
```

### 导航

使用 `app.redirect()`、`app.replace()` 和 `app.reload()` 来控制浏览器历史记录和页面状态。

```typescript
// 跳转到新 URL (添加到历史记录)
app.redirect('/profile');

// 替换当前 URL (不添加到历史记录)
app.replace('/settings');

// 重新加载当前路由的数据和视图 (不会刷新整个页面)
app.reload();
```

URL 会自动添加在 `Application` 构造函数中定义的前缀。

### Hooks

*   `app.usePrefix(): string`: 获取 URL 前缀。
*   `app.useLocation(): LocationProps`: 获取当前位置信息（路径名、参数、查询、哈希）。
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

可以通过 `app.addStatusListener()` 注册特定 HTTP 状态码对应的 React 组件。当 `app.request` 遇到相应的错误状态码，或者手动调用 `app.exceptable()` 时，会渲染对应的状态组件。

```typescript
import React from 'react';
import { IStatusComponentProps } from '@iocore/react';

function ForbiddenComponent({ status, message }: IStatusComponentProps) {
  return <h1>{status}: {message || 'Forbidden'}</h1>;
}

function ServerErrorComponent({ status, message }: IStatusComponentProps) {
  return <h1>{status}: {message || 'Internal Server Error'}</h1>;
}

app.addStatusListener(403, ForbiddenComponent);
app.addStatusListener(500, ServerErrorComponent);

// 手动触发错误显示
app.exceptable(new Exception(403, 'You do not have permission.'));
```

### Controller 方法

*   `controller.path(params?: Record<P, string>): { toString: () => string, query: (q: Record<Q, string>) => { toString: () => string } }`: 根据参数生成 URL 路径。可以链式调用 `query()` 添加查询参数。
    ```typescript
    const url = userController.path({ userId: '123' }).toString(); // /users/123
    const urlWithQuery = userController.path({ userId: '456' }).query({ tab: 'profile' }).toString(); // /users/456?tab=profile
    ```
*   `controller.match(path: string): MatchResult<Record<Q, string>> | false`: 匹配给定的路径是否符合 Controller 的路由规则。返回匹配结果或 `false`。
    ```typescript
    const matchResult = userController.match('/users/789?tab=settings');
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
*   `render<T extends HTMLElement>(id: T, manifest: { path: string, controller: Controller }[], notfound?: ReactNode): () => void`: 渲染应用，返回一个卸载函数。
*   `joinUrl(url: string): string`: 将相对 URL 与前缀合并。
*   `redirect(url: string): this`
*   `replace(url: string): this`
*   `reload(): this`
*   `exceptable(e: Exception): void`: 手动触发错误状态。
*   `request: Request`: 请求实例。
*   `on(path: string, opts: object | Function, handler?: Function)`: 底层路由注册方法 (来自 Router 基类)。
*   `off(path: string)`: 底层路由注销方法 (来自 Router 基类)。
*   `find(path: string): { handler: Function, params: object } | null`: 底层路由查找方法 (来自 Router 基类)。

### `Controller<P, Q>`

*   `constructor(middlewares: Middleware<P, Q>[])`
*   `initialize(app: Application, path: string): () => void`: 由 `app.render` 内部调用。
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
