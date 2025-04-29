# @iocore/logger

[![npm version](https://badge.fury.io/js/%40iocore%2Flogger.svg)](https://badge.fury.io/js/%40iocore%2Flogger)

IoCore 的日志记录模块，基于 `log4js`。

提供了一个易于使用的日志记录器，可以将日志同时输出到控制台（带颜色）和按日期轮转的文件中。

## 安装

```bash
npm install @iocore/logger @iocore/component log4js --save
# or
yarn add @iocore/logger @iocore/component log4js
```

## 依赖

*   `@iocore/component`
*   `log4js`: 功能强大的 Node.js 日志库。

## 配置

该模块使用 `log4js` 的默认配置，包含两个 appender：

1.  **`console`**: 输出到控制台，使用 `colored` 布局，根据日志级别自动着色。
2.  **`rotatingFile`**: 输出到文件。
    *   文件名: `logs/app.log`
    *   轮转模式: 按日期 (`yyyy-MM-dd`)
    *   布局: `"%d{ISO8601} [%p] %m"` (包含 ISO8601 时间戳和日志级别)
    *   自动压缩旧日志 (`compress: true`)
    *   保留天数: 7 天 (`daysToKeep: 7`)

默认日志级别 (`level`) 设置为 `info`。

目前不支持通过环境变量进行配置，如果需要自定义配置，可以考虑扩展此类或直接使用 `log4js`。

## 使用

`Logger` 类是一个 IoCore `Application` 组件，通常通过依赖注入使用。

```typescript
import { Application } from '@iocore/component';
import Logger from '@iocore/logger';

@Application.Inject(Logger)
class MyApp extends Application {

  @Application.Inject(Logger)
  private logger: Logger;

  public async main() {
    this.logger.trace('Entering application main...'); // 默认 info 级别，不会输出 trace
    this.logger.debug('Debugging information.');       // 默认 info 级别，不会输出 debug
    this.logger.info('Application started successfully.', { pid: process.pid });
    this.logger.warn('Something is not quite right...');
    this.logger.error('An error occurred!', new Error('Sample error'));
    this.logger.fatal('A critical error occurred, shutting down!');

    // 动态修改日志级别
    this.logger.setLevel('debug');
    this.logger.debug('This debug message will now be logged.');

    // 使用特定级别记录日志
    this.logger.log('info', 'Another info message using log method.');
  }
}

Application.start(MyApp);
```

### `Logger` 类方法

该类包装了 `log4js` 的 Logger 实例，提供了标准的日志记录方法：

*   `trace(message: any, ...args: any[])`
*   `debug(message: any, ...args: any[])`
*   `info(message: any, ...args: any[])`
*   `warn(message: any, ...args: any[])`
*   `error(message: any, ...args: any[])`
*   `fatal(message: any, ...args: any[])`
*   `log(level: Level | string, ...args: any[])`: 使用指定的级别记录日志。
*   `setLevel(level: Level | string): this`: 动态设置当前 Logger 实例的日志级别。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
