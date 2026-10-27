import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Render the real controls without Decky's runtime, then use the actual numeric
// converter so this catches the UI rejecting an otherwise valid saved profile.
const jsx = (type, props) => ({ type, props });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: "Fragment" };
function loadSource(path, imports) {
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
    }
  }, { filename: path });
  return exports;
}

const settings = loadSource("src/lib/settingsmanager.ts", {
  lodash: {}, rxjs: {}, "async-mutex": {}, "./readonlysubject": {},
  "@decky/api": {}, "./logger": {}
});
const numeric = loadSource("src/components/shared/numerictextinput.tsx", {
  "./textinput": { TextInput: "TextInput" }
});
const shared = { ...numeric, ListDropdown: "ListDropdown", OptionalBooleanDropdown: "OptionalBooleanDropdown" };
const { StreamingProfileFields } = loadSource("src/components/moonlightsettingsview/streamingprofilefields.tsx", {
  react: { useState: (value) => [value, () => {}] },
  "../shared": shared, "../../lib": settings, "@decky/ui": { Field: "Field" }
});

function findBitrateInput(node) {
  if (node?.type === numeric.NumericTextInput && node.props.optional && node.props.integer) return node;
  const children = node?.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = child && findBitrateInput(child);
    if (found) return found;
  }
  return null;
}

function bitrateControl(codec = null, bitrate = null) {
  let updated;
  const tree = StreamingProfileFields({
    value: { ...settings.emptyStreamingProfile(), videoCodec: codec, bitrate },
    setValue: (value) => { updated = value; }
  });
  const input = findBitrateInput(tree);
  assert.ok(input, "The streaming profile must expose its bitrate field");
  return {
    enter(text) {
      const result = numeric.NumericTextInput(input.props).props.convert(text);
      if (result.success) input.props.setValue(result.value);
      return result;
    },
    get value() { return updated?.bitrate; }
  };
}

test("PyroWave and inherited-codec profiles accept and retain rates above 500 Mbps", () => {
  for (const codec of ["PyroWave", null]) {
    for (const rate of [500001, 1000000, 3000000]) {
      const control = bitrateControl(codec);
      assert.equal(control.enter(String(rate)).success, true, `${codec}: ${rate} kbps rejected`);
      assert.equal(control.value, rate);
      const reopened = bitrateControl(codec, control.value);
      assert.equal(reopened.enter(String(control.value)).success, true);
      assert.equal(reopened.value, rate);
    }
  }
});

test("bitrate fields keep blank inheritance and validate the supported boundaries", () => {
  const control = bitrateControl("PyroWave", 1000000);
  assert.equal(control.enter("").success, true);
  assert.equal(control.value, null);
  for (const invalid of ["3000001", "499", "1000000.5", "Infinity", "NaN"]) {
    assert.equal(control.enter(invalid).success, false, `${invalid} must be rejected`);
    assert.equal(control.value, null, "Invalid input must not overwrite the saved value");
  }
  const wifi = bitrateControl("AV1");
  assert.equal(wifi.enter("40000").success, true);
  assert.equal(wifi.value, 40000);
});
