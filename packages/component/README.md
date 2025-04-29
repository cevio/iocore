# @iocore/component

[![npm version](https://badge.fury.io/js/%40iocore%2Fcomponent.svg)](https://badge.fury.io/js/%40iocore%2Fcomponent)

IoCore 框架的核心组件和依赖注入系统。

提供了一个基于类的依赖注入容器和生命周期管理机制，使用装饰器来定义组件、它们的依赖关系以及初始化和终止逻辑。

## 安装

```bash
npm install @iocore/component reflect-metadata --save
# or
yarn add @iocore/component reflect-metadata
```

## 依赖

*   `reflect-metadata`: 用于支持装饰器元数据。

**重要**: 你需要在你的应用程序入口文件的顶部导入 `reflect-metadata`：

```typescript
import 'reflect-metadata';
// ... 你的其他代码
```

## 核心概念

### Component

所有 IoCore 组件的基础类。任何希望被 IoCore 管理（注入、生命周期）的类都应该直接或间接地继承自 `Component`。

### Application

继承自 `Component` 的特殊抽象类，代表具有初始化 (`initialize`) 和终止 (`terminate`) 生命周期的组件，通常用于表示服务器、数据库连接池等需要启动和停止的服务。

### Decorators (装饰器)

*   **`@Component.Injectable(callback?: IInjectableCallback)`**: 类装饰器。
    *   **必须** 添加到所有希望被 IoCore 管理的 `Component` 类上。
    *   可选地接收一个 `callback` 函数 `(ctx: Context<T>) => unknown | Promise<unknown>`。这个回调函数会在组件实例创建 **之后**，但在注入到其他组件 **之前** 执行。`ctx` 参数包含：
        *   `ctx.value`: 当前创建的组件实例。
        *   `ctx.wrap`: 组件的包装器实例 (`Wrap`)。
        *   `ctx.callbacks`: 一个数组，可以在这里 `push` 清理函数，这些函数会在组件销毁时执行。
*   **`@Component.Singleton`**: 类装饰器。
    *   标记一个组件为单例。IoCore 容器将只创建该类的一个实例，并在所有注入点共享它。
    *   默认情况下，组件是 **非单例** 的，每次注入都会创建一个新实例 (除非注入的是单例依赖)。
*   **`@Component.Inject(clazz: INewAble<T>)`**: 属性装饰器。
    *   用于声明一个属性依赖。将指定的 `clazz` (必须是 `@Component.Injectable` 的类) 注入到该属性。
    *   IoCore 会自动处理依赖的实例化和注入。
*   **`@Application.Server`**: 类装饰器 (快捷方式)。
    *   **必须** 添加到继承自 `Application` 的类上。
    *   它等同于 `@Component.Singleton` 和 `@Component.Injectable(ApplicationServer)` 的组合，确保 `Application` 子类是单例，并自动处理 `initialize` 和 `terminate` 方法的调用。

### Meta

一个用于创建和管理装饰器元数据的工具类。它提供了 `createClassDecorator`, `createPropertyDecorator`, `createMethodDecorator`, `createParameterDecorator` 等静态方法，用于创建自定义装饰器并将元数据附加到类、属性、方法或参数上。

### Wrap

内部类，用于包装每个注册的 `Component` 类。它负责管理组件的元数据、生命周期状态 (`status`)、依赖关系、上下文 (`Context`) 和实例化逻辑。

### Context

每个组件实例（非单例）或单例组件的包装器 (`Wrap`) 都有一个关联的 `Context`。它存储了组件实例 (`value`) 和销毁时需要执行的回调 (`callbacks`)。

### 生命周期

1.  **Preload (`Component.preload(clazz)`)**: 预加载组件类，返回 `Wrap` 实例。会递归预加载所有依赖。
2.  **Start (`wrap.start()`)**: 启动组件 (及其依赖)。
    *   状态变为 `INITING`。
    *   解析并预加载所有 `@Inject` 的依赖项。
    *   如果是单例，调用 `create()` 创建实例并缓存。
    *   执行 `@Injectable` 的回调函数。
    *   (对于 `Application` 子类) 调用 `initialize()` 方法。
    *   状态变为 `INTED` (成功) 或 `INTERR` (失败)。
3.  **Create (`wrap.create()` 或 `Component.create(clazz)`)**: 创建组件实例。
    *   如果是单例且已创建，直接返回缓存的实例。
    *   创建新实例。
    *   递归创建并注入 **非单例** 依赖的新实例。
    *   注入 **单例** 依赖的共享实例。
    *   执行 `@Injectable` 的回调函数。
    *   返回实例或 `Context`。
4.  **Stop (`wrap.stop()`)**: 停止组件。
    *   状态变为 `ENDING`。
    *   执行 `Context.callbacks` 中注册的清理函数 (按 LIFO 顺序)。
    *   (对于 `Application` 子类) 调用 `terminate()` 方法。
    *   清空实例 (如果是单例)。
    *   状态变为 `ENDED` (成功) 或 `ENDERR` (失败)。
5.  **Terminate (`Application.terminate()`)**: 停止所有已注册的 `Application` 组件。

## 使用示例

```typescript
import 'reflect-metadata';
import Component, {
  Application,
  Context,
  IInjectableCallback,
} from '@iocore/component';

// --- 定义服务组件 ---

interface IDatabase {
  query(sql: string): Promise<string[]>;
}

// 模拟数据库连接 (Application)
@Application.Server // <=> @Component.Singleton + @Component.Injectable(ApplicationServer)
class DatabaseConnection extends Application implements IDatabase {
  private connectionId: string;

  async initialize(): Promise<void> {
    this.connectionId = `conn-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[DatabaseConnection] Initialized, ID: ${this.connectionId}`);
  }

  async terminate(): Promise<void> {
    console.log(`[DatabaseConnection] Terminated, ID: ${this.connectionId}`);
  }

  async query(sql: string): Promise<string[]> {
    console.log(`[DatabaseConnection ${this.connectionId}] Executing query: ${sql}`);
    await new Promise(res => setTimeout(res, 50)); // 模拟延迟
    return [`Result for: ${sql}`];
  }
}

// 服务注入回调示例
const userServiceCallback: IInjectableCallback<UserService> = (ctx) => {
  console.log(`[UserService Injectable Callback] UserService instance created. User count: ${ctx.value.getUserCount()}`);
  // 注册清理函数
  ctx.callbacks.push(() => {
    console.log(`[UserService Cleanup] Cleaning up UserService instance.`);
  });
};

// 用户服务 (普通 Component，非单例)
@Component.Injectable(userServiceCallback)
class UserService extends Component {
  // 注入单例的数据库连接
  @Component.Inject(DatabaseConnection)
  private db: IDatabase;

  private userCount = 0;

  constructor() {
    super();
    this.userCount = Math.floor(Math.random() * 100);
    console.log(`[UserService Constructor] Instance created.`);
  }

  async getUser(id: number): Promise<string> {
    const result = await this.db.query(`SELECT * FROM users WHERE id = ${id}`);
    return result[0] || 'User not found';
  }

  getUserCount(): number {
    return this.userCount;
  }
}

// --- 定义主应用程序 ---

@Application.Server
class MyApp extends Application {
  // 注入非单例的 UserService
  @Component.Inject(UserService)
  private userService1: UserService;

  // 再次注入，会得到一个新的 UserService 实例
  @Component.Inject(UserService)
  private userService2: UserService;

  // 注入单例的 DatabaseConnection
  @Component.Inject(DatabaseConnection)
  private db: IDatabase;

  async initialize(): Promise<void> {
    console.log('[MyApp] Initialized.');
  }

  async terminate(): Promise<void> {
    console.log('[MyApp] Terminated.');
  }

  async run() {
    console.log('\n--- Running MyApp ---');
    console.log('Checking db connection instance:', this.db === (this.userService1 as any).db ? 'Same instance' : 'Different instance'); // true
    console.log('Checking user service instances:', this.userService1 === this.userService2 ? 'Same instance' : 'Different instance'); // false

    const user1 = await this.userService1.getUser(1);
    console.log('User 1:', user1);
    console.log('User service 1 count:', this.userService1.getUserCount());

    const user2 = await this.userService2.getUser(2);
    console.log('User 2:', user2);
    console.log('User service 2 count:', this.userService2.getUserCount());

    console.log('--- Finished MyApp Run ---\n');
  }
}

// --- 启动和停止 --- (通常在入口文件)
async function bootstrap() {
  console.log('>>> Bootstrapping application...');
  // 预加载并启动 MyApp (会自动启动其依赖)
  // 方式一：通过 Component.create (适用于 Application)
  const myAppInstance = await Component.create(MyApp);
  await myAppInstance.run();

  // 方式二：通过 Application.start (更常用，内部调用 preload 和 create)
  // const myAppInstance = await Application.start(MyApp);
  // await myAppInstance.main(); // 假设 Application 有 main 方法

  console.log('\n>>> Tearing down application...');
  // 停止所有 Application 组件 (会按依赖反向顺序停止)
  await Application.terminate();
  console.log('>>> Application terminated.');
}

bootstrap();

```

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
