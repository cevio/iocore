# @iocore/cache

[![npm version](https://badge.fury.io/js/%40iocore%2Fcache.svg)](https://badge.fury.io/js/%40iocore%2Fcache)

IoCore 的多层缓存管理模块。

提供了一种基于模板和多种缓存存储后端（Dispenser）的缓存策略。

## 核心概念

1.  **`CacheDispenser<R>` (抽象类)**: 定义了缓存存储的基本接口 (`set`, `get`, `has`, `ttl`, `delete`)。具体的实现类（如 `@iocore/cache-dispenser-momery`, `@iocore/cache-dispenser-file`, `@iocore/cache-dispenser-ioredis`）负责与特定的存储后端交互。
2.  **`CacheImplementer<T, R>` (抽象类)**: 定义了具体的缓存逻辑。
    *   **模板字符串 `T`**: 用于动态生成缓存键。格式为 `prefix:{paramName:type}:suffix...`，例如 `user:{userId:number}:profile:{field:string}`。
    *   **`provide(options: ExtractParams<T>): Promise<[R, number?]>`**: **必须实现** 的方法。当缓存未命中时，此方法被调用以生成原始数据 `R`。它可以选择性地返回一个缓存过期时间（秒）。
    *   **缓存分发器 `pools`**: 在构造函数中传入一个或多个 `CacheDispenser` **类**。`CacheImplementer` 会按顺序使用这些分发器。
3.  **缓存键生成**: `CacheImplementer` 根据模板字符串 `T` 和传入的参数 `options` (类型由 `ExtractParams<T>` 推断) 自动生成缓存键。可以通过设置环境变量 `CACHE_PREFIX` 来添加全局缓存键前缀。
4.  **读写逻辑**: `read` 和 `write` 方法协调多个 `CacheDispenser`。
    *   `read`: 按顺序查询 Dispenser，第一个命中则返回数据，并将此数据写回到之前未命中的 Dispenser 中（缓存预热）。如果所有 Dispenser 都未命中，则调用 `provide` 获取数据，然后写入所有 Dispenser。
    *   `write`: 调用 `provide` 获取数据，然后将数据写入所有 Dispenser。
    *   `remove`: 删除所有 Dispenser 中的对应缓存键。

## 安装

```bash
npm install @iocore/cache @iocore/component --save
# 还需要至少安装一个 CacheDispenser 实现，例如：
npm install @iocore/cache-dispenser-momery --save
# or
yarn add @iocore/cache @iocore/component
yarn add @iocore/cache-dispenser-momery
```

## 依赖

*   `@iocore/component`: IoCore 核心组件系统。
*   至少一个 `CacheDispenser` 实现包。

## 使用

```typescript
import { Application, Component } from '@iocore/component';
import {
  CacheImplementer,
  CacheDispenser,
  ExtractParams,
} from '@iocore/cache';
import MomeryCacheDispenser from '@iocore/cache-dispenser-momery';
// import FileCacheDispenser from '@iocore/cache-dispenser-file'; // 假设使用文件作为二级缓存

// --- 定义缓存实现 ---

// 模板：缓存用户的配置信息，键类似 user:123:settings
type UserSettingsTemplate = 'user:{userId:number}:settings';
// 缓存的数据类型
interface UserSettingsData {
  theme: string;
  notifications: boolean;
  lastLogin: string;
}

@Application.Injectable() // 缓存实现本身也是一个 Component
class UserSettingsCache extends CacheImplementer<UserSettingsTemplate, UserSettingsData> {
  constructor(
    // 注入缓存分发器 (按顺序使用)
    @Application.Inject(MomeryCacheDispenser)
    memoryDispenser: CacheDispenser<UserSettingsData>,
    // @Application.Inject(FileCacheDispenser)
    // fileDispenser: CacheDispenser<UserSettingsData>,
  ) {
    super(
      'user:{userId:number}:settings', // 模板字符串
      // 传入 Dispenser 类
      MomeryCacheDispenser,
      // FileCacheDispenser,
    );
  }

  // 实现 provide 方法：当缓存未命中时，从源头获取数据
  protected async provide(
    options: ExtractParams<UserSettingsTemplate>
  ): Promise<[UserSettingsData, number?]> {
    console.log(`[UserSettingsCache] PROVIDE called for userId: ${options.userId}`);
    // 模拟从数据库或其他服务获取数据
    await new Promise(res => setTimeout(res, 80));
    const data: UserSettingsData = {
      theme: Math.random() > 0.5 ? 'dark' : 'light',
      notifications: Math.random() > 0.5,
      lastLogin: new Date().toISOString(),
    };
    // 返回数据和可选的过期时间 (例如 10 分钟)
    const expireInSeconds = 600;
    return [data, expireInSeconds];
  }
}

// --- 使用缓存 --- //

@Application.Injectable()
class UserProfileService extends Component {
  @Application.Inject(UserSettingsCache)
  private settingsCache: UserSettingsCache;

  async displaySettings(userId: number) {
    console.log(`\n--- Displaying settings for user ${userId} ---`);
    // 使用 read 方法获取缓存或从 provide 生成
    const settings = await this.settingsCache.read({ userId });
    console.log('Settings:', settings);
  }

  async refreshSettings(userId: number) {
    console.log(`\n--- Refreshing settings for user ${userId} ---`);
    // 使用 write 方法强制从 provide 获取并更新所有缓存
    const settings = await this.settingsCache.write({ userId });
    console.log('Refreshed Settings:', settings);
  }

  async clearSettingsCache(userId: number) {
    console.log(`\n--- Clearing cache for user ${userId} ---`);
    // 使用 remove 方法删除所有缓存中的条目
    await this.settingsCache.remove({ userId });
  }
}

// --- 启动应用 --- //

// 确保所有依赖 (包括 Dispenser 和 Implementer) 都被注入
@Application.Inject(
  MomeryCacheDispenser,
  // FileCacheDispenser,
  UserSettingsCache,
  UserProfileService
)
class BootApp extends Application {
  @Application.Inject(UserProfileService)
  service: UserProfileService;

  async main() {
    const userId = 42;
    await this.service.displaySettings(userId); // 第一次调用，执行 provide
    await this.service.displaySettings(userId); // 第二次调用，命中内存缓存
    await this.service.refreshSettings(userId); // 强制刷新，执行 provide 并写入缓存
    await this.service.displaySettings(userId); // 命中内存缓存 (已刷新)
    await this.service.clearSettingsCache(userId); // 清除缓存
    await this.service.displaySettings(userId); // 再次调用，执行 provide
  }

  initialize() {}
  terminate() {}
}

Application.start(BootApp);
```

### `CacheImplementer<T, R>` 类

*   **`constructor(template: T, ...pools: INewAble<CacheDispenser<R>>[])`**: 构造函数。
    *   `template`: 缓存键模板字符串。
    *   `pools`: 按优先级顺序传入的 `CacheDispenser` 类。
*   **`protected abstract provide(options: ExtractParams<T>): Promise<[R, number?]>`**: **必须实现**。定义数据源逻辑。
*   **`read(options: ExtractParams<T>): Promise<R>`**: 读取缓存。尝试按顺序从 `pools` 中获取，如果未命中则调用 `provide`，并将结果写回所有 `pools`。
*   **`write(options: ExtractParams<T>): Promise<R>`**: 强制写入缓存。调用 `provide` 获取最新数据，并写入所有 `pools`。
*   **`remove(options: ExtractParams<T>): Promise<void>`**: 从所有 `pools` 中删除缓存。

### `CacheDispenser<R>` (抽象类)

定义缓存存储后端必须实现的接口。

*   `set(key: string, value: R, time?: number): Promise<R>`
*   `has(key: string): Promise<boolean>`
*   `get(key: string): Promise<R>`
*   `ttl(key: string): Promise<number>` (返回秒)
*   `delete(key: string): Promise<unknown>`

### `ExtractParams<Template>`

一个 TypeScript 类型工具，用于从模板字符串中提取参数名和推断类型。

```typescript
// type Params = { userId: number, type: string }
type Params = ExtractParams<'data:{userId:number}:{type:string}'>;
```

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
