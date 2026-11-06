// Run from repository root. PLAYWRIGHT_MODULE can point at an existing Playwright installation.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const outputDir = process.env.HUD_SCREENSHOT_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'moba-hud-'));
await fs.mkdir(outputDir, { recursive: true });
const errors = [], measurements = {};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const types = {'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const sizes = [[320,568],[390,844],[768,1024],[1024,768],[844,390],[1280,800],[1440,810]];
async function localFiles(route) {
  const url = new URL(route.request().url());
  // The solo UI test is offline; only the external PeerJS bootstrap is stubbed.
  if (url.hostname !== '127.0.0.1') return route.fulfill({body:'window.Peer = class {};',contentType:'application/javascript'});
  const file = path.join(process.cwd(), decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  try { await route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)] || 'application/octet-stream'}); }
  catch { await route.fulfill({status:404,body:'Missing file'}); }
}
async function start(hero = 'knight', viewport = {width:844,height:390}, touch = true) {
  const page = await browser.newPage({viewport, hasTouch:touch, isMobile:touch});
  await page.route('**/*', localFiles);
  page.on('pageerror', e=>errors.push(e.message));
  page.on('dialog', dialog=>dialog.dismiss());
  await page.goto('http://127.0.0.1:3000');
  await page.evaluate(()=>{window.__nativeTouchPointers=new Set();window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')window.__nativeTouchPointers.add(e.pointerId);},true);for(const name of ['pointerup','pointercancel'])window.addEventListener(name,e=>window.__nativeTouchPointers.delete(e.pointerId),true);});
  await page.getByRole('button', {name:/SELECIONAR HER/}).click();
  await page.locator(`[data-hero-id="${hero}"]`).click();
  await page.getByRole('button', {name:/ENTRAR NO CAMPO/}).click();
  await page.getByRole('button', {name:'Pular guia',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.ability-art img')].length === 4 && [...document.querySelectorAll('.ability-art img')].every(i=>i.complete && i.naturalWidth));
  return page;
}
const intersects = (a,b) => a.x < b.x+b.width-.5 && a.x+a.width > b.x+.5 && a.y < b.y+b.height-.5 && a.y+a.height > b.y+.5;
async function layout(page, label) {
  const viewport = page.viewportSize();
  const info = ['#minimap-container','.hud-match-score','.match-timer-container','#hud-objective','#boss-hud','.hud-hero-summary'];
  const actions = ['#btn-shop-toggle','.hud-info-panel > summary','.hud-settings-panel > summary','.v-joystick-base',
    '#ability-q','#ability-w','#ability-e','#ability-r','#ability-b','#mobile-attack-btn','#btn-upgrade-q','#btn-upgrade-w','#btn-upgrade-e','#btn-upgrade-r'];
  const boxes = {};
  for (const sel of [...info,...actions]) {
    const el=page.locator(sel);
    if(!await el.isVisible()) continue;
    const b=await el.boundingBox();
    assert(b && b.x>=-.5 && b.y>=-.5 && b.x+b.width<=viewport.width+.5 && b.y+b.height<=viewport.height+.5, `${label}: ${sel} offscreen ${JSON.stringify(b)}`);
    if(actions.includes(sel)) {
      assert(b.width>=44 && b.height>=44, `${label}: small touch target ${sel}`);
      assert(await el.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}), `${label}: covered ${sel}`);
    }
    for(const [other,rect] of Object.entries(boxes)) assert(!intersects(b,rect),`${label}: ${sel} overlaps ${other}`);
    boxes[sel]=b;
  }
  measurements[label]=boxes;
}
async function shop(page,width) {
  await page.locator('#btn-shop-toggle').click();
  await page.locator('.shop-item-card').first().click();
  const buy=page.locator('#buy-item-btn');
  await buy.scrollIntoViewIfNeeded();
  const b=await buy.boundingBox(), vp=page.viewportSize();
  assert(b.x>=0 && b.y>=0 && b.x+b.width<=vp.width && b.y+b.height<=vp.height, 'Buy action offscreen');
  await page.locator('#shop-close-btn').focus();
  await page.keyboard.press('Shift+Tab');
  assert(await buy.evaluate(el=>el===document.activeElement),'Shop focus escaped backwards');
  await page.keyboard.press('Tab');
  assert(await page.locator('#shop-close-btn').evaluate(el=>el===document.activeElement),'Shop focus escaped forwards');
  if(width===320 || width===844) await page.screenshot({path:path.join(outputDir,`shop-${width}.png`)});
  await page.getByRole('button',{name:'Fechar loja',exact:true}).click();
}
const touchSessions = new WeakMap();
async function sendPointer(page, type, id, x, y) {
  let session = touchSessions.get(page);
  if (!session) { session = await page.context().newCDPSession(page); touchSessions.set(page, session); }
  const eventType = {pointerdown:'touchStart',pointermove:'touchMove',pointercancel:'touchCancel'}[type];
  if(eventType==='touchCancel' && !await page.evaluate(()=>window.__nativeTouchPointers.size)) return;
  await session.send('Input.dispatchTouchEvent',{type:eventType,touchPoints:eventType==='touchCancel'?[]:[{id,x,y}]});
}

try {
  const page=await start();
  for(const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{const g=window.gameSim;g.camera.follow(g.playerHero);g.camera.recenter();g.camera.snapZoom(1.25);document.activeElement?.blur?.();});
    await page.waitForTimeout(100);
    await layout(page,`${width}x${height}`);
    await page.screenshot({path:path.join(outputDir,`hud-${width}x${height}.png`)});
    await page.locator('#minimap-canvas').tap();
    assert(!await page.evaluate(()=>window.gameSim.virtualJoystick.active),'Minimap starts movement');
    await page.locator('.hud-info-panel > summary').click();
    await page.locator('[data-zoom="in"]').scrollIntoViewIfNeeded();
    await page.locator('[data-zoom="out"]').click();
    await page.keyboard.press('Escape');
    assert(!await page.locator('.hud-info-panel').evaluate(el=>el.open),'Escape fails to close Partida');
    await page.locator('.hud-settings-panel > summary').click();
    await page.locator('#settings-reduce-motion').check();
    assert(await page.evaluate(()=>window.gameSim.helpUI.reducedMotion),'Motion preference not applied');
    await page.locator('#settings-reduce-motion').uncheck();
    await page.keyboard.press('Escape');
    await shop(page,width);
    console.log(`PASS layout ${width}x${height}: bounds, targets, layers, menu, settings and shop`);
  }
  // All four upgrades must fit, including the portrait tray.
  await page.evaluate(()=>{const h=window.gameSim.playerHero;h.level=6;h.skillPoints=4;});
  await page.setViewportSize({width:320,height:568});
  await page.waitForTimeout(80);
  await layout(page,'320x568-all-upgrades');
  await page.locator('#btn-upgrade-q').click();
  assert.equal(await page.evaluate(()=>window.gameSim.playerHero.abilities.Q.rank),1);
  await page.locator('#btn-upgrade-w').click();
  await page.locator('#btn-upgrade-e').click();
  await page.locator('#btn-upgrade-r').click();
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(80);
  // Real CDP multitouch: hold movement while tapping ATACAR with another finger.
  const session=await page.context().newCDPSession(page);
  let base=await page.locator('.v-joystick-base').boundingBox();
  const cx=base.x+base.width/2, cy=base.y+base.height/2;
  await page.evaluate(()=>{const g=window.gameSim;g.__attackCalls=0;g.__attack=g.virtualJoystick.handleTouchAttack.bind(g.virtualJoystick);g.virtualJoystick.handleTouchAttack=()=>{g.__attackCalls++;g.__attack();};g.__commands=[];g.__handle=g.handleCommand.bind(g);g.handleCommand=(c,...args)=>{g.__commands.push(c.type);return g.__handle(c,...args);};});
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:cx,y:cy}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:cx+25,y:cy}]});
  await page.waitForTimeout(100);
  assert(await page.evaluate(()=>window.gameSim.virtualJoystick.active),'Joystick not held');
  const attack=await page.locator('#mobile-attack-btn').boundingBox();
  const ax=attack.x+attack.width/2,ay=attack.y+attack.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:cx+25,y:cy},{id:2,x:ax,y:ay}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{id:2,x:ax,y:ay}]});
  assert(await page.evaluate(()=>window.gameSim.virtualJoystick.active),'Second finger cancels movement');
  assert.equal(await page.evaluate(()=>window.gameSim.__attackCalls),1,'Second finger must attack exactly once');
  const q=await page.locator('#ability-q').boundingBox();
  const qx=q.x+q.width/2,qy=q.y+q.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:cx+25,y:cy},{id:3,x:qx,y:qy}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{id:3,x:qx,y:qy}]});
  assert(await page.evaluate(()=>window.gameSim.playerHero.abilities.Q.cooldownRemaining>0),'Second finger did not cast the skill');
  assert(!await page.evaluate(()=>!!window.gameSim.input.targetingState),'Assisted touch cast left a preview active');
  assert(await page.evaluate(()=>window.gameSim.virtualJoystick.active),'Casting with the second finger cancels movement');
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:cx+150,y:cy-100}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(!await page.evaluate(()=>window.gameSim.virtualJoystick.active),'Release outside leaves joystick active');
  assert(await page.evaluate(()=>window.gameSim.__commands.includes('MOVE_TO') && window.gameSim.__commands.includes('STOP')),'Movement/stop commands missing');
  await page.evaluate(()=>{const g=window.gameSim;g.handleCommand=g.__handle;});
  // Cancel, rotation and opening windows stop an active gesture.
  for(const cancel of ['pointercancel','blur','rotate','shop','menu','guide']) {
    base=await page.locator('.v-joystick-base').boundingBox();
    await sendPointer(page,'pointerdown',7,base.x+base.width/2,base.y+base.height/2);
    await sendPointer(page,'pointermove',7,base.x+base.width,base.y+base.height/2);
    if(cancel==='pointercancel') await sendPointer(page,'pointercancel',7,0,0);
    if(cancel==='blur') await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    if(cancel==='rotate') {await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);}
    if(cancel==='shop') {await page.locator('#btn-shop-toggle').click();await page.getByRole('button',{name:'Fechar loja',exact:true}).click();}
    if(cancel==='menu') {await page.locator('.hud-info-panel > summary').click();await page.keyboard.press('Escape');}
    if(cancel==='guide') {await page.evaluate(()=>window.gameSim.helpUI.open());await page.getByRole('button',{name:'Pular guia',exact:true}).click();}
    assert(!await page.evaluate(()=>window.gameSim.virtualJoystick.active),`Movement survives ${cancel}`);
    await sendPointer(page,'pointercancel',7,0,0);
  }
  // Exercise buying and selling through native UI; setup only changes fixture resources/location.
  await page.evaluate(()=>{const g=window.gameSim;g.playerHero.x=400;g.playerHero.y=400;g.playerHero.gold=1200;g.playerHero.moveTarget=null;g.playerHero.abilities.Q.cooldownRemaining=0;});
  await page.locator('#btn-shop-toggle').click();
  await page.locator('.shop-item-card').first().click();
  const goldBefore=await page.evaluate(()=>window.gameSim.playerHero.gold);
  await page.locator('#buy-item-btn').click();
  assert((await page.evaluate(()=>window.gameSim.playerHero.gold))<goldBefore,'Purchase does not debit gold');
  await page.getByRole('button',{name:'Fechar loja',exact:true}).click();
  await page.locator('.hud-info-panel > summary').click();
  await page.locator('.inv-slot').first().click();
  assert(await page.locator('#sell-item-btn').isEnabled(),'Equipped item cannot be sold');
  await page.locator('#sell-item-btn').click();
  assert(await page.evaluate(()=>!window.gameSim.playerHero.inventoryInstance.getItem(0)),'Sale leaves item equipped');
  await page.getByRole('button',{name:'Fechar loja',exact:true}).click();
  await page.evaluate(()=>{window.gameSim.playerHero.gold=0;});
  await page.locator('#btn-shop-toggle').click();await page.locator('.shop-item-card').first().click();
  assert(await page.locator('#buy-item-btn').isDisabled(),'Insufficient gold does not disable buy');
  await page.evaluate(()=>{const h=window.gameSim.playerHero;h.gold=5000;h.x=1800;h.y=1800;});
  await page.waitForFunction(()=>document.querySelector('#buy-item-btn')?.textContent.includes('Fora'));
  assert(await page.locator('#buy-item-btn').isDisabled(),'Outside base permits purchase');
  await page.evaluate(()=>{const h=window.gameSim.playerHero;h.x=400;h.y=400;const inv=h.inventoryInstance;while(!inv.isFull()) {const r=inv.addItem('item_dagger');if(!r.success)break;}});
  assert.equal(await page.evaluate(()=>window.gameSim.playerHero.inventoryInstance.getEquippedItems().length),6,'Fixture did not fill inventory');
  // Assert the UI refuses an extra item.
  const count=await page.evaluate(()=>window.gameSim.playerHero.inventoryInstance.getEquippedItems().length);
  await page.locator('.shop-item-card').first().click();
  if(await page.locator('#buy-item-btn').isEnabled()) await page.locator('#buy-item-btn').click();
  const newCount=await page.evaluate(()=>window.gameSim.playerHero.inventoryInstance.getEquippedItems().length);
  assert(newCount<=6 && (count<6 || newCount===count),'Inventory exceeds capacity');
  await page.getByRole('button',{name:'Fechar loja',exact:true}).click();
  console.log('PASS touch lifecycle, multitouch, upgrade, purchase, sale and resource boundaries');
  await page.close();
  // Each hero uses its own atlas and displays all the skill states with real controller updates.
  for(const hero of ['knight','sorceress','ranger','assassin','cleric']) {
    const p=await start(hero);
    assert(await p.locator('#ability-q .ability-art img').evaluate((el,id)=>el.src.endsWith(`/abilities/${id}.png`),hero),'Wrong hero atlas');
    assert(await p.locator('#ability-q').getAttribute('aria-disabled')==='true','Unlearned skill should be disabled');
    await p.locator('#btn-upgrade-q').click();
    await p.evaluate(()=>{const g=window.gameSim;g.playerHero.mana=g.playerHero.maxMana;g.playerHero.abilities.Q.cooldownRemaining=0;g.hud.update(g.playerHero,g.getState(),g.input);});
    assert((await p.locator('#ability-q').getAttribute('aria-label')).includes('Pronta'),'Learned skill not ready');
    await p.locator('#ability-q').click();
    const targeting=await p.evaluate(()=>!!window.gameSim.input.targetingState);
    assert(targeting,'Ground/directional Q did not enter targeting');
    await p.keyboard.press('Escape');
    await p.evaluate(()=>{const g=window.gameSim;g.playerHero.mana=0;g.hud.update(g.playerHero,g.getState(),g.input);});
    assert((await p.locator('#ability-q').getAttribute('aria-label')).includes('Mana insuficiente'),'Mana state missing');
    await p.evaluate(()=>{const g=window.gameSim;g.playerHero.mana=g.playerHero.maxMana;g.playerHero.abilities.Q.cooldownRemaining=3;g.hud.update(g.playerHero,g.getState(),g.input);});
    assert((await p.locator('#ability-q').getAttribute('aria-label')).includes('recarga'),'Cooldown state missing');
    await p.evaluate(()=>{const g=window.gameSim;g.playerHero.hp=0;g.playerHero.respawnTimer=5;g.hud.update(g.playerHero,g.getState(),g.input);});
    assert(await p.locator('#death-timer-overlay').isVisible(),'Death feedback missing');
    await p.evaluate(()=>{const g=window.gameSim;g.playerHero.hp=g.playerHero.maxHp;g.playerHero.respawnTimer=0;g.playerHero.abilities.Q.cooldownRemaining=0;g.hud.update(g.playerHero,g.getState(),g.input);});
    await p.locator('#ability-b').click();
    assert(await p.evaluate(()=>window.gameSim.playerHero.isRecalling),'Recall button does not channel');
    await p.screenshot({path:path.join(outputDir,`hero-${hero}.png`)});
    await p.close();console.log(`PASS hero ${hero}: atlas, learning, aim, mana, cooldown, death and recall`);
  }
  const desktop=await start('knight',{width:1440,height:810},false);
  for(const width of [320,768,1024,1440]) {
    await desktop.setViewportSize({width,height:810});await desktop.waitForTimeout(80);
    await layout(desktop,`desktop-${width}`);
    assert(!await desktop.locator('.v-joystick-base').isVisible(),'Desktop joystick visible');
    assert(await desktop.locator('#mobile-attack-btn').isVisible(),'Desktop attack button missing');
  }
  // Art failure retains the fallback symbol, key label and accessible description.
  await desktop.route('**/assets/ui/abilities/knight.png*', route=>route.fulfill({status:404,body:''}));
  await desktop.locator('.ability-art img').evaluateAll(imgs=>imgs.forEach(img=>{img.src += '?test-missing=1';}));
  await desktop.waitForFunction(()=>!document.querySelector('#ability-q .ability-art'));
  assert(await desktop.locator('#ability-q .ability-icon').isVisible(),'Art fallback missing');
  assert(await desktop.locator('#ability-q').getAttribute('aria-label'),'Skill lacks accessible name');
  console.log('PASS desktop, keyboard access and missing-art fallback');
  assert.deepEqual(errors,[],'Runtime exceptions');
  await fs.writeFile(path.join(outputDir,'measurements.json'),JSON.stringify(measurements,null,2));
  console.log(`Screenshots and measured geometry: ${outputDir}`);
} finally { await browser.close(); }
