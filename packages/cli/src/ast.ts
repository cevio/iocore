import { Project, SourceFile, VariableDeclarationKind, ClassDeclaration, PropertyDeclaration, SyntaxKind } from "ts-morph";
import { createRequire } from 'node:module';
import { diffArrays } from "./utils";

const require = createRequire(import.meta.url);

export class AST {
  private readonly source: SourceFile;

  constructor(file: string) {
    const project = new Project({
      compilerOptions: {
        typescript: require('typescript'),
      },
    });
    if (!project.getSourceFile(file)) {
      project.addSourceFileAtPath(file);
    }
    const source = project.getSourceFile(file);
    if (!source) {
      throw new Error(`文件 ${file} 加载失败`);
    }
    this.source = source;
  }

  public getImportDeclaration(value: string) {
    const imports = this.source.getImportDeclarations();
    const target = imports.find(decl =>
      decl.getModuleSpecifierValue() === value
    );
    return target;
  }

  public insertImportDeclaration(index: number, value: string, defaultValue: string, names: string[] = []) {
    const target = this.getImportDeclaration(value);
    if (target) {
      if (defaultValue) {
        const defaultTarget = target.getDefaultImport();
        if (!defaultTarget) {
          target.setDefaultImport(defaultValue);
        }
      }

      const oldNames = target.getNamedImports().map(item => item.getText());
      const { added } = diffArrays(oldNames, names);
      for (let i = 0; i < added.length; i++) {
        target.addNamedImport(added[i]);
      }

      return target.getChildIndex();
    }
    return this.source.insertImportDeclaration(index, {
      defaultImport: defaultValue,
      namedImports: names,
      moduleSpecifier: value,
    }).getChildIndex()
  }

  public insertVariable(index: number, key: string, value: string, kind: VariableDeclarationKind) {
    const filenameDeclaration = this.source.getVariableDeclaration(key);
    if (filenameDeclaration) return filenameDeclaration.getChildIndex();
    const variableStatement = this.source.addVariableStatement({
      declarationKind: kind,
      declarations: [{
        name: key,
        initializer: value,
      }]
    });
    variableStatement.setOrder(index);
    return variableStatement.getChildIndex();
  }

  public getDefaultClass() {
    return this.source.getClassOrThrow(c => c.isDefaultExport());
  }

  public getExtendsClass(name: string) {
    return this.source.getClass(c =>
      c.getExtends()?.getText() === name
    )!;
  }

  public getConstructorIndex(clazz: ClassDeclaration) {
    const ctor = clazz.getConstructors()[0];
    return ctor ? clazz.getMembers().indexOf(ctor) : 0;
  }

  public classHasReadonly(property: PropertyDeclaration, kind: SyntaxKind) {
    return property.getModifiers().some(m =>
      m.getKind() === kind
    ) && property.getModifiers().some(m =>
      m.getKind() === SyntaxKind.ReadonlyKeyword
    );
  }

  public save() {
    this.source.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
    })
    this.source.saveSync();
  }
}