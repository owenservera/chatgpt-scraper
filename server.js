const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Check if chatgpt.js exists, if not create a basic version
let scrapeScript = '';
const scriptPath = path.join(__dirname, 'chatgpt.js');
if (fs.existsSync(scriptPath)) {
  scrapeScript = fs.readFileSync(scriptPath, 'utf8');
} else {
  // Basic scraping function if chatgpt.js is missing
  scrapeScript = `
    async function scrapeChatGPT() {
      try {
        const title = document.title || 'Untitled';
        const url = window.location.href;
        
        // Basic message extraction - you'll need to customize this
        const messages = [];
        const messageElements = document.querySelectorAll('[data-message-author-role], .message, .conversation-turn');
        
        messageElements.forEach((el, index) => {
          const text = el.innerText || el.textContent || '';
          if (text.trim()) {
            messages.push({
              role: el.getAttribute('data-message-author-role') || 'unknown',
              content: text.trim(),
              timestamp: new Date().toISOString()
            });
          }
        });
        
        return {
          conversation_id: url.split('/').pop() || 'unknown',
          conversation_title: title,
          messages: messages
        };
      } catch (error) {
        return { error: error.message };
      }
    }
  `;
}

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
    // Detect Chrome executable path
    const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                     
                      '/usr/bin/chromium-browser' ||
                      undefined;

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--single-process',
        '--memory-pressure-off',
        '--max-old-space-size=2048'
      ],
      executablePath: chromePath,
      ignoreHTTPSErrors: true,
      timeout: 30000
    });

    const page = await browser.newPage();
    
    // Set reasonable viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set timeout for navigation
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Inject our scraping script
    await page.addScriptTag({ content: scrapeScript });

    // Execute scraping
    const result = await page.evaluate(async () => {
      try {
        return await scrapeChatGPT();
      } catch (e) {
        console.error('Scraping error:', e);
        return { error: 'Failed to scrape page content: ' + e.message };
      }
    });

    if (result.error) {
      throw new Error(result.error);
    }

    const { conversation_id, conversation_title, messages } = result;

    const response = {
      conversation_id,
      conversation_title: conversation_title || 'Untitled Conversation',
      messages: messages || [],
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
      try {
        await browser.close();
      } catch (e) {
        console.error('Error closing browser:', e);
      }
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Scraper API running on port ${PORT}`));