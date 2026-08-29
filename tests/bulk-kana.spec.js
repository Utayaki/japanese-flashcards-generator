const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8000/');
  await page.getByRole('textbox', { name: 'Japanese text input' }).click();
  await page.getByRole('textbox', { name: 'Japanese text input' }).fill('終らせない');

  // ---------------------
  await context.close();
  await browser.close();
})();