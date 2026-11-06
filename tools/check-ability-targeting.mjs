// Run from the repository root. Set TARGET_BASE_URL to exercise deployed assets.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const baseURL = process.env.TARGET_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.TARGET_SCREENSHOT_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'moba-targeting-'));
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [];
const contentTypes = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function start(hero, touch = false) {
  const page = await browser.newPage({ viewport: touch ? { width: 844, height: 390 } : { width: 1440, height: 900 }, hasTouch: touch, isMobile: touch });
  page.on('pageerror', error => errors.push(`${hero}: ${error.message}`));
  page.on('dialog', dialog => dialog.dismiss());
  if (!process.env.TARGET_BASE_URL) {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      // Solo testing needs no external signaling service. Application files remain real.
      if (url.origin !== new URL(baseURL).origin) return route.fulfill({ body: 'window.Peer = class {};', contentType: 'application/javascript' });
      const file = path.join(process.cwd(), decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      try { await route.fulfill({ body: await fs.readFile(file), contentType: contentTypes[path.extname(file)] || 'application/octet-stream' }); }
      catch { await route.fulfill({ status: 404, body: 'Missing file' }); }
    });
  }
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: /SELECIONAR HER/ }).click({ timeout: 45000 });
  await page.locator(`[data-hero-id="${hero}"]`).click();
  await page.getByRole('button', { name: /ENTRAR NO CAMPO/ }).click();
  await page.getByRole('button', { name: 'Pular guia', exact: true }).click();
  await page.waitForFunction(() => window.gameSim?.playerHero && [...document.querySelectorAll('.ability-art img')].length === 4 && [...document.querySelectorAll('.ability-art img')].every(image => image.complete && image.naturalWidth));
  await page.evaluate(() => {
    window.__targetingPointerEvents = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) window.addEventListener(type, event => {
      window.__targetingPointerEvents.push({ type, pointerType: event.pointerType, pointerId: event.pointerId, target: event.target.id || event.target.className, x: event.clientX, y: event.clientY });
      if (window.__targetingPointerEvents.length > 80) window.__targetingPointerEvents.shift();
    }, true);
  });
  return page;
}

async function fixture(page, targets = [{ id: 'enemy', dx: 240, dy: 0 }], ranks = {}) {
  return page.evaluate(async ({ targets, ranks }) => {
    const [{ MinionUnit }, { HeroEntity }, { worldToScreen }, { getSkillRuntime }] = await Promise.all([
      import('/src/world/minion.js'), import('/src/entities/entity.js'), import('/src/core/isometric.js'), import('/src/entities/heroes.js')
    ]);
    const g = window.gameSim, h = g.playerHero;
    // Pause autonomous combat/regeneration, retaining real rendering, input and skill execution.
    g.loop.pause();
    g.virtualJoystick?.cancelMovement();
    g.input.cancelTargeting();
    h.stop(); h.attackTarget = null; h.attackMoveDestination = null;
    h.x = 1600; h.y = 1600; h.hp = h.maxHp; h.mana = h.maxMana;
    h.barrier = 0; h.level = 6; h.skillPoints = 0;
    h.clearCrowdControl();
    for (const [slot, ability] of Object.entries(h.abilities)) {
      ability.rank = ranks[slot] || 1;
      ability.cooldownRemaining = 0;
    }
    g.entities.splice(0, g.entities.length, h);
    g.heroProjectiles.length = 0;
    g.particles.clear();
    g.map.syncStructuresFromEntities(g.entities);
    for (const target of targets) {
      const options = { id: target.id, team: target.team || 'enemy', x: h.x + target.dx, y: h.y + target.dy };
      const entity = target.team === 'allied'
        ? new HeroEntity({ ...options, heroId: 'knight', hp: target.hp ?? 200, maxHp: 1000 })
        : new MinionUnit({ ...options, subType: 'melee' });
      if (target.team !== 'allied') { entity.hp = 1200; entity.maxHp = 1200; }
      g.entities.push(entity);
    }
    if (!g.__targetingHandleCommand) {
      g.__targetingHandleCommand = g.handleCommand.bind(g);
      g.handleCommand = (command, ...args) => {
        g.__targetingCommands.push({ type: command.type, slot: command.slot, targetX: command.targetX, targetY: command.targetY, targetId: command.targetId });
        return g.__targetingHandleCommand(command, ...args);
      };
    }
    g.__targetingCommands = [];
    g.input.entityManager = g.entities;
    g.input.isRightDown = false;
    g.camera.rotation = 0;
    g.camera.follow(h); g.camera.recenter(); g.camera.snapZoom(1.25);
    g.input.update(0, h, g.entities);
    g.hud.update(h, g.getState(), g.input);
    g.render(0, 0);
    document.activeElement?.blur?.();
    const rect = g.canvas.getBoundingClientRect();
    const points = Object.fromEntries(g.entities.filter(entity => entity !== h).map(entity => {
      const { sx, sy } = worldToScreen(entity.x, entity.y, 0, g.camera);
      return [entity.id, { x: rect.left + sx * rect.width / g.camera.viewportWidth, y: rect.top + (sy - entity.height * .65 * g.camera.zoom) * rect.height / g.camera.viewportHeight, worldX: entity.x, worldY: entity.y, hp: entity.hp }];
    }));
    return { mana: h.mana, points, costs: Object.fromEntries(Object.entries(h.abilities).map(([slot, ability]) => [slot, ability.manaCost])), ranges: Object.fromEntries(Object.keys(h.abilities).map(slot => [slot, getSkillRuntime(h, slot).range || 0])) };
  }, { targets, ranks });
}

async function state(page) {
  return page.evaluate(() => {
    const g = window.gameSim, h = g.playerHero, indicator = g.input.targetingState?.indicator;
    return { mana: h.mana, barrier: h.barrier, x: h.x, y: h.y, targeting: g.input.targetingState?.slot || null, indicator: indicator ? { type: indicator.type, target: indicator.target, end: indicator.end, range: indicator.range, castRange: indicator.castRange } : null, cooldowns: Object.fromEntries(Object.entries(h.abilities).map(([slot, ability]) => [slot, ability.cooldownRemaining])), hp: Object.fromEntries(g.entities.map(entity => [entity.id, entity.hp])), commands: g.__targetingCommands, joystick: g.virtualJoystick?.active || false };
  });
}

function castOccurred(actual, setup, slot, targetId) {
  const casts = actual.commands.filter(command => command.type === 'CAST_ABILITY' && command.slot === slot);
  assert.equal(casts.length, 1, `${slot}: expected exactly one cast`);
  assert.equal(actual.mana, setup.mana - setup.costs[slot], `${slot}: incorrect mana debit`);
  assert(actual.cooldowns[slot] > 0, `${slot}: cooldown was not started`);
  assert.equal(actual.targeting, null, `${slot}: preview remains active after cast`);
  if (targetId) assert(actual.hp[targetId] < setup.points[targetId].hp, `${slot}: target took no damage`);
  return casts[0];
}

function unchanged(actual, setup, slot = 'Q') {
  assert.equal(actual.mana, setup.mana, 'Cancelled/unconfirmed cast spent mana');
  assert.equal(actual.cooldowns[slot], 0, 'Cancelled/unconfirmed cast started cooldown');
  assert.equal(actual.commands.filter(command => command.type === 'CAST_ABILITY').length, 0, 'Cancelled/unconfirmed cast emitted a command');
}

async function screenshot(page, name) {
  await page.evaluate(() => { const g = window.gameSim; g.hud.update(g.playerHero, g.getState(), g.input); g.render(0, 0); });
  await page.screenshot({ path: path.join(outputDir, `${name}.png`) });
}
function passed(name) { results.push(name); console.log(`PASS ${name}`); }
async function center(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert(box, `${selector}: no visible bounds`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function touch(session, type, points = []) { await session.send('Input.dispatchTouchEvent', { type, touchPoints: points }); }

try {
  const desktop = await start('knight');
  let setup = await fixture(desktop);
  let body = setup.points.enemy;
  await desktop.mouse.move(body.x, body.y);
  await desktop.keyboard.press('q');
  let actual = await state(desktop);
  unchanged(actual, setup);
  assert.equal(actual.targeting, 'Q');
  assert(Math.hypot(actual.indicator.target.x - body.worldX, actual.indicator.target.y - body.worldY) < 1, 'Mouse aim did not snap from the sprite body to the target');
  await screenshot(desktop, 'desktop-body-preview');
  await desktop.mouse.click(body.x, body.y);
  castOccurred(await state(desktop), setup, 'Q', 'enemy');
  passed('desktop mouse body selection snaps and damages the enemy');

  setup = await fixture(desktop); body = setup.points.enemy;
  await desktop.mouse.move(500, 350);
  await desktop.keyboard.press('q');
  await desktop.mouse.click(body.x, body.y);
  const command = castOccurred(await state(desktop), setup, 'Q', 'enemy');
  assert(Math.hypot(command.targetX - body.worldX, command.targetY - body.worldY) < 1, 'Confirm used stale aim geometry');
  passed('immediate mouse confirmation recalculates the latest pointer position');

  setup = await fixture(desktop); body = setup.points.enemy;
  await desktop.mouse.move(body.x, body.y);
  await desktop.keyboard.press('q');
  unchanged(await state(desktop), setup);
  await desktop.keyboard.press('q');
  castOccurred(await state(desktop), setup, 'Q', 'enemy');
  passed('second Q press confirms the preview exactly once');

  setup = await fixture(desktop);
  await desktop.keyboard.press('w');
  actual = await state(desktop);
  castOccurred(actual, setup, 'W', 'enemy');
  assert(actual.barrier > 0, 'Self ability did not grant its shield');
  await screenshot(desktop, 'desktop-self-cast');
  passed('self area skill casts on one key press');
  await desktop.close();

  const mage = await start('sorceress');
  setup = await fixture(mage, [], { E: 4 });
  const farPoint = await mage.evaluate(async () => {
    const { worldToScreen } = await import('/src/core/isometric.js');
    const g = window.gameSim, h = g.playerHero;
    return worldToScreen(h.x + 650, h.y, 0, g.camera);
  });
  await mage.mouse.move(farPoint.sx, farPoint.sy);
  await mage.keyboard.press('e');
  actual = await state(mage);
  assert.equal(actual.indicator.range, setup.ranges.E, 'Mobility preview uses the base rank range');
  assert(Math.abs(Math.hypot(actual.indicator.end.x - 1600, actual.indicator.end.y - 1600) - setup.ranges.E) < 1, 'Mobility endpoint has the wrong range');
  await screenshot(mage, 'desktop-mobility-range');
  const expectedDestination = await mage.evaluate(point => window.gameSim.map.findNearestWalkable(point.x, point.y, window.gameSim.playerHero.radius), actual.indicator.end);
  await mage.keyboard.press('e');
  actual = await state(mage); castOccurred(actual, setup, 'E');
  assert(Math.hypot(actual.x - expectedDestination.x, actual.y - expectedDestination.y) < 1, 'Mobility cast and preview disagree');
  passed('rank-four mobility preview matches the actual destination');
  await mage.close();

  const mobile = await start('knight', true);
  setup = await fixture(mobile);
  await mobile.locator('#ability-q').tap();
  castOccurred(await state(mobile), setup, 'Q', 'enemy');
  await screenshot(mobile, 'mobile-tap-auto-aim');
  passed('mobile tap automatically casts Q on a nearby enemy');

  const session = await mobile.context().newCDPSession(mobile);
  for (const slot of ['q', 'w', 'e', 'r']) {
    assert.equal(await mobile.locator(`#ability-${slot}`).evaluate(button => getComputedStyle(button).touchAction), 'none', `${slot}: browser gestures can cancel skill dragging`);
  }
  let q = await center(mobile, '#ability-q');
  setup = await fixture(mobile);
  await touch(session, 'touchStart', [{ id: 10, ...q }]);
  await touch(session, 'touchMove', [{ id: 10, x: q.x - 100, y: q.y }]);
  assert.equal((await state(mobile)).targeting, 'Q', 'Dragging failed to start a preview');
  await touch(session, 'touchMove', [{ id: 10, ...q }]);
  await touch(session, 'touchEnd');
  actual = await state(mobile); unchanged(actual, setup);
  assert.equal(actual.targeting, null, 'Returning to button center left the preview active');
  passed('dragging back to the button center cancels without spending mana');

  setup = await fixture(mobile);
  await touch(session, 'touchStart', [{ id: 11, ...q }]);
  await touch(session, 'touchMove', [{ id: 11, x: q.x - 100, y: q.y }]);
  await touch(session, 'touchCancel');
  actual = await state(mobile); unchanged(actual, setup);
  assert.equal(actual.targeting, null, 'Native touch cancellation left the preview active');
  passed('native touch cancellation preserves mana and clears preview');

  const edge = 400 / Math.sqrt(2);
  setup = await fixture(mobile, [{ id: 'enemy', dx: -edge, dy: edge }]);
  await touch(session, 'touchStart', [{ id: 12, ...q }]);
  await touch(session, 'touchMove', [{ id: 12, x: q.x - 100, y: q.y }]);
  actual = await state(mobile); unchanged(actual, setup);
  assert.equal(actual.targeting, 'Q');
  assert(Math.hypot(actual.indicator.target.x - setup.points.enemy.worldX, actual.indicator.target.y - setup.points.enemy.worldY) < 1, 'Screen-relative drag aimed in the wrong world direction');
  await screenshot(mobile, 'mobile-drag-preview');
  await touch(session, 'touchEnd');
  castOccurred(await state(mobile), setup, 'Q', 'enemy');
  passed('drag preview follows the finger direction and release damages the intended enemy');

  setup = await fixture(mobile);
  const joystick = await center(mobile, '.v-joystick-base');
  const moving = { id: 20, x: joystick.x + 24, y: joystick.y };
  await touch(session, 'touchStart', [{ id: 20, ...joystick }]);
  await touch(session, 'touchMove', [moving]);
  await mobile.waitForTimeout(80);
  assert((await state(mobile)).joystick, 'First finger failed to hold movement');
  await touch(session, 'touchStart', [moving, { id: 21, ...q }]);
  // Release the skill pointer explicitly while the movement pointer stays held.
  await touch(session, 'touchEnd', [{ id: 21, ...q }]);
  actual = await state(mobile);
  castOccurred(actual, setup, 'Q', 'enemy');
  assert(actual.joystick, 'Releasing the skill finger cancelled joystick movement');
  assert(actual.commands.some(command => command.type === 'MOVE_TO'), 'Joystick did not dispatch movement');
  await screenshot(mobile, 'mobile-multitouch');
  await touch(session, 'touchEnd');
  assert(!(await state(mobile)).joystick, 'Final release left movement active');
  passed('two native touch pointers move and cast independently');

  await mobile.setViewportSize({ width: 390, height: 844 });
  setup = await fixture(mobile);
  await mobile.locator('#ability-q').tap();
  castOccurred(await state(mobile), setup, 'Q', 'enemy');
  await screenshot(mobile, 'portrait-tap-auto-aim');
  passed('portrait mobile tap retains assisted casting');
  await mobile.close();

  const assassin = await start('assassin', true);
  setup = await fixture(assassin, []);
  await assassin.locator('#ability-q').tap();
  actual = await state(assassin); unchanged(actual, setup);
  assert.equal(actual.targeting, null, 'No-target quick cast left the player stuck aiming');
  await screenshot(assassin, 'assassin-no-target');
  passed('assassin Q with no valid target spends no mana or cooldown');
  await assassin.close();

  const cleric = await start('cleric', true);
  setup = await fixture(cleric, [{ id: 'ally', team: 'allied', dx: 240, dy: 0, hp: 200 }, { id: 'enemy', dx: -100, dy: 0 }]);
  await cleric.locator('#ability-w').tap();
  actual = await state(cleric); castOccurred(actual, setup, 'W');
  assert(actual.hp.ally > setup.points.ally.hp, 'Cleric W missed the wounded ally');
  assert.equal(actual.hp.enemy, setup.points.enemy.hp, 'Healing W affected the enemy');
  await screenshot(cleric, 'cleric-assisted-heal');
  passed('cleric W chooses and heals a wounded ally despite a closer enemy');
  await cleric.close();

  assert.deepEqual(errors, [], 'Browser runtime exceptions');
  await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify({ baseURL, deployedAssets: !!process.env.TARGET_BASE_URL, passed: results, errors }, null, 2));
  console.log(`Screenshots and results: ${outputDir}`);
} catch (error) {
  const diagnostics = [];
  for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    await screenshot(page, `failure-${index}`).catch(() => {});
    diagnostics.push({ index, state: await state(page).catch(() => null), pointerEvents: await page.evaluate(() => window.__targetingPointerEvents).catch(() => null) });
  }
  await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify({ error: error.message, diagnostics }, null, 2));
  console.error(`Failure screenshots and diagnostics: ${outputDir}`);
  throw error;
} finally { await browser.close(); }
