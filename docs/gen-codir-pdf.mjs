import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'codir-recap.html');
const pdfPath = path.join(__dirname, 'codir-recap-numerique-responsable.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:7pt; color:#94a3b8; width:100%; padding:0 14mm; display:flex; justify-content:space-between; font-family:-apple-system,Segoe UI,sans-serif;">
    <span>Numérique Responsable — Recap CoDir</span>
    <span class="date"></span>
  </div>`,
  footerTemplate: `<div style="font-size:7pt; color:#94a3b8; width:100%; padding:0 14mm; display:flex; justify-content:space-between; font-family:-apple-system,Segoe UI,sans-serif;">
    <span>Document interne · Avril 2026</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`,
});

await browser.close();
console.log(`PDF généré : ${pdfPath}`);
