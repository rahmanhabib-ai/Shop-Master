const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  
  await page.evaluate(() => {
    localStorage.setItem('shopmaster_user', JSON.stringify({
      uid: 'test_uid',
      email: 'stratproamz@gmail.com',
      role: 'admin',
      shopId: 'test_shop'
    }));
    localStorage.setItem('authChecked', 'true');
    localStorage.setItem('isOnboarded', 'true');
  });
  
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const inventoryBtn = buttons.find(b => (b.textContent.includes('Inventory Dashboard')));
    if (inventoryBtn) {
      console.log('Found button, clicking it:', inventoryBtn.className);
      inventoryBtn.click();
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });
