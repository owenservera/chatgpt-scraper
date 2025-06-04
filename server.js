const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const scrapeScript = fs.readFileSync(path.join(__dirname, 'chatgpt.js'), 'utf8');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      ignoreHTTPSErrors: true,
      timeout: 30000
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set timeout for navigation
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Inject our scraping script
    await page.addScriptTag({ content: scrapeScript });

    // Execute scraping
    const result = await page.evaluate(async () => {
      try {
        return await scrapeChatGPT();
      } catch (e) {
        console.error('Scraping error:', e);
        return { error: 'Failed to scrape page content' };
      }
    });

    if (result.error) {
      throw new Error(result.error);
    }

    const { conversation_id, conversation_title, messages } = result;

    const response = {
      conversation_id,
      conversation_title: conversation_title || 'Untitled Conversation',
      messages,
      source_url: url,
      scraped_at: new Date().toISOString()
    };

    res.json(response);
    
  } catch (err) {
    console.error('Scrape failed:', err);
    res.status(500).json({ 
      error: 'Scrape failed',
      details: err.message 
    });
  } finally {
    if (browser) {
      await browser.close().catch(e => console.error('Error closing browser:', e));
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Scraper API running on port ${PORT}`));