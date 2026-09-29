import type {
  WeaponDef,
  PassiveDef,
  EnemyDef,
  BossDef,
  MiniBossDef,
  WaveDef,
  CharacterDef,
  MetaUpgradeDef,
  PlayerStats,
  WeaponId,
  CovenantOption,
} from "./types";

// =====================================================================
// WEAPONS — Vampire Survivors-style auto weapons, 8 levels each,
// each with an evolution unlocked by pairing with a passive (VS-style)
// =====================================================================

export const WEAPONS: Record<string, WeaponDef> = {
  swordwave: {
    id: "swordwave",
    name: "Sword Wave",
    icon: "⚔️",
    color: "#e8e3d4",
    desc: "Slashes a crescent wave in your facing direction.",
    evolvesWith: "might",
    evolvedName: "Crimson Tempest",
    evolvedIcon: "🌪️",
    evolvedDesc: "Massive blood-red waves slash in three directions and feed on the slain.",
    maxLevel: 8,
    levels: [
      { desc: "Slashes ahead of you.", damage: 12, cooldown: 1.25, amount: 1, area: 1 },
      { desc: "Damage +6.", damage: 18 },
      { desc: "Adds a backward slash.", amount: 2 },
      { desc: "Wave size +25%.", area: 1.25 },
      { desc: "Damage +8.", damage: 26 },
      { desc: "Cooldown reduced.", cooldown: 1.0 },
      { desc: "Wave size +25%, damage +6.", area: 1.5, damage: 32 },
      { desc: "Damage +10.", damage: 42 },
    ],
  },
  bow: {
    id: "bow",
    name: "Hunter Bow",
    icon: "🏹",
    color: "#9ee37d",
    desc: "Fires arrows at the nearest foe. Arrows pierce once.",
    evolvesWith: "eagle",
    evolvedName: "Storm Volley",
    evolvedIcon: "🌠",
    evolvedDesc: "Unleashes piercing arrow storms; critical hits burst into shrapnel.",
    maxLevel: 8,
    levels: [
      { desc: "Fires 1 arrow at the nearest enemy.", damage: 10, cooldown: 1.1, amount: 1, speed: 520, pierce: 1 },
      { desc: "+1 arrow.", amount: 2 },
      { desc: "Damage +5.", damage: 15 },
      { desc: "+1 arrow.", amount: 3 },
      { desc: "Arrows pierce +1.", pierce: 2 },
      { desc: "Damage +6, faster arrows.", damage: 21, speed: 640 },
      { desc: "+1 arrow.", amount: 4 },
      { desc: "Damage +8, pierce +1.", damage: 29, pierce: 3 },
    ],
  },
  orb: {
    id: "orb",
    name: "Arcane Orb",
    icon: "🔮",
    color: "#b78cff",
    desc: "A slow orb of raw magic that pierces everything it touches.",
    evolvesWith: "tome",
    evolvedName: "Void Sphere",
    evolvedIcon: "🕳️",
    evolvedDesc: "A compact piercing sphere, 20% wider than Arcane Orb. It never pulls enemies.",
    maxLevel: 8,
    levels: [
      { desc: "Launches a piercing orb.", damage: 14, cooldown: 2.4, amount: 1, area: 1, speed: 130, duration: 3.2 },
      { desc: "Orb size +20%.", area: 1.2 },
      { desc: "Damage +8.", damage: 22 },
      { desc: "+1 orb.", amount: 2 },
      { desc: "Orbs last longer.", duration: 4.2 },
      { desc: "Damage +10, size +20%.", damage: 32, area: 1.4 },
      { desc: "+1 orb.", amount: 3 },
      { desc: "Damage +12, size +25%.", damage: 44, area: 1.65 },
    ],
  },
  lightning: {
    id: "lightning",
    name: "Lightning Strike",
    icon: "⚡",
    color: "#7dd9ff",
    desc: "Bolts from the sky smite random enemies.",
    evolvesWith: "crystal",
    evolvedName: "Wrath of Storms",
    evolvedIcon: "🌩️",
    evolvedDesc: "Constant thunder; every bolt chains to nearby enemies.",
    maxLevel: 8,
    levels: [
      { desc: "Smites 1 random enemy.", damage: 16, cooldown: 2.2, amount: 1, area: 1 },
      { desc: "+1 bolt.", amount: 2 },
      { desc: "Damage +8.", damage: 24 },
      { desc: "Strike area +25%.", area: 1.25 },
      { desc: "+1 bolt.", amount: 3 },
      { desc: "Damage +10.", damage: 34 },
      { desc: "+1 bolt, faster strikes.", amount: 4, cooldown: 1.8 },
      { desc: "Damage +14.", damage: 48 },
    ],
  },
  frost: {
    id: "frost",
    name: "Frost Shards",
    icon: "❄️",
    color: "#a8ecff",
    desc: "A cone of ice shards that chill enemies to the bone.",
    evolvesWith: "boots",
    evolvedName: "Absolute Zero",
    evolvedIcon: "🧊",
    evolvedDesc: "Freezing novas lock nearby foes in ice for 0.7 seconds. Bosses resist freezing.",
    maxLevel: 8,
    levels: [
      { desc: "Fires 3 chilling shards.", damage: 8, cooldown: 1.6, amount: 3, speed: 420, duration: 1.6 },
      { desc: "+2 shards.", amount: 5 },
      { desc: "Damage +4.", damage: 12 },
      { desc: "Slow lasts longer.", duration: 2.4 },
      { desc: "+2 shards.", amount: 7 },
      { desc: "Damage +6.", damage: 18 },
      { desc: "+2 shards, faster.", amount: 9, cooldown: 1.35 },
      { desc: "Damage +8.", damage: 26 },
    ],
  },
  fire: {
    id: "fire",
    name: "Fire Wand",
    icon: "🔥",
    color: "#ff9f5b",
    desc: "Hurls fireballs that explode on impact.",
    evolvesWith: "clover",
    evolvedName: "Meteor Storm",
    evolvedIcon: "☄️",
    evolvedDesc: "Focused meteors strike small, clearly marked impact zones.",
    maxLevel: 8,
    levels: [
      { desc: "Hurls 1 exploding fireball.", damage: 15, cooldown: 1.9, amount: 1, area: 1, speed: 380 },
      { desc: "Explosion +25% bigger.", area: 1.25 },
      { desc: "+1 fireball.", amount: 2 },
      { desc: "Damage +8.", damage: 23 },
      { desc: "Explosion +25% bigger.", area: 1.5 },
      { desc: "+1 fireball.", amount: 3 },
      { desc: "Damage +10.", damage: 33 },
      { desc: "Damage +12, huge blasts.", damage: 45, area: 1.8 },
    ],
  },
  aura: {
    id: "aura",
    name: "Holy Aura",
    icon: "✨",
    color: "#ffe9a8",
    desc: "A sacred ring that sears all who come close.",
    evolvesWith: "heart",
    evolvedName: "Sanctuary",
    evolvedIcon: "🛡️",
    evolvedDesc: "A vast blessed ground that burns the dark and mends your wounds.",
    maxLevel: 8,
    levels: [
      { desc: "Burns nearby enemies.", damage: 5, cooldown: 0.55, amount: 1, area: 1 },
      { desc: "Aura +15% bigger.", area: 1.15 },
      { desc: "Damage +3.", damage: 8 },
      { desc: "Aura +15% bigger.", area: 1.3 },
      { desc: "Burns faster.", cooldown: 0.45 },
      { desc: "Damage +4.", damage: 12 },
      { desc: "Aura +20% bigger.", area: 1.55 },
      { desc: "Damage +6.", damage: 18 },
    ],
  },
  daggers: {
    id: "daggers",
    name: "Spirit Daggers",
    icon: "🗡️",
    color: "#8fd0ff",
    desc: "Phantom blades orbit you, shredding everything they touch.",
    evolvesWith: "magnet",
    evolvedName: "Blade Cyclone",
    evolvedIcon: "🌀",
    evolvedDesc: "A wide orbit of spectral steel draws in treasure. Keep foes at blade reach; the inner circle is exposed.",
    maxLevel: 8,
    levels: [
      { desc: "2 blades orbit you.", damage: 10, cooldown: 0, amount: 2, area: 1, speed: 2.4 },
      { desc: "+1 blade.", amount: 3 },
      { desc: "Damage +5.", damage: 15 },
      { desc: "Orbit wider, spin faster.", area: 1.2, speed: 2.9 },
      { desc: "+1 blade.", amount: 4 },
      { desc: "Damage +7.", damage: 22 },
      { desc: "+1 blade, wider orbit.", amount: 5, area: 1.4 },
      { desc: "Damage +10, spin faster.", damage: 32, speed: 3.4 },
    ],
  },
};

// =====================================================================
// PASSIVES — Brotato/VS style stat items, each enables one evolution
// =====================================================================

export const PASSIVES: Record<string, PassiveDef> = {
  might: { id: "might", name: "Whetstone", icon: "🪨", color: "#f0a35e", desc: "Raises all damage dealt.", maxLevel: 5, perLevelDesc: "+8% damage" },
  tome: { id: "tome", name: "Arcane Tome", icon: "📖", color: "#b78cff", desc: "Expands the area of all attacks.", maxLevel: 5, perLevelDesc: "+8% area" },
  boots: { id: "boots", name: "Swift Boots", icon: "👢", color: "#9ee37d", desc: "Increases movement speed.", maxLevel: 5, perLevelDesc: "+5% move speed" },
  eagle: { id: "eagle", name: "Eagle Eye", icon: "🎯", color: "#ffd166", desc: "Sharpens your aim for critical strikes.", maxLevel: 5, perLevelDesc: "+4% crit chance" },
  crystal: { id: "crystal", name: "Storm Crystal", icon: "💠", color: "#7dd9ff", desc: "Your weapons recharge faster.", maxLevel: 5, perLevelDesc: "-4% cooldown" },
  heart: { id: "heart", name: "Iron Heart", icon: "❤️", color: "#ff6b6b", desc: "Hardens your body and mends wounds.", maxLevel: 5, perLevelDesc: "+12% max HP, +0.3 regen" },
  magnet: { id: "magnet", name: "Lodestone", icon: "🧲", color: "#c9b6ff", desc: "Draws experience gems from afar.", maxLevel: 5, perLevelDesc: "+20% pickup range" },
  clover: { id: "clover", name: "Lucky Clover", icon: "🍀", color: "#6ee7b7", desc: "Fortune favors you — better drops.", maxLevel: 5, perLevelDesc: "+10% luck" },
};

// =====================================================================
// CHARACTERS — Brotato/Nomad Survival style classes with trade-offs
// =====================================================================

export const CHARACTERS: CharacterDef[] = [
  {
    id: "knight",
    name: "Aldric",
    title: "The Sentinel",
    icon: "🛡️",
    color: "#e8e3d4",
    weapon: "swordwave",
    desc: "A steadfast knight who holds the line until dawn.",
    trait: "Sentinel: after 4 seconds without damage, the next hit is reduced by 40% and releases a short shockwave.",
    bonuses: ["+20% Max HP", "+1 Armor", "Starts with Sword Wave"],
    stats: { maxHp: 120, armor: 1 },
  },
  {
    id: "ranger",
    name: "Lyra",
    title: "The Windrunner",
    icon: "🏹",
    color: "#9ee37d",
    weapon: "bow",
    desc: "A swift huntress who strikes from the shadows.",
    trait: "Windrunner: moving for 3 seconds empowers the next bow volley by 25%.",
    bonuses: ["+10% Move Speed", "+10% Crit Chance", "Starts with Hunter Bow"],
    stats: { moveSpeed: 1.1, critChance: 0.15 },
  },
  {
    id: "mage",
    name: "Morwen",
    title: "The Voidcaller",
    icon: "🔮",
    color: "#b78cff",
    weapon: "orb",
    desc: "A frail sorceress wielding overwhelming arcane power.",
    trait: "Voidcaller: every fourth orb cast slows nearby enemies for one second.",
    bonuses: ["+25% Area", "+10% Damage", "-15% Max HP"],
    stats: { area: 1.25, might: 1.1, maxHp: 85 },
  },
  {
    id: "reaper",
    name: "Vex",
    title: "The Forsaken",
    icon: "💀",
    color: "#8fd0ff",
    weapon: "daggers",
    desc: "A cursed soul whose blades hunger for vengeance.",
    trait: "Forsaken: a dagger kill restores 2 HP, at most once every 2 seconds.",
    bonuses: ["+25% Damage", "+5% Move Speed", "-25% Max HP"],
    stats: { might: 1.25, moveSpeed: 1.05, maxHp: 75 },
  },
];

// =====================================================================
// ENEMIES — HP/damage scale with time in the engine
// =====================================================================

export const ENEMIES: Record<string, EnemyDef> = {
  bat: { id: "bat", name: "Night Bat", hp: 6, speed: 86, damage: 4, radius: 10, xp: 1, color: "#7a6cc7", glow: "#5b4bb5", shape: "bat" },
  ghoul: { id: "ghoul", name: "Ghoul", hp: 14, speed: 52, damage: 7, radius: 13, xp: 1, color: "#6da06b", glow: "#3f7a4a", shape: "ghoul" },
  skeleton: { id: "skeleton", name: "Skeleton", hp: 24, speed: 56, damage: 9, radius: 13, xp: 2, color: "#d8d3c5", glow: "#9a9484", shape: "skeleton" },
  spider: { id: "spider", name: "Crypt Spider", hp: 16, speed: 88, damage: 7, radius: 11, xp: 2, color: "#a4533d", glow: "#7c3326", shape: "spider" },
  wraith: { id: "wraith", name: "Wraith", hp: 30, speed: 74, damage: 11, radius: 14, xp: 3, color: "#9fd4e8", glow: "#5fa8c8", shape: "wraith", attack: "hex" },
  cultist: { id: "cultist", name: "Cultist", hp: 48, speed: 58, damage: 13, radius: 14, xp: 4, color: "#c45a8a", glow: "#92325f", shape: "cultist", attack: "bolt" },
  brute: { id: "brute", name: "Flesh Brute", hp: 95, speed: 62, damage: 18, radius: 22, xp: 7, color: "#bd7a5a", glow: "#8a4a30", shape: "brute", knockResist: 0.6 },
  hound: { id: "hound", name: "Hellhound", hp: 55, speed: 104, damage: 14, radius: 13, xp: 5, color: "#e06a3c", glow: "#b03d18", shape: "hound", behavior: "charge" },
  gargoyle: { id: "gargoyle", name: "Gargoyle", hp: 80, speed: 80, damage: 16, radius: 16, xp: 7, color: "#8d93a8", glow: "#5a6078", shape: "gargoyle" },
  demon: { id: "demon", name: "Pit Demon", hp: 140, speed: 58, damage: 22, radius: 19, xp: 10, color: "#d6453f", glow: "#9c1f1f", shape: "demon", knockResist: 0.5 },
  golem: { id: "golem", name: "Bone Golem", hp: 230, speed: 40, damage: 26, radius: 24, xp: 14, color: "#cfc4a8", glow: "#8f8468", shape: "golem", knockResist: 0.8 },
  shadow: { id: "shadow", name: "Shadow Fiend", hp: 150, speed: 92, damage: 24, radius: 16, xp: 14, color: "#6b5fd1", glow: "#3c2f9e", shape: "shadow", attack: "bolt", knockResist: 0.4 },
  lancer: { id: "lancer", name: "Dread Lancer", hp: 190, speed: 76, damage: 25, radius: 18, xp: 12, color: "#5cacb8", glow: "#27818f", shape: "lancer", behavior: "charge", knockResist: 0.65 },
  banshee: { id: "banshee", name: "Crimson Banshee", hp: 145, speed: 68, damage: 23, radius: 18, xp: 12, color: "#ee86ac", glow: "#c13973", shape: "banshee", attack: "fan", knockResist: 0.25 },
  scarab: { id: "scarab", name: "Iron Scarab", hp: 300, speed: 60, damage: 29, radius: 23, xp: 16, color: "#c5a74a", glow: "#8c711e", shape: "scarab", knockResist: 0.85 },
};

// =====================================================================
// MAIN BOSSES — every five minutes. Only Death at 30:00 ends the hunt.
// =====================================================================

export const BOSSES: BossDef[] = [
  {
    id: "colossus",
    name: "Korgath",
    title: "The Bone Colossus",
    minute: 5,
    hp: 2800,
    speed: 46,
    damage: 16,
    radius: 38,
    color: "#d8d3c5",
    glow: "#b8a87a",
    shape: "colossus",
  },
  {
    id: "bloodwarden",
    name: "Varkos",
    title: "The Blood Warden",
    minute: 10,
    hp: 13600,
    speed: 49,
    damage: 24,
    radius: 39,
    color: "#cf7770",
    glow: "#f04f69",
    shape: "colossus",
  },
  {
    id: "lich",
    name: "Maltheor",
    title: "The Hollow Lich",
    minute: 15,
    hp: 30000,
    speed: 52,
    damage: 30,
    radius: 34,
    color: "#9fe8d8",
    glow: "#3fc8a8",
    shape: "lich",
  },
  {
    id: "dreadknight",
    name: "Rhazek",
    title: "The Dread Knight",
    minute: 20,
    hp: 50000,
    speed: 59,
    damage: 34,
    radius: 37,
    color: "#8aa9db",
    glow: "#648cff",
    shape: "death",
  },
  {
    id: "voidseer",
    name: "Nyxara",
    title: "The Void Seer",
    minute: 25,
    hp: 78000,
    speed: 56,
    damage: 37,
    radius: 36,
    color: "#d4a7ef",
    glow: "#be6dff",
    shape: "lich",
  },
  {
    id: "death",
    name: "NORPEK",
    title: "Death Incarnate",
    minute: 30,
    hp: 104000,
    speed: 64,
    damage: 40,
    radius: 42,
    color: "#c43a3a",
    glow: "#8c1010",
    shape: "death",
  },
];

// Mini-bosses keep their own field presence; they never replace a main boss.
// Modest XP/gold rewards avoid adding twelve more guaranteed evolution chests.
export const MINI_BOSSES: MiniBossDef[] = [
  { id: "gravefang", name: "Gravefang", title: "The First Hunger", minute: 1, enemyId: "ghoul", hp: 600, speed: 52, damage: 8, radius: 24, xp: 18, gold: 12, pattern: "charge" },
  { id: "bonehex", name: "Bonehex", title: "The Crypt Herald", minute: 3, enemyId: "skeleton", hp: 1200, speed: 48, damage: 11, radius: 25, xp: 30, gold: 18, pattern: "volley" },
  { id: "webmaw", name: "Webmaw", title: "The Buried Matriarch", minute: 7, enemyId: "spider", hp: 5200, speed: 60, damage: 17, radius: 27, xp: 60, gold: 30, pattern: "slam" },
  { id: "mourningveil", name: "Mourningveil", title: "The Restless Oracle", minute: 9, enemyId: "wraith", hp: 8400, speed: 62, damage: 20, radius: 28, xp: 75, gold: 36, pattern: "volley" },
  { id: "ashmaw", name: "Ashmaw", title: "The Cinder Hunter", minute: 11, enemyId: "hound", hp: 12800, speed: 70, damage: 22, radius: 27, xp: 90, gold: 42, pattern: "charge" },
  { id: "gorebell", name: "Gorebell", title: "The Chapel Breaker", minute: 13, enemyId: "brute", hp: 16800, speed: 47, damage: 25, radius: 34, xp: 105, gold: 48, pattern: "slam" },
  { id: "duskwing", name: "Duskwing", title: "The Fallen Watcher", minute: 17, enemyId: "gargoyle", hp: 24800, speed: 72, damage: 28, radius: 30, xp: 135, gold: 60, pattern: "charge" },
  { id: "bloodcantor", name: "Bloodcantor", title: "The Scarlet Voice", minute: 19, enemyId: "cultist", hp: 32000, speed: 58, damage: 30, radius: 29, xp: 150, gold: 66, pattern: "volley" },
  { id: "pitbreaker", name: "Pitbreaker", title: "The Furnace Fist", minute: 21, enemyId: "demon", hp: 40000, speed: 57, damage: 32, radius: 33, xp: 165, gold: 72, pattern: "slam" },
  { id: "marrowking", name: "Marrowking", title: "The Ossuary Crown", minute: 23, enemyId: "golem", hp: 48000, speed: 48, damage: 34, radius: 38, xp: 180, gold: 78, pattern: "slam" },
  { id: "nightreaver", name: "Nightreaver", title: "The Last Pursuer", minute: 27, enemyId: "shadow", hp: 62000, speed: 78, damage: 37, radius: 31, xp: 210, gold: 90, pattern: "charge" },
  { id: "dawnless", name: "Dawnless", title: "The Final Omen", minute: 29, enemyId: "demon", hp: 74000, speed: 65, damage: 39, radius: 35, xp: 225, gold: 96, pattern: "volley" },
];

// =====================================================================
// WAVES — Vampire Survivors style per-minute spawn director
// =====================================================================

// A new ordinary silhouette joins every two minutes. Odd minutes remix the known
// cast; ranged enemies stay in the mix so a tank-only wave never creates an idle break.
export const WAVES: WaveDef[] = [
  { minute: 0, enemies: ["bat"], interval: 1.4, perTick: 2, maxAlive: 30 },
  { minute: 1, enemies: ["bat"], interval: 1.2, perTick: 3, maxAlive: 50 },
  { minute: 2, enemies: ["ghoul", "bat"], interval: 1.1, perTick: 3, maxAlive: 65 },
  { minute: 3, enemies: ["bat", "ghoul", "ghoul"], interval: 1.0, perTick: 4, maxAlive: 80 },
  { minute: 4, enemies: ["cultist", "ghoul", "bat"], interval: 1.05, perTick: 4, maxAlive: 85 },
  { minute: 5, enemies: ["ghoul", "cultist", "bat"], interval: 1.2, perTick: 3, maxAlive: 80 },
  { minute: 6, enemies: ["skeleton", "cultist", "ghoul", "bat"], interval: 1.0, perTick: 4, maxAlive: 100 },
  { minute: 7, enemies: ["skeleton", "bat", "cultist", "ghoul"], interval: 0.95, perTick: 5, maxAlive: 110 },
  { minute: 8, enemies: ["spider", "cultist", "skeleton", "ghoul"], interval: 0.9, perTick: 5, maxAlive: 130 },
  { minute: 9, enemies: ["spider", "bat", "cultist", "skeleton"], interval: 0.85, perTick: 5, maxAlive: 140 },
  { minute: 10, enemies: ["brute", "cultist", "spider", "skeleton"], interval: 0.9, perTick: 5, maxAlive: 150 },
  { minute: 11, enemies: ["spider", "brute", "cultist", "ghoul"], interval: 0.85, perTick: 5, maxAlive: 160 },
  { minute: 12, enemies: ["wraith", "brute", "spider", "cultist"], interval: 0.85, perTick: 5, maxAlive: 160 },
  { minute: 13, enemies: ["wraith", "skeleton", "brute", "spider"], interval: 0.8, perTick: 5, maxAlive: 175 },
  { minute: 14, enemies: ["hound", "wraith", "brute", "cultist"], interval: 0.85, perTick: 5, maxAlive: 175 },
  { minute: 15, enemies: ["hound", "spider", "wraith", "brute"], interval: 0.95, perTick: 5, maxAlive: 170 },
  { minute: 16, enemies: ["gargoyle", "hound", "wraith", "brute"], interval: 0.85, perTick: 5, maxAlive: 185 },
  { minute: 17, enemies: ["gargoyle", "cultist", "hound", "skeleton"], interval: 0.8, perTick: 6, maxAlive: 200 },
  { minute: 18, enemies: ["demon", "gargoyle", "wraith", "hound"], interval: 0.75, perTick: 6, maxAlive: 210 },
  { minute: 19, enemies: ["demon", "brute", "cultist", "hound", "gargoyle"], interval: 0.75, perTick: 6, maxAlive: 215 },
  { minute: 20, enemies: ["golem", "demon", "gargoyle", "wraith", "hound"], interval: 0.75, perTick: 6, maxAlive: 220 },
  { minute: 21, enemies: ["golem", "cultist", "hound", "demon"], interval: 0.75, perTick: 6, maxAlive: 230 },
  { minute: 22, enemies: ["shadow", "golem", "demon", "hound"], interval: 0.7, perTick: 6, maxAlive: 240 },
  { minute: 23, enemies: ["shadow", "gargoyle", "brute", "wraith", "demon"], interval: 0.7, perTick: 7, maxAlive: 250 },
  { minute: 24, enemies: ["lancer", "shadow", "golem", "demon", "wraith"], interval: 0.7, perTick: 7, maxAlive: 255 },
  { minute: 25, enemies: ["lancer", "hound", "shadow", "gargoyle"], interval: 0.7, perTick: 6, maxAlive: 255 },
  { minute: 26, enemies: ["banshee", "lancer", "golem", "shadow", "demon"], interval: 0.7, perTick: 6, maxAlive: 265 },
  { minute: 27, enemies: ["banshee", "hound", "lancer", "wraith", "golem"], interval: 0.65, perTick: 7, maxAlive: 275 },
  { minute: 28, enemies: ["scarab", "banshee", "lancer", "shadow", "demon"], interval: 0.65, perTick: 7, maxAlive: 280 },
  { minute: 29, enemies: ["scarab", "banshee", "golem", "lancer", "hound"], interval: 0.6, perTick: 7, maxAlive: 285 },
];

// Swarm events — VS-style rings of weak enemies converging on the player
export const SWARM_MINUTES = [3, 7, 11, 17, 21, 24, 27];

// Elite spawns (drop treasure chests) — every other minute starting at 2
export const ELITE_MINUTES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];

// Minimum separation between authored elite/swarm admissions and recovery after a boss/Covenant.
export const ENCOUNTER_SPACING = 12;

// Time-based difficulty scaling
export function enemyHpScale(t: number): number {
  const m = Math.max(0, Math.min(GAME_DURATION, t)) / 60;
  // Continuous pressure: old cohorts also toughen instead of becoming free XP.
  return 1 + m * .22 + Math.pow(m / 10, 2);
}
export function enemyDmgScale(t: number): number {
  return 1 + (t / 60) * 0.04;
}
export function enemyXpScale(t: number): number {
  return 1 + (t / 60) * 0.12;
}

// XP curve (VS-like)
export function xpForLevel(level: number): number {
  // Keep the opening twelve ranks, then gradually extend equipment progression.
  // The continuous late ramp avoids sudden milestone walls or a time-gated build cap.
  const base = 5 + (Math.max(1, level) - 1) * 9;
  const ramp = (start: number) => Math.max(0, Math.min(1, (level - start) / 8));
  const late = Math.max(0, level - 12);
  return Math.round(base * (1 + .35 * ramp(16)) * (1 + .7 * ramp(36)) * (1 + .012 * late + .0001 * late * late));
}
export const FROST_NOVA_FREEZE = .7;

// =====================================================================
// META PROGRESSION — VS PowerUp-style permanent shop (gold persists)
// =====================================================================

export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: "might", name: "Might", icon: "⚔️", desc: "+5% damage per rank", maxLevel: 5, baseCost: 150, costGrowth: 1.9, apply: (s, l) => { s.might *= 1 + 0.05 * l; } },
  { id: "vitality", name: "Vitality", icon: "❤️", desc: "+10% max HP per rank", maxLevel: 5, baseCost: 120, costGrowth: 1.9, apply: (s, l) => { s.maxHp = Math.round(s.maxHp * (1 + 0.1 * l)); } },
  { id: "swiftness", name: "Swiftness", icon: "👢", desc: "+3% move speed per rank", maxLevel: 5, baseCost: 130, costGrowth: 1.9, apply: (s, l) => { s.moveSpeed *= 1 + 0.03 * l; } },
  { id: "haste", name: "Haste", icon: "💠", desc: "-2.5% cooldown per rank", maxLevel: 5, baseCost: 180, costGrowth: 1.9, apply: (s, l) => { s.cooldown *= 1 - 0.025 * l; } },
  { id: "magnetism", name: "Magnetism", icon: "🧲", desc: "+15% pickup range per rank", maxLevel: 5, baseCost: 90, costGrowth: 1.8, apply: (s, l) => { s.magnet *= 1 + 0.15 * l; } },
  { id: "fortune", name: "Fortune", icon: "🍀", desc: "+10% luck per rank", maxLevel: 5, baseCost: 140, costGrowth: 1.9, apply: (s, l) => { s.luck *= 1 + 0.1 * l; } },
  { id: "greed", name: "Greed", icon: "💰", desc: "+10% coin and treasure gold per rank; dawn bonus stays fixed", maxLevel: 5, baseCost: 110, costGrowth: 1.9, apply: (s, l) => { s.goldGain *= 1 + 0.1 * l; } },
  { id: "growth", name: "Growth", icon: "📈", desc: "+5% XP gained per rank", maxLevel: 5, baseCost: 160, costGrowth: 1.9, apply: (s, l) => { s.xpGain *= 1 + 0.05 * l; } },
  { id: "armor", name: "Armor", icon: "🛡️", desc: "+1 armor per rank", maxLevel: 3, baseCost: 200, costGrowth: 2.2, apply: (s, l) => { s.armor += l; } },
  { id: "revival", name: "Revival", icon: "🕊️", desc: "+1 revive per rank", maxLevel: 2, baseCost: 600, costGrowth: 3.0, apply: (s, l) => { s.revives += l; } },
];

export function metaUpgradeCost(def: MetaUpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

export const BASE_STATS: PlayerStats = {
  maxHp: 100,
  regen: 0,
  might: 1,
  area: 1,
  projSpeed: 1,
  cooldown: 1,
  moveSpeed: 1,
  magnet: 95,
  luck: 1,
  critChance: 0.05,
  critDamage: 1.6,
  armor: 0,
  xpGain: 1,
  goldGain: 1,
  revives: 0,
};

export const GAME_DURATION = 30 * 60; // 30 minutes
export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;

/** Resolved values power both combat and truthful upgrade previews. Area means radius multiplier. */
export function resolveWeaponStats(id: WeaponId, level: number) {
  const out = { damage: 10, cooldown: 1.5, amount: 1, area: 1, speed: 400, pierce: 0, duration: 2 };
  for (const rank of WEAPONS[id].levels.slice(0, level)) {
    for (const key of Object.keys(out) as (keyof typeof out)[]) {
      if (rank[key] !== undefined) out[key] = rank[key]!;
    }
  }
  return out;
}
export function weaponUpgradeDetail(id: WeaponId, level: number): string {
  const now = resolveWeaponStats(id, level);
  const before = level > 1 ? resolveWeaponStats(id, level - 1) : null;
  const labels = { damage: "Damage", cooldown: "Cooldown (s)", amount: "Projectiles", area: "Radius ×", speed: "Speed", pierce: "Extra targets", duration: "Duration (s)" };
  return (Object.keys(now) as (keyof typeof now)[])
    .filter((key) => before ? before[key] !== now[key] : ["damage", "cooldown", "amount"].includes(key))
    .map((key) => `${labels[key]}: ${before ? `${before[key]} → ` : ""}${now[key]}`).join(" · ");
}
export const COVENANT_REWARDS: CovenantOption[] = [
  { id: "frost", name: "Winter Oath", desc: "Frozen enemies take 10% more damage. Pair with Absolute Zero." },
  { id: "precision", name: "Hunter’s Oath", desc: "Your first hit on a full-health enemy deals 10% more damage. Reward careful opening attacks." },
  { id: "sanctuary", name: "Mercy Oath", desc: "Collecting meat grants half a second of protection; healing still caps at maximum health." },
];
