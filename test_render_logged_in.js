const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('error', err => console.log('PAGE CRASH:', err.message));
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  
  // Set localStorage to simulate logged in user
  await page.evaluate(() => {
    localStorage.setItem('user', JSON.stringify({
      id: 'test_user',
      email: 'stratproamz@gmail.com',
      role: 'admin',
      shopId: 'test_shop'
    }));
    localStorage.setItem('authChecked', 'true');
    localStorage.setItem('isOnboarded', 'true');
  });
  
  // Reload page to apply localStorage
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  
  const html = await page.content();
  console.log('HTML SNIPPET:', html.substring(0, 500));
  
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });
