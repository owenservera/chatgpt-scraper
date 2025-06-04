const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Installing Puppeteer browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    console.log('✅ Puppeteer installed successfully');
    await browser.close();
  } catch (error) {
    console.error('❌ Puppeteer installation failed:', error);
    process.exit(1);
  }
})();