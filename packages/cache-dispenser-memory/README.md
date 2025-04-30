# @iocore/cache-dispenser-memory

[![npm version](https://badge.fury.io/js/%40iocore%2Fcache-dispenser-memory.svg)](https://badge.fury.io/js/%40iocore%2Fcache-dispenser-memory)

**注意:** 包名可能是 `memory` 的拼写错误。

IoCore 的内存缓存分发器。

这是 `@iocore/cache` 模块 `CacheDispenser` 抽象类的一个具体实现，将缓存数据存储在 Node.js 进程的内存中。支持设置缓存过期时间。

## 安装

```bash
npm install @iocore/cache-dispenser-memory @iocore/cache @iocore/component --save
# or
yarn add @iocore/cache-dispenser-memory @iocore/cache @iocore/component
```

## 依赖

*   `@iocore/cache`: 提供 `CacheDispenser` 抽象类。
*   `@iocore/component`: IoCore 核心组件系统。

## 配置

该模块没有外部配置项。

## 使用

`memoryCacheDispenser` 类是一个 IoCore `Application` 组件（因为它有 `initialize` 和 `terminate` 来管理过期检查定时器），通常作为其他需要缓存的组件（如 `@iocore/configs`）的依赖项注入。

```typescript
import { Application } from '@iocore/component';
import { CacheDispenser } from '@iocore/cache';
import memoryCacheDispenser from '@iocore/cache-dispenser-memory';

// 模拟一个需要缓存的服务
@Application.Injectable()
class MyCachedService extends Component {
  // 注入内存缓存分发器
  @Application.Inject(memoryCacheDispenser)
  private cache: CacheDispenser<string>; // 类型参数 R 定义了缓存值的类型

  private async expensiveOperation(userId: number): Promise<string> {
    console.log(`Performing expensive operation for user ${userId}...`);
    await new Promise(res => setTimeout(res, 100)); // 模拟耗时
    return `Data for user ${userId}`;
  }

  async getUserData(userId: number): Promise<string> {
    const cacheKey = `user:${userId}:data`;

    if (await this.cache.has(cacheKey)) {
      console.log(`Cache hit for key: ${cacheKey}`);
      const ttl = await this.cache.ttl(cacheKey);
      console.log(`TTL: ${ttl} seconds`);
      return this.cache.get(cacheKey);
    }

    console.log(`Cache miss for key: ${cacheKey}`);
    const data = await this.expensiveOperation(userId);
    // 缓存数据 60 秒
    await this.cache.set(cacheKey, data, 60);
    return data;
  }

  async clearUserData(userId: number): Promise<void> {
    const cacheKey = `user:${userId}:data`;
    await this.cache.delete(cacheKey);
    console.log(`Cache cleared for key: ${cacheKey}`);
  }
}

// 启动应用
// 确保 memoryCacheDispenser 被 IoCore 管理
@Application.Inject(memoryCacheDispenser, MyCachedService)
class BootApp extends Application {
  @Application.Inject(MyCachedService)
  service: MyCachedService;

  async main() {
    console.log('--- First call ---');
    await this.service.getUserData(123);
    console.log('\n--- Second call (should hit cache) ---');
    await this.service.getUserData(123);

    console.log('\n--- Clearing cache ---');
    await this.service.clearUserData(123);

    console.log('\n--- Third call (should miss cache) ---');
    await this.service.getUserData(123);
  }

  // Application 抽象类要求实现 initialize 和 terminate
  initialize() {}
  terminate() {}
}

Application.start(BootApp);
```

### `memoryCacheDispenser<R = any>` 类

继承自 `CacheDispenser`。

*   **`initialize(): void`**: 启动一个 `setInterval` 定时器 (每秒检查一次)，用于清理过期的缓存条目。IoCore 会自动调用。
*   **`terminate(): void`**: 清除过期检查定时器。IoCore 会自动调用。
*   **`set(key: string, value: R, time?: number): Promise<R>`**: 设置缓存。
    *   `key`: 缓存键。
    *   `value`: 要缓存的值。
    *   `time` (可选): 过期时间（秒）。如果为 0 或不提供，则永不过期。
    *   返回 `value`。
*   **`has(key: string): Promise<boolean>`**: 检查缓存键是否存在（且未过期）。
*   **`get(key: string): Promise<R>`**: 获取缓存值。如果键不存在或已过期，行为未定义（可能返回 `undefined`）。应先用 `has` 检查。
*   **`ttl(key: string): Promise<number>`**: 获取缓存键的剩余生存时间（秒）。如果键不存在或永不过期，返回 `undefined` 或 `0` (根据实现，当前实现对于永不过期返回 0，不存在可能出错)。
*   **`delete(key: string): Promise<void>`**: 删除缓存键。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
