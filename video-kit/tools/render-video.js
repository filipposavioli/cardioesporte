const { chromium } = require('playwright');
(async () => {
  const [,, html, outdir, dur, fps] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + require('path').resolve(html));
  await p.waitForTimeout(500);
  const n = Math.round(+dur * +fps);
  for (let i = 0; i < n; i++) {
    const t = i * 1000 / +fps;
    await p.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), t);
    await p.screenshot({ path: `${outdir}/f${String(i).padStart(4,'0')}.png` });
  }
  await b.close();
})();
