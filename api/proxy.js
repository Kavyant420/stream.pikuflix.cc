import fetch from "node-fetch";

// Helper function to extract challenge parameters
function extractChallengeParams(html) {
  const challengeMatch = html.match(/name="cf-turnstile-response"/);
  const rayIdMatch = html.match(/data-ray="([^"]+)"/);
  const sitekeyMatch = html.match(/data-sitekey="([^"]+)"/);
  
  return {
    hasChallenge: !!challengeMatch,
    rayId: rayIdMatch ? rayIdMatch[1] : null,
    sitekey: sitekeyMatch ? sitekeyMatch[1] : null
  };
}

// Clean URL by removing Cloudflare challenge parameters
function cleanUrl(url) {
  const urlObj = new URL(url);
  // Remove Cloudflare challenge parameters
  urlObj.searchParams.delete('__cf_chl_rt_tk');
  urlObj.searchParams.delete('__cf_chl_captcha_tk__');
  urlObj.searchParams.delete('__cf_chl_jschl_tk__');
  urlObj.searchParams.delete('__cf_chl_f_tk');
  return urlObj.toString();
}

export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: "Missing ?url parameter" });
  }

  // Clean the URL first
  const cleanedUrl = cleanUrl(targetUrl);
  
  try {
    // First attempt with basic headers
    let response = await fetch(cleanedUrl, {
      method: 'GET',
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "iframe", // Important for embeds
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Upgrade-Insecure-Requests": "1",
        "DNT": "1"
      },
      timeout: 30000,
    });

    let data = await response.text();
    
    // Check if we got a Cloudflare challenge
    const challengeInfo = extractChallengeParams(data);
    
    if (challengeInfo.hasChallenge || data.includes('Checking your browser') || data.includes('__cf_chl_rt_tk')) {
      console.log('Cloudflare challenge detected, attempting bypass...');
      
      // Wait a moment and try again with different approach
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try with more specific headers for the embed
      response = await fetch(cleanedUrl, {
        method: 'GET',
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Referer": "https://vidsrc.cc/", // Set appropriate referer
          "Origin": "https://vidsrc.cc",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "iframe",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site",
          "X-Requested-With": "XMLHttpRequest" // Sometimes helps with embeds
        },
        timeout: 30000,
      });
      
      data = await response.text();
    }

    // Check if still blocked
    if (data.includes('__cf_chl_rt_tk') || data.includes('Checking your browser')) {
      return res.status(503).json({
        error: "Cloudflare challenge still active",
        message: "The target site is protected by Cloudflare. Try using a browser-based solution.",
        originalUrl: targetUrl,
        cleanedUrl: cleanedUrl
      });
    }

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
    
    // Set appropriate content type
    const contentType = response.headers.get('content-type') || 'text/html';
    res.setHeader('Content-Type', contentType);

    // If it's HTML, modify it to remove any remaining challenge scripts
    if (contentType.includes('text/html')) {
      // Remove Cloudflare challenge scripts and meta tags
      data = data.replace(/<script[^>]*cf-chl[^>]*>[\s\S]*?<\/script>/gi, '');
      data = data.replace(/<meta[^>]*cf-chl[^>]*>/gi, '');
      data = data.replace(/window\.__CF\$cv\$params[\s\S]*?<\/script>/gi, '</script>');
    }

    res.status(200).send(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ 
      error: `Proxy failed: ${err.message}`,
      url: targetUrl 
    });
  }
}
