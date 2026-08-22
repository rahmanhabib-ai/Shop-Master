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
  const html = await page.content();
  console.log("Found Inventory Analytics Dashboard:", html.includes('Inventory Analytics Dashboard') || html.includes('ইনভেন্টরি ডেসবোর্ড'));
  if (!html.includes('Inventory Analytics Dashboard') && !html.includes('ইনভেন্টরি ডেসবোর্ড')) {
    console.log("Current HTML body subset:", html.substring(1000, 3000));
    console.log("Inventory button exists?", await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Inventory'))));
    console.log("Current active tab text:", await page.evaluate(() => {
       const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Inventory'));
       return b ? b.outerHTML : 'none';
    }));
  }
  
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });
