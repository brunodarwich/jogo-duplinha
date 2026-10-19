import { calculateRespawnTime } from '../../../src/entities/heroes.js';
import { HeroEntity } from '../../../src/entities/entity.js';
import { GameSimulation } from '../../../src/game.js';
import { InputManager, InputDispatcher, CommandType } from '../../../src/core/input.js';
import { HUDController } from '../../../src/ui/hud.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('--- 1. Boundary & Fractional Level Scaling ---');
assert(calculateRespawnTime(1) === 5.0, 'Level 1 = 5.0s');
assert(calculateRespawnTime(1.9) === 5.0, 'Level 1.9 = 5.0s');
assert(calculateRespawnTime(2.1) === 6.0, 'Level 2.1 = 6.0s');
assert(calculateRespawnTime(0) === 5.0, 'Level 0 = 5.0s');
assert(calculateRespawnTime(-10) === 5.0, 'Level -10 = 5.0s');
assert(calculateRespawnTime(null) === 5.0, 'Level null = 5.0s');
assert(calculateRespawnTime(undefined) === 5.0, 'Level undefined = 5.0s');
assert(calculateRespawnTime('18') === 22.0, 'Level "18" = 22.0s');

console.log('--- 2. Rapid Consecutive Damage Post-Death ---');
const hero = new HeroEntity({ heroId: 'knight', hp: 500, maxHp: 500, level: 2 });
hero.takeDamage(600); // Fatal
assert(hero.isDead === true, 'Hero is dead after fatal damage');
assert(hero.hp === 0, 'HP clamped to 0');
const initialTimer = hero.respawnTimer;
assert(initialTimer === 6.0, 'Initial respawn timer is 6.0s');

// Rapid consecutive hits
const d1 = hero.takeDamage(500);
const d2 = hero.takeDamage(1000);
assert(d1 === 0, 'Post-death damage returns 0');
assert(d2 === 0, 'Post-death damage returns 0');
assert(hero.hp === 0, 'HP remains 0');
assert(hero.respawnTimer === 6.0, 'Timer was not reset or corrupted by post-death damage');

console.log('--- 3. Healing & Movement While Dead ---');
const healAmount = hero.heal(500);
assert(healAmount === 0, 'Dead hero cannot receive healing');
assert(hero.hp === 0, 'Dead hero HP remains 0 after heal attempt');

hero.moveTo(1000, 1000);
assert(hero.targetX === null, 'Dead hero cannot receive moveTo orders');
assert(hero.isMoving === false, 'Dead hero isMoving remains false');

console.log('--- 4. Death During Recall Channeling ---');
const recallHero = new HeroEntity({ heroId: 'knight', hp: 300, maxHp: 300 });
recallHero.isRecalling = true;
recallHero.recallElapsed = 2500;
recallHero.takeDamage(400); // Fatal
assert(recallHero.isDead === true, 'Hero died during recall');
assert(recallHero.isRecalling === false, 'Recall was cancelled by fatal damage');
assert(recallHero.recallElapsed === 0, 'Recall elapsed reset to 0');

console.log('--- 5. Death Under Multiple CC Debuffs & Status Cleanse on Respawn ---');
const ccHero = new HeroEntity({ heroId: 'knight', hp: 100, maxHp: 680, mana: 50, maxMana: 300, level: 1 });
const farFuture = Date.now() + 100000;
ccHero.stunnedUntil = farFuture;
ccHero.rootedUntil = farFuture;
ccHero.silencedUntil = farFuture;
ccHero.tauntedUntil = farFuture;
ccHero.tauntTargetId = 'enemy_boss';
ccHero.slowedUntil = farFuture;
ccHero.slowPercentage = 0.8;
ccHero.stealthedUntil = farFuture;
ccHero.barrier = 250;
ccHero.holdPosition = true;

// Inflict fatal damage (barrier 250 + hp 100 = 350 effective hp, deal 500)
ccHero.takeDamage(500);
assert(ccHero.isDead === true, 'Hero is dead after breaking barrier and hp');
assert(ccHero.hp === 0, 'Hero HP is 0');
assert(ccHero.barrier === 0, 'Barrier broken');

// Simulate full respawn timer elapsing (5.0s)
ccHero.update(5.0);
assert(ccHero.isDead === false, 'Hero has resurrected');
assert(ccHero.isAlive() === true, 'Hero isAlive() is true');
assert(ccHero.x === 400 && ccHero.y === 400, 'Hero is at Allied Fountain (400, 400)');
assert(ccHero.hp === 680, 'HP fully restored to 680');
assert(ccHero.mana === 300, 'Mana fully restored to 300');
assert(ccHero.barrier === 0, 'Barrier cleanly wiped to 0');
assert(ccHero.stunnedUntil === 0, 'Stun cleansed');
assert(ccHero.rootedUntil === 0, 'Root cleansed');
assert(ccHero.silencedUntil === 0, 'Silence cleansed');
assert(ccHero.tauntedUntil === 0, 'Taunt cleansed');
assert(ccHero.tauntTargetId === null, 'Taunt target cleared');
assert(ccHero.slowedUntil === 0, 'Slow duration cleansed');
assert(ccHero.slowPercentage === 0, 'Slow percentage cleansed');
assert(ccHero.stealthedUntil === 0, 'Stealth cleansed');
assert(ccHero.holdPosition === false, 'Hold position cleared');
assert(ccHero.canMove() === true, 'Hero can move immediately upon respawn');
assert(ccHero.canAttack() === true, 'Hero can attack immediately upon respawn');
assert(ccHero.canCast() === true, 'Hero can cast immediately upon respawn');

console.log('--- 6. Headless Safety (HUDController without document) ---');
const hud = new HUDController();
try {
  hud.update(hero, null);
  console.log('PASS: HUDController.update runs safely in headless environment without throwing');
} catch (e) {
  console.error(`FAIL: HUDController threw in headless environment: ${e.message}`);
  failures++;
}

console.log('--- 7. GameSimulation Entity Retention & Particles Safety ---');
const sim = new GameSimulation();
const simHero = new HeroEntity({ id: 'hero_1', hp: 100, maxHp: 100, level: 1 });
sim.entities = [simHero];
sim.playerHero = simHero;
simHero.takeDamage(200);
sim.update(0.016);
assert(sim.entities.length === 1, 'Dead hero retained in sim.entities');
assert(sim.entities[0].isDead === true, 'Hero in entities is dead');

if (failures === 0) {
  console.log('\nALL ADVERSARIAL STRESS TESTS PASSED CLEANLY (0 failures)');
} else {
  console.error(`\nFAILED: ${failures} tests failed!`);
  process.exit(1);
}
