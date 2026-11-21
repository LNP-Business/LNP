// node print_pdf.js page.html sortie.pdf "Titre" : imprime un mémo en A4 (Chromium, Playwright), numéros de page en pied
const { chromium } = require('playwright');
(async () => {
  const [src, out, title] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + src, { waitUntil: 'load' });
  await p.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true, headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:8px;width:100%;padding:0 16mm;color:#5A6478;display:flex;justify-content:space-between;font-family:sans-serif">' +
      '<span>LNP · ' + (title || '') + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
  await b.close();
})();
