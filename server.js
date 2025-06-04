const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const scrapeScript = fs.readFileSync(path.join(__dirname, 'chatgpt.js'), 'utf8');

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('https://chatgpt.com/share/')) {
    return res.status(400).json({ error: 'Invalid or missing ChatGPT share URL' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.addScriptTag({ content: scrapeScript });

    const result = await page.evaluate(async () => {
      return await scrapeChatGPT();
    });

    await browser.close();
    res.json(result);
  } catch (err) {
    console.error('Scrape failed:', err);
    res.status(500).json({ error: 'Scrape failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scraper API running on port ${PORT}`));
