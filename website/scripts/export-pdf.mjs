import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { chromium } from 'playwright';

const destination = resolve(process.argv[2] || '../output/pdf/agent-book.pdf');
const address = process.env.BOOK_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${address.replace(/\/$/, '')}/?page=print`);
  await page.locator('[data-print-ready="true"]').waitFor({ timeout: 120000 });
  if (errors.length) throw new Error(errors.join('\n'));
  await page.emulateMedia({ media: 'print' });
  await mkdir(dirname(destination), { recursive: true });
  await page.pdf({ path: destination, format: 'A4', preferCSSPageSize: true,
    printBackground: true, tagged: true, outline: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;text-align:center;font:9px Arial;color:#72776b"><span class="pageNumber"></span></div>',
  });
  console.log(`Exported ${await page.locator('.print-chapter').count()} chapters to ${destination}`);
} finally {
  await browser.close();
}
