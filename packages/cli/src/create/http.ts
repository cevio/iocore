import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { VariableDeclarationKind, SyntaxKind } from "ts-morph";
import { AST } from '../ast';

const methods = `private async http_initialize() {
    this.http.hooks.add('prefix', async (ctx, next) => {
      await next();
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(\`[\${ ctx.method }: \${ ctx.status }]\`, ctx.url);
      }
    })
    // 加载所有路由
    await this.preload<Controller>(__controllers, 'controller', async ({ url, clazz }) => {
      const fn = await this.http.bind(url, clazz);
      if (typeof fn === 'function') {
        this.stacks.add(fn);
      }
    })
    this.logger.info('http://127.0.0.1:' + this.http.props.port);
  }

  private async http_terminate() {
    for (const fn of this.stacks.values()) {
      fn();
    }
  }`

export function HttpResolve(directory: string) {
  const mainFile = resolve(directory, 'src/main.ts');
  if (!existsSync(mainFile)) throw new Error('缺少入口文件main.ts');
  const ast = new AST(mainFile);

  let index = ast.insertImportDeclaration(0, '@iocore/boot', 'Boot');
  index = ast.insertImportDeclaration(index + 1, '@iocore/component', null, ['Application']);
  index = ast.insertImportDeclaration(index + 1, '@iocore/http', null, ['Controller', 'Http']);
  index = ast.insertImportDeclaration(index + 1, 'node:url', null, ['fileURLToPath']);
  index = ast.insertImportDeclaration(index + 1, 'node:path', null, ['resolve', 'dirname']);

  index = ast.insertVariable(index + 1, '__filename', 'fileURLToPath(import.meta.url)', VariableDeclarationKind.Const);
  index = ast.insertVariable(index + 1, '__dirname', 'dirname(__filename)', VariableDeclarationKind.Const);
  index = ast.insertVariable(index + 1, '__controllers', "resolve(__dirname, 'controllers')", VariableDeclarationKind.Const);

  const cls = ast.getExtendsClass('Boot');
  if (!cls) throw new Error('找不到基于 Boot 的类');

  index = ast.getConstructorIndex(cls);

  const hasHttpModule = cls.getProperties().some(property => {
    // 检查修饰符：private 和 readonly
    const isPrivateReadonly = ast.classHasReadonly(property, SyntaxKind.PrivateKeyword);

    // 检查属性名和类型
    const isCorrectType = property.getType().getText() === "Http" && property.getName() === "http";

    // 检查装饰器
    const hasDecorator = property.getDecorators().some(decorator => {
      const callExpr = decorator.getExpression();
      if (callExpr.getKind() === SyntaxKind.CallExpression) {
        const expr = callExpr.asKind(SyntaxKind.CallExpression)!;
        const methodAccess = expr.getExpression();
        if (methodAccess.getKind() === SyntaxKind.PropertyAccessExpression) {
          const pa = methodAccess.asKind(SyntaxKind.PropertyAccessExpression)!;
          return pa.getExpression().getText() === "Application" &&
            pa.getName() === "Inject" &&
            expr.getArguments()[0]?.getText() === "Http";
        }
      }
      return false;
    });

    return isPrivateReadonly && isCorrectType && hasDecorator;
  })

  const hasStackVariable = cls.getProperties().some(property => {
    // 验证修饰符
    const isPrivateReadonly = ast.classHasReadonly(property, SyntaxKind.PrivateKeyword);

    // 验证属性名
    if (!isPrivateReadonly || property.getName() !== "stacks") {
      return false;
    }

    // 验证类型声明（显式类型或推断类型）
    const typeCheck = () => {
      // 显式类型声明检查
      const explicitType = property.getTypeNode()?.getText();
      if (explicitType === "Set<() => void>") return true;

      // 初始化表达式类型检查
      const initializer = property.getInitializer();
      if (initializer?.getKind() === SyntaxKind.NewExpression) {
        const newExpr = initializer.asKind(SyntaxKind.NewExpression)!;
        return newExpr.getTypeArguments()[0]?.getText() === "() => void" &&
          newExpr.getExpression().getText() === "Set";
      }

      // 类型推断检查
      return property.getType().getText() === "Set<() => void>";
    };

    return typeCheck();
  })

  if (!hasStackVariable) {
    cls.insertMembers(index, 'private readonly stacks = new Set<() => void>();');
  }

  if (!hasHttpModule) {
    cls.insertMembers(index, '@Application.Inject(Http)\n\tprivate readonly http: Http;');
  }

  const ctor = cls.getConstructors()[0];
  ctor.addStatements("this.logger.setLevel('debug');");
  const initializeMethod = cls.getMethodOrThrow("initialize");
  const insertIndex = initializeMethod
    ? cls.getMembers().indexOf(initializeMethod)
    : cls.getMembers().length;

  cls.insertMembers(insertIndex, methods);
  initializeMethod.addStatements('await this.http_initialize();');
  const terminateMethod = cls.getMethodOrThrow("terminate");
  terminateMethod.addStatements('await this.http_terminate();');

  ast.save();
}