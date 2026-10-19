import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertCloseTo } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Visual FX (VFX), Screen Shake Dynamism & Thematic Hero Particles (M3 / R3)', () => {

  it('TC-VFX-01: Camera Trauma Model — addTrauma, clamping, decay, and quadratic shake calculation', async () => {
    const { module: cameraMod } = await resolveModule('core/camera');
    assertEqual(typeof cameraMod.Camera, 'function', 'Camera must be exported');

    const cam = new cameraMod.Camera({ traumaDecay: 2.0, maxShakeX: 14, maxShakeY: 10, maxShakeRoll: 0.02 });
    assertEqual(cam.trauma, 0.0, 'Initial trauma must be 0');
    assertEqual(cam.shakeOffsetX, 0);
    assertEqual(cam.shakeOffsetY, 0);
    assertEqual(cam.shakeRoll, 0);

    // 1. Add trauma and check clamping to [0, 1.0]
    cam.addTrauma(0.4);
    assertCloseTo(cam.trauma, 0.4, 1e-4, 'Trauma should be 0.4');

    cam.addTrauma(0.8);
    assertEqual(cam.trauma, 1.0, 'Trauma must clamp at maximum 1.0');

    // Negative / invalid values should be safely ignored
    cam.addTrauma(-0.5);
    assertEqual(cam.trauma, 1.0, 'Negative trauma addition must not decrease trauma');
    cam.addTrauma(NaN);
    cam.addTrauma(null);
    assertEqual(cam.trauma, 1.0, 'Invalid trauma inputs must be ignored');

    // 2. Linear decay over time in update(dt)
    // With traumaDecay = 2.0, dt = 0.2s decreases trauma by 0.4
    cam.update(0.2);
    assertCloseTo(cam.trauma, 0.6, 1e-3, 'Trauma should decay linearly by decay * dt');
    assertTrue(Math.abs(cam.shakeOffsetX) > 0 || Math.abs(cam.shakeOffsetY) > 0 || Math.abs(cam.shakeRoll) > 0,
      'Active shake should produce non-zero offsets when trauma > 0');

    // Total decay to 0
    cam.update(0.5); // 0.6 - 1.0 -> clamped to 0
    assertEqual(cam.trauma, 0.0, 'Trauma should decay to 0 and clamp');
    assertEqual(cam.shakeOffsetX, 0, 'Shake offset X must zero out when trauma is 0');
    assertEqual(cam.shakeOffsetY, 0, 'Shake offset Y must zero out when trauma is 0');
    assertEqual(cam.shakeRoll, 0, 'Shake roll must zero out when trauma is 0');
  });

  it('TC-VFX-02: Camera Shake Displacements respect setShakeEnabled(false)', async () => {
    const { module: cameraMod } = await resolveModule('core/camera');
    const cam = new cameraMod.Camera({ maxShakeX: 20, maxShakeY: 15, maxShakeRoll: 0.05 });

    cam.addTrauma(1.0);
    assertTrue(cam.shakeEnabled, 'Shake should be enabled by default');

    cam.update(0.016);
    // When enabled and trauma is near 1.0, offsets should be non-zero
    const hasDisplacement = cam.shakeOffsetX !== 0 || cam.shakeOffsetY !== 0 || cam.shakeRoll !== 0;
    assertTrue(hasDisplacement, 'Camera displacement should occur when shake is enabled');

    // Disable shake
    cam.setShakeEnabled(false);
    assertFalse(cam.shakeEnabled, 'Shake must be disabled');
    assertEqual(cam.shakeOffsetX, 0, 'shakeOffsetX must immediately reset to 0');
    assertEqual(cam.shakeOffsetY, 0, 'shakeOffsetY must immediately reset to 0');
    assertEqual(cam.shakeRoll, 0, 'shakeRoll must immediately reset to 0');

    // Run updates while disabled — trauma should decay, but offsets remain strictly 0
    cam.addTrauma(0.5);
    cam.update(0.016);
    assertEqual(cam.shakeOffsetX, 0, 'shakeOffsetX must remain 0 while disabled');
    assertEqual(cam.shakeOffsetY, 0, 'shakeOffsetY must remain 0 while disabled');
    assertEqual(cam.shakeRoll, 0, 'shakeRoll must remain 0 while disabled');
  });

  it('TC-VFX-03: Renderer applies screen shake transform to Passes 1-6 and preserves static HUD in Pass 7', async () => {
    const { module: rendererMod } = await resolveModule('render/renderer');
    const { module: cameraMod } = await resolveModule('core/camera');

    assertEqual(typeof rendererMod.Renderer, 'function', 'Renderer must be exported');
    const renderer = new rendererMod.Renderer({ width: 1280, height: 720 });

    const translations = [];
    const rotations = [];
    let saveCount = 0;
    let restoreCount = 0;

    const ctxMock = {
      clearRect() {},
      save() { saveCount++; },
      restore() { restoreCount++; },
      translate(x, y) { translations.push({ x, y }); },
      rotate(rad) { rotations.push(rad); },
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

    renderer.ctx = ctxMock;

    const cam = new cameraMod.Camera();
    cam.shakeOffsetX = 7.5;
    cam.shakeOffsetY = -4.2;
    cam.shakeRoll = 0.015;
    cam.shakeEnabled = true;

    const mockGameState = {
      entities: [],
      playerHero: { hp: 500, maxHp: 500, x: 650, y: 650 }
    };

    renderer.render(mockGameState, cam, null, null);

    // Save & restore must be invoked to isolate world passes from screen HUD
    assertTrue(saveCount >= 1, 'ctx.save must be called before passes 1-6');
    assertTrue(restoreCount >= 1, 'ctx.restore must be called after pass 6');
    assertTrue(translations.length >= 1, 'ctx.translate must be called for camera shake offset');
    assertEqual(translations[0].x, 7.5, 'First translation X must match shakeOffsetX');
    assertEqual(translations[0].y, -4.2, 'First translation Y must match shakeOffsetY');
    assertTrue(rotations.length >= 1, 'ctx.rotate must be called for shakeRoll');
    assertEqual(rotations[0], 0.015, 'Rotation must match camera shakeRoll');
  });

  it('TC-VFX-04: Confetti Particles — Angular rotation, sinusoidal oscillation, and capacity eviction', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    const ps = new particleMod.ParticleSystem();

    // 1. Emit confetti
    ps.emit('confetti', {
      x: 400,
      y: 500,
      count: 40,
      life: 1.5
    });

    assertEqual(ps.particles.length, 40, 'Must emit exactly 40 confetti particles');
    const confetti = ps.particles[0];
    assertEqual(confetti.type, 'confetti');
    assertTrue(typeof confetti.angle === 'number');
    assertTrue(typeof confetti.angularVelocity === 'number');
    assertTrue(typeof confetti.color === 'string');
    assertTrue(confetti.color.startsWith('#'), 'Confetti color should be a hex string');

    const initialX = confetti.x;
    const initialAngle = confetti.angle;

    // 2. Update particle simulation
    ps.update(0.1);
    assertTrue(confetti.angle !== initialAngle, 'Confetti must rotate over time');
    assertTrue(confetti.life < 1.5, 'Confetti life must decrement');

    // 3. Max capacity capping test (500 limit)
    for (let i = 0; i < 20; i++) {
      ps.emit('confetti', { x: 400, y: 500, count: 30 });
    }
    assertTrue(ps.particles.length <= ps.maxParticles, `Particles count must not exceed ${ps.maxParticles}`);
  });

  it('TC-VFX-05: Trail Particles — Short life, drag deceleration, radius decay, zero gravity and projectile emission', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    const { module: projMod } = await resolveModule('combat/projectile');

    const ps = new particleMod.ParticleSystem();

    // 1. Emit trail particle
    ps.emit('trail', {
      x: 300,
      y: 350,
      count: 5,
      color: '#34d399',
      size: 4,
      life: 0.15
    });

    assertEqual(ps.particles.length, 5);
    const trail = ps.particles[0];
    assertEqual(trail.type, 'trail');
    assertEqual(trail.color, '#34d399');
    assertEqual(trail.vz, 0, 'Trail particles must have 0 vertical gravity velocity');

    // 2. Update lifecycle: radius decays smoothly with life ratio
    const initialSize = trail.size;
    ps.update(0.05); // 1/3 of life passed
    assertTrue(trail.size < initialSize, 'Trail particle size must decay over its lifespan');
    assertCloseTo(trail.size, initialSize * (trail.life / trail.maxLife), 0.05);

    // 3. HeroProjectile flight emissions
    const mockTarget = { x: 500, y: 350, hp: 100, isAlive: () => true };
    const proj = new projMod.HeroProjectile({
      x: 200,
      y: 350,
      target: mockTarget,
      speed: 600,
      heroClass: 'ranger'
    });

    const mockSim = {
      particles: ps,
      applyHeroHit() {}
    };

    ps.clear();
    proj.update(0.05, mockSim); // Move in flight
    assertTrue(ps.particles.some(p => p.type === 'trail'), 'HeroProjectile must emit trail particle in flight');
  });

  it('TC-VFX-06: CC Ring Particles — Expanding ground ring and suspended orbiting orbs', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    const ps = new particleMod.ParticleSystem();

    ps.emit('cc_ring', {
      x: 450,
      y: 650,
      color: '#fbbf24',
      life: 0.8
    });

    assertEqual(ps.particles.length, 1);
    const cc = ps.particles[0];
    assertEqual(cc.type, 'cc_ring');
    assertEqual(cc.color, '#fbbf24');
    assertTrue(cc.radius >= 10);
    assertTrue(cc.orbitCount >= 3, 'Must have at least 3 suspended orbiting orbs');

    const initialRadius = cc.radius;
    const initialOrbitAngle = cc.orbitAngle;

    ps.update(0.1);
    assertTrue(cc.radius > initialRadius, 'Ground ring must expand over time');
    assertTrue(cc.orbitAngle > initialOrbitAngle, 'Orbiting orbs must rotate around suspended center');

    // Test draw call with mocked canvas
    let ellipseDrawn = false;
    let arcDrawn = false;
    const ctxMock = {
      save() {},
      restore() {},
      beginPath() {},
      ellipse() { ellipseDrawn = true; },
      arc() { arcDrawn = true; },
      stroke() {},
      fill() {}
    };

    const cameraMock = { x: 450, y: 650, viewportWidth: 1280, viewportHeight: 720 };
    ps.draw(ctxMock, cameraMock, 1.0);
    assertTrue(ellipseDrawn, 'Ground ellipse ring must be rendered');
    assertTrue(arcDrawn, 'Orbiting orbs must be rendered');
  });

  it('TC-VFX-07: Hero Attack Hit Presets — Thematic verification for all 5 hero archetypes and critical strikes', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    const ps = new particleMod.ParticleSystem();

    // 1. Knight: faíscas branco/dourado (#fef08a), anel metálico azul (#60a5fa)
    ps.clear();
    ps.emitHeroAttackHit('knight', 500, 500, false);
    assertTrue(ps.particles.some(p => p.type === 'spark' && p.color === '#fef08a'), 'Knight hit must include gold/white sparks');
    assertTrue(ps.particles.some(p => p.type === 'ring' && p.color === '#60a5fa'), 'Knight hit must include metallic blue ring');

    // 2. Sorceress: fagulhas de fogo (#f97316) e anel de calor radiante (#ef4444)
    ps.clear();
    ps.emitHeroAttackHit('sorceress', 500, 500, false);
    assertTrue(ps.particles.some(p => p.type === 'fire' || p.color === '#f97316' || p.color === '#ef4444'), 'Sorceress hit must include fire particles');
    assertTrue(ps.particles.some(p => p.type === 'ring' && p.color === '#ef4444'), 'Sorceress hit must include radiant heat ring');

    // 3. Ranger: fragmentos esmeralda perfurantes (#34d399 / #10b981)
    ps.clear();
    ps.emitHeroAttackHit('ranger', 500, 500, false);
    assertTrue(ps.particles.some(p => p.color === '#34d399' || p.color === '#10b981'), 'Ranger hit must include emerald piercing sparks');

    // 4. Assassin: faíscas venenosas violeta (#a855f7) e fumaça sombria (#1e1b4b)
    ps.clear();
    ps.emitHeroAttackHit('assassin', 500, 500, false);
    assertTrue(ps.particles.some(p => p.color === '#a855f7'), 'Assassin hit must include violet venom sparks');
    assertTrue(ps.particles.some(p => p.color === '#1e1b4b'), 'Assassin hit must include dark shadow smoke sparks');

    // 5. Cleric: partículas solares cintilantes (#fde047) e anel sagrado (#fef08a)
    ps.clear();
    ps.emitHeroAttackHit('cleric', 500, 500, false);
    assertTrue(ps.particles.some(p => p.color === '#fde047'), 'Cleric hit must include solar light sparks');
    assertTrue(ps.particles.some(p => p.type === 'ring' && p.color === '#fef08a'), 'Cleric hit must include holy radiation ring');

    // 6. Critical Strike: 2x spark count, extra white ring and white flash
    ps.clear();
    ps.emitHeroAttackHit('knight', 500, 500, false);
    const normalSparksCount = ps.particles.filter(p => p.type === 'spark').length;

    ps.clear();
    ps.emitHeroAttackHit('knight', 500, 500, true);
    const critSparksCount = ps.particles.filter(p => p.type === 'spark').length;
    assertTrue(critSparksCount > normalSparksCount, 'Critical strike must significantly increase spark particles');
    assertTrue(ps.particles.some(p => p.type === 'ring' && p.color === '#ffffff'), 'Critical strike must emit extra white impact ring');
    assertTrue(ps.particles.some(p => p.type === 'spark' && p.color === '#ffffff'), 'Critical strike must emit white flash sparks');
  });

  it('TC-VFX-08: Combat Trauma Triggers — Critical hits (0.18), hero death (0.35), towers (0.50), bosses (0.65) & Level Up celebration', async () => {
    const { module: gameMod } = await resolveModule('game');
    assertEqual(typeof gameMod.GameSimulation, 'function', 'GameSimulation must be exported');

    const sim = new gameMod.GameSimulation({ isHost: true });

    // 1. Critical strike triggers 0.18 trauma
    sim.camera.trauma = 0;
    const dummyTarget = { x: 700, y: 700, hp: 500, isAlive: () => true, takeDamage: () => 50 };
    sim.applyHeroHit(sim.playerHero, dummyTarget, 100, 'physical', true, 0);
    assertCloseTo(sim.camera.trauma, 0.18, 1e-4, 'Critical hit must add 0.18 trauma to camera');

    // 2. Tower destruction triggers 0.50 trauma
    sim.camera.trauma = 0;
    const dummyTower = { type: 'tower', team: 'enemy', x: 1950, y: 1950 };
    sim.awardDeathXp(dummyTower, sim.playerHero);
    assertCloseTo(sim.camera.trauma, 0.50, 1e-4, 'Tower destruction must add 0.50 trauma to camera');

    // 3. Boss defeat triggers 0.65 trauma
    sim.camera.trauma = 0;
    const dummyBoss = { type: 'boss', name: 'Stone Colossus', team: 'enemy', x: 2000, y: 2000 };
    sim.awardDeathXp(dummyBoss, sim.playerHero);
    assertCloseTo(sim.camera.trauma, 0.65, 1e-4, 'Boss defeat must add 0.65 trauma to camera');

    // 4. Player hero death triggers 0.35 trauma
    sim.camera.trauma = 0;
    sim.playerHero.hp = 50;
    sim.playerHero.isDead = false;
    sim.playerHero.isLocalPlayer = true;
    sim.applyHeroHit({ id: 'enemy_1', heroId: 'assassin' }, sim.playerHero, 200, 'physical', false, 0);
    assertCloseTo(sim.camera.trauma, 0.35, 1e-4, 'Player hero death must add 0.35 trauma to camera');

    // 5. Level Up celebration VFX emits confetti, rings, and sparks
    sim.particles.clear();
    sim.triggerLevelUpVFX(sim.playerHero, 5);
    assertTrue(sim.particles.particles.some(p => p.type === 'confetti'), 'Level up must emit confetti');
    assertEqual(sim.particles.particles.filter(p => p.type === 'ring').length, 2, 'Level up must emit 2 concentric gold rings');
    assertTrue(sim.particles.particles.some(p => p.type === 'spark'), 'Level up must emit upward sparks');
    assertTrue(sim.particles.floatingTexts.some(ft => ft.text.includes('LEVEL UP')), 'Level up must display epic floating text');
  });

  it('TC-VFX-09: Headless Safety & Defensive Edge Cases', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    const { module: cameraMod } = await resolveModule('core/camera');
    const { module: rendererMod } = await resolveModule('render/renderer');

    const ps = new particleMod.ParticleSystem();
    const cam = new cameraMod.Camera();
    const renderer = new rendererMod.Renderer();

    // Call draw with empty/null/mock context without errors
    ps.draw(null, cam, 1.0);
    ps.draw({}, cam, 1.0);

    // Call renderer with minimal/null camera without errors
    renderer.ctx = {
      clearRect() {},
      save() {},
      restore() {}
    };
    renderer.render({ entities: [] }, null, null, ps);

    // Camera update with extreme/negative dt
    cam.addTrauma(0.5);
    cam.update(-1);
    cam.update(0);
    cam.update(100);
    assertEqual(cam.trauma, 0, 'Large dt should safely decay trauma to 0 without underflow');
    assertTrue(Number.isFinite(cam.shakeOffsetX));
    assertTrue(Number.isFinite(cam.shakeOffsetY));
    assertTrue(Number.isFinite(cam.shakeRoll));
  });

});
