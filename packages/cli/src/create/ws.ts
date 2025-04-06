import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { VariableDeclarationKind, SyntaxKind } from "ts-morph";
import { AST } from '../ast';

const methods = `private async micro_ws_initialize() {
    await this.preload<Service>(__services, 'service', async ({ url, clazz }) => {
      this.agent.bind(url, clazz);
    })
  }`

export function MicroWSResolve(directory: string) {
  const mainFile = resolve(directory, 'src/main.ts');
  if (!existsSync(mainFile)) throw new Error('缺少入口文件main.ts');
  const ast = new AST(mainFile);

  let index = ast.insertImportDeclaration(0, '@iocore/boot', 'Boot');
  index = ast.insertImportDeclaration(index + 1, '@iocore/component', null, ['Application']);
  index = ast.insertImportDeclaration(index + 1, 'node:url', null, ['fileURLToPath']);
  index = ast.insertImportDeclaration(index + 1, 'node:path', null, ['resolve', 'dirname']);
  index = ast.insertImportDeclaration(index + 1, '@iocore/micro-ws-agent', null, ['MicroWebSocketAgent', 'Service']);

  index = ast.insertVariable(index + 1, '__filename', 'fileURLToPath(import.meta.url)', VariableDeclarationKind.Const);
  index = ast.insertVariable(index + 1, '__dirname', 'dirname(__filename)', VariableDeclarationKind.Const);
  index = ast.insertVariable(index + 1, '__services', "resolve(__dirname, 'services')", VariableDeclarationKind.Const);

  const cls = ast.getExtendsClass('Boot');
  if (!cls) throw new Error('找不到基于 Boot 的类');

  index = ast.getConstructorIndex(cls);

  const hasWSModule = cls.getProperties().some(property => {
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
            expr.getArguments()[0]?.getText() === "MicroWebSocketAgent";
        }
      }
      return false;
    });

    return isPrivateReadonly && isCorrectType && hasDecorator;
  })

  if (!hasWSModule) {
    cls.insertMembers(index, '@Application.Inject(MicroWebSocketAgent)\n\tprivate readonly agent: MicroWebSocketAgent;');
  }

  const initializeMethod = cls.getMethodOrThrow("initialize");
  const insertIndex = initializeMethod
    ? cls.getMembers().indexOf(initializeMethod)
    : cls.getMembers().length;

  cls.insertMembers(insertIndex, methods);
  initializeMethod.addStatements('await this.micro_ws_initialize();');

  ast.save();
}