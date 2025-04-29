# IoCore - Node.js 应用框架

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

IoCore 是一个基于 TypeScript 的 Node.js 框架，旨在通过组件化、依赖注入和模块化的设计，简化和加速后端应用程序（尤其是微服务）的开发。

## 设计理念

*   **组件化**: 应用功能被拆分为可复用的组件，通过 `@iocore/component` 进行管理。
*   **依赖注入**: 使用装饰器 (`@Component.Inject`) 自动管理组件之间的依赖关系。
*   **生命周期管理**: 通过 `Application` 基类和相关装饰器 (`@Application.Server`) 统一管理服务的启动和停止。
*   **配置驱动**: 主要通过环境变量（由 YAML 文件加载）来配置各个模块。
*   **模块化**: 提供了一系列预置模块来处理常见任务，如 HTTP 服务、WebSocket 通信、数据库访问、缓存等。

## 核心模块

*   **`@iocore/component`**: [查看详情](./packages/component/README.md)
    *   框架的核心，提供了依赖注入容器、组件基类、生命周期管理和元数据 API。
*   **`@iocore/boot`**: [查看详情](./packages/boot/README.md)
    *   应用程序引导模块，负责加载配置 (YAML/环境变量)、初始化应用、处理全局异常和优雅退出。

## 主要功能模块

### 网络通信

*   **`@iocore/http`**: [查看详情](./packages/http/README.md)
    *   基于 Koa 和 find-my-way 的高性能 HTTP 服务器模块，支持 Controller、Middleware 和路由参数注入。
*   **`@iocore/micro-ws`**: [查看详情](./packages/micro-ws/README.md)
    *   底层的 WebSocket 通信模块，基于 `ws` 和 `@iocore/demodulator`，提供可靠的请求/响应模式和连接管理。
*   **`@iocore/micro-ws-registry`**: [查看详情](./packages/micro-ws-registry/README.md)
    *   基于 `@iocore/micro-ws` 的 WebSocket 服务注册中心，用于微服务发现。
*   **`@iocore/micro-ws-agent`**: [查看详情](./packages/micro-ws-agent/README.md)
    *   WebSocket 微服务 Agent，连接到注册中心，可以处理 RPC 风格的 `Service` 调用和模拟 HTTP 的 `Controller` 请求。
*   **`@iocore/react`**: [查看详情](./packages/react/README.md)
    *   一个用于构建单页应用（SPA）的 React 前端框架，集成了路由、请求、中间件和状态管理。

### 数据与存储

*   **`@iocore/ioredis`**: [查看详情](./packages/ioredis/README.md)
    *   集成了 `ioredis` 库，提供 Redis 连接管理的 IoCore 组件。
*   **`@iocore/typeorm`**: [查看详情](./packages/typeorm/README.md)
    *   集成了 TypeORM，提供数据库 ORM 功能和事务管理的 IoCore 组件。
*   **`@iocore/cache`**: [查看详情](./packages/cache/README.md)
    *   多层缓存管理模块，支持基于模板的缓存键生成和多种缓存后端。
*   **`@iocore/cache-dispenser-momery`**: [查看详情](./packages/cache-dispenser-momery/README.md)
    *   `@iocore/cache` 的内存缓存实现。
*   **`@iocore/cache-dispenser-ioredis`**: [查看详情](./packages/cache-dispenser-ioredis/README.md)
    *   `@iocore/cache` 的 Redis (基于 `@iocore/ioredis`) 缓存实现。
*   **`@iocore/cache-dispenser-file`**: [查看详情](./packages/cache-dispenser-file/README.md)
    *   `@iocore/cache` 的文件缓存实现。

### 工具与其他

*   **`@iocore/logger`**: [查看详情](./packages/logger/README.md)
    *   基于 `log4js` 的日志记录模块，支持控制台和文件输出。
*   **`@iocore/configs`**: [查看详情](./packages/configs/README.md)
    *   基于 `@sinclair/typebox` 和 `@iocore/cache` 的可持久化配置管理模块。
*   **`@iocore/demodulator`**: [查看详情](./packages/demodulator/README.md)
    *   用于在双向通信流上实现可靠、带超时的请求/响应模式的底层模块。
*   **`@iocore/cli`**: [查看详情](./packages/cli/README.md)
    *   命令行工具，用于创建项目骨架、启动应用和启动注册中心。

## 快速开始

使用 `@iocore/cli` 创建新项目是最快的方式：

```bash
# 1. 全局安装 CLI
npm install -g @iocore/cli

# 2. 创建新项目
iocore create
# (按照提示输入项目名称并选择需要的服务模块)

# 3. 进入项目目录
cd <your-project-name>

# 4. 安装依赖
npm install # 或者 yarn install

# 5. (可选) 修改 iocore.configs.yaml 和 .env 文件配置

# 6. 启动应用 (开发模式)
iocore start -e src/main.ts --dev
```

## 配置

IoCore 应用主要通过 YAML 文件进行配置，并通过 `@iocore/boot` 模块加载到环境变量中。各个模块通过读取特定的环境变量来获取配置。

标准的配置文件是项目根目录下的 `iocore.configs.yaml`。

**示例 `iocore.configs.yaml`:**

```yaml
IOCORE_HTTP_CONFIGS:
  port: 3000

IOCORE_IOREDIS_CONFIGS:
  host: localhost
  port: 6379

CACHE_PREFIX: "my_app:"
```

## 贡献

欢迎通过提交 Pull Request 或开启 Issue 来贡献代码或提出建议。对于重大更改，请先开一个 Issue 进行讨论。

## 许可证

本项目采用 [MIT](LICENSE) 许可证。

