# @iocore/cli

[![npm version](https://badge.fury.io/js/%40iocore%2Fcli.svg)](https://badge.fury.io/js/%40iocore%2Fcli)

IoCore 框架的命令行工具。

提供用于创建、启动和管理 IoCore 应用程序的命令。

## 安装

全局安装（推荐）：

```bash
npm install -g @iocore/cli
# or
yarn global add @iocore/cli
```

或者作为开发依赖安装：

```bash
npm install --save-dev @iocore/cli
# or
yarn add --dev @iocore/cli
```

如果作为开发依赖安装，你需要通过 `npx iocore ...` 或 `yarn iocore ...` 来运行命令。

## 依赖

*   `@iocore/boot`: 用于启动应用。
*   `@iocore/micro-ws-registry`: 用于启动 WebSocket 注册中心。
*   `commander`: 命令行参数解析。
*   `inquirer`: 交互式命令行提示。
*   `fs-extra`: 文件系统操作。
*   `ts-morph`: TypeScript AST 操作 (用于项目创建)。
*   `tsx`: (可选，开发模式需要) 即时执行 TypeScript/ESM。

## 命令

### `iocore start [yaml]`

启动 IoCore 应用程序。

*   `[yaml]` (可选): 指定配置文件的路径，默认为项目根目录下的 `iocore.configs.yaml`。
*   `-e, --entry <file>`: **必须** 指定应用程序的入口 TypeScript/JavaScript 文件路径 (相对或绝对路径)。该文件 **必须** `export default` 一个继承自 `Application` 的类。
*   `-m, --module <module>`: (**替代 --entry**) 指定要导入的模块名或路径，而不是本地文件。
*   `-d, --dev`: 启用开发模式。如果设置，将使用 `tsx` 来即时运行 TypeScript 代码，无需预先编译。

**示例:**

```bash
# 使用默认 iocore.configs.yaml 启动 src/main.ts
iocore start -e src/main.ts

# 使用指定配置文件启动，并启用开发模式
iocore start myconfig.yaml -e src/main.ts --dev

# 使用模块作为入口
iocore start -m my-package/dist/main.js
```

### `iocore create`

创建一个新的 IoCore 项目。

它会通过一系列交互式问题引导你：

1.  **输入项目名称**: 新项目的文件夹名称。
2.  **选择需要的服务**: 可以多选，包括：
    *   Http 服务 (`@iocore/http`)
    *   WS 微服务 (`@iocore/micro-ws-agent`)
    *   IORedis 服务 (`@iocore/ioredis`)
    *   TypeORM 服务 (`@iocore/typeorm`)

该命令会自动：

*   创建项目文件夹。
*   复制基础项目模板 (`packages/cli/template/project`)。
*   根据选择的服务，添加相应的依赖到 `package.json`。
*   在 `iocore.configs.yaml` 中添加对应服务的示例配置。
*   如果选择了 Http 或 Micro-WS 服务，会复制相应的 Controller/Middleware/Service 模板 (`packages/cli/template/*`) 到 `src/` 目录下。
*   使用 `ts-morph` 修改 `src/main.ts`，自动注入和绑定所选的服务和控制器/服务。

**示例:**

```bash
iocore create
# ? 请输入项目名称 my-new-app
# ? 请选择需要的服务 (Press <space> to select, <a> to toggle all, <i> to invert selection)
# > [x] Http服务
#   [ ] WS微服务
#   [x] IORedis服务
#   [ ] TypeORM服务
# ... 项目创建完成
```

### `iocore registry <protocol>`

快速启动一个 IoCore 微服务注册中心。

*   `<protocol>`: **必须** 指定协议。目前只支持 `ws`。
*   `-p, --port <port>`: **必须** 指定注册中心监听的端口。

**示例:**

```bash
# 启动一个监听在 8427 端口的 WebSocket 注册中心
iocore registry ws -p 8427
```

这实际上是使用 `@iocore/boot` 和预设配置来启动 `@iocore/micro-ws-registry`。

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
