/** Opt-in local fault lab. Production files are read once, never modified.
 * Start: node --import tsx scripts/recovery-lab.mts [--html game.html]
 * A random loopback port and per-process storage namespace isolate real progress.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createDefaultProfile, purchaseUpgrade } from "../app/game/meta";
import { SAVE_KEY } from "../app/game/platform";

const pageStyle = `body{margin:0;padding:24px;background:#11151e;color:#f0f1f5;font:16px/1.5 system-ui}main{max-width:940px;margin:auto}button,a{font:inherit}button{padding:10px 15px;margin:5px;border:1px solid #9eafd0;border-radius:7px;background:#26334a;color:white;cursor:pointer}a{color:#bad8ff}fieldset{border:1px solid #61708b;margin:18px 0;padding:15px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#080d16;padding:12px}small{color:#c1cadb}`;
const controls = `<fieldset><legend>1. Seed an isolated fixture</legend>
<button data-fixture="current">Valid current profile · 1,000 gold</button>
<button data-fixture="corrupt">Corrupt primary + valid backup · 1,234 gold</button>
<button data-fixture="future">Future profile + older backup</button>
<button data-fixture="load-error">Blocked load + valid primary</button>
<button data-fixture="save-error">Blocked save + valid primary</button>
<button data-fixture="recovery-error">Corrupt primary + blocked recovery write</button>
</fieldset><fieldset><legend>2. Control faults without reloading the game</legend>
<button data-action="healthy">Allow storage reads and writes</button>
<button data-action="load-error">Block primary reads</button>
<button data-action="save-error">Block primary writes</button>
<button data-action="conflict">Simulate another writer · 2,222 gold</button>
<button data-action="inspect">Inspect stored fixture</button></fieldset>`;

export async function startRecoveryLab(htmlPath = resolve("game.html")) {
  const original = await readFile(htmlPath, "utf8");
  if (!original.includes("<head>") || !original.includes("</body>")) throw new Error("Expected a generated standalone HTML document.");
  if (/youtube\.com\/game_api|https?:\/\//i.test(original.match(/<script[^>]*src=[^>]+/gi)?.join("") ?? "")) throw new Error("The recovery lab requires the browser standalone, not a remote SDK entry.");
  const hash = createHash("sha256").update(original).digest("hex");
  const namespace = `norpek-recovery-lab:${randomUUID()}:`;
  const current = createDefaultProfile(); current.gold = 1000; current.settings.onboardingComplete = true;
  let backup = createDefaultProfile(); backup.gold = 1384; backup.settings.onboardingComplete = true;
  const bought = purchaseUpgrade(backup, "might");
  if (!bought.ok) throw new Error("The known fixture purchase could not be prepared.");
  backup = bought.profile; // Current-schema backup: 1,234 gold and one paid Might rank.
  const other = createDefaultProfile(); other.gold = 2222; other.revision = 50; other.settings.onboardingComplete = true;
  const future = JSON.stringify({ ...current, version: 999, gold: 4321 });
  const config = JSON.stringify({ namespace, saveKey: SAVE_KEY, hash, fixtures: {
    current: { primary: JSON.stringify(current), backup: null, fault: "healthy" },
    corrupt: { primary: "{broken-json", backup: JSON.stringify(backup), fault: "healthy" },
    future: { primary: future, backup: JSON.stringify(backup), fault: "healthy" },
    "load-error": { primary: JSON.stringify(current), backup: JSON.stringify(backup), fault: "load-error" },
    "save-error": { primary: JSON.stringify(current), backup: null, fault: "save-error" },
    "recovery-error": { primary: "{broken-json", backup: JSON.stringify(backup), fault: "save-error" },
  }, other: JSON.stringify(other) }).replaceAll("<", "\\u003c");
  const adapter = `(() => {
    const config=${config};
    const native=window.localStorage;
    const key=(name)=>config.namespace+name;
    const primary=config.saveKey, backup=primary+'-backup';
    const get=(name)=>native.getItem(key(name));
    const put=(name,value)=>value===null?native.removeItem(key(name)):native.setItem(key(name),value);
    if(document.documentElement.dataset.recoveryGame==='true'){
      const storage={getItem(name){if(name===primary&&get('fault')==='load-error')throw new DOMException('Recovery lab: storage read blocked','SecurityError');return get(name);},
        setItem(name,value){if(name===primary&&get('fault')==='save-error')throw new DOMException('Recovery lab: storage write blocked','QuotaExceededError');put(name,String(value));},
        removeItem(name){native.removeItem(key(name));},clear(){throw new Error('Recovery lab refuses broad storage clearing');},
        key(index){return [primary,backup][index]??null;},get length(){return Number(get(primary)!==null)+Number(get(backup)!==null);}};
      Object.defineProperty(window,'localStorage',{configurable:true,value:storage});
    }
    function inspect(){const out=document.getElementById('lab-state');if(!out)return;out.textContent=JSON.stringify({fault:get('fault')||'healthy',primary:get(primary),backup:get(backup)},null,2);}
    function bind(){document.querySelectorAll('[data-fixture]').forEach(button=>button.addEventListener('click',()=>{
      const fixture=config.fixtures[button.dataset.fixture];if(!fixture)return;
      put(primary,fixture.primary);put(backup,fixture.backup);put('fault',fixture.fault);inspect();
      document.getElementById('lab-message').textContent='Fixture prepared. Open a fresh game tab. Existing game tabs must be closed before switching fixtures.';
    }));document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
      const action=button.dataset.action;
      if(action==='conflict')put(primary,config.other);else if(action!=='inspect')put('fault',action);
      inspect();document.getElementById('lab-message').textContent=action==='conflict'?'Another writer changed the primary. Trigger a game save to test conflict recovery.':'Storage control updated. Retry in the game without reloading.';
    }));inspect();}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  })();`;
  const setup = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>NORPEK isolated recovery lab</title><style>${pageStyle}</style></head><body><main>
<h1>Isolated save recovery lab</h1><p>This loopback-only lab serves a copy of the generated standalone. Storage is namespaced for this process; normal website/YouTube progress is never read or written. All network connections are disabled by the lab CSP.</p>
<p><strong>Close existing lab game tabs before seeding another fixture.</strong> Control buttons may be used while a game stays open. Faults affect only the primary save; backup reads remain available.</p>
${controls}<p><a href="/game" target="_blank" rel="noopener">Open prepared game in a new tab</a></p><p id="lab-message" role="status">Choose a fixture, then open the game.</p>
<h2>Stored fixture (inspection bypasses injected faults)</h2><pre id="lab-state"></pre><small>Artifact SHA-256: ${hash}</small></main><script src="/adapter.js"></script></body></html>`;
  const game = original.replace("<head>", '<head><script src="/adapter.js"></script>')
    .replace(/<html\b/, '<html data-recovery-game="true"');
  const csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
    const content = path === "/" ? setup : path === "/game" ? game : path === "/adapter.js" ? adapter : null;
    if (content === null) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": path.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", "Content-Security-Policy": csp,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    res.end(req.method === "HEAD" ? undefined : content);
  });
  await new Promise<void>((resolveListening, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListening); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No loopback address allocated.");
  return { url: `http://127.0.0.1:${address.port}`, artifactHash: hash, namespace,
    close: () => new Promise<void>((resolveClosed, reject) => { server.close(error => error ? reject(error) : resolveClosed()); server.closeIdleConnections(); }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flag = process.argv.indexOf("--html");
  void startRecoveryLab(flag < 0 ? undefined : resolve(process.argv[flag + 1])).then(lab => {
    console.log(`Isolated recovery lab: ${lab.url}\nArtifact SHA-256: ${lab.artifactHash}\nClose lab game tabs before changing fixtures. Ctrl-C stops the loopback server.`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
