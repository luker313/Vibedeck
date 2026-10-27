import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const jsx = (type, props) => ({ type, props });
export const jsxRuntime = { jsx, jsxs: jsx, Fragment: "Fragment" };

export function loadSource(path, imports, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX
    }
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "react/jsx-runtime") return jsxRuntime;
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
      return imports[name];
    },
    ...globals
  }, { filename: path });
  return exports;
}

export const settings = loadSource("src/lib/settingsmanager.ts", {
  lodash: {}, rxjs: {}, "async-mutex": {}, "./readonlysubject": {},
  "@decky/api": {}, "./logger": {}
});
export const profiles = loadSource("src/lib/streamingprofile.ts", { "./settingsmanager": settings });
export const plain = (value) => JSON.parse(JSON.stringify(value));

export function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

export function stateHarness(context = {}) {
  const slots = [];
  let cursor = 0;
  return {
    react: {
      useContext: () => context,
      useState(initial) {
        const position = cursor++;
        if (!(position in slots)) slots[position] = typeof initial === "function" ? initial() : initial;
        return [slots[position], (next) => { slots[position] = typeof next === "function" ? next(slots[position]) : next; }];
      }
    },
    render(Component, props) { cursor = 0; return Component(props); }
  };
}
