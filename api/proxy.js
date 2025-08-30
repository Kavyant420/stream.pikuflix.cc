// Install: npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth puppeteer-extra-plugin-recaptcha
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configure stealth plugin with all evasions
puppeteer.use(StealthPlugin({
  enabledEvasions: new Set([
    'chrome.app',
    'chrome.csi',
    'chrome.loadTimes',
    'chrome.runtime',
    'defaultArgs',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.hardwareConcurrency',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.webdriver',
    'sourceurl',
    'user-agent-override',
    'webgl.vendor',
    'window.outerdimensions'
  ])
}));

export default async function handler(req, res) {
  const targetUrl = req.query.url || 'https://vidsrc.cc/v2/embed/movie/550';
  let browser;

  // Set longer timeout for Vercel
  res.setTimeout(60000);

  try {
    console.log('Starting browser for URL:', targetUrl);
    
    browser = await puppeteer.launch({
      headless: 'new',
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--window-size=1920,1080',
        '--start-maximized'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();
    
    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock chrome object
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // Override the plugins property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return [1, 2, 3, 4, 5];
        },
      });
      
      // Override the languages property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: function() {
          return ['en-US', 'en'];
        },
      });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // Set realistic viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    });

    console.log('Navigating to page...');
    
    // Navigate with multiple strategies
    const navigationPromise = page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    await navigationPromise;
    console.log('Initial navigation complete');

    // Wait for Cloudflare challenge to potentially appear and resolve
    console.log('Waiting for Cloudflare challenge...');
    
    try {
      // First check if we're on a challenge page
      const isChallengeActive = await page.evaluate(() => {
        return document.body.innerHTML.includes('Checking your browser') ||
               document.body.innerHTML.includes('Please wait') ||
               document.body.innerHTML.includes('Cloudflare') ||
               document.querySelector('.cf-browser-verification') !== null;
      });

      if (isChallengeActive) {
        console.log('Cloudflare challenge detected, waiting for resolution...');
        
        // Wait for the challenge to complete (up to 30 seconds)
        await page.waitForFunction(
          () => {
            return !document.body.innerHTML.includes('Checking your browser') &&
                   !document.body.innerHTML.includes('Please wait') &&
                   !document.querySelector('.cf-browser-verification') &&
                   (document.querySelector('iframe') !== null || 
                    document.querySelector('video') !== null ||
                    document.body.innerHTML.length > 5000);
          },
          { timeout: 30000 }
        );
        
        console.log('Challenge appears to be resolved');
      }

      // Additional wait for content to load
      await page.waitForTimeout(5000);
      
      // Try to wait for video content
      try {
        await Promise.race([
          page.waitForSelector('iframe', { timeout: 10000 }),
          page.waitForSelector('video', { timeout: 10000 }),
          page.waitForTimeout(10000)
        ]);
      } catch (e) {
        console.log('No video elements found, proceeding anyway');
      }

    } catch (waitError) {
      console.log('Wait timeout, but proceeding:', waitError.message);
    }

    // Get final page content
    const content = await page.content();
    const finalUrl = page.url();
    
    console.log('Final URL:', finalUrl);
    console.log('Content length:', content.length);

    // Check if we still have a challenge page
    if (content.includes('Checking your browser') || 
        content.includes('cf-browser-verification') ||
        content.length < 1000) {
      throw new Error('Cloudflare challenge not resolved');
    }

    // Set response headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Final-URL', finalUrl);

    console.log('Success! Returning content');
    res.status(200).send(content);

  } catch (err) {
    console.error('Puppeteer bypass error:', err.message);
    
    // Try one more time with different strategy
    if (browser && !err.message.includes('second attempt')) {
      try {
        console.log('Attempting second strategy...');
        const page2 = await browser.newPage();
        
        await page2.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page2.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        await page2.waitForTimeout(10000);
        
        const content2 = await page2.content();
        if (content2.length > 1000 && !content2.includes('Checking your browser')) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.status(200).send(content2);
        }
      } catch (secondErr) {
        console.log('Second attempt also failed:', secondErr.message);
      }
    }

    res.status(503).json({
      error: 'Cloudflare bypass failed',
      message: `Unable to bypass Cloudflare protection: ${err.message}`,
      url: targetUrl,
      timestamp: new Date().toISOString()
    });

  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Error closing browser:', closeErr.message);
      }
    }
  }
    }
