# @iocore/ioredis

[![npm version](https://badge.fury.io/js/%40iocore%2Fioredis.svg)](https://badge.fury.io/js/%40iocore%2Fioredis)

IoCore 的 ioredis 模块。

集成了 `ioredis` 库，提供了一个 IoCore 组件来管理 Redis 连接。

## 安装

```bash
npm install @iocore/ioredis @iocore/component ioredis --save
# or
yarn add @iocore/ioredis @iocore/component ioredis
```

## 依赖

*   `@iocore/component`
*   `ioredis`: 功能强大的 Node.js Redis 客户端。

## 配置

通过环境变量 `IOCORE_IOREDIS_CONFIGS` 配置 ioredis。该变量应包含一个 JSON 字符串，其内容是 ioredis 的 `RedisOptions`。

**示例 `.env` 文件:**

```env
# 连接到单个 Redis 实例
IOCORE_IOREDIS_CONFIGS='{"host":"localhost","port":6379,"password":"yourpassword","db":0}'

# 连接到 Redis Sentinel
# IOCORE_IOREDIS_CONFIGS='{"sentinels":[{"host":"localhost","port":26379},{"host":"localhost","port":26380}],"name":"mymaster","password":"yourpassword","db":0}'

# 连接到 Redis Cluster
# IOCORE_IOREDIS_CONFIGS='[{"host":"localhost","port":7000},{"host":"localhost","port":7001}]'
```

有关 `RedisOptions` 的详细信息，请参阅 [ioredis 文档](https://github.com/luin/ioredis/blob/main/API.md#new-redisport-host-options)。

## 使用

`IORedis` 类是一个 IoCore `Application` 组件，可以通过依赖注入使用。

```typescript
import { Application } from '@iocore/component';
import IORedis from '@iocore/ioredis';
import { Redis } from 'ioredis';

// 配置 Redis (通常通过环境变量完成)
// process.env.IOCORE_IOREDIS_CONFIGS = JSON.stringify({ host: 'localhost', port: 6379 });

@Application.Inject(IORedis)
class MyApp extends Application {

  @Application.Inject(IORedis)
  private ioredis: IORedis;

  public async main() {
    const redisClient: Redis = this.ioredis.conn;
    console.log('Redis Client Status:', redisClient.status);

    if (redisClient.status === 'ready') {
      try {
        await redisClient.set('mykey', 'Hello from IoCore ioredis module!');
        const value = await redisClient.get('mykey');
        console.log('Retrieved value from Redis:', value);

        await redisClient.del('mykey');
      } catch (error) {
        console.error('Redis command failed:', error);
      }
    } else {
      console.error('Redis client is not ready.');
    }
  }
}

Application.start(MyApp);
```

### `IORedis` 类

*   **`conn: Redis`**: 初始化后的 `ioredis` 实例。
*   **`props: IOCORE_IOREDIS_CONFIGS`**: 从环境变量加载的原始配置选项 (`RedisOptions`)。
*   **`constructor()`**: 读取并解析 `IOCORE_IOREDIS_CONFIGS` 环境变量。如果未设置，则抛出错误。
*   **`initialize(): Promise<void>`**: 基于提供的配置创建并连接 `ioredis` 实例。IoCore 会自动调用此方法。连接成功后才会 resolve。
*   **`terminate(): void`**: 断开 Redis 连接。IoCore 会自动调用此方法。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
