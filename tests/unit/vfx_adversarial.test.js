import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertCloseTo, assertLessOrEqual } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Adversarial Stress — VFX, Screen Shake, Particle Spam & Projectile Edge Cases (M3)', () => {

  it('TC-ADV-VFX-01: Camera Trauma Extremes — negative, overflow, dt=0/negative/NaN/huge, and setShakeEnabled toggling', async () => {
    const { module: cameraMod } = await resolveModule('core/camera');
    assertEqual(typeof cameraMod.Camera, 'function', 'Camera must be exported');

    const cam = new cameraMod.Camera({
      traumaDecay: 2.0,
      maxShakeX: 14,
      maxShakeY: 10,
      maxShakeRoll: 0.02
    });

    // 1. Negative trauma addition must NOT decrease trauma or cause negative trauma
    cam.addTrauma(-10);
    assertEqual(cam.trauma, 0.0, 'Negative trauma addition on zero trauma must remain 0');

    cam.addTrauma(0.5);
    cam.addTrauma(-0.3);
    assertEqual(cam.trauma, 0.5, 'Negative trauma addition on positive trauma must not reduce trauma');

    // 2. Extreme overflow trauma addition must strictly clamp to 1.0
    cam.addTrauma(50.0);
    assertEqual(cam.trauma, 1.0, 'Trauma of 50.0 must clamp to 1.0');

    cam.addTrauma(1e9);
    assertEqual(cam.trauma, 1.0, 'Giant trauma must remain clamped to 1.0');

    // 3. Non-finite or invalid inputs must be safely ignored
    cam.addTrauma(NaN);
    cam.addTrauma(Infinity);
    cam.addTrauma(-Infinity);
    cam.addTrauma('0.8');
    cam.addTrauma(null);
    cam.addTrauma(undefined);
    cam.addTrauma({});
    assertEqual(cam.trauma, 1.0, 'Invalid inputs must not alter trauma');

    // 4. Edge cases for update(dt): dt = 0, dt < 0, dt = NaN, dt = Infinity
    // dt = 0: safeDt = 0, no decay
    cam.update(0);
    assertEqual(cam.trauma, 1.0, 'dt=0 should produce zero decay');
    assertTrue(Number.isFinite(cam.shakeOffsetX), 'Offset X must be finite');
    assertTrue(Number.isFinite(cam.shakeOffsetY), 'Offset Y must be finite');
    assertTrue(Number.isFinite(cam.shakeRoll), 'Shake roll must be finite');

    // dt < 0: safeDt = 0, no negative time travel or trauma inflation
    cam.update(-5.0);
    assertEqual(cam.trauma, 1.0, 'Negative dt must be treated as safeDt=0');

    // dt = NaN: safeDt = 0, no NaN contamination
    cam.update(NaN);
    assertEqual(cam.trauma, 1.0, 'NaN dt must be treated as safeDt=0');

    // dt = Infinity: safeDt = 0
    cam.update(Infinity);
    assertEqual(cam.trauma, 1.0, 'Infinity dt must be treated as safeDt=0');

    // 5. Huge dt: trauma must decay to 0 without underflow or NaN
    cam.update(10000);
    assertEqual(cam.trauma, 0.0, 'Huge dt should cleanly decay trauma to 0');
    assertEqual(cam.shakeOffsetX, 0, 'Shake offset X must be 0 when trauma is 0');
    assertEqual(cam.shakeOffsetY, 0, 'Shake offset Y must be 0 when trauma is 0');
    assertEqual(cam.shakeRoll, 0, 'Shake roll must be 0 when trauma is 0');

    // 6. Immediate reset on setShakeEnabled(false)
    cam.addTrauma(1.0);
    cam.update(0.016);
    // At trauma ~0.968, shake should have non-zero displacement
    assertTrue(cam.shakeOffsetX !== 0 || cam.shakeOffsetY !== 0 || cam.shakeRoll !== 0, 'Displacement expected at near-max trauma');

    cam.setShakeEnabled(false);
    assertFalse(cam.shakeEnabled);
    assertEqual(cam.shakeOffsetX, 0, 'shakeOffsetX must immediately reset to 0');
    assertEqual(cam.shakeOffsetY, 0, 'shakeOffsetY must immediately reset to 0');
    assertEqual(cam.shakeRoll, 0, 'shakeRoll must immediately reset to 0');

    // Subsequent updates while disabled keep offsets at 0
    cam.update(0.016);
    assertEqual(cam.shakeOffsetX, 0);
    assertEqual(cam.shakeOffsetY, 0);
    assertEqual(cam.shakeRoll, 0);

    // Re-enabling shake allows displacements to resume if trauma remains
    cam.setShakeEnabled(true);
    assertTrue(cam.shakeEnabled);
    cam.update(0.016);
    assertTrue(cam.shakeOffsetX !== 0 || cam.shakeOffsetY !== 0 || cam.shakeRoll !== 0, 'Shake displacement resumes when re-enabled');
  });

  it('TC-ADV-VFX-02: Particle Buffer Stress & Eviction — spamming 1000+ particles across confetti, trail, cc_ring, and hero hits', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    assertEqual(typeof particleMod.ParticleSystem, 'function', 'ParticleSystem must be exported');

    const ps = new particleMod.ParticleSystem();
    assertEqual(ps.maxParticles, 500, 'maxParticles must be 500');
    assertEqual(ps.particles.length, 0);

    const startTime = performance.now();

    // 1. Spam 1000 confetti particles (50 bursts of 20)
    for (let i = 0; i < 50; i++) {
      ps.emit('confetti', { x: 500, y: 500, count: 20 });
      assertLessOrEqual(ps.particles.length, ps.maxParticles, 'Confetti spam must never exceed maxParticles');
    }
    assertEqual(ps.particles.length, 500, 'Confetti pool must cap at 500');

    // 2. Spam 1000 trail particles (100 bursts of 10)
    for (let i = 0; i < 100; i++) {
      ps.emit('trail', { x: 600, y: 600, count: 10 });
      assertLessOrEqual(ps.particles.length, ps.maxParticles, 'Trail spam must never exceed maxParticles');
    }
    assertEqual(ps.particles.length, 500, 'Trail pool must remain capped at 500');

    // 3. Spam 1000 cc_ring particles (1000 single emitter calls)
    for (let i = 0; i < 1000; i++) {
      ps.emit('cc_ring', { x: 700 + (i % 50), y: 700 + (i % 50) });
      assertLessOrEqual(ps.particles.length, ps.maxParticles, 'CC ring spam must never exceed maxParticles');
    }
    assertEqual(ps.particles.length, 500, 'CC ring pool must remain capped at 500');

    // 4. Spam 200 hits per hero across all 5 archetypes with critical strikes (5 * 200 = 1000 calls, >20,000 particles)
    const heroes = ['knight', 'sorceress', 'ranger', 'assassin', 'cleric'];
    for (const hero of heroes) {
      for (let i = 0; i < 200; i++) {
        ps.emitHeroAttackHit(hero, 800, 800, true);
        assertLessOrEqual(ps.particles.length, ps.maxParticles, 'Hero hit spam must never exceed maxParticles');
      }
    }
    assertEqual(ps.particles.length, 500, 'Pool must remain strictly 500');

    // 5. Benchmark check: 1000+ emissions must execute swiftly without quadratic slowdown
    const emissionDuration = performance.now() - startTime;
    assertTrue(emissionDuration < 300, `Heavy particle spam should complete under 300ms, took ${emissionDuration.toFixed(1)}ms`);

    // 6. Draw under maximum particle load with mock context
    let ringCount = 0;
    let arcCount = 0;
    let rectCount = 0;
    const ctxMock = {
      save() {},
      restore() {},
      beginPath() {},
      ellipse() { ringCount++; },
      arc() { arcCount++; },
      translate() {},
      rotate() {},
      fillRect() { rectCount++; },
      stroke() {},
      fill() {}
    };
    const camera = { x: 800, y: 800, viewportWidth: 1280, viewportHeight: 720 };
    ps.draw(ctxMock, camera, 1.0);
    assertTrue(ringCount > 0 || arcCount > 0 || rectCount > 0, 'Active particles rendered under maximum capacity');

    // 7. Complete lifecycle drainage: update until all 500 particles expire
    // Max life of particles is ~1.8s. 40 ticks of 0.05s = 2.0s
    for (let tick = 0; tick < 40; tick++) {
      ps.update(0.05);
    }
    assertEqual(ps.particles.length, 0, 'All particles must naturally expire and drain to 0 without memory leakage');
  });

  it('TC-ADV-VFX-03: Projectile Edge Cases — null targets, NaN/invalid coordinates, zero distance, and class trails', async () => {
    const { module: projMod } = await resolveModule('combat/projectile');
    const { module: particleMod } = await resolveModule('render/particles');

    assertEqual(typeof projMod.HeroProjectile, 'function', 'HeroProjectile must be exported');

    const ps = new particleMod.ParticleSystem();
    const mockSim = {
      particles: ps,
      hitsApplied: [],
      applyHeroHit(hero, target, damage, type, isCrit, lifesteal) {
        this.hitsApplied.push({ hero, target, damage, type, isCrit, lifesteal });
      }
    };

    // 1. Projectile with null target
    const projNullTarget = new projMod.HeroProjectile({ target: null });
    projNullTarget.update(0.016, mockSim);
    assertTrue(projNullTarget.isDead, 'Projectile with null target must immediately mark isDead');

    // 2. Projectile with dead target (isAlive() === false)
    const deadTarget = { x: 500, y: 500, hp: 0, isAlive: () => false };
    const projDeadTarget = new projMod.HeroProjectile({ target: deadTarget });
    projDeadTarget.update(0.016, mockSim);
    assertTrue(projDeadTarget.isDead, 'Projectile with dead target must immediately mark isDead');

    // 3. Projectile with zero distance (already at target coordinates)
    mockSim.hitsApplied.length = 0;
    const targetSamePos = { x: 400, y: 400, height: 40, hp: 100, isAlive: () => true, radius: 20 };
    const projInstantHit = new projMod.HeroProjectile({
      x: 400,
      y: 400,
      z: 20,
      target: targetSamePos,
      damage: 75
    });
    projInstantHit.update(0.016, mockSim);
    assertTrue(projInstantHit.isDead, 'Projectile at zero distance must impact immediately');
    assertEqual(mockSim.hitsApplied.length, 1, 'Hit must be delivered');
    assertEqual(mockSim.hitsApplied[0].damage, 75);

    // 4. Projectile flight emitting thematic trail particles for all classes
    const classes = [
      { class: 'ranger', expectedColor: '#34d399' },
      { class: 'sorceress', expectedColor: '#f97316' },
      { class: 'cleric', expectedColor: '#fde047' },
      { class: 'assassin', expectedColor: '#a855f7' },
      { class: 'knight', expectedColor: '#60a5fa' }
    ];

    for (const item of classes) {
      ps.clear();
      const distantTarget = { x: 2000, y: 2000, height: 40, hp: 500, isAlive: () => true, radius: 20 };
      const proj = new projMod.HeroProjectile({
        x: 100,
        y: 100,
        z: 20,
        target: distantTarget,
        heroClass: item.class,
        speed: 500
      });

      proj.update(0.016, mockSim);
      assertFalse(proj.isDead, `${item.class} projectile should remain in flight`);
      assertTrue(ps.particles.some(p => p.type === 'trail' && p.color === item.expectedColor),
        `${item.class} projectile must emit trail particle with color ${item.expectedColor}`);
    }

    // 5. Projectile with null / NaN initial coordinates
    const weirdTarget = { x: 600, y: 600, hp: 200, isAlive: () => true };
    const projWeird = new projMod.HeroProjectile({
      x: null,
      y: null,
      z: null,
      target: weirdTarget
    });
    // In update, should not throw
    projWeird.update(0.016, mockSim);
    assertFalse(projWeird.isDead);

    // 6. Projectile update with simulation = null or simulation.particles = null
    const distantTarget2 = { x: 3000, y: 3000, hp: 500, isAlive: () => true };
    const projNoSim = new projMod.HeroProjectile({
      x: 100,
      y: 100,
      target: distantTarget2
    });
    projNoSim.update(0.016, null);
    projNoSim.update(0.016, {});
    assertFalse(projNoSim.isDead, 'Projectile must safely update without simulation or particles');
  });

  it('TC-ADV-VFX-04: Headless Safety & Canvas Robustness — pure Node.js rendering without native Canvas/DOM', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    const { module: cameraMod } = await resolveModule('core/camera');
    const { module: rendererMod } = await resolveModule('render/renderer');

    const ps = new particleMod.ParticleSystem();
    const cam = new cameraMod.Camera();
    const renderer = new rendererMod.Renderer({ width: 1280, height: 720 });

    // 1. Draw with completely null or undefined context
    ps.draw(null, cam, 1.0);
    ps.draw(undefined, cam, 1.0);

    // 2. Draw with empty context object (no save/restore)
    ps.draw({}, cam, 1.0);

    // 3. Draw with headless mock context implementing full Canvas 2D methods
    const headlessCtx = {
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      stroke() {},
      fill() {},
      ellipse() {},
      arc() {},
      rect() {},
      fillRect() {},
      fillText() {},
      strokeText() {},
      setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; },
      createLinearGradient() { return { addColorStop() {} }; }
    };

    // Populate particles of every known type
    ps.emit('confetti', { x: 500, y: 500, count: 5 });
    ps.emit('trail', { x: 500, y: 500, count: 5 });
    ps.emit('cc_ring', { x: 500, y: 500 });
    ps.emit('ring', { x: 500, y: 500 });
    ps.emit('spark', { x: 500, y: 500, count: 5 });
    ps.emit('fire', { x: 500, y: 500, count: 5 });
    ps.emit('frost', { x: 500, y: 500, count: 5 });
    ps.emit('heal', { x: 500, y: 500, count: 5 });
    ps.emitMoveIndicator(500, 500);
    ps.addFloatingText('CRIT 350', 500, 500, { isCrit: true });

    // Draw with varied zoom values (including boundary and extreme zoom)
    ps.draw(headlessCtx, cam, 0.6);
    ps.draw(headlessCtx, cam, 1.0);
    ps.draw(headlessCtx, cam, 1.6);
    ps.draw(headlessCtx, cam, 0.0);
    ps.draw(headlessCtx, cam, 10.0);

    // 4. Renderer headless execution: test null and empty context early returns
    renderer.ctx = null;
    const gameState = {
      entities: [],
      playerHero: { hp: 500, maxHp: 500, x: 650, y: 650 }
    };
    renderer.render(gameState, cam, null, ps); // Must safely return without error

    renderer.ctx = {};
    renderer.render(gameState, cam, null, ps); // Must safely return without error

    // 5. Full renderer pass execution with headless Canvas context and screen shake
    renderer.ctx = headlessCtx;
    cam.addTrauma(0.8);
    cam.update(0.016);
    renderer.render(gameState, cam, null, ps);
    assertTrue(true, 'Full headless render executed cleanly');
  });

});
