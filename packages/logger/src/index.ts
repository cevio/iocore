import { Application } from '@iocore/component';
import log4js, { Logger as ILogger, Configuration, Level } from 'log4js';

@Application.Server
export class Logger extends Application {
  private readonly instance: ILogger;
  private readonly configs: Configuration = {
    appenders: {
      // 控制台输出：带颜色
      console: {
        type: "console",
        layout: { type: "colored" }, // 自动根据日志级别着色
      },
      // 文件输出：按日期轮转 + 时间戳
      rotatingFile: {
        type: "dateFile",
        filename: "logs/app.log",
        pattern: "yyyy-MM-dd",
        layout: {
          type: "pattern",
          pattern: "%d{ISO8601} [%p] %m", // 强制添加时间戳
        },
        compress: true,
        daysToKeep: 7,
      },
    },
    categories: {
      default: {
        appenders: ["console", "rotatingFile"],
        level: "info",
      },
    },
  }

  constructor() {
    super();
    log4js.configure(this.configs);
    this.instance = log4js.getLogger();
  }

  public initialize() { }
  public terminate() { }

  public trace(message: any, ...args: any[]) {
    return this.instance.trace(message, ...args);
  }

  public debug(message: any, ...args: any[]) {
    return this.instance.debug(message, ...args);
  }

  public info(message: any, ...args: any[]) {
    return this.instance.info(message, ...args);
  }

  public warn(message: any, ...args: any[]) {
    return this.instance.warn(message, ...args);
  }

  public error(message: any, ...args: any[]) {
    return this.instance.error(message, ...args);
  }

  public fatal(message: any, ...args: any[]) {
    return this.instance.fatal(message, ...args);
  }

  public log(level: Level | string, ...args: any[]) {
    return this.instance.log(level, ...args);
  }

  public setLevel(level: Level | string) {
    this.instance.level = level;
    return this;
  }
}

export {
  Level,
}

export default Logger;