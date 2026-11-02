const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(300);
  await p.pdf({ path: process.argv[3], format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-family:Inter,sans-serif;font-size:7px;color:#5b6472;width:100%;padding:0 17mm;display:flex;justify-content:space-between"><span>SKL · SPIN Discovery memo · Source of truth</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '18mm', bottom: '20mm', left: '17mm', right: '17mm' } });
  await b.close();
})();
