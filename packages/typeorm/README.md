# @iocore/typeorm

[![npm version](https://badge.fury.io/js/%40iocore%2Ftypeorm.svg)](https://badge.fury.io/js/%40iocore%2Ftypeorm)

IoCore 框架的 TypeORM 模块。

## 安装

```bash
npm install @iocore/typeorm typeorm --save
# or
yarn add @iocore/typeorm typeorm
```

## 依赖

这个模块需要 TypeORM 作为 peer dependency。请确保已安装 `typeorm`。

## 配置

通过环境变量 `IOCORE_TYPEORM_CONFIGS` 配置 TypeORM。该变量应包含一个 JSON 字符串，其内容是 TypeORM 的 `DataSourceOptions`。

**示例 `.env` 文件:**

```env
IOCORE_TYPEORM_CONFIGS='{"type":"mysql","host":"localhost","port":3306,"username":"user","password":"password","database":"test","entities":["dist/**/*.entity{.ts,.js}"],"migrations":["dist/migration/*{.ts,.js}"]}'
```

**注意:**

*   `synchronize` 选项会自动设置为 `true`。
*   `logging` 选项在 `NODE_ENV` 为 `development` 时会自动设置为 `true`。

## 使用

该模块导出 `TypeORM` 类，它继承自 `@iocore/component` 的 `Application`。

```typescript
import { Application } from '@iocore/component';
import { TypeORM, IOCORE_TYPEORM_CONFIGS } from '@iocore/typeorm';
import { DataSource, QueryRunner, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// 定义一个实体
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}

// 配置 TypeORM (通常通过环境变量完成)
// process.env.IOCORE_TYPEORM_CONFIGS = JSON.stringify({
//   type: 'sqlite',
//   database: ':memory:',
//   entities: [User],
// });

@Application.Inject(TypeORM)
class MyApp extends Application {
  @Application.Inject(TypeORM)
  private typeorm: TypeORM;

  public async main() {
    const dataSource: DataSource = this.typeorm.conn;
    console.log('TypeORM Connection Initialized:', dataSource.isInitialized);

    // 使用连接进行数据库操作
    const userRepository = dataSource.getRepository(User);
    const newUser = userRepository.create({ name: 'Test User' });
    await userRepository.save(newUser);
    console.log('User saved:', newUser);

    const users = await userRepository.find();
    console.log('All users:', users);

    // 使用事务
    await this.typeorm.transaction(async (runner, rollback) => {
      const user = new User();
      user.name = "User In Transaction";
      await runner.manager.save(user);
      console.log("User saved within transaction:", user);

      // 可以添加回滚操作
      rollback(() => console.log("Rollback handler executed!"));

      // 如果发生错误，事务将自动回滚，并且 rollback 函数会被调用
      // throw new Error("Something went wrong!");
    });
  }
}

// 启动应用
Application.start(MyApp);
```

### `TypeORM` 类

*   **`conn: DataSource`**: 初始化后的 TypeORM `DataSource` 实例。
*   **`props: IOCORE_TYPEORM_CONFIGS`**: 从环境变量加载的原始配置选项。
*   **`constructor()`**: 读取并解析 `IOCORE_TYPEORM_CONFIGS` 环境变量。如果未设置，则抛出错误。
*   **`initialize(): Promise<void>`**: 基于提供的配置初始化 TypeORM 数据源连接。IoCore 会自动调用此方法。
*   **`terminate(): Promise<void>`**: 关闭 TypeORM 连接。IoCore 会自动调用此方法。
*   **`transaction<T>(callback): Promise<T>`**: 在当前数据源上执行一个事务。
    *   `callback`: 一个函数，接收 `QueryRunner` 和 `rollback` 函数作为参数。
        *   `runner: QueryRunner`: 用于在事务内执行数据库操作。
        *   `rollback(roll: () => unknown | Promise<unknown>): number`: 注册一个回调函数，该函数将在事务回滚时执行。
*   **`static transaction<T>(datasource, callback): Promise<T>`**: 在给定的 `DataSource` 上执行一个事务（静态方法）。参数同上。

## 事务处理

`transaction` 方法提供了一种便捷的方式来处理数据库事务。它会自动处理连接、启动事务、提交或回滚以及释放查询运行器。

你可以在 `callback` 函数中使用提供的 `runner` 来执行数据库操作。如果 `callback` 成功完成，事务将被提交。如果 `callback` 抛出错误，事务将被回滚，并且所有通过 `rollback` 函数注册的回调都将被执行。

```typescript
await this.typeorm.transaction(async (runner, addRollback) => {
  // ... 在事务中执行操作 ...
  await runner.manager.save(entity);

  // 注册一个回滚操作
  addRollback(async () => {
    // ... 清理操作 ...
  });

  // 如果这里抛出错误，事务会回滚，上面的清理操作会被调用
});
```

## 贡献

欢迎提交 Pull Request。对于重大更改，请先开一个 Issue 来讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
