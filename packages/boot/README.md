# @iocore/boot

[![npm version](https://badge.fury.io/js/%40iocore%2Fboot.svg)](https://badge.fury.io/js/%40iocore%2Fboot)

IoCore 应用程序引导模块。

提供了一个标准的启动流程 (`Boot.Strap`)，用于加载配置、初始化应用程序、处理全局异常和优雅退出。

## 安装

```bash
npm install @iocore/boot @iocore/component @iocore/logger async-exit-hook yaml glob --save
# or
yarn add @iocore/boot @iocore/component @iocore/logger async-exit-hook yaml glob
```

## 依赖

*   `@iocore/component`: IoCore 核心组件系统。
*   `@iocore/logger`: 用于记录日志。
*   `async-exit-hook`: 用于注册异步退出钩子，确保在进程退出前能执行清理逻辑 (如 `Application.terminate`)。
*   `yaml`: 用于解析 YAML 配置文件。
*   `glob`: 用于查找匹配模式的文件 (在 `preload` 方法中使用)。

## 使用

通常，你的应用程序入口会继承 `Boot` 类，并使用静态方法 `Boot.Strap` 来启动。

**1. 创建入口类 (例如 `src/main.ts`)**

```typescript
import 'reflect-metadata'; // 必须在顶部导入
import Boot from '@iocore/boot';
import { resolve } from 'node:path';
// 导入你需要自动加载的服务/控制器等 (确保它们使用了 @Application.Server 或 @Component.Injectable)
import './services/MyService';
import './controllers/HomeController';
// 也可以导入其他 IoCore 模块，如 Http, IORedis 等
import Http from '@iocore/http';

// 你的主应用程序类继承自 Boot
@Application.Server
class MainApp extends Boot {

  // 注入 Logger (Boot 基类已提供)
  // private readonly logger: Logger;

  // 注入其他需要的服务
  @Application.Inject(Http)
  private http: Http;

  // Boot 类已经实现了 initialize 和 terminate，但你可以覆盖它们
  // public async initialize(): Promise<void> {
  //   this.logger.info('Custom initialize logic running...');
  //   await super.initialize(); // 如果需要，调用基类实现
  // }
  // public async terminate(): Promise<void> {
  //   this.logger.info('Custom terminate logic running...');
  //   await super.terminate();
  // }

  // 可以在这里添加应用的主要逻辑，或者通过其他组件实现
  async startServices() {
    this.logger.info('MainApp started, binding routes...');
    // 例如，使用 preload 自动绑定 HTTP 控制器
    // await this.preload(
    //   resolve(__dirname, 'controllers'), // 控制器目录
    //   'controller', // 文件后缀 (匹配 *.controller.ts/js)
    //   async ({ url, clazz }) => {
    //     this.logger.debug(`Binding HTTP controller: ${url}`);
    //     // @ts-ignore 假设 clazz 是 Controller 类型
    //     await this.http.bind(url, clazz);
    //   }
    // );
  }
}

export default MainApp; // 必须默认导出入口类
```

**2. 创建配置文件 (例如 `iocore.configs.yaml`)**

```yaml
# 日志模块配置 (如果使用了 @iocore/logger)
# (log4js 配置)

# HTTP 模块配置 (如果使用了 @iocore/http)
IOCORE_HTTP_CONFIGS:
  port: 3000
  keys:
    - "a_secure_random_key"
    - "another_secure_key"

# IORedis 配置 (如果使用了 @iocore/ioredis)
IOCORE_IOREDIS_CONFIGS:
  host: "localhost"
  port: 6379

# 其他 IoCore 模块的配置...
# MY_CUSTOM_CONFIG: value
```

**3. 启动脚本 (例如 `scripts/start.js` 或直接使用 `iocore cli`)**

```javascript
// scripts/start.js
import Boot from '@iocore/boot';
import MainApp from '../src/main'; // 导入你的入口类

// 使用 YAML 文件启动
Boot.Strap('iocore.configs.yaml', MainApp);

// 或者直接传入配置对象
// Boot.Strap({
//   IOCORE_HTTP_CONFIGS: JSON.stringify({ port: 4000 }),
//   IOCORE_IOREDIS_CONFIGS: JSON.stringify({ host: '127.0.0.1', port: 6379 })
// }, MainApp);
```

或者使用 `@iocore/cli`:

```bash
npm install -g @iocore/cli # or yarn global add @iocore/cli
iocore start -e src/main.ts # 使用默认 yaml 文件
# or
iocore start myconfig.yaml -e src/main.ts # 使用指定 yaml 文件
```

### `Boot` (抽象类)

继承自 `Application`。

*   **`logger: Logger`** (注入): 提供一个 `@iocore/logger` 实例用于日志记录。
*   **`initialize(): void`**: 空实现。子类可以覆盖以添加自定义初始化逻辑。
*   **`terminate(): void`**: 空实现。子类可以覆盖以添加自定义终止逻辑。
*   **`static Strap<T extends object, U extends Boot>(yaml: string | T, clazz: INewAble<U>): void`**: 核心启动方法。
    *   `yaml`: YAML 配置文件的路径，或者一个包含配置的对象。
    *   `clazz`: 继承自 `Boot` 的应用程序入口类。
    *   **流程**: 
        1.  如果 `yaml` 是字符串路径，读取并解析 YAML 文件。
        2.  将配置对象中的所有键值对设置为 `process.env` 的环境变量 (如果值不是字符串，会 JSON 序列化)。**这是 IoCore 模块读取配置的主要方式**。
        3.  调用 `Application.create(clazz)` 来创建并初始化应用程序实例 (及其所有依赖)。
        4.  注册全局错误处理钩子 (`uncaughtException`, `unhandledRejection` 等)，将错误信息通过注入的 `logger` 输出。
        5.  使用 `async-exit-hook` 注册一个退出钩子，确保在进程退出时调用 `Application.terminate()` 来优雅地关闭所有 `Application` 组件。
*   **`preload<T extends Component>(directory: string, suffix: string, callback?): Promise<void>`**: 辅助方法，用于动态加载和处理指定目录下的组件文件。
    *   `directory`: 要扫描的目录路径。
    *   `suffix`: 文件后缀名 (不含 `.ts` 或 `.js`)，例如 `controller`, `service`。
    *   `callback`: 可选的回调函数，会对每个加载的文件执行。回调参数包含 `file`, `path`, `url` (相对路径，去除了后缀), `wrap` (组件的 `Wrap` 实例), `clazz` (组件类)。
    *   **逻辑**: 使用 `glob` 查找 `directory` 下所有 `**/*.${suffix}.{ts,js}` 文件，动态 `import` 它们，预加载默认导出的 `Component` 类 (`Application.preload`)，并执行 `callback`。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
