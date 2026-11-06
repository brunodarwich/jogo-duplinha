// Verify deployed bytes and exercise the public site without substituting application assets.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const site='https://jogo-duplinha-blush.vercel.app';
const paths=['index.html','src/ui/hud.css','src/ui/hud.js','src/ui/ability_art.js','src/ui/touch_button.js','src/ui/virtual_joystick.js',...['knight','sorceress','ranger','assassin','cleric'].map(id=>`assets/ui/abilities/${id}.png`)];
for(const file of paths) {
  const response=await fetch(`${site}/${file}?release=4df027d`);
  assert.equal(response.status,200,`${file}: HTTP ${response.status}`);
  const remote=Buffer.from(await response.arrayBuffer()), local=await fs.readFile(file);
  const digest=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(digest(remote),digest(local),`${file}: deployed bytes differ`);
  console.log(`PASS HTTP200 SHA256 ${file}`);
}
for(const file of ['output/ui-concepts/reference-approved.png','assets/ui/abilities/prompts.json']) {
  assert.equal((await fetch(`${site}/${file}`)).status,404,`Source artifact unexpectedly public: ${file}`);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const [width,height] of [[844,390],[390,844],[1280,800]]) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(site,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('button',{name:/SELECIONAR HER/}).click({timeout:45000});
    await page.getByRole('button',{name:/ENTRAR NO CAMPO/}).click();
    await page.getByRole('button',{name:'Pular guia',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.ability-art img')].length===4 && [...document.querySelectorAll('.ability-art img')].every(el=>el.complete&&el.naturalWidth));
    assert(await page.locator('.v-joystick-base').isVisible());
    assert(await page.locator('#boss-hud').isVisible());
    await page.locator('#btn-shop-toggle').click();
    await page.locator('.shop-item-card').first().click();
    assert(await page.locator('#buy-item-btn').isEnabled());
    await page.locator('#buy-item-btn').click();
    await page.getByRole('button',{name:'Fechar loja',exact:true}).click();
    assert.deepEqual(errors,[],`Runtime errors ${width}x${height}`);
    await page.screenshot({path:`output/ui-concepts/production-${width}x${height}.png`});
    console.log(`PASS production ${width}x${height}: solo match, illustrated HUD, joystick and item purchase; no pageerror`);
    await page.close();
  }
} finally {await browser.close();}
