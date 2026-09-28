/** Developer-only diagnostic. Bots test legal mechanics; they do not establish human fairness or fun.
 * BALANCE_SEEDS=1,2 BALANCE_LIMIT=2100 node --import tsx scripts/simulate-balance.ts
 */
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, CHARACTERS, META_UPGRADES, WEAPONS } from "../app/game/data";
import type { CharacterId, PlayerStats, RunStats, UpgradeOption, WeaponId } from "../app/game/types";

const profiles = ["fresh", "partial", "max"] as const;
const seeds = (process.env.BALANCE_SEEDS ?? "1,2").split(",").map(Number).filter(Number.isFinite);
const limit = Number(process.env.BALANCE_LIMIT ?? 2100);
const selectedHunters = process.env.BALANCE_HUNTERS?.split(",");
const selectedProfiles = process.env.BALANCE_PROFILES?.split(",");
const statsFor = (profile: typeof profiles[number]) => {
  const stats: PlayerStats = { ...BASE_STATS };
  for (const def of META_UPGRADES) def.apply(stats, profile === "max" ? def.maxLevel : profile === "partial" ? Math.min(def.maxLevel, def.id === "revival" ? 0 : 2) : 0);
  return stats;
};
function distanceToSegment(x: number,y: number,ax: number,ay: number,bx: number,by: number) {
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-ax-dx*t,y-ay-dy*t);
}
function run(hunter: CharacterId, profile: typeof profiles[number], seed: number) {
  let options: UpgradeOption[] = [], result: RunStats | null = null;
  const input = new Input(); let movement={x:0,y:0}; input.getMove=()=>movement;
  const game = new Game(input,{onPhaseChange(){},onHud(){},onLevelUp(o){options=o},onChest(){},onBossWarning(){},onRunEnd(s){result=s},onEvolutionChoice(o){options=o},onCovenant(){}},{seed,autoStart:false});
  game.setViewport(1000,600); game.startRun(hunter,statsFor(profile));
  const starter=CHARACTERS.find(c=>c.id===hunter)!.weapon;
  const weapons=[...new Set<WeaponId>([starter,"aura","frost","lightning","orb","fire","swordwave"])].slice(0,6);
  const passives=weapons.map(id=>WEAPONS[id].evolvesWith);
  let nextDecision=0,firstUpgrade:number|null=null,firstEvolution:number|null=null,maxEnemies=0;
  const start=performance.now();
  while(game.time<limit && !result) {
    if(game.phase==="levelup") {
      firstUpgrade??=game.time;
      const score=(o:UpgradeOption)=>o.kind==="weapon" ? weapons.includes(o.id as WeaponId) ? (o.id===starter?70:o.id==="aura"?65:45)+(o.isNew?8:o.level*2):0 : o.kind==="passive" ? passives.includes(o.id as typeof passives[number]) ? (game.weapons.some(w=>WEAPONS[w.id].evolvesWith===o.id&&w.level===8)?110:25)+(o.isNew?8:0):0 : o.kind==="heal"&&game.hp<game.stats.maxHp*.6?80:5;
      const chosen=[...options].sort((a,b)=>score(b)-score(a))[0]; game.applyUpgrade(chosen);continue;
    }
    if(game.phase==="chest"){game.ackChest();continue;}
    if(game.phase==="evolution"){game.chooseEvolution(options[0].id);continue;}
    if(game.phase==="covenant"){if(game.covenant?.status==="offered")game.declineCovenant();else game.chooseCovenant("precision");continue;}
    if(game.phase!=="playing")throw new Error(`Unexpected phase ${game.phase}`);
    if(game.weapons.some(w=>w.evolved))firstEvolution??=game.time;
    if(game.time>=nextDecision){
      nextDecision=game.time+.2;
      const enemies=game.enemies.filter(e=>e.active);maxEnemies=Math.max(maxEnemies,enemies.length);
      const near=enemies.filter(e=>Math.hypot(e.x-game.px,e.y-game.py)<330).sort((a,b)=>Math.hypot(a.x-game.px,a.y-game.py)-Math.hypot(b.x-game.px,b.y-game.py)).slice(0,35);
      const pickups=game.pickups.filter(p=>p.active);
      const target=pickups.sort((a,b)=>Math.hypot(a.x-game.px,a.y-game.py)/(a.kind==="chest"?3:a.kind==="meat"&&game.hp<game.stats.maxHp*.6?4:1)-Math.hypot(b.x-game.px,b.y-game.py)/(b.kind==="chest"?3:b.kind==="meat"&&game.hp<game.stats.maxHp*.6?4:1))[0];
      const goal=target??game.boss??near[0]??enemies[0]??{x:game.px+100*Math.cos(game.time*.2),y:game.py+100*Math.sin(game.time*.2)};
      const safety = (hunter === "knight" || hunter === "reaper") && game.weapons.length < 3 ? 45 : 90;
      let best=-Infinity;
      for(let i=0;i<24;i++){
        const angle=i/24*Math.PI*2,x=Math.cos(angle),y=Math.sin(angle),speed=175*game.stats.moveSpeed;
        const nx=game.px+x*speed*.6,ny=game.py+y*speed*.6;
        let score=(Math.hypot(goal.x-game.px,goal.y-game.py)-Math.hypot(goal.x-nx,goal.y-ny))*.3;
        for(const e of near){const d=Math.hypot(e.x-game.px,e.y-game.py)||1;const ex=e.x+(game.px-e.x)/d*e.speed*.6,ey=e.y+(game.py-e.y)/d*e.speed*.6;const gap=distanceToSegment(ex,ey,game.px,game.py,nx,ny)-e.radius-14;if(gap<safety)score-=Math.max(0,safety-gap)**2*.045;}
        if(game.boss){const gap=distanceToSegment(game.boss.x,game.boss.y,game.px,game.py,nx,ny)-game.boss.def.radius-14;if(gap<80)score-=Math.max(0,80-gap)**2*.12;}
        for(const b of game.enemyBullets){if(!b.active)continue;const gap=distanceToSegment(nx,ny,b.x,b.y,b.x+b.vx*.6,b.y+b.vy*.6)-b.radius-14;if(gap<35)score-=Math.max(0,35-gap)**2*.7;}
        for(const f of game.fx){if(f.kind!=="telegraph"||f.color==="#ff9f5b"&&game.weapons.some(w=>w.id==="fire"&&w.evolved))continue;const gap=f.shape==="line"?distanceToSegment(nx,ny,f.x,f.y,f.x2,f.y2)-f.radius:Math.hypot(nx-f.x,ny-f.y)-f.radius;if(gap<20)score-=Math.max(0,20-gap)**2*.15;}
        if(score>best){best=score;movement={x,y};}
      }
    }
    game.step(1/30);
  }
  const end = result as RunStats|null;
  return {hunter,profile,seed,time:+game.time.toFixed(2),won:end?.won??false,timeout:!end,level:game.level,kills:game.kills,gold:+game.runGold.toFixed(2),firstUpgrade:firstUpgrade===null?null:+firstUpgrade.toFixed(2),firstEvolution:firstEvolution===null?null:+firstEvolution.toFixed(2),bosses:game.metrics.bossesDefeated,maxEnemies,build:game.weapons.map(w=>`${w.id}:${w.level}${w.evolved?"E":""}`),damageByWeapon:game.metrics.damageByWeapon,wallSeconds:+((performance.now()-start)/1000).toFixed(2)};
}
const rows=[];
for(const seed of seeds)for(const profile of profiles)for(const hunter of CHARACTERS){if(selectedHunters&&!selectedHunters.includes(hunter.id)||selectedProfiles&&!selectedProfiles.includes(profile))continue;const row=run(hunter.id,profile,seed);rows.push(row);console.log(JSON.stringify(row));}
console.log(JSON.stringify({summary:true,runs:rows.length,wins:rows.filter(r=>r.won).length,note:"Legal builds and progression. Deterministic greedy bot; does not establish human balance or device performance."}));
