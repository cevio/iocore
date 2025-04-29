# @iocore/configs

[![npm version](https://badge.fury.io/js/%40iocore%2Fconfigs.svg)](https://badge.fury.io/js/%40iocore%2Fconfigs)

IoCore 的可持久化配置模块。

基于 `@iocore/cache` 和 `@sinclair/typebox`，提供了一个抽象类 `Configs`，用于定义、管理和持久化应用程序配置。配置可以从多个缓存源 (`CacheDispenser`) 中读取和写入。

## 安装

```bash
npm install @iocore/configs @iocore/cache @iocore/component @sinclair/typebox --save
# or
yarn add @iocore/configs @iocore/cache @iocore/component @sinclair/typebox
```

## 依赖

*   `@iocore/cache`: 提供缓存分发器 (`CacheDispenser`)。
*   `@iocore/component`: IoCore 核心组件系统。
*   `@sinclair/typebox`: 用于定义配置的 JSON Schema 类型。

## 使用

需要继承 `Configs` 类，并提供配置的命名空间、TypeBox Schema 以及至少一个 `CacheDispenser` 类。

```typescript
import { Application } from '@iocore/component';
import { Type, Static } from '@sinclair/typebox';
import { Configs } from '@iocore/configs';
import {
  CacheDispenser,
  CacheDispenserMemory,
  // CacheDispenserFile, // 假设我们还有一个基于文件的 Dispenser
  // CacheDispenserIORedis, // 假设我们还有一个基于 Redis 的 Dispenser
} from '@iocore/cache';

// --- 定义配置 Schema ---
const AppSettingsSchema = Type.Object({
  appName: Type.String({ default: 'My Awesome App' }),
  theme: Type.Union([
    Type.Literal('light'),
    Type.Literal('dark'),
  ], { default: 'light' }),
  featureFlags: Type.Object({
    newDashboard: Type.Boolean({ default: false }),
    betaAccess: Type.Boolean({ default: false }),
  }, { default: { newDashboard: false, betaAccess: false } }),
  retryAttempts: Type.Integer({ default: 3, minimum: 0 }),
});

type AppSettings = Static<typeof AppSettingsSchema>;

// --- 定义 Configs 子类 ---
// 使用 Memory 缓存作为第一层，File 作为第二层 (假设存在)
@Application.Singleton // 通常配置类是单例的
class AppConfigs extends Configs<typeof AppSettingsSchema> {
  constructor(
    // 注入 Cache Dispensers (IoCore 会自动实例化)
    @Application.Inject(CacheDispenserMemory)
    memoryDispenser: CacheDispenserMemory<AppSettings>,
    // @Application.Inject(CacheDispenserFile)
    // fileDispenser: CacheDispenserFile<AppSettings>,
  ) {
    super(
      'appSettings', // 命名空间，用于生成缓存 key
      AppSettingsSchema, // 传入 Schema
      // 传入 Dispenser 类 (IoCore 会处理注入的实例)
      CacheDispenserMemory,
      // CacheDispenserFile,
    );
  }

  // 可以添加自定义方法
  isDarkMode(): boolean {
    return this.get('theme') === 'dark';
  }
}

// --- 启动应用并使用配置 ---
@Application.Inject(AppConfigs)
class MyApp extends Application {
  @Application.Inject(AppConfigs)
  private configs: AppConfigs;

  public async main() {
    console.log('Initial Configs:', this.configs.toValue());
    console.log('App Name:', this.configs.get('appName'));
    console.log('Is Dark Mode?', this.configs.isDarkMode());
    console.log('New Dashboard Enabled?', this.configs.get('featureFlags').newDashboard);

    // 修改配置并保存
    console.log('\nEnabling dark mode and new dashboard...');
    await this.configs.save({
      theme: 'dark',
      featureFlags: {
        ...this.configs.get('featureFlags'), // 保留其他标志
        newDashboard: true,
      },
    });

    console.log('\nUpdated Configs:', this.configs.toValue());
    console.log('App Name:', this.configs.get('appName')); // 未修改，保持不变
    console.log('Is Dark Mode Now?', this.configs.isDarkMode());
    console.log('New Dashboard Enabled Now?', this.configs.get('featureFlags').newDashboard);

    // 重新启动应用后，配置会从缓存加载 (在这个例子中是内存缓存)
  }
}

// 需要确保 CacheDispenserMemory (以及其他使用的 Dispenser) 被 IoCore 管理
@Application.Inject(CacheDispenserMemory)
class BootApp extends Application {
  @Application.Inject(MyApp)
  app: MyApp;
  main() {
    return this.app.main();
  }
}

Application.start(BootApp);

```

### `Configs<T extends TObject>` (抽象类)

*   **`constructor(namespace: string, schema: T, ...dispensers: INewAble<CacheDispenser<Static<T>>>[])`**: 构造函数。
    *   `namespace`: 配置的唯一命名空间，用于生成缓存 key (`${CACHE_PREFIX}variable:${namespace}:state`)。
    *   `schema`: `@sinclair/typebox` 定义的 `TObject` Schema。Schema 中的 `default` 值将作为初始配置值。
    *   `dispensers`: 一个或多个 `CacheDispenser` **类**。IoCore 会负责实例化它们。
*   **`initialize(): Promise<void>`**: IoCore 自动调用。它会：
    1.  根据 Schema 的 `default` 值初始化内存中的配置状态。
    2.  按照 `dispensers` 数组的顺序，尝试从每个 Dispenser 读取缓存的配置。
    3.  如果从某个 Dispenser 成功读取到配置，则用缓存的值覆盖内存中的默认值。
*   **`terminate(): void`**: IoCore 自动调用 (目前为空实现)。
*   **`get<U extends keyof Static<T>>(key: U): Static<T>[U]`**: 获取指定 `key` 的当前配置值。
*   **`set<U extends keyof Static<T>>(key: U, value: Static<T>[U]): this`**: **仅修改内存中** 的配置值。不会触发保存。
*   **`save(value: Partial<Static<T>>): Promise<Static<T>>`**: 更新一个或多个配置项，并将 **完整的当前配置** 保存到 **所有** 配置的 `dispensers` 中。
    *   首先，使用 `value` 更新内存中的配置状态。
    *   然后，将内存中完整的配置对象写入到每个 Dispenser。
    *   返回保存后的完整配置对象。
*   **`toValue(): Static<T>`**: 返回当前内存中完整的配置对象。
*   **`toSchema(): T`**: 返回构造时传入的 TypeBox Schema。

### 配置加载与保存逻辑

*   **加载 (initialize)**: 优先使用 Schema 的默认值，然后按顺序尝试从 Dispenser 读取，第一个读到数据的 Dispenser 的值会被采用并覆盖默认值。
*   **保存 (save)**: 将当前完整的配置状态写入到 **所有** 的 Dispenser 中。这确保了所有缓存层的数据一致性。例如，即使主要从 Redis 读取，修改后也会同时写入 Redis 和文件缓存（如果配置了两者）。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
