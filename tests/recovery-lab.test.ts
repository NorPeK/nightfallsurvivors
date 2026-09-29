import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { startRecoveryLab } from "../scripts/recovery-lab.mjs";
import { SAVE_KEY } from "../app/game/platform";
import { parseProfile } from "../app/game/meta";

test("recovery lab is loopback-only, serves an unchanged artifact copy and blocks external connections", async t => {
  const dir = await mkdtemp(join(tmpdir(), "norpek-recovery-"));
  const file = join(dir, "game.html"), original = '<!doctype html><html><head></head><body><div id="root"></div><script type="module">window.originalGame=true</script></body></html>';
  await writeFile(file, original);
  const lab = await startRecoveryLab(file);
  t.after(async () => { await lab.close(); await rm(dir, { recursive: true, force: true }); });
  assert.match(lab.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  const response = await fetch(`${lab.url}/game`), game = await response.text();
  assert.equal(response.status, 200); assert.match(response.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
  assert.ok(game.indexOf('/adapter.js') < game.indexOf('window.originalGame'));
  assert.match(game, /data-recovery-game="true"/);
  assert.equal(game.replace('<script src="/adapter.js"></script>', '').replace('<html data-recovery-game="true"', '<html'), original,
    "the game receives only the storage adapter and marker, with no added controls or layout");
  assert.equal(await readFile(file, "utf8"), original);
  assert.equal((await fetch(`${lab.url}/package.json`)).status, 404);
  assert.equal((await fetch(`${lab.url}/`, { method: "POST" })).status, 405);
});

test("recovery lab fixture controls exercise primary faults while never touching ordinary profile keys", async t => {
  const dir = await mkdtemp(join(tmpdir(), "norpek-recovery-")); const file = join(dir, "game.html");
  await writeFile(file, "<html><head></head><body></body></html>");
  const lab = await startRecoveryLab(file);
  t.after(async () => { await lab.close(); await rm(dir, { recursive: true, force: true }); });
  const script = await (await fetch(`${lab.url}/adapter.js`)).text();
  const storage = new Map([[SAVE_KEY, "real progress must remain untouched"], [`${SAVE_KEY}-backup`, "real backup"]]);
  const native = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } };
  const makeButton = (field: string, value: string) => ({ dataset: { [field]: value }, click: () => {}, addEventListener(_name: string, callback: () => void) { this.click = callback; } });
  const fixtures = ["current", "corrupt", "future", "load-error", "save-error", "recovery-error"].map(name => makeButton("fixture", name));
  const actions = ["healthy", "load-error", "save-error", "conflict", "inspect"].map(name => makeButton("action", name));
  const window = { localStorage: native };
  const nodes = { "lab-state": { textContent: "" }, "lab-message": { textContent: "" } };
  const document = { documentElement: { dataset: { recoveryGame: "true" } }, readyState: "complete",
    getElementById: (id: keyof typeof nodes) => nodes[id], querySelectorAll: (query: string) => query === "[data-fixture]" ? fixtures : actions };
  runInNewContext(script, { window, document, DOMException });
  const click = (name: string) => fixtures.find(button => button.dataset.fixture === name)!.click();
  const action = (name: string) => actions.find(button => button.dataset.action === name)!.click();
  click("current"); assert.equal(parseProfile(window.localStorage.getItem(SAVE_KEY)!).gold, 1000);
  click("corrupt"); assert.throws(() => parseProfile(window.localStorage.getItem(SAVE_KEY)!));
  const backup = parseProfile(window.localStorage.getItem(`${SAVE_KEY}-backup`)!);
  assert.equal(backup.gold, 1234); assert.equal(backup.upgrades.might, 1);
  click("future"); assert.throws(() => parseProfile(window.localStorage.getItem(SAVE_KEY)!), /different game version/);
  click("load-error"); assert.throws(() => window.localStorage.getItem(SAVE_KEY), { name: "SecurityError" });
  action("healthy"); assert.equal(parseProfile(window.localStorage.getItem(SAVE_KEY)!).gold, 1000);
  click("save-error"); assert.throws(() => window.localStorage.setItem(SAVE_KEY, "replacement"), { name: "QuotaExceededError" });
  action("healthy"); window.localStorage.setItem(SAVE_KEY, "retry succeeded");
  assert.equal(window.localStorage.getItem(SAVE_KEY), "retry succeeded");
  action("conflict"); assert.equal(parseProfile(window.localStorage.getItem(SAVE_KEY)!).gold, 2222);
  click("recovery-error"); assert.throws(() => window.localStorage.setItem(SAVE_KEY, "replacement"), { name: "QuotaExceededError" });
  assert.equal(parseProfile(window.localStorage.getItem(`${SAVE_KEY}-backup`)!).gold, 1234);
  assert.equal(storage.get(SAVE_KEY), "real progress must remain untouched"); assert.equal(storage.get(`${SAVE_KEY}-backup`), "real backup");
});
