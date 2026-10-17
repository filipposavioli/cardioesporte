const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const iv = JSON.parse(fs.readFileSync('intervals.json'));
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + require('path').resolve('overlay.html'));
  await p.waitForTimeout(500);
  for (const [name, [a, e]] of Object.entries(iv)) {
    if (only.length && !only.includes(name)) continue;
    const dir = `ov4/${name}`; fs.mkdirSync(dir, { recursive: true });
    await p.evaluate(n => document.querySelectorAll('section').forEach(s => s.style.display = s.id === n ? '' : 'none'), name);
    const f0 = Math.round(a * 30), f1 = Math.round(e * 30);
    for (let f = f0; f < f1; f++) {
      await p.evaluate(t => document.getAnimations().forEach(x => { x.pause(); x.currentTime = t; }), f * 1000 / 30);
      await p.screenshot({ path: `${dir}/f${String(f - f0).padStart(5, '0')}.png`, omitBackground: true });
    }
    console.log(name, f0, f1 - f0);
  }
  await b.close();
})();
