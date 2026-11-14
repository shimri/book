// Offline regression tests for flight-finder/pagelib.js.
// Pages are generated from templates MODELLED ON real result pages (Trip.com, Kayak, Skyscanner from user screenshots;
// the others are best guesses). Every page contains cheaper "trap" prices (alerts, tabs, filters, hotel/car ads).
// Run:  node tests/run.js        (needs playwright)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const LIB = fs.readFileSync(path.join(__dirname, "../flight-finder/pagelib.js"), "utf8");

const { FMT, CUR, RATE, DESTS, T } = require("./templates");

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1000, height: 800 } });
  let pass = 0;
  const fail = [];
  for (const [site, tpl] of Object.entries(T)) {
    for (const [d, base] of Object.entries(DESTS)) {
      for (const f of site === "splitSpans" ? ["usd1"] : Object.keys(FMT)) {
        const cur = CUR[f], r = RATE[cur];
        const cheapest = Math.round(base * r) + (site.length % 7);
        const fares = [cheapest, cheapest + Math.round(30 * r), cheapest + Math.round(77 * r), cheapest + Math.round(140 * r)];
        const { html } = tpl(fares, FMT[f], d);
        await page.setContent(`<body style="font-family:Arial">${html}</body>`);
        await page.addScriptTag({ content: LIB });
        const res = await page.evaluate(() => window.cf.extract(null));
        const hl = await page.evaluate(([p, c]) => { const x = window.cf.find(p, c, ""); return x ? x.el.textContent : null; }, [cheapest, cur]);
        const ok = res.min === cheapest && res.currency === cur && hl && hl.replace(/\D/g, "").includes(String(cheapest));
        if (ok) pass++; else fail.push(`${site} ${d} ${f}: expected ${cheapest} ${cur}, got ${res.min} ${res.currency} (highlight: ${hl})`);
      }
    }
  }
  // Negative: page with only traps (no flight cards) must return nothing, not a wrong price.
  await page.setContent(`<body>Price alerts Want a better deal? We'll notify you when the price drops below US$91. Recommended: US$91. Hotels from $112 per night. Dec 16 US$94 View</body>`);
  await page.addScriptTag({ content: LIB });
  const neg = await page.evaluate(() => window.cf.extract("USD"));
  if (neg.min === null) pass++; else fail.push(`negative page returned ${neg.min}`);
  // Bags: Basic card with "0" next to icons -> no/no; card with included bag -> yes/yes
  await page.setContent(`<body><div class=card><span aria-label="Carry-on bag">C</span> <span>0</span> <span aria-label="Checked bag">K</span> 11:05 am – 2:00 pm Wizz nonstop 3h 55m <b>$124</b> Basic</div>
    <div class=card>08:10 pm – 12:30 am Israir nonstop 3h 20m <span aria-label="1 checked bag included">K</span> Carry-on baggage included <b>$168</b></div></body>`);
  await page.addScriptTag({ content: LIB });
  const b1 = await page.evaluate(() => window.cf.bags(124, "USD", "")), b2 = await page.evaluate(() => window.cf.bags(168, "USD", ""));
  const bagOk = b1 && b2 && b1.checked.state === "no" && b1.carry.state === "no" && b2.checked.state === "yes" && b2.carry.state === "yes";
  if (bagOk) pass++; else fail.push(`bags: ${JSON.stringify([b1, b2])}`);
  await b.close();
  console.log(`passed ${pass}, failed ${fail.length}`);
  const by = {}; fail.forEach((x) => { const k = x.split(" ")[0]; by[k] = (by[k] || 0) + 1; }); console.log("failures by template:", JSON.stringify(by)); (process.env.SHOW ? fail : fail.slice(0, 6)).forEach((x) => console.log("  FAIL", x));
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
