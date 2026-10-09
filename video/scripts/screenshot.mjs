// Ganzseitiger Mobil-Screenshot einer Demo-Seite für die Handy-Szene im Clip.
// Aufruf: node scripts/screenshot.mjs <demo-ordner> <ziel-ordner>
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [demo, out] = process.argv.slice(2);
const root = path.resolve("..");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
// feste Uhrzeit, damit der Status "geöffnet" zeigt (Fr 11:00)
// (nur Date verschieben – Timer/Animationen laufen normal weiter)
await page.addInitScript(() => {
  const offset = new Date("2026-10-09T11:00:00+02:00").getTime() - Date.now();
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { a.length ? super(...a) : super(RealDate.now() + offset); }
    static now() { return RealDate.now() + offset; }
  };
});
await page.goto(`http://localhost:${port}/${demo}/`, { waitUntil: "networkidle" });
// Banner "Unverbindlicher Entwurf" schließen und Scroll-Animationen auslösen
await page.evaluate(async () => {
  document.querySelectorAll("button").forEach((b) => { if (b.textContent.trim() === "×") b.click(); });
  for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);
// fixierte Leisten (Header, Aktionsleiste unten) würden im Ganzseiten-Shot mitten im Bild landen
await page.addStyleTag({ content: "*{scroll-behavior:auto!important}" });
await page.evaluate(() => {
  for (const el of document.querySelectorAll("body *")) {
    const pos = getComputedStyle(el).position;
    if ((pos === "fixed" || pos === "sticky") && el.getBoundingClientRect().top > 100) el.style.display = "none";
  }
});
await page.screenshot({ path: path.join(out, "site.png"), fullPage: true });
await browser.close();
server.close();
