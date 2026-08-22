const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
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
  
  // Click Inventory Dashboard
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const inventoryBtn = buttons.find(b => (b.textContent.includes('Inventory Dashboard') || b.textContent.includes('Inventory')) && !b.textContent.includes('Filter'));
    if (inventoryBtn) inventoryBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const h2Text = await page.evaluate(() => {
    const main = document.querySelector('main');
    const h2s = Array.from(main.querySelectorAll('h2')).map(h => h.textContent);
    return h2s;
  });
  console.log("H2s in main area:", h2Text);
  
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });
