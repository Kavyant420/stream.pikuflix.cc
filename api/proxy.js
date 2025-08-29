import fetch from "node-fetch";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send("No URL provided");
  }

  try {
    // Fetch the original iframe page
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36",
      },
    });

    let body = await response.text();

    // Load into cheerio
    const $ = cheerio.load(body);

    // Remove ads/popups
    $("script[src*='ads']").remove();
    $("script:contains('popunder')").remove();
    $("iframe[src*='ads']").remove();
    $("div[class*='ad']").remove();
    $("a[target='_blank']").remove();

    res.setHeader("Content-Type", "text/html");
    res.send($.html());
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching content");
  }
}
