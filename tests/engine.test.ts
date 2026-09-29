import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, type Enemy, type Callbacks, type GameSnapshot } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, ENEMIES, WEAPONS, PASSIVES, xpForLevel } from "../app/game/data";
import type { RunStats, UpgradeOption } from "../app/game/types";

type FixtureAccess = {
  buildGrid(): void; nearEnemies(x: number, y: number, radius: number, callback: (e: Enemy) => void): void;
  update(dt: number): void; updateBullets(dt: number): void; updateBoss(dt: number): void; updateEnemies(dt: number): void;
  recomputePassives(): void; slash(angle: number, radius: number, damage: number, evolved: boolean): void;
  updateScheduled(dt: number): void; schedule(delay: number, kind: string, args: number[], evolved?: boolean, owner?: number): void;
  openChest(): void; flushPickups(): void; enterFinalPhase(): void; currentDraft: UpgradeOption[];
  updateWeapons(dt: number): void; updateCovenant(dt: number): void;
  updateSpawning(dt: number, time: number): void;
};
function setup(extra: Partial<Callbacks> = {}, seed = 1) {
  const ends: RunStats[] = [];
  const input = new Input();
  const game = new Game(input, { onPhaseChange() {}, onHud() {}, onLevelUp() {}, onChest() {}, onBossWarning() {}, onRunEnd(s) { ends.push(s); }, ...extra }, { seed, autoStart: false });
  game.startRun("knight", { ...BASE_STATS, critChance: 0 });
  game.weapons = []; game.spawnTimer = 10000;
  return { game, input, ends, access: game as unknown as FixtureAccess };
}
function enemy(game: Game, x = 0, y = 0, hp = 1000) {
  const e = game.spawnEnemy(ENEMIES.brute, false)!;
  Object.assign(e, { x, y, hp, maxHp: hp, speed: 0, radius: 24 });
  return e;
}

test("new runs derive passives from the current hunter and permanent upgrades", () => {
  const { game, access } = setup(); game.passives = [{ id: "might", level: 1 }]; access.recomputePassives();
  game.startRun("mage", { ...BASE_STATS, maxHp: 150, might: 1.25 });
  game.passives = [{ id: "boots", level: 1 }]; access.recomputePassives();
  assert.equal(game.stats.maxHp, 128); assert.equal(game.stats.might, 1.375); assert.equal(game.stats.area, 1.25);
});

test("fatal contact cannot be replaced by a same-frame chest", () => {
  const { game, access, ends } = setup(); game.hp = 1; enemy(game); game.dropPickup("chest", 0, 0, 0);
  access.update(.01); game.ackChest();
  assert.equal(game.phase, "gameover"); assert.equal(game.hp, 0); assert.equal(ends.length, 1);
});

test("victory is terminal immediately and settlement is idempotent", () => {
  const { game, ends } = setup(); game.spawnBoss(BOSSES[2]); game.hp = 1;
  game.hitBoss(1e6, false); game.damagePlayer(1000); game.abandonRun(); game.step(.1);
  assert.equal(game.phase, "victory"); assert.equal(ends.length, 1); assert.equal(ends[0].won, true);
});

test("abandon settles earned gold once", () => {
  const { game, access, ends } = setup(); game.dropPickup("coin", 0, 0, 5); access.update(.01);
  game.abandonRun(); game.abandonRun(); assert.equal(ends.length, 1); assert.equal(ends[0].gold, 5); assert.equal(ends[0].abandoned, true);
});

test("simulation delays freeze during pause/suspension and cannot leak into a retry", () => {
  const { game, access } = setup(); const e = enemy(game, 50, 0); access.buildGrid();
  access.schedule(.15, "slash", [0, 100, 10]); game.pause(); game.step(.2); assert.equal(e.hp, 1000);
  game.resume(); game.setSuspended("platform", true); game.step(.2); assert.equal(e.hp, 1000);
  game.setSuspended("platform", false); game.step(.2); assert.equal(e.hp, 990);
  access.schedule(.01, "slash", [0, 100, 10]); game.startRun("knight", { ...BASE_STATS, critChance: 0 });
  game.weapons = []; game.spawnTimer = 10000; const next = enemy(game, 50, 0); game.step(.1); assert.equal(next.hp, 1000);
});

test("boss-owned actions are invalidated when the boss dies", () => {
  const { game, access } = setup(); game.spawnBoss(BOSSES[0]); access.schedule(.01, "slam", [0, 0, 120, 1000], false, game.boss!.id);
  game.hitBoss(1e6, false); game.step(.1); assert.ok(game.hp > 0);
});

test("spatial queries include large enemies across grid boundaries", () => {
  const { game, access } = setup(); const e = enemy(game, 75, 0); e.radius = 10; access.buildGrid();
  let hits = 0; access.nearEnemies(65, 0, 5, () => hits++); assert.equal(hits, 1);
});

test("spatial query results agree with brute force for deterministic random fixtures", () => {
  const { game, access } = setup();
  for (let i = 0; i < 150; i++) { const e = enemy(game, (i * 137 % 1000) - 500, (i * 317 % 900) - 450); e.radius = i % 2 ? 45.6 : 10; }
  access.buildGrid();
  for (let i = 0; i < 60; i++) {
    const x = i * 47 % 800 - 400, y = i * 113 % 800 - 400, r = i % 70;
    const actual: number[] = []; access.nearEnemies(x, y, r, (e) => actual.push(e.id));
    const expected = game.enemies.filter((e) => e.active && Math.hypot(e.x - x, e.y - y) <= r + e.radius).map((e) => e.id);
    assert.deepEqual(actual.sort((a,b) => a-b), expected.sort((a,b) => a-b));
  }
});

test("spatial keys remain distinct across negative cells and distant-world fallback", () => {
  const {game,access}=setup();
  for(const [x,y] of [[-72,72],[72,-72],[72_000_001,-72_000_001],[-72_000_001,72_000_001]])enemy(game,x,y);
  access.buildGrid();
  for(const target of game.enemies.filter(e=>e.active)){
    const hits:number[]=[];access.nearEnemies(target.x,target.y,1,e=>{hits.push(e.id)});assert.deepEqual(hits,[target.id]);
  }
});

test("piercing arrows hit each target once, including across frames", () => {
  const { game, access } = setup(); const e = enemy(game); access.buildGrid();
  game.spawnBullet("arrow", -10, 0, 520, 0, 10, 5, 3, 1.4, false, 0);
  for (let i = 0; i < 4; i++) access.updateBullets(.01);
  assert.equal(e.hp, 990);
});

test("swept arrows hit targets crossed between frame endpoints", () => {
  const { game, access } = setup(); const e = enemy(game, 0, 0); e.radius = 10; access.buildGrid();
  game.spawnBullet("arrow", -60, 0, 2400, 0, 10, 5, 0, 1, false, 0); access.updateBullets(.05); assert.equal(e.hp, 990);
});

test("boss orb damage is independent of unrelated projectile counts", () => {
  function damage(extra: number) {
    const { game, access } = setup(); game.spawnBoss(BOSSES[0]); Object.assign(game.boss!, { x: 0, y: 0, hp: 100000 });
    game.spawnBullet("orb", 0, 0, 0, 0, 10, 16, 999, 2, false, 0);
    for (let i = 0; i < extra; i++) game.spawnBullet("arrow", 10000, 10000, 0, 0, 10, 5, 1, 2, false, 0);
    for (let i = 0; i < 60; i++) { access.updateBoss(1/60); access.updateBullets(1/60); }
    return 100000 - game.boss!.hp;
  }
  assert.equal(damage(0), damage(9)); assert.ok(damage(0) > 10);
});

test("dagger cooldown cannot suppress an orb", () => {
  const { game, access } = setup(); const e = enemy(game); e.hitCooldowns.daggers = .45; access.buildGrid();
  game.spawnBullet("orb", 0, 0, 0, 0, 10, 16, 99, 1, false, 0); access.updateBullets(.01); assert.equal(e.hp, 990);
});

test("sword angle normalization rejects targets outside the intended arc", () => {
  const { game, access } = setup(); const e = enemy(game, -50, -50); access.buildGrid(); access.slash(2 * Math.PI, 100, 10, false); assert.equal(e.hp, 1000);
});

test("Frost Shards carry the selected duration into collisions", () => {
  const { game, access } = setup(); const e = enemy(game, 200, 0); access.buildGrid(); game.weapons = [{ id: "frost", level: 4, evolved: false, timer: 0, alt: 0 }];
  access.updateWeapons(.01); const shard = game.bullets.find((b) => b.active)!; Object.assign(shard, { x: 200, y: 0, vx: 0, vy: 0 }); access.updateBullets(.01); assert.equal(e.slowT, 2.4);
});

test("frozen wraiths stop voluntary drift", () => {
  const { game, access } = setup(); const e = game.spawnEnemy(ENEMIES.wraith, false)!;
  Object.assign(e, { x: 100, y: 0, slowT: 1, slowF: 0, kx: 0, ky: 0 }); access.buildGrid(); access.updateEnemies(.1); assert.equal(e.x, 100); assert.equal(e.y, 0);
});

test("full pickup pools preserve chests and total XP", () => {
  const { game, access } = setup();
  for (let i = 0; i < 700; i++) game.dropPickup("gem", 1000, 1000, 1);
  game.dropPickup("chest", 20, 0, 0); access.flushPickups();
  assert.equal(game.pickups.filter((p) => p.active && p.kind === "chest").length, 1);
  assert.equal(game.pickups.filter((p) => p.active && p.kind === "gem").reduce((n,p) => n+p.value, 0), 700);
});

test("small coin rewards retain fractional Greed benefit", () => {
  const { game, access } = setup(); game.stats.goldGain = 1.1; game.dropPickup("coin", 0, 0, 5); game.dropPickup("coin", 0, 0, 5); access.update(.01); assert.equal(game.runGold, 11);
});

test("normal spawns are outside wide and narrow logical viewports", () => {
  for (const [w,h] of [[1920,1080],[390,844],[844,390]]) {
    const { game } = setup(); game.setViewport(w,h);
    for (let i=0;i<100;i++) { const e=game.spawnEnemy(ENEMIES.bat,false)!; assert.ok(Math.abs(e.x)>w/2 || Math.abs(e.y)>h/2); }
  }
});

test("finale settles a surviving early boss and freezes summon scaling", () => {
  const { game, access } = setup(); game.time=1800; game.spawnBoss(BOSSES[0]); access.enterFinalPhase();
  assert.equal(game.boss!.def.id,"death"); assert.ok(game.metrics.bossesDefeated.includes("colossus"));
  const first=game.spawnEnemy(ENEMIES.shadow,false)!; game.time=2700; const second=game.spawnEnemy(ENEMIES.shadow,false)!; assert.equal(first.maxHp,second.maxHp);
});

test("draft tools are bounded and stale choices cannot be reused", () => {
  const { game, access }=setup(); game.gainXp(5); const old=access.currentDraft[0];
  game.applyUpgrade(old); const count=game.weapons.length+game.passives.length; game.applyUpgrade(old); assert.equal(game.weapons.length+game.passives.length,count);
  game.gainXp(100); for(let i=0;i<3;i++) assert.equal(game.rerollDraft(),true); assert.equal(game.rerollDraft(),false);
});

test("multiple eligible evolutions can be chosen explicitly", () => {
  let choices: UpgradeOption[]=[];const {game,access}=setup({onEvolutionChoice(o){choices=o;}});
  game.weapons=[{id:"bow",level:8,evolved:false,timer:1,alt:0},{id:"orb",level:8,evolved:false,timer:1,alt:0}]; game.passives=[{id:"eagle",level:1},{id:"tome",level:1}];
  access.openChest(); assert.equal(game.phase,"evolution");assert.equal(choices.length,2);game.chooseEvolution("orb");assert.equal(game.weapons[1].evolved,true);assert.equal(game.weapons[0].evolved,false);
});

test("Covenants remain optional and award one chosen rule",()=>{
  const {game,access}=setup({onCovenant(){}});game.time=601;access.updateCovenant(.01);assert.equal(game.phase,"covenant");
  game.acceptCovenant();assert.equal(game.covenant!.status,"active");game.covenant!.progress=12;access.updateCovenant(.01);
  assert.equal(game.covenant!.status,"reward");assert.equal(game.chooseCovenant("frost"),true);assert.equal(game.chooseCovenant("precision"),false);
});

test("snapshots restore active simulation and scheduled attacks",()=>{
  const {game,access}=setup();enemy(game,50,0);access.schedule(.15,"slash",[0,100,10]); game.step(.05);
  const serialized=JSON.parse(JSON.stringify(game.exportSnapshot()));const other=setup();assert.equal(other.game.importSnapshot(serialized),true);
  game.step(.2);other.game.step(.2); assert.equal(other.game.enemies.find((e)=>e.active)!.hp,game.enemies.find((e)=>e.active)!.hp);
  assert.equal(other.game.time,game.time); assert.equal(other.game.runId,game.runId);
});

test("malformed snapshots cannot overwrite runtime methods or live state",()=>{
  const {game}=setup();const before=game.runId;const snapshot=game.exportSnapshot()!;
  assert.equal(game.importSnapshot({...snapshot,step:"corrupt"}),false);assert.equal(game.importSnapshot({...snapshot,stats:null}),false);assert.equal(game.runId,before);
});

test("seeded simulation agrees across render rates and pause adds no elapsed time",()=>{
  const a=setup({},123),b=setup({},123);a.input.keys.add("d");b.input.keys.add("d");
  for(let i=0;i<600;i++)a.game.step(1/60);for(let i=0;i<300;i++)b.game.step(1/30);
  assert.equal(a.game.time,b.game.time);assert.equal(a.game.px,b.game.px);a.game.pause();const time=a.game.time;for(let i=0;i<100;i++)a.game.step(.25);assert.equal(a.game.time,time);
});

test("evolved Bow critical hits splash from bosses as described",()=>{
  const {game,access}=setup();game.stats.critChance=1;const e=enemy(game,50,0);access.buildGrid();game.spawnBoss(BOSSES[0]);Object.assign(game.boss!,{x:0,y:0});
  game.spawnBullet("arrow",0,0,0,0,10,5,1,1,true,0);access.updateBullets(.01);assert.equal(e.hp,995);
});

test("Fire evolution carries level area and uses matching warning geometry",()=>{
  const {game,access}=setup();game.weapons=[{id:"fire",level:8,evolved:false,timer:0,alt:0}];access.updateWeapons(.01);
  assert.ok(Math.abs(game.bullets.find(b=>b.active)!.aoe - 111.6)<1e-8);
  game.bullets.forEach(b=>b.active=false);game.weapons[0].evolved=true;game.weapons[0].timer=0;access.updateWeapons(.01);access.updateScheduled(.01);
  const meteor=game.bullets.find(b=>b.active)!;assert.equal(meteor.aoe,171);assert.equal(game.fx.find(f=>f.kind==='telegraph')!.radius,171);
});

test("snapshot roundtrip preserves queued drafts and rejects incomplete entities",()=>{
  const {game}=setup();enemy(game,80,0);game.gainXp(30);const snapshot=game.exportSnapshot()!;const restored=setup();let options:UpgradeOption[]=[];restored.game.cb.onLevelUp=o=>options=o;
  assert.equal(restored.game.importSnapshot(JSON.parse(JSON.stringify(snapshot))),true);assert.equal(restored.game.phase,'levelup');assert.ok(options.length>0);
  const corrupt=JSON.parse(JSON.stringify(snapshot));delete corrupt.enemies[0].speed;assert.equal(restored.game.importSnapshot(corrupt),false);
});

test("evolved Frost retains a movement gap even with maximum cooldown reductions",()=>{
  const {game,access}=setup();const e=enemy(game,100,0);game.stats.cooldown=.875*.8;game.weapons=[{id:"frost",level:8,evolved:true,timer:0,alt:0}];
  let frozen=0;for(let i=0;i<1200;i++){Object.assign(e,{x:100,y:0,kx:0,ky:0});access.buildGrid();game.step(1/120);if(e.slowT>0&&e.slowF===0)frozen++;}
  assert.ok(frozen>700,"control still has substantial uptime");assert.ok(frozen<1150,"a true movement gap remains");
});

test("XP milestones are smooth while the established late-game budget is preserved",async()=>{
  const {xpForLevel}=await import("../app/game/data");
  for(const level of [...Array.from({length:8},(_,i)=>17+i),...Array.from({length:8},(_,i)=>37+i)])assert.ok(xpForLevel(level)/xpForLevel(level-1)<1.12);
  assert.equal(xpForLevel(44),900);assert.equal(xpForLevel(80),1643);assert.equal(Array.from({length:79},(_,i)=>xpForLevel(i+1)).reduce((a,b)=>a+b,0),57260);
});

test("every progress callback observes a restorable completed transaction",()=>{
  const snapshots:unknown[]=[];
  const game:Game=setup({onProgress(){snapshots.push(game.exportSnapshot());},onEvolutionChoice(){}}).game;
  const a=game as unknown as FixtureAccess;
  game.weapons=[{id:"bow",level:8,evolved:false,timer:1,alt:0},{id:"orb",level:8,evolved:false,timer:1,alt:0}];game.passives=[{id:"eagle",level:1},{id:"tome",level:1}];
  a.openChest();game.chooseEvolution("orb");game.ackChest();game.dropPickup("coin",0,0,5);game.step(.02);
  assert.ok(snapshots.length>=2);for(const snapshot of snapshots){const target=setup();assert.equal(target.game.importSnapshot(snapshot),true);}
});

test("hunter traits implement their displayed triggers and caps",()=>{
  const sentinel=setup();for(let i=0;i<500;i++)sentinel.game.step(.01);const health=sentinel.game.hp;sentinel.game.damagePlayer(20);assert.equal(health-sentinel.game.hp,11);
  const ranger=setup();ranger.game.startRun('ranger',{...BASE_STATS,critChance:0});ranger.game.spawnTimer=10000;ranger.input.keys.add('d');ranger.game.weapons=[];
  for(let i=0;i<330;i++)ranger.game.step(.01);enemy(ranger.game,ranger.game.px+100,ranger.game.py);ranger.game.weapons=[{id:'bow',level:1,evolved:false,timer:0,alt:0}];ranger.access.updateWeapons(.01);assert.equal(ranger.game.bullets.find(b=>b.active)!.damage,12.5);
  const mage=setup();mage.game.startRun('mage',{...BASE_STATS,critChance:0});mage.game.spawnTimer=10000;const e=enemy(mage.game,100,0);mage.access.buildGrid();mage.game.weapons=[{id:'orb',level:1,evolved:false,timer:0,alt:0}];
  for(let i=0;i<4;i++){mage.game.weapons[0].timer=0;mage.access.updateWeapons(.01);}assert.equal(e.slowT,1);assert.equal(e.slowF,.5);
  const vex=setup();vex.game.startRun('reaper',{...BASE_STATS,critChance:0});vex.game.hp=30;vex.game.weapons=[{id:'daggers',level:1,evolved:false,timer:0,alt:0}];const one=enemy(vex.game,72,0,1),two=enemy(vex.game,72,0,1);vex.access.buildGrid();vex.access.updateWeapons(.001);assert.equal(one.active,false);assert.equal(two.active,false);assert.equal(vex.game.hp,32);
});

test("Covenant rules match their descriptions without weakening terminal guards",()=>{
  const {game,access}=setup();const e=enemy(game,60,0);game.covenant={status:'complete',x:0,y:0,remaining:0,progress:12,target:12,reward:'precision'};
  game.hitEnemy(e,10,false,0,0);assert.equal(e.hp,988);game.hitEnemy(e,10,false,0,0);assert.equal(e.hp,978);
  game.covenant.reward='frost';e.slowF=0;e.slowT=1;game.hitEnemy(e,10,false,0,0);assert.equal(e.hp,966);
  game.covenant.reward='sanctuary';game.hp=100;game.dropPickup('meat',0,0,0);access.update(.01);assert.equal(game.hp,120);assert.equal(game.iframes,1);
});

test("QA scenarios are gated and never export resumable god-mode saves",()=>{
  const {game}=setup();assert.equal(game.debugScenario({minute:25,density:100,fullBuild:true,invulnerable:true}),false);
  game.debug=true;assert.equal(game.debugScenario({minute:25,density:100,fullBuild:true,invulnerable:true}),true);assert.equal(game.exportSnapshot(),null);
  const hp=game.hp;game.damagePlayer(1000);assert.equal(game.hp,hp);
});

test("production rejects QA even if the public debug flag is changed",()=>{
  const env=process.env as Record<string,string|undefined>;
  const prior=env.NODE_ENV;env.NODE_ENV='production';
  try { const {game}=setup();game.debug=true;assert.equal(game.debugScenario({minute:30,density:100,fullBuild:true,invulnerable:true}),false);game.debugSkip(600);assert.equal(game.time,0); }
  finally { if(prior===undefined)delete env.NODE_ENV;else env.NODE_ENV=prior; }
});

test("snapshot restore preserves recycled pool order and future seeded combat",()=>{
  const original=setup();enemy(original.game,200,0).active=false;enemy(original.game,300,0);
  original.game.spawnBullet('arrow',0,0,10,0,10,4,0,3,false,0)!.active=false;
  original.game.spawnBullet('arrow',100,0,10,0,10,4,0,3,false,0);
  original.game.dropPickup('coin',500,0,1);original.game.pickups[0].active=false;original.game.dropPickup('gem',600,0,2);
  const snapshot=original.game.exportSnapshot()!;const restored=setup();assert.equal(restored.game.importSnapshot(snapshot),true);
  const left=enemy(original.game,400,0),right=enemy(restored.game,400,0);assert.equal(original.game.enemies.indexOf(left),restored.game.enemies.indexOf(right));
  for(let i=0;i<100;i++){original.game.step(1/60);restored.game.step(1/60);}
  const a=original.game.exportSnapshot()!,b=restored.game.exportSnapshot()!;
  assert.deepEqual(a.enemies,b.enemies);assert.deepEqual(a.bullets,b.bullets);assert.equal(a.randomState,b.randomState);
  const malformed=structuredClone(snapshot);malformed.enemies[0].slot=400;assert.equal(restored.game.importSnapshot(malformed),false);
});

test("authored encounters defer during bosses, recover, and resume in deterministic order",()=>{
  const original=setup();const g=original.game;g.time=449;g.eliteSpawned=new Set([2,4]);g.swarmSpawned=new Set([3]);g.spawnBoss(BOSSES[0]);
  original.access.updateSpawning(.1,g.time);assert.equal(g.eliteSpawned.has(6),false);assert.equal(g.swarmSpawned.has(7),false);
  g.hitBoss(1e9,false);g.time+=11;original.access.updateSpawning(11,g.time);assert.equal(g.eliteSpawned.has(6),false);
  const restored=setup();assert.equal(restored.game.importSnapshot(g.exportSnapshot()),true);
  for(const fixture of [original,restored]){
    fixture.game.time+=1;fixture.access.updateSpawning(1,fixture.game.time);assert.equal(fixture.game.eliteSpawned.has(6),true);assert.equal(fixture.game.swarmSpawned.has(7),false);
    fixture.game.time+=12;fixture.access.updateSpawning(12,fixture.game.time);assert.equal(fixture.game.swarmSpawned.has(7),true);
  }
  assert.deepEqual(g.exportSnapshot()!.enemies,restored.game.exportSnapshot()!.enemies);
  g.time=1800;original.access.updateSpawning(999,g.time);assert.equal(g.eliteSpawned.has(8),false);
  g.finalPhase=true;original.access.updateSpawning(999,g.time);assert.equal(g.eliteSpawned.has(8),false);
});

test("Covenants reserve authored admission and bosses retain their scheduled priority",()=>{
  const {game,access}=setup();game.time=689;game.bossesSpawned.add('colossus');game.eliteSpawned=new Set([2,4,6,8]);game.swarmSpawned=new Set([3,7]);
  game.covenant={status:'active',x:0,y:0,remaining:40,progress:0,target:12,reward:null};access.updateSpawning(1,game.time);assert.equal(game.eliteSpawned.has(10),false);assert.equal(game.swarmSpawned.has(11),false);
  game.covenant.status='failed';game.time+=12;access.updateSpawning(12,game.time);assert.equal(game.eliteSpawned.has(10),true);assert.equal(game.swarmSpawned.has(11),false);
  game.time=900;access.updateSpawning(.01,game.time);assert.equal(game.boss!.def.id,'lich');assert.equal(game.swarmSpawned.has(11),false);
});

test("authored swarm delivery waits for room for the full ring",()=>{
  const {game,access}=setup();game.time=209;game.eliteSpawned.add(2);
  for(let i=0;i<400;i++)enemy(game,1000+i,0);access.updateSpawning(.1,game.time);assert.equal(game.swarmSpawned.has(3),false);
  for(let i=0;i<40;i++)game.enemies[i].active=false;access.updateSpawning(.1,game.time);assert.equal(game.swarmSpawned.has(3),true);assert.equal(game.enemies.filter(e=>e.active).length,400);
});

test("Growth applies once to both ordinary-enemy and boss XP drops",()=>{
  const total=(boss:boolean,xpGain:number)=>{
    const {game}=setup();game.startRun('knight',{...BASE_STATS,xpGain,critChance:0});
    if(boss){game.spawnBoss(BOSSES[0]);game.hitBoss(1e9,false);}else{const e=enemy(game,100,0,1);game.hitEnemy(e,1e9,false,0,0);}
    return game.pickups.filter(p=>p.active&&p.kind==='gem').reduce((sum,p)=>sum+p.value,0);
  };
  assert.equal(total(true,1.25),210);assert.equal(total(true,1.25),total(true,1)*1.25);
  assert.equal(total(false,1.25),total(false,1)*1.25);
});

test("weaker slow effects neither thaw frozen enemies nor extend the freeze",()=>{
  const {game,access}=setup();game.startRun('mage',{...BASE_STATS,critChance:0});const e=enemy(game,50,0);e.slowT=.5;e.slowF=0;access.buildGrid();game.weapons=[{id:'orb',level:1,evolved:false,timer:0,alt:0}];
  for(let i=0;i<4;i++){game.weapons[0].timer=0;access.updateWeapons(.001);}
  assert.equal(e.slowF,0);assert.equal(e.slowT,.5);
  game.hitEnemy(e,1,false,0,0,{slow:2.4,slowF:.55});assert.equal(e.slowF,0);assert.equal(e.slowT,.5);
  e.slowF=.55;e.slowT=2.4;game.hitEnemy(e,1,false,0,0,{slow:.7,slowF:0});assert.equal(e.slowT,.7);
});

test("nonpiercing swept projectiles hit the nearest surface in either direction",()=>{
  for(const direction of [-1,1]){
    const {game,access}=setup();const near=enemy(game,90*direction,0),far=enemy(game,0,0);near.radius=far.radius=10;access.buildGrid();
    game.spawnBullet('arrow',130*direction,0,-2400*direction,0,10,5,0,1,false,0);access.updateBullets(.075);
    assert.equal(near.hp,990);assert.equal(far.hp,1000);
  }
});

test("a boss and ordinary targets share the same projectile contact order",()=>{
  const {game,access}=setup();game.spawnBoss(BOSSES[0]);Object.assign(game.boss!,{x:90,y:0,hp:1000,maxHp:1000});const far=enemy(game,0,0);far.radius=10;access.buildGrid();
  game.spawnBullet('arrow',160,0,-2400,0,10,5,0,1,false,0);access.updateBullets(.08);
  assert.equal(game.boss!.hp,990);assert.equal(far.hp,1000);
});

test("fireballs explode at the swept impact point instead of the far endpoint",()=>{
  const {game,access}=setup();const e=enemy(game,90,0);e.radius=10;access.buildGrid();
  game.spawnBullet('fireball',160,0,-2400,0,10,5,0,1,false,20);access.updateBullets(.08);assert.equal(e.hp,990);
  const fx=game.fx.find(f=>f.kind==='explosion')!;assert.equal(fx.x,105);
});

test("orb pulls cannot leave later projectile queries behind a stale grid cell",()=>{
  const {game,access}=setup();const e=enemy(game,146,0);e.radius=45.6;access.buildGrid();
  for(let i=0;i<12;i++)game.spawnBullet('orb',86,0,0,0,1,1,999,1,true,150);
  game.spawnBullet('arrow',86,0,0,0,10,5,0,1,false,0);access.updateBullets(1/120);
  assert.ok(Math.abs(e.x-136.5)<1e-8);assert.equal(e.hp,990);
});

test("Hunter's Oath grants its first-hit bonus against full-health bosses",()=>{
  const {game}=setup();game.covenant={status:'complete',x:0,y:0,remaining:0,progress:12,target:12,reward:'precision'};game.spawnBoss(BOSSES[0]);
  const hp=game.boss!.hp;game.hitBoss(10,false);assert.equal(game.boss!.hp,hp-12);game.hitBoss(10,false);assert.equal(game.boss!.hp,hp-22);
});

test("saved drafts reject impossible slots, ranks, ownership and evolution readiness atomically",()=>{
  const {game}=setup();const before=game.runId;
  const option=(id:string,kind:'weapon'|'passive'|'evolution',level=1,isNew=true):UpgradeOption=>{
    const def=kind==='passive'?PASSIVES[id]:WEAPONS[id];return{kind,id,name:def.name,icon:def.icon,color:def.color,level,maxLevel:def.maxLevel,isNew,desc:def.desc};
  };
  const make=()=>{const s=game.exportSnapshot()!;s.phase='levelup';s.weapons=[{id:'bow',level:1,evolved:false,timer:0,alt:0}];s.currentDraft=[option('bow','weapon',2,false)];return s;};
  const cases:((s:GameSnapshot)=>void)[]=[
    s=>{s.weapons=(['bow','orb','lightning','frost','fire','aura'] as const).map(id=>({id,level:1,evolved:false,timer:0,alt:0}));s.currentDraft=[option('daggers','weapon')];},
    s=>{s.currentDraft=[option('bow','weapon',3,false)];},
    s=>{s.currentDraft=[option('bow','weapon',1,true)];},
    s=>{s.currentDraft=[option('orb','weapon',1,false)];},
    s=>{s.weapons[0].level=8;s.currentDraft=[option('bow','weapon',8,false)];},
    s=>{s.weapons[0].level=7;s.weapons[0].evolved=true;s.currentDraft=[option('bow','weapon',8,false)];},
    s=>{s.passives=(['might','tome','boots','eagle','crystal','heart'] as const).map(id=>({id,level:1}));s.currentDraft=[option('magnet','passive')];},
    s=>{s.passives=[{id:'heart',level:1}];s.currentDraft=[option('heart','passive',3,false)];},
    s=>{s.phase='evolution';s.weapons[0].level=8;s.currentDraft=[option('bow','evolution',8)];},
    s=>{s.phase='evolution';s.weapons[0].level=8;s.weapons[0].evolved=true;s.passives=[{id:'eagle',level:1}];s.currentDraft=[option('bow','evolution',8)];},
  ];
  for(const corrupt of cases){const s=make();corrupt(s);assert.equal(game.importSnapshot(s),false);assert.equal(game.runId,before);}
  assert.equal(game.importSnapshot(make()),true);
});

test("live stale draft actions cannot exceed slots or evolve an ineligible weapon",()=>{
  const {game,access}=setup();game.weapons=(['bow','orb','lightning','frost','fire','aura'] as const).map(id=>({id,level:1,evolved:false,timer:0,alt:0}));
  const def=WEAPONS.daggers;const option:UpgradeOption={kind:'weapon',id:def.id,name:def.name,icon:def.icon,color:def.color,level:1,maxLevel:8,isNew:true,desc:def.desc};
  game.phase='levelup';access.currentDraft=[option];game.applyUpgrade(option);assert.equal(game.weapons.length,6);assert.equal(game.phase,'levelup');
  game.phase='evolution';access.currentDraft=[{...option,kind:'evolution',id:'bow',level:8}];assert.equal(game.chooseEvolution('bow'),false);assert.equal(game.weapons[0].evolved,false);
});

test("full-build QA fixtures use late-run XP cadence but explicit draft presets still open",()=>{
  const {game}=setup();game.debug=true;game.debugScenario({minute:27,density:0,fullBuild:true,invulnerable:true});
  assert.equal(game.level,80);assert.equal(game.xp,0);assert.equal(game.xpNext,xpForLevel(80));
  game.debugScenario({minute:27,density:0,fullBuild:true,invulnerable:true,phase:'levelup'});assert.equal(game.phase,'levelup');assert.equal(game.level,81);
});
