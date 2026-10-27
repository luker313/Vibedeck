import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the actual TypeScript launcher with Steam/Decky APIs mocked: those
// APIs are only available inside Steam, while shortcut migration must run in CI.
function loadSource(path, imports, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
      return imports[name];
    },
    ...globals
  }, { filename: path });
  return exports;
}

const logger = { log() {}, error() {} };
const steamutils = loadSource("src/lib/steamutils.ts", {
  "../steam-utils": {},
  "@decky/api": {},
  "./logger": { logger },
  "promise-throttle-all": {}
});
const oldRunner = "/home/deck/homebrew/plugins/moondeck/python/moondeckrun.sh";
const newRunner = "/home/deck/homebrew/plugins/vibedeck/python/moondeckrun.sh";

function migrationCase(executable, { verifyUpdate = true } = {}) {
  const details = { unAppID: 2147484000, strShortcutExe: executable };
  const writes = [];
  const utilities = {
    ...steamutils,
    async getAppDetails(appId) { assert.equal(appId, details.unAppID); return details; },
    async setAppHiddenState() { return true; },
    async waitForAppDetails(appId, predicate) {
      assert.equal(appId, details.unAppID);
      return { details, matchesPredicate: verifyUpdate && predicate(details) };
    }
  };
  const { MoonDeckAppLauncher } = loadSource("src/lib/moondeckapplauncher.ts", {
    "./steamutils": utilities,
    "rxjs": {},
    "./envutils": {},
    "@decky/ui/dist/globals/steam-client/Input": {},
    "./moondeckapp": { MoonDeckAppProxy: class {} },
    "@decky/api": {},
    "./executeasync": {},
    "./logger": { logger }
  }, {
    SteamClient: { Apps: { SetShortcutExe(appId, path) {
      writes.push({ appId, path });
      if (verifyUpdate) details.strShortcutExe = path;
    } } }
  });
  const shortcuts = {
    getId() { return details.unAppID; },
    async removeShortcut() { assert.fail("Migration must preserve the existing shortcut"); },
    async addShortcut() { assert.fail("Migration must preserve the existing shortcut ID"); }
  };
  const launcher = new MoonDeckAppLauncher({}, {}, shortcuts, {}, {});
  return {
    details,
    writes,
    // TypeScript private is intentionally accessed here to isolate the real
    // migration flow from the surrounding host/network/stream launch workflow.
    run() { return launcher.ensureAppDetails(1903340, newRunner, "Expedition 33", steamutils.AppType.MoonDeck); }
  };
}

test("imported MoonDeck shortcuts are rebound in place, including quoted executables", async () => {
  for (const path of [oldRunner, `"${oldRunner}"`]) {
    const migration = migrationCase(path);
    assert.equal(await migration.run(), migration.details);
    assert.deepEqual(migration.writes, [{ appId: migration.details.unAppID, path: newRunner }]);
  }
});

test("a current Vibedeck shortcut is reused without changing its executable", async () => {
  const migration = migrationCase(`"${newRunner}"`);
  assert.equal(await migration.run(), migration.details);
  assert.deepEqual(migration.writes, []);
});

test("unrelated executables are not rebound", async () => {
  for (const path of ["/home/deck/games/game.sh", `${oldRunner}.backup`, `${oldRunner} --other`]) {
    const migration = migrationCase(path);
    assert.equal(await migration.run(), null);
    assert.deepEqual(migration.writes, []);
  }
});

test("a failed Steam executable update aborts the launch", async () => {
  const migration = migrationCase(oldRunner, { verifyUpdate: false });
  assert.equal(await migration.run(), null);
});

test("executable matching accepts Steam quotes and treats path punctuation literally", () => {
  const path = "/home/deck/homebrew/plugins/vibedeck (test)/python/moondeckrun.sh";
  assert.ok(steamutils.checkExecPathMatch(path, `"${path}"`));
  assert.ok(steamutils.checkExecPathMatch(`"${path}"`, path));
  assert.equal(steamutils.checkExecPathMatch(newRunner, `${newRunner}.backup`), false);
  assert.equal(steamutils.checkExecPathMatch(newRunner, newRunner.replace(".sh", "Xsh")), false);
  assert.equal(steamutils.checkExecPathMatch(newRunner, oldRunner), false);
});
