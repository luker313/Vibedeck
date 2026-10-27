import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { loadSource, nodes, plain, profiles, settings, stateHarness } from "./frontend_helpers.mjs";
import test from "node:test";

const fixtures = JSON.parse(execFileSync("python3", ["-c", `
import json
from test_profiles import host_fixture, display_fixture
print(json.dumps({'host': host_fixture(), 'screen': display_fixture()}))
`], { env: { ...process.env, PYTHONPATH: "defaults/python:tests" }, encoding: "utf8" }));

function fixture() {
  const host = structuredClone(fixtures.host);
  const screen = structuredClone(fixtures.screen);
  host.resolution.dimensions = [screen];
  host.networkSettings.mode = "WiFi";
  screen.updateMetadata = "preserve unknown metadata";
  Object.assign(screen, { label: "Living room", videoCodec: "HEVC", bitrate: 40000, fps: 90 });
  Object.assign(host.networkSettings.wifi, { videoCodec: "AV1", bitrate: 60000, enableVrr: false });
  Object.assign(host.networkSettings.ethernet, { videoCodec: "PyroWave", bitrate: 1000000 });
  Object.assign(screen.networkOverrides.ethernet, { bitrate: 1500000, hdr: false });
  return { host, screen };
}

const ui = { Field: "Field", DialogButton: "Button", Focusable: "Focusable", ModalRoot: "Modal", DialogControlsSection: "Section", DialogControlsSectionHeader: "Header" };
const fieldsOf = (tree) => nodes(tree, (node) => node.type === "ProfileFields");
const tabOf = (tree) => nodes(tree, (node) => node.type === "LayerTabs")[0];
const fieldOf = (tree, label) => nodes(tree, (node) => node.type === "Field" && node.props.label === label)[0];
const buttonOf = (tree, label) => nodes(tree, (node) => node.type === "Button" && node.props.children === label)[0];

test("UI previews match the existing Python runner across all layers, networks and screen selections", () => {
  const cases = JSON.parse(execFileSync("python3", ["-c", `
import json
from test_profiles import host_fixture, display_fixture
from lib.plugin.settings import StreamingProfile, StreamingOptions
from lib.streamingprofile import selected_dimension, resolve_streaming_profile
cases = []
for i in range(24):
    host = host_fixture()
    screens = [display_fixture('TV'), display_fixture('Deck')]
    host['resolution'].update(dimensions=screens, useLinkedDisplays=i % 3 != 0,
        useCustomDimensions=i % 4 != 0, selectedDimensionIndex=[-1, 0, 1, 99][i % 4])
    choices = {'videoCodec': [None, 'AV1', 'PyroWave', 'HEVC'],
        'bitrate': [None, 0, 40000, 60000, 1000000, 3000000],
        'fps': [None, 0, 60, 90, 120], 'hdr': [None, False, True]}
    host['resolution'].update(defaultBitrate=choices['bitrate'][i % 6],
        defaultFps=choices['fps'][i % 5], defaultHdr=choices['hdr'][i % 3])
    layers = [host, *screens, host['networkSettings']['wifi'], host['networkSettings']['ethernet'],
        screens[0]['networkOverrides']['wifi'], screens[0]['networkOverrides']['ethernet'],
        screens[1]['networkOverrides']['wifi'], screens[1]['networkOverrides']['ethernet']]
    for n, layer in enumerate(layers):
        for k, key in enumerate(StreamingProfile.__annotations__):
            if layer is host and key not in StreamingOptions.__annotations__: continue
            options = choices.get(key, [None, False, True])
            layer[key] = options[(i + n + k) % len(options)]
    for display in ('TV', 'Deck', 'missing', None):
        selected = selected_dimension(host, display)
        for transport in ('wifi', 'ethernet', 'unknown'):
            cases.append({'host': host, 'display': display, 'transport': transport,
                'selected': selected, 'expected': resolve_streaming_profile(host, selected, transport)})
print(json.dumps(cases))
`], { env: { ...process.env, PYTHONPATH: "defaults/python:tests" }, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
  assert.equal(cases.length, 288);
  for (const entry of cases) {
    const before = JSON.stringify(entry.host);
    const selected = profiles.selectDisplayProfile(entry.host, entry.display);
    assert.deepEqual(plain(selected), entry.selected);
    assert.deepEqual(plain(profiles.resolveProfile(entry.host, selected, entry.transport).values), entry.expected);
    assert.equal(JSON.stringify(entry.host), before, "Preview must not write resolved values into settings");
  }
});

test("blank fields explain the actual inherited value and source, preserving explicit false", () => {
  const { host, screen } = fixture();
  const { StreamingProfileFields } = loadSource("src/components/moonlightsettingsview/streamingprofilefields.tsx", {
    react: { useState: (value) => [value, () => {}] }, "../shared": { ListDropdown: "Dropdown", NumericTextInput: "Number", OptionalBooleanDropdown: "Boolean" },
    "../../lib": settings, "../../lib/streamingprofile": profiles, "@decky/ui": ui
  });
  const value = { ...screen.networkOverrides.wifi, enableVrr: false };
  const inherited = profiles.resolveProfile(host, screen, "wifi", "screen-network");
  const tree = StreamingProfileFields({ value, setValue() {}, inherited });
  assert.match(JSON.stringify(fieldOf(tree, "Video codec").props.description), /Inherited: AV1 — shared Wi-Fi override/);
  assert.match(JSON.stringify(fieldOf(tree, "Bitrate (kbps)").props.description), /Inherited: 60 Mbps — shared Wi-Fi override/);
  assert.match(JSON.stringify(fieldOf(tree, "FPS").props.description), /Inherited: 90 FPS — screen defaults/);
  assert.doesNotMatch(JSON.stringify(fieldOf(tree, "VRR pacing").props.description), /Inherited:/);
  const boolean = nodes(fieldOf(tree, "VRR pacing"), (node) => node.type === "Boolean")[0];
  assert.equal(boolean.props.value, false);
  assert.equal(profiles.inheritedDescription(profiles.resolveProfile(host, screen, "wifi"), "enableVrr"), "Inherited: Disabled — shared Wi-Fi override");
});

test("an inherited dropdown label updates when its source changes without saving a value", () => {
  const state = stateHarness();
  let previous;
  let pending;
  let writes = 0;
  const { ListDropdown } = loadSource("src/components/shared/listdropdown.tsx", {
    "@decky/ui": { Dropdown: "Dropdown" },
    react: { ...state.react, useEffect(effect, dependencies) {
      if (!previous || dependencies.some((dependency, index) => dependency !== previous[index])) {
        previous = dependencies;
        pending = effect;
      }
    } }
  });
  const props = { optionList: ["AV1", "HEVC"], withOptionalValue: true, value: null,
    label: "Inherit — AV1", setValue() { writes++; } };
  const render = () => {
    state.render(ListDropdown, props);
    const effect = pending;
    pending = null;
    effect?.();
    return state.render(ListDropdown, props);
  };
  assert.equal(render().props.rgOptions[0].label, "Inherit — AV1");
  props.label = "Inherit — HEVC";
  const updated = render();
  assert.equal(updated.props.rgOptions[0].label, "Inherit — HEVC");
  assert.equal(updated.props.selectedOption, null);
  assert.equal(writes, 0);
});

function editor(host) {
  const state = stateHarness();
  const { ModifyResolutionModal } = loadSource("src/components/moonlightsettingsview/resolution/modifyresolutionmodal.tsx", {
    react: state.react, "../../shared": { AnyTextInput: "Text", NumericTextInput: "Number" }, "@decky/ui": ui,
    "../../../lib": settings, "../../../hooks": { useCurrentHostSettings: () => host },
    "../profilelayertabs": { ProfileLayerTabs: "LayerTabs" }, "../profilesummary": { ProfileSummary: "Summary" },
    "../streamingprofilefields": { StreamingProfileFields: "ProfileFields" }, "../../../lib/streamingprofile": profiles
  });
  let saved = null;
  let closed = 0;
  const props = { currentList: host.resolution.dimensions, currentIndex: 0,
    updateList: (list, index) => { saved = { list, index }; }, closeModal: () => closed++ };
  return { render: () => state.render(ModifyResolutionModal, props), get saved() { return saved; }, get closed() { return closed; } };
}

test("opening, switching tabs and cancelling preserves all saved settings and inherits live drafts", () => {
  const { host } = fixture();
  const before = JSON.stringify(host);
  const instance = editor(host);
  let tree = instance.render();
  const defaults = fieldsOf(tree)[0];
  defaults.props.setValue({ ...defaults.props.value, fps: 75 });
  tree = instance.render();
  tabOf(tree).props.setValue("wifi");
  tree = instance.render();
  assert.equal(fieldsOf(tree)[0].props.inherited.values.fps, 75);
  assert.equal(fieldsOf(tree)[0].props.inherited.sources.fps, "screen defaults");
  tabOf(tree).props.setValue("ethernet");
  instance.render();
  assert.equal(JSON.stringify(host), before);
  assert.equal(instance.saved, null);
});

test("saving unchanged settings preserves nulls, explicit false, links and both network profiles", () => {
  const { host, screen } = fixture();
  const instance = editor(host);
  const tree = instance.render();
  buttonOf(tree, "Save profile — all tabs").props.onClick();
  assert.equal(instance.saved.index, 0);
  assert.equal(instance.closed, 1);
  assert.deepEqual(plain(instance.saved.list[0]), screen);
  assert.equal(host.networkSettings.mode, "WiFi");
});

test("one save keeps edits in all tabs without flattening inheritance or changing shared overrides", () => {
  const { host } = fixture();
  const before = JSON.stringify(host);
  const instance = editor(host);
  let tree = instance.render();
  tabOf(tree).props.setValue("wifi");
  tree = instance.render();
  let fields = fieldsOf(tree)[0];
  fields.props.setValue({ ...fields.props.value, bitrate: 45000 });
  tree = instance.render();
  tabOf(tree).props.setValue("ethernet");
  tree = instance.render();
  fields = fieldsOf(tree)[0];
  fields.props.setValue({ ...fields.props.value, bitrate: null });
  tree = instance.render();
  buttonOf(tree, "Save profile — all tabs").props.onClick();
  const screen = instance.saved.list[0];
  assert.equal(screen.networkOverrides.wifi.bitrate, 45000);
  assert.equal(screen.networkOverrides.ethernet.bitrate, null);
  assert.equal(screen.networkOverrides.ethernet.hdr, false);
  assert.equal(profiles.resolveProfile(host, screen, "ethernet").values.bitrate, 1000000);
  assert.equal(JSON.stringify(host), before, "Only the explicit save callback may persist edits");
});

test("shared controls open and close without writes, and retain settings outside the edited field", () => {
  const { host, screen } = fixture();
  const original = structuredClone(host);
  let writes = 0;
  const state = stateHarness({ settingsManager: { updateHost(callback) { writes++; callback(host); } } });
  const { AdvancedProfileSection } = loadSource("src/components/moonlightsettingsview/advancedprofilesection.tsx", {
    react: state.react, "../../lib": settings, "../../lib/streamingprofile": profiles, "../../contexts": {}, "@decky/ui": ui,
    "./profilelayertabs": { ProfileLayerTabs: "LayerTabs" }, "./profilesummary": { ProfileSummary: "Summary" },
    "./streamingprofilefields": { StreamingProfileFields: "ProfileFields" }
  });
  const render = () => state.render(AdvancedProfileSection, { hostSettings: host, dimension: screen });
  let tree = render();
  buttonOf(tree, "Show advanced").props.onClick();
  tree = render();
  assert.equal(writes, 0);
  const defaults = fieldsOf(tree)[0];
  defaults.props.setValue({ ...defaults.props.value, fps: 90 });
  assert.equal(writes, 1);
  const expected = structuredClone(original);
  expected.resolution.defaultFps = 90;
  assert.deepEqual(host, expected);
  buttonOf(tree, "Hide advanced").props.onClick();
  assert.equal(fieldsOf(render()).length, 0);
  assert.equal(writes, 1);
});

test("next-connection preview separates detected transport, forced mode and disabled profiles", () => {
  const { host } = fixture();
  let detected = { transport: "wifi", interface: "wlan0", reason: "Route to host uses wlan0" };
  const state = stateHarness({ settingsManager: { updateHost(callback) { callback(host); } } });
  const { NetworkProfileSection } = loadSource("src/components/moonlightsettingsview/networkprofilesection.tsx", {
    react: state.react, "../../lib": settings, "../../lib/streamingprofile": profiles, "../../contexts": {}, "@decky/ui": ui,
    "../shared": { ListDropdown: "Dropdown" }, "./profilesummary": { ProfileSummary: "Summary" },
    "../../hooks/usenetworkroute": { useNetworkRoute: () => ({ route: detected, refresh() {} }) }
  });
  const render = () => state.render(NetworkProfileSection, { hostSettings: host, display: "TV" });
  host.networkSettings.mode = "Ethernet";
  let tree = render();
  assert.ok(fieldOf(tree, "Detected: Wi-Fi (wlan0)"));
  assert.ok(fieldOf(tree, "Using: Ethernet (forced)"));
  let summary = nodes(tree, (node) => node.type === "Summary")[0];
  assert.equal(summary.props.resolved.values.bitrate, 1500000);
  nodes(tree, (node) => node.type === "Dropdown")[0].props.setValue("Auto");
  tree = render();
  summary = nodes(tree, (node) => node.type === "Summary")[0];
  assert.equal(summary.props.resolved.values.bitrate, 60000);
  detected = { transport: "unknown", interface: null, reason: "No route" };
  tree = render();
  assert.equal(nodes(tree, (node) => node.type === "Summary")[0].props.resolved.values.bitrate, 40000);
  host.passToMoonlight = false;
  tree = render();
  assert.ok(fieldOf(tree, "Using Moonlight settings"));
  assert.equal(nodes(tree, (node) => node.type === "Summary").length, 0);
});
