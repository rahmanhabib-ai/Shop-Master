const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('error', err => console.log('PAGE CRASH:', err.message));
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });
