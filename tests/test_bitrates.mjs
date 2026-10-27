import assert from "node:assert/strict";
import { loadSource, profiles, settings } from "./frontend_helpers.mjs";
import test from "node:test";

const numeric = loadSource("src/components/shared/numerictextinput.tsx", {
  "./textinput": { TextInput: "TextInput" }
});
const shared = { ...numeric, ListDropdown: "ListDropdown", OptionalBooleanDropdown: "OptionalBooleanDropdown" };
const { StreamingProfileFields } = loadSource("src/components/moonlightsettingsview/streamingprofilefields.tsx", {
  react: { useState: (value) => [value, () => {}] },
  "../shared": shared, "../../lib": settings, "../../lib/streamingprofile": profiles, "@decky/ui": { Field: "Field" }
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
