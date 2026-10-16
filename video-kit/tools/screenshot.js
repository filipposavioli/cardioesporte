const { chromium } = require('playwright');
(async () => {
  const [,, html, out, w, h] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  await p.goto('file://' + require('path').resolve(html));
  await p.waitForTimeout(300);
  await p.screenshot({ path: out });
  await b.close();
})();
