const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../..');
const projectRequire = createRequire(path.join(root, 'package.json'));
const ts = projectRequire('typescript');

// Compile the real TS/TSX sources in memory. Only browser/network boundaries
// supplied by a test are replaced; no generated files are written to the app.
function createRuntime(environment = {}, replacements = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const module = {exports: {}};
    cache.set(filename, module.exports);
    const localRequire = createRequire(filename);
    const context = {
      module,
      exports: module.exports,
      console,
      URL,
      TextDecoder,
      setTimeout,
      clearTimeout,
      process: {env: {}},
      ...environment,
      require: (name) => {
        if (Object.prototype.hasOwnProperty.call(replacements, name))
          return replacements[name];
        if (name.endsWith('.css')) return {}; // Styling is not executable in these Node-only checks.
        if (name.startsWith('.')) {
          const base = path.resolve(path.dirname(filename), name);
          for (const candidate of [
            base + '.ts',
            base + '.tsx',
            path.join(base, 'index.ts'),
            path.join(base, 'index.tsx'),
          ]) {
            if (fs.existsSync(candidate))
              return load(path.relative(root, candidate));
          }
        }
        return localRequire(name);
      },
    };
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(output, context, {filename});
    cache.set(filename, module.exports);
    return module.exports;
  }
  return {load};
}

function synchronousState(component) {
  component.setState = (update, callback) => {
    const change =
      typeof update === 'function'
        ? update(component.state, component.props)
        : update;
    component.state = {...component.state, ...change};
    if (callback) callback();
  };
  return component;
}

function bundledParentHandler(bridge) {
  const source = ts.createSourceFile(
    'widget.js',
    fs.readFileSync(path.join(root, 'public/widget.js'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  let expression;
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'postMessageHandlers' &&
      ts.isFunctionExpression(node.right)
    ) {
      if (expression) throw new Error('Ambiguous parent bridge handler');
      expression = node.right.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error('Missing parent bridge handler');
  return vm.runInNewContext('(' + expression + ')', {n: bridge, URL});
}

module.exports = {
  createRuntime,
  synchronousState,
  bundledParentHandler,
  projectRequire,
};
