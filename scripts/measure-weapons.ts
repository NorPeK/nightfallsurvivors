/** Reproducible offensive fixtures, not a ranking of survivability, control or human usefulness. */
import { Game } from "../app/game/engine";
import { Input } from "../app/game/input";
import { BASE_STATS, BOSSES, ENEMIES, WEAPONS } from "../app/game/data";
import type { WeaponId } from "../app/game/types";
for (const id of Object.keys(WEAPONS) as WeaponId[]) for (const evolved of [false,true]) {
  const output: Record<string,unknown>={weapon:id,evolved};
  for (const scene of ["stationary","boss","crowd"] as const) {
    const g=new Game(new Input(),{onPhaseChange(){},onHud(){},onLevelUp(){},onChest(){},onRunEnd(){},onBossWarning(){}},{seed:917,autoStart:false});
    g.startRun("knight",{...BASE_STATS,critChance:0});g.weapons=[{id,level:8,evolved,timer:0,alt:0}];g.spawnTimer=1e9;
    const positions:{x:number;y:number}[]=[];
    if(scene==="boss"){g.spawnBoss({...BOSSES[0],speed:0,damage:0});Object.assign(g.boss!,{x:100,y:0,hp:1e9,maxHp:1e9,t1:1e9,t2:1e9,t3:1e9});}
    else for(let i=0;i<(scene==="crowd"?24:1);i++){const angle=i/24*Math.PI*2,r=scene==="crowd"?75+(i%3)*35:75;const e=g.spawnEnemy(ENEMIES.brute,false)!;const pos={x:Math.cos(angle)*r,y:Math.sin(angle)*r};positions.push(pos);Object.assign(e,{...pos,speed:0,hp:1e9,maxHp:1e9,kx:0,ky:0});}
    for(let frame=0;frame<2400;frame++){positions.forEach((p,i)=>Object.assign(g.enemies[i],{...p,kx:0,ky:0}));g.step(1/120);}
    output[scene]={effectiveDps:+(g.damageDealt/20).toFixed(2),frozenTargets:g.enemies.filter(e=>e.active&&e.slowT>0&&e.slowF===0).length,healingPerSecond: id==="aura"&&evolved?1.2:0};
    g.dispose();
  }
  console.log(JSON.stringify(output));
}
