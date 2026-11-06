const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const outDir = process.argv[3];
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, svg] of Object.entries(jobs)) {
    const size = Number(svg.match(/width="(\d+)"/)[1]);
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.locator('svg').screenshot({ path: `${outDir}/${name}`, omitBackground: true });
  }
  await b.close();
})();
