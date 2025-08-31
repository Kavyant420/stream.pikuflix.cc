// server.js
import express from "express";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static test page
app.use(express.static(path.join(__dirname, "public")));

// Proxy route
app.get("/proxy", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing ?url=");

    // Fetch the remote page
    const response = await fetch(url);
    let html = await response.text();

    // Parse and clean ads
    const dom = new JSDOM(html);
    const { document } = dom.window;

    // Remove ads (scripts, iframes, divs with 'ad' in id/class)
    document.querySelectorAll("script, iframe, .ad, [id*='ad'], [class*='ad']").forEach(el => el.remove());

    // Return cleaned HTML
    res.send(dom.serialize());
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Ad-free proxy running on http://localhost:${PORT}`));
