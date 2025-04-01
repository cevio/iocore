export const HTTP_INITIALIZE_CODE = `this.http.hooks.add('prefix', async (ctx, next) => {
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
this.logger.info('http://127.0.0.1:' + this.http.props.port);`;


export const HTTP_TERMINATE_CODE = `for (const fn of this.stacks.values()) {
  fn();
}`

export const HTTP_IMPORTS = [{
  namedImports: ["Application"],
  moduleSpecifier: "@iocore/component"
},
{
  namedImports: ["Controller", "Http"],
  moduleSpecifier: "@iocore/http"
},
{
  namedImports: ["fileURLToPath"],
  moduleSpecifier: "node:url"
},
{
  namedImports: ["resolve", "dirname"],
  moduleSpecifier: "node:path"
}]

export const HTTP_GLOBAL_VARS = [
  "\n",
  "const __filename = fileURLToPath(import.meta.url);",
  "const __dirname = dirname(__filename);",
  "const __controllers = resolve(__dirname, 'controllers');",
]