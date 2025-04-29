# @iocore/cache-dispenser-file

[![npm version](https://badge.fury.io/js/%40iocore%2Fcache-dispenser-file.svg)](https://badge.fury.io/js/%40iocore%2Fcache-dispenser-file)

IoCore 的文件缓存分发器。

这是 `@iocore/cache` 模块 `CacheDispenser` 抽象类的一个具体实现，使用本地文件系统来存储和检索缓存数据。每个缓存条目存储为一个 JSON 文件，支持设置缓存过期时间。

## 安装

```bash
npm install @iocore/cache-dispenser-file @iocore/cache @iocore/component fs-extra glob --save
# or
yarn add @iocore/cache-dispenser-file @iocore/cache @iocore/component fs-extra glob
```

## 依赖

*   `@iocore/cache`: 提供 `CacheDispenser` 抽象类。
*   `@iocore/component`: IoCore 核心组件系统。
*   `fs-extra`: 提供了增强的文件系统操作方法 (如 `ensureDir`)。
*   `glob`: 用于查找匹配模式的文件。

## 配置

通过环境变量 `IOCORE_FILE_CACHE_DISPENSER_CONFIGS` 配置缓存文件存储的目录路径。

**示例 `.env` 文件:**

```env
# 将缓存文件存储在项目根目录下的 .cache 文件夹中
IOCORE_FILE_CACHE_DISPENSER_CONFIGS='.cache'

# 或者指定一个绝对路径
# IOCORE_FILE_CACHE_DISPENSER_CONFIGS='/var/tmp/iocore_cache'
```

如果目录不存在，该模块会自动创建。

## 使用

`FileCacheDispenser` 类是一个 IoCore `Application` 组件，通常作为其他需要文件缓存的组件（如 `@iocore/configs`）的依赖项注入。

```typescript
import { Application } from '@iocore/component';
import { CacheDispenser } from '@iocore/cache';
import FileCacheDispenser from '@iocore/cache-dispenser-file';

// 确保缓存目录已配置 (通过 .env 或 process.env)
// process.env.IOCORE_FILE_CACHE_DISPENSER_CONFIGS = '.file_cache_data';

// 模拟一个需要文件缓存的服务
@Application.Injectable()
class MyFileCachedService extends Component {
  @Application.Inject(FileCacheDispenser)
  private cache: CacheDispenser<object>; // 缓存对象类型

  private async fetchDataFromSource(configName: string): Promise<object> {
    console.log(`Fetching data from source for config: ${configName}...`);
    await new Promise(res => setTimeout(res, 120)); // 模拟耗时
    return { name: configName, timestamp: Date.now(), data: Math.random() };
  }

  async getConfig(configName: string): Promise<object> {
    const cacheKey = `config_${configName}`; // 文件名将是 config_someConfig.json

    if (await this.cache.has(cacheKey)) {
      console.log(`File Cache hit for key: ${cacheKey}`);
      const ttl = await this.cache.ttl(cacheKey);
      console.log(`TTL: ${ttl} seconds`);
      return this.cache.get(cacheKey);
    }

    console.log(`File Cache miss for key: ${cacheKey}`);
    const data = await this.fetchDataFromSource(configName);
    // 缓存数据 1 小时 (3600 秒)
    await this.cache.set(cacheKey, data, 3600);
    return data;
  }

  async invalidateConfig(configName: string): Promise<void> {
    const cacheKey = `config_${configName}`;
    await this.cache.delete(cacheKey);
    console.log(`File Cache cleared for key: ${cacheKey}`);
  }
}

// 启动应用
// 确保 FileCacheDispenser 被 IoCore 管理
@Application.Inject(FileCacheDispenser, MyFileCachedService)
class BootApp extends Application {
  @Application.Inject(MyFileCachedService)
  service: MyFileCachedService;

  async main() {
    console.log('--- File Cache Test ---');
    const config = 'app_settings';
    await this.service.getConfig(config);
    await this.service.getConfig(config);
    await this.service.invalidateConfig(config);
    await this.service.getConfig(config);
  }

  initialize() {}
  terminate() {}
}

Application.start(BootApp);

```

### `FileCacheDispenser<R = any>` 类

继承自 `CacheDispenser`。

*   **`constructor()`**: 解析 `IOCORE_FILE_CACHE_DISPENSER_CONFIGS` 环境变量获取缓存目录。
*   **`initialize(): Promise<void>`**: IoCore 自动调用。
    1.  确保缓存目录存在。
    2.  使用 `glob` 扫描缓存目录下的所有 `.json` 文件。
    3.  加载每个 JSON文件的内容 (包含 `data` 和 `expire` 字段) 到内存中的 `stacks` Map 中。
    4.  启动一个 `setInterval` 定时器 (每秒检查一次)，用于清理过期的缓存条目（从内存 Map 和文件系统中删除）。
*   **`terminate(): void`**: 清除过期检查定时器。IoCore 会自动调用。
*   **`set(key: string, value: R, time?: number): Promise<R>`**: 设置缓存。
    *   `key`: 缓存键 (将作为文件名的一部分)。
    *   `value`: 要缓存的值。
    *   `time` (可选): 过期时间（秒）。如果为 0 或不提供，则永不过期。
    *   将 `{ data: value, expire: timestamp_or_0, path: filePath }` 对象 JSON 序列化后写入到 `缓存目录/key.json` 文件中。
    *   更新内存中的 `stacks` Map。
    *   返回 `value`。
*   **`has(key: string): Promise<boolean>`**: 检查内存中的 `stacks` Map 是否包含该键（表示文件存在且未过期）。
*   **`get(key: string): Promise<R>`**: 从内存中的 `stacks` Map 获取缓存数据。如果键不存在或已过期，行为未定义。应先用 `has` 检查。
*   **`ttl(key: string): Promise<number>`**: 根据内存中的 `stacks` Map 计算剩余生存时间（秒）。如果键不存在或永不过期，返回 `0`。
*   **`delete(key: string): Promise<void>`**: 从文件系统删除对应的 `.json` 文件，并从内存中的 `stacks` Map 中移除该条目。

## 注意事项

*   缓存数据以 JSON 格式存储在文件中。
*   初始化时会读取缓存目录下的所有 `.json` 文件到内存，对于大量缓存文件可能会消耗较多内存和启动时间。
*   过期检查是基于内存中的计时器，如果进程异常退出，过期文件可能不会被立即清理（但下次启动时会被重新扫描和清理）。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
