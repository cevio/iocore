import { createPromptModule } from 'inquirer';
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { copy } from 'fs-extra';
import { createRequire } from 'node:module';
import { Project } from "ts-morph";
import { HTTP_GLOBAL_VARS, HTTP_IMPORTS, HTTP_INITIALIZE_CODE, HTTP_TERMINATE_CODE } from './http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __template = resolve(__dirname, '../template');
const require = createRequire(import.meta.url);

export async function createProject() {
  const prompt = createPromptModule();
  const { project } = await prompt([{
    type: 'input',
    name: 'project',
    message: '请输入项目名称'
  }]);

  // 创建文件夹
  const directory = resolve(process.cwd(), project);
  if (!existsSync(directory)) {
    mkdirSync(directory);
  }

  await copy(__template, directory);

  const { funcs } = await prompt([{
    type: 'checkbox',
    name: 'funcs',
    message: '请选择需要的服务',
    choices: [
      { name: 'Http服务', value: 'http' },
    ]
  }]);

  for (let i = 0; i < funcs.length; i++) {
    const func: string = funcs[i];
    switch (func) {
      case 'http':
        HttpResolve(directory);
        break;
    }
  }
}

function HttpResolve(directory: string) {
  const mainFile = resolve(directory, 'src/main.ts');
  if (!existsSync(mainFile)) throw new Error('缺少入口文件main.ts');
  const project = new Project({
    // 显式指定 TypeScript 版本（需与项目中实际版本一致）
    compilerOptions: {
      typescript: require('typescript'),
    },
  });
  if (!project.getSourceFile(mainFile)) {
    // 2. 若不存在，显式添加到项目
    project.addSourceFileAtPath(mainFile);
  }
  const sourceFile = project.getSourceFile(mainFile);
  if (!sourceFile) {
    throw new Error(`文件 ${mainFile} 加载失败`);
  }

  const imports = sourceFile.getImportDeclarations();
  const bootImport = imports.find(decl =>
    decl.getModuleSpecifierValue() === "@iocore/boot" &&
    decl.getDefaultImport()?.getText() === "Boot"
  );

  if (!bootImport) {
    throw new Error(`未找到 import Boot from '@iocore/boot'`);
  }

  sourceFile.insertImportDeclarations(bootImport.getChildIndex() + 1, HTTP_IMPORTS);

  const lastImport = sourceFile.getImportDeclaration("node:path");
  sourceFile.insertStatements(lastImport.getChildIndex() + 1, HTTP_GLOBAL_VARS);

  const cls = sourceFile.getClassOrThrow(c => c.isDefaultExport());
  cls.addProperty({
    decorators: [{ name: "Application.Inject", arguments: ['Http'] }],
    // @ts-ignore
    scope: "private",
    isReadonly: true,
    name: "http",
    type: "Http"
  });
  cls.addProperty({
    // @ts-ignore
    scope: "private",
    isReadonly: true,
    name: "stacks",
    initializer: "new Set<() => void>()"
  });
  const ctor = cls.getConstructors()[0];
  ctor.addStatements("this.logger.setLevel('debug');");
  const initializeMethod = cls.getMethodOrThrow("initialize");
  initializeMethod.addStatements(HTTP_INITIALIZE_CODE);
  const terminateMethod = cls.getMethodOrThrow("terminate");
  terminateMethod.addStatements(HTTP_TERMINATE_CODE);
  sourceFile.formatText({
    indentSize: 2, // 缩进 2 空格
    convertTabsToSpaces: true,
  })
  sourceFile.saveSync();
}