// End-to-end test of the REAL extension in a real Chromium.
// Websites are replaced by generated fixture pages (context.route), so the whole flow runs for real:
// popup reads the "El Al" tab -> background opens 7 comparison tabs -> pagelib extracts -> popup shows rows
// -> clicking a row opens the site and highlights the price.
// (The live El Al site blocks automated browsers/datacenter IPs with "access denied", so it can't be used here.)
// Run:  node tests/e2e.js      (needs playwright with Chromium)
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");
const { FMT, T } = require("./templates");

const SRC = path.join(__dirname, "../flight-finder");
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "e2e-"));
const EXT = path.join(OUT, "ext");
fs.cpSync(SRC, EXT, { recursive: true });
// Test copy only: grant the El Al fixture host (in real use the toolbar click grants it via activeTab).
const mf = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
mf.host_permissions.push("https://booking.elal.com/*");
fs.writeFileSync(path.join(EXT, "manifest.json"), JSON.stringify(mf, null, 1));

const DEST = process.env.DEST || "CDG";
const usd = FMT.usd1;
// cheapest fare per comparison site (all different, so mixing sites up would be noticed)
const SITES = {
  "www.google.com": { name: "Google Flights", tpl: T.google, cheapest: 181 },
  "www.skyscanner.co.il": { name: "Skyscanner", tpl: T.skyscanner, cheapest: 164 },
  "www.kayak.com": { name: "Kayak", tpl: T.kayak, cheapest: 172 },
  "www.momondo.com": { name: "Momondo", tpl: T.kayak, cheapest: 176 },
  "www.expedia.com": { name: "Expedia", tpl: T.expedia, cheapest: 190 },
  "flights.booking.com": { name: "Booking.com", tpl: T.booking, cheapest: 158 },
  "www.trip.com": { name: "Trip.com", tpl: T.trip, cheapest: 149 },
};
const fares = (c) => [c, c + 30, c + 77, c + 140];

// El Al-like page (Hebrew, modelled on the user's screenshot): one card per flight, several fare columns.
const ELAL_HTML = `<body dir="rtl" style="font-family:Arial">
  <div class="hdr">עריכה &nbsp; 1 &nbsp; 15 דצמ - 18 דצמ &nbsp; הלוך-חזור &nbsp; <b>TLV</b> ✈ <b>${DEST}</b></div>
  <div class="note">תשומת ליבך: המחיר המוצג יכול להשתנות עד למועד השלמת הזמנתך</div>
  <h2>הלוך תל אביב ✈ פריז</h2><div>15 דצמבר 2026</div>
  <div class="strip"><span>שבת 12 דצמבר</span><span>ראשון 13 דצמבר</span><span>שלישי 15 דצמבר</span></div>
  ${[[832, "-", 165], [1139, 701, 210], [969, "-", 165]].map(([a, b, c], i) => `
  <div class="card"><div>${["09:45", "13:00", "15:15"][i]} ${DEST}</div><div>טיסה ישירה 05h 10m</div><div>${["05:35", "09:00", "11:05"][i]} TLV</div>
    <div>עסקים $${a.toLocaleString("en-US")}</div><div>פרימיום ${b === "-" ? "-" : "$" + b}</div><div>תיירים $${c}</div></div>`).join("")}</body>`;

const DAY = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

(async () => {
  // Local HTTPS server standing in for all the websites; Chrome is told to resolve those hostnames to it.
  const key = path.join(OUT, "k.pem"), crt = path.join(OUT, "c.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore" });
  const hits = [];
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(crt) }, (req, res) => {
    const host = (req.headers.host || "").split(":")[0];
    if (host === "booking.elal.com" && req.url.startsWith("/booking")) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(ELAL_HTML); }
    const s = SITES[host];
    if (s && !/favicon/.test(req.url)) {
      hits.push(host + req.url);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(`<body style="font-family:Arial">${s.tpl(fares(s.cheapest), usd, DEST).html}</body>`);
    }
    res.writeHead(204); res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const hostRules = [...Object.keys(SITES), "booking.elal.com"].map((h) => `MAP ${h} 127.0.0.1:${port}`).join(",");
  const ctx = await chromium.launchPersistentContext(path.join(OUT, "profile"), {
    channel: "chromium", headless: true, viewport: { width: 1100, height: 900 }, locale: process.env.LOCALE || "en-US",
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--host-resolver-rules=${hostRules}`, "--ignore-certificate-errors", "--no-proxy-server"],
  });

  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 20000 }));
  const extId = new URL(sw.url()).host;
  check("extension loaded", /^[a-p]{32}$/.test(extId), extId);

  // 1) "El Al" results page
  const elal = await ctx.newPage();
  await elal.goto("https://booking.elal.com/booking/flights?from=TLV&to=" + DEST);
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://booking.elal.com/*" }))[0].id);

  if (process.env.DEBUG_E2E) {
    console.log("  tabId", tabId, "scripting test:", JSON.stringify(await sw.evaluate(async (id) => { try { return await chrome.scripting.executeScript({ target: { tabId: id }, func: () => document.title + "|" + document.body.innerText.length }); } catch (e) { return String(e); } }, tabId)));
    console.log("  tabs:", JSON.stringify(await sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => [t.id, t.url]))));
  }
  // 2) open the popup pointed at that tab
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 380, height: 900 });
  pop.on("pageerror", (e) => console.log("  [popup pageerror]", e.message));
  pop.on("console", (m) => m.type() === "error" && console.log("  [popup console]", m.text()));
  await pop.goto(`chrome-extension://${extId}/popup.html?tabId=${tabId}`);
  await pop.waitForFunction(() => document.getElementById("status").textContent.length > 0, null, { timeout: 15000 }).catch(async (e) => { console.log("  popup state:", JSON.stringify(await pop.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 200), lang: document.documentElement.lang, scripts: [...document.scripts].map((x) => x.src.split("/").pop()), parse: typeof parsePage, t: typeof t, msg: chrome.i18n.getMessage("appTitle"), ui: chrome.i18n.getUILanguage() })))); throw e; });
  const v = await pop.evaluate(() => ({ from: from.value, to: to.value, dep: dep.value, ret: ret.value, cur: document.getElementById("cur").textContent.trim(), hidden: document.getElementById("cur").hidden }));
  check("reads origin from El Al page", v.from === "TLV", v.from);
  check("reads destination from El Al page", v.to === DEST, v.to);
  check("reads Hebrew dates (15 דצמ - 18 דצמ)", v.dep === "2026-12-15" && v.ret === "2026-12-18", `${v.dep} → ${v.ret}`);
  check("reads cheapest page price ($165, not the $832 business fare)", !v.hidden && /\$165\b/.test(v.cur), v.cur);

  // 3) run the comparison
  await pop.click("#go");
  await pop.waitForFunction((n) => document.querySelectorAll(".site").length === n && !document.querySelector(".site.loading"), Object.keys(SITES).length, { timeout: 120000 });
  const rows = await pop.evaluate(() => [...document.querySelectorAll(".site")].map((a) => ({ name: a.querySelector("b").textContent, price: (a.querySelector(".price") || {}).textContent || null, cls: a.className })));
  for (const s of Object.values(SITES)) {
    const r = rows.find((x) => x.name === s.name);
    check(`${s.name}: price ${usd(s.cheapest)}`, !!r && r.price === usd(s.cheapest), r ? r.price || r.cls : "row missing");
  }
  const best = await pop.evaluate(() => document.querySelector(".site.best b")?.textContent);
  const expectedBest = Object.values(SITES).sort((a, b) => a.cheapest - b.cheapest)[0].name;
  check(`marks cheapest = ${expectedBest}`, best === expectedBest, best);
  check("no comparison tab left open", ctx.pages().filter((p) => /skyscanner|kayak|momondo|expedia|booking\.com|trip\.com|google\.com/.test(p.url())).length === 0);
  // every site must have been queried with the right route, dates and passenger count
  const want = {
    "www.google.com": new RegExp(`/travel/flights\\?q=Flights from TLV to ${DEST} on 2026-12-15 through 2026-12-18`),
    "www.skyscanner.co.il": new RegExp(`/transport/flights/TLV/${DEST}/261215/261218/\\?adultsv2=1&currency=USD`),
    "www.kayak.com": new RegExp(`/flights/TLV-${DEST}/2026-12-15/2026-12-18/1adults\\?currency=USD`),
    "www.momondo.com": new RegExp(`/flight-search/TLV-${DEST}/2026-12-15/2026-12-18/1adults\\?currency=USD`),
    "www.expedia.com": new RegExp(`leg1=from:TLV,to:${DEST},departure:12/15/2026TANYT&leg2=from:${DEST},to:TLV,departure:12/18/2026TANYT&passengers=adults:1`),
    "flights.booking.com": new RegExp(`TLV\\.AIRPORT-${DEST}\\.AIRPORT/\\?type=ROUNDTRIP&adults=1.*depart=2026-12-15&return=2026-12-18`),
    "www.trip.com": new RegExp(`dcity=tlv&acity=${DEST.toLowerCase()}&ddate=2026-12-15&rdate=2026-12-18&triptype=rt&class=y&quantity=1&curr=USD`),
  };
  for (const [host, re] of Object.entries(want)) {
    const mine = hits.map((x) => decodeURIComponent(x)).filter((x) => x.startsWith(host)); // Chrome itself also pings google.com
    const h = mine.find((x) => re.test(x));
    check(`${SITES[host].name}: request URL has route/dates/passengers`, !!h, h ? "" : mine.length ? "got: " + mine.join(" | ").slice(0, 200) : "never requested");
  }
  await pop.screenshot({ path: path.join(OUT, "popup-results.png"), fullPage: true });

  // 4) click a row -> site opens, price highlighted
  const [site] = await Promise.all([ctx.waitForEvent("page", { timeout: 20000 }), pop.click('a.site:has-text("Skyscanner")')]);
  await site.waitForSelector("text=Price read by the extension", { timeout: 30000 }).catch(() => {});
  const hl = await site.evaluate(() => {
    const tag = [...document.querySelectorAll("div")].find((d) => /Price read by the extension/.test(d.textContent) && d.style.position === "fixed");
    const el = [...document.querySelectorAll("*")].find((e) => e.style.outline && /solid/.test(e.style.outline));
    return { tag: tag && tag.textContent, el: el && el.textContent.trim() };
  });
  check("click opens site and shows highlight label with the price", !!hl.tag && /\$164/.test(hl.tag), hl.tag || "no label");
  check("highlighted element is the $164 flight price", !!hl.el && /\$164/.test(hl.el) && !/Hotels|per night|Car rental/.test(hl.el), hl.el || "none");
  await site.screenshot({ path: path.join(OUT, "site-highlight.png") });

  // 5) reset
  await pop.bringToFront();
  await pop.click("#reset");
  await DAY(500);
  const afterReset = await pop.evaluate(() => ({ rows: document.querySelectorAll(".site").length, dep: dep.value || "(re-read)" }));
  check("reset clears results", afterReset.rows === 0);

  await ctx.close();
  server.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed. Output: ${OUT}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("E2E ERROR:", e); process.exit(2); });
