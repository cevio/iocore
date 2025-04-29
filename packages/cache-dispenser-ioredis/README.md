# @iocore/cache-dispenser-ioredis

[![npm version](https://badge.fury.io/js/%40iocore%2Fcache-dispenser-ioredis.svg)](https://badge.fury.io/js/%40iocore%2Fcache-dispenser-ioredis)

IoCore 的 Redis 缓存分发器。

这是 `@iocore/cache` 模块 `CacheDispenser` 抽象类的一个具体实现，使用 `@iocore/ioredis` 连接 Redis 来存储和检索缓存数据。支持设置缓存过期时间 (通过 Redis 的 `EXPIRE` 功能)。

## 安装

```bash
npm install @iocore/cache-dispenser-ioredis @iocore/cache @iocore/component @iocore/ioredis --save
# or
yarn add @iocore/cache-dispenser-ioredis @iocore/cache @iocore/component @iocore/ioredis
```

## 依赖

*   `@iocore/cache`: 提供 `CacheDispenser` 抽象类。
*   `@iocore/component`: IoCore 核心组件系统。
*   `@iocore/ioredis`: 提供 Redis 连接。

## 配置

该模块本身没有配置项，但它依赖于 `@iocore/ioredis` 的配置。请确保已通过环境变量 `IOCORE_IOREDIS_CONFIGS` 正确配置了 Redis 连接信息。详情请参考 `@iocore/ioredis` 的 README。

## 使用

`IoRedisCacheDispenser` 类是一个 IoCore `Application` 组件，通常作为其他需要 Redis 缓存的组件（如 `@iocore/configs`）的依赖项注入。

```typescript
import { Application } from '@iocore/component';
import { CacheDispenser } from '@iocore/cache';
import IoRedisCacheDispenser from '@iocore/cache-dispenser-ioredis';
import IORedis from '@iocore/ioredis'; // 需要确保 IORedis 模块也被注入和启动

// 确保 IORedis 已配置 (通过 .env 或 process.env)
// process.env.IOCORE_IOREDIS_CONFIGS = JSON.stringify({ host: 'localhost', port: 6379 });

// 模拟一个需要 Redis 缓存的服务
@Application.Injectable()
class MyRedisCachedService extends Component {
  // 注入 Redis 缓存分发器
  @Application.Inject(IoRedisCacheDispenser)
  private cache: CacheDispenser<{ value: string }>; // 明确缓存值的类型

  private async generateData(itemId: string): Promise<{ value: string }> {
    console.log(`Generating data for item ${itemId}...`);
    await new Promise(res => setTimeout(res, 150)); // 模拟耗时
    return { value: `Generated data for ${itemId} at ${Date.now()}` };
  }

  async getItemData(itemId: string): Promise<{ value: string }> {
    const cacheKey = `item:${itemId}:info`;

    if (await this.cache.has(cacheKey)) {
      console.log(`Redis Cache hit for key: ${cacheKey}`);
      const ttl = await this.cache.ttl(cacheKey);
      console.log(`TTL: ${ttl} seconds`);
      return this.cache.get(cacheKey);
    }

    console.log(`Redis Cache miss for key: ${cacheKey}`);
    const data = await this.generateData(itemId);
    // 缓存数据 5 分钟 (300 秒)
    await this.cache.set(cacheKey, data, 300);
    return data;
  }

  async clearItemData(itemId: string): Promise<void> {
    const cacheKey = `item:${itemId}:info`;
    await this.cache.delete(cacheKey);
    console.log(`Redis Cache cleared for key: ${cacheKey}`);
  }
}

// 启动应用
// 需要确保 IoRedisCacheDispenser 和 IORedis 都被 IoCore 管理
@Application.Inject(IORedis, IoRedisCacheDispenser, MyRedisCachedService)
class BootApp extends Application {
  @Application.Inject(MyRedisCachedService)
  service: MyRedisCachedService;

  async main() {
    console.log('--- Redis Cache Test ---');
    const item = 'item-abc';
    await this.service.getItemData(item);
    await this.service.getItemData(item);
    await this.service.clearItemData(item);
    await this.service.getItemData(item);
  }

  // Application 抽象类要求实现 initialize 和 terminate
  initialize() {}
  terminate() {}
}

Application.start(BootApp);

```

### `IoRedisCacheDispenser<R = any>` 类

继承自 `CacheDispenser`。

*   **`initialize(): void`**: 空实现。IoCore 会自动调用。
*   **`terminate(): void`**: 空实现。IoCore 会自动调用。
*   **`set(key: string, value: R, time?: number): Promise<R>`**: 使用 `SET` 或 `SETEX` 命令将 `value` (JSON 序列化后) 存入 Redis。
    *   `key`: 缓存键。
    *   `value`: 要缓存的值 (会被 `JSON.stringify`)。
    *   `time` (可选): 过期时间（秒）。如果为 0 或不提供，则不设置过期时间。
    *   返回 `value`。
*   **`has(key: string): Promise<boolean>`**: 使用 `EXISTS` 命令检查键是否存在。
*   **`get(key: string): Promise<R>`**: 使用 `GET` 命令获取键的值，并使用 `JSON.parse` 解析。
*   **`ttl(key: string): Promise<number>`**: 使用 `TTL` 命令获取键的剩余生存时间（秒）。如果键不存在或没有设置过期时间，返回 `0` (Redis `TTL` 对不存在的键返回 -2，对无过期时间的键返回 -1，这里做了转换)。
*   **`delete(key: string): Promise<number>`**: 使用 `DEL` 命令删除键。返回删除的键的数量 (通常是 0 或 1)。

## 注意事项

*   所有存入 Redis 的值都会被 `JSON.stringify`，取出时会被 `JSON.parse`。
*   确保你的 Redis 服务器已启动，并且 `@iocore/ioredis` 配置正确。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
