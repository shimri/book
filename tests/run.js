// Offline regression tests for flight-finder/pagelib.js.
// Pages are generated from templates MODELLED ON real result pages (Trip.com, Kayak, Skyscanner from user screenshots;
// the others are best guesses). Every page contains cheaper "trap" prices (alerts, tabs, filters, hotel/car ads).
// Run:  node tests/run.js        (needs playwright)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const LIB = fs.readFileSync(path.join(__dirname, "../flight-finder/pagelib.js"), "utf8");

const FMT = {
  usd1: (n) => `$${n.toLocaleString("en-US")}`, usd2: (n) => `US$${n.toLocaleString("en-US")}`,
  eur1: (n) => `€${n.toLocaleString("de-DE")}`, eur2: (n) => `${n.toLocaleString("de-DE")} €`,
  ils1: (n) => `₪${n.toLocaleString("en-US")}`, ils2: (n) => `${n.toLocaleString("en-US")} ₪`,
  gbp: (n) => `£${n.toLocaleString("en-US")}`,
};
const CUR = { usd1: "USD", usd2: "USD", eur1: "EUR", eur2: "EUR", ils1: "ILS", ils2: "ILS", gbp: "GBP" };
const RATE = { USD: 1, EUR: 0.92, ILS: 3.7, GBP: 0.79 };
const DESTS = { CDG: 180, ROM: 120, LON: 150, NYC: 780, BKK: 640, DXB: 420, ATH: 130, BCN: 170 };
const AIRLINES = ["El Al", "Wizz Air", "Israir", "easyJet", "ITA Airways", "Air France", "Emirates"];

// Each template returns { html } for fare list `fares` (ascending, first = cheapest), money fn `$`.
const T = {
  trip: (fares, $, d) => ({
    html: `<h1>Tel Aviv – ${d}</h1><div class="tabs">${[1, 2, 3, 4].map((i) => `<div>Dec ${15 + i} <span>${$(fares[0] - 30)}</span> View</div>`).join("")}</div>
      <aside><h3>Airlines</h3>${AIRLINES.slice(0, 4).map((a, i) => `<label><input type=checkbox> ${a} (${i + 3}) <span>${$(fares[0] - 30 + i)}</span></label>`).join("")}
      <h3>Alliances</h3><label>Star Alliance <span>${$(fares[0] - 20)}</span></label></aside>
      ${fares.map((f, i) => `${i === 2 ? `<div class="alert"><b>Price alerts</b> Want a better deal? We'll notify you when the price drops below <span>${$(fares[0] - 3)}</span> High chances of success Recommended: ${$(fares[0] - 3)}</div>` : ""}
      <div class="card"><div>${AIRLINES[i % 4]}</div><div>16:50 TLV T3</div><div>5h 10m Nonstop</div><div>21:00 ${d} T2B</div><div><span>${$(f)}</span> <s>${$(f + 6)}</s> <button>Select</button></div></div>`).join("")}`,
  }),
  kayak: (fares, $, d) => ({
    html: `<div class="book"><b>Book now</b> We expect prices to rise ${$(130)} in the next 35 days <label>Track prices</label></div>
      <div class="tabs"><div>Cheapest ${$(fares[0])} 3h 40m</div><div>Best ${$(fares[0] + 4)} · 3h 40m</div><div>Quickest ${$(fares[0] + 120)} 3h 30m</div></div>
      <aside>Stops <div>Nonstop ${$(fares[0])}</div><div>1 stop ${$(fares[0] + 150)}</div></aside>
      ${fares.map((f, i) => `<div class="card"><div>11:05 am – 2:00 pm ${AIRLINES[i % 5]} nonstop 3h 55m TLV-${d}</div><div>5:45 am – 10:10 am ${AIRLINES[i % 5]} nonstop 3h 25m ${d}-TLV</div><div>${$(f)} Basic <button>Select</button></div></div>`).join("")}`,
  }),
  skyscanner: (fares, $, d) => ({
    html: `<div class="tabs"><div>Best ${$(fares[1] || fares[0])} 5h 10m</div><div>Cheapest ${$(fares[0])} 25h</div><div>Fastest ${$(fares[0] + 116)} 4h 50</div></div>
      <aside>Stops <div>Direct from ${$(fares[1] || fares[0])}</div><div>1 stop from ${$(fares[0])}</div></aside>
      <div class="ad">Car rental in ${d} Don't stop at flights – from ${$(40)} per day. Hotels in ${d} from ${$(Math.round(fares[0] * 0.6) + 40)} per night</div>
      ${fares.map((f, i) => `<div class="card">This flight emits 8% less CO2e<div>${AIRLINES[i % 3]}</div><div>11:05 AM TLV</div><div>5h 10 Direct</div><div>3:15 PM ${d}</div><div>18 deals from <b>${$(f)}</b> <button>Select</button></div></div>`).join("")}`,
  }),
  google: (fares, $, d) => ({
    html: `<div class="ins">Prices are currently low – ${$(fares[0] - 25)} cheaper than usual. Typically ${$(fares[0] + 90)}–${$(fares[0] + 260)}. <label>Track prices</label></div>
      <ul>${fares.map((f, i) => `<li aria-label="From ${f} US dollars round trip total"><div>5:35 AM – 9:45 AM</div><div>${AIRLINES[i % 4]}</div><div>5 hr 10 min TLV–${d}</div><div>Nonstop</div><div>${$(f)}</div></li>`).join("")}</ul>`,
  }),
  expedia: (fares, $, d) => ({
    html: `<div class="promo">Save up to ${$(50)} when you add a hotel. Hotel + Flight packages from ${$(Math.round(fares[0] * 0.5) + 40)}</div>
      ${fares.map((f, i) => `<div class="card"><div>5:35am - 9:45am</div><div>${AIRLINES[i % 5]} Nonstop (5h 10m)</div><div>TLV - ${d}</div><div><span>${$(f)}</span> roundtrip per traveler <button>Select</button></div></div>`).join("")}`,
  }),
  booking: (fares, $, d) => ({
    html: `<div class="alerts">Price drop alert: get notified when fares fall below ${$(fares[0] - 8)}</div>
      ${fares.map((f, i) => `<div class="card"><div>${AIRLINES[i % 6]}</div><div>05:35 TLV</div><div>Direct 5h 10m</div><div>09:45 ${d}</div><div>${$(f)} per adult <a>See flight</a></div></div>`).join("")}`,
  }),
  // Adversarial: banner with flight words and NO alert wording, living in the same wrapper as the cards.
  advBannerInList: (fares, $, d) => ({
    html: `<div class="list"><div class="banner">Nonstop flights to ${d} from ${$(fares[0] - 40)} per person</div>${fares.slice(0, 2).map((f, i) => `<div class="card"><div>07:15 TLV</div><div>${AIRLINES[i]} Nonstop 4h 55m</div><div>12:10 ${d}</div><div>${$(f)} <button>Select</button></div></div>`).join("")}</div>`,
  }),
  advBannerOneCard: (fares, $, d) => ({
    html: `<div class="list"><div class="banner">Fares from ${$(fares[0] - 55)} Direct 5h</div><div class="card"><div>07:15 TLV</div><div>El Al Nonstop 4h 55m</div><div>12:10 ${d}</div><div>${$(fares[0])} <button>Select</button></div></div></div>`,
  }),
  advHotelTimes: (fares, $, d) => ({
    html: `<div class="ad">Stay in ${d}: check-in from 15:00, check-out until 11:00 – Direct booking from ${$(fares[0] - 70)}</div>${fares.slice(0, 3).map((f, i) => `<div class="card"><div>06:30 TLV</div><div>${AIRLINES[i]} Direct 5h 05m</div><div>11:35 ${d}</div><div>${$(f)}</div></div>`).join("")}`,
  }),
  advCalendar: (fares, $, d) => ({
    html: `<div class="cal">Direct flights, 5h typical. ${[16, 17, 18, 19].map((x) => `<span>Dec ${x}: ${$(fares[0] - 20 + x)}</span>`).join(" ")}</div><div class="card"><div>09:00 TLV</div><div>${AIRLINES[0]} Nonstop 5h 00m</div><div>13:10 ${d}</div><div>${$(fares[0])}</div></div>`,
  }),
  advFareColumns: (fares, $, d) => ({ // El Al style: several fare columns per card; cheapest column is the offer price
    html: `${fares.slice(0, 3).map((f, i) => `<div class="card"><div>09:45 ${d}</div><div>Direct 5h 10m</div><div>05:35 TLV</div><div>Business ${$(f * 5)}</div><div>Premium ${$(f * 2)}</div><div>Economy ${$(f)}</div></div>`).join("")}`,
  }),
  splitSpans: (fares, $, d) => ({ // currency symbol and number in separate elements
    html: `${fares.map((f, i) => `<div class="card"><div>07:15 TLV</div><div>${AIRLINES[i % 6]} Nonstop 4h 55m</div><div>12:10 ${d}</div><div><span class=c>$</span><span class=n>${f}</span></div></div>`).join("")}<div class="alert">Notify me below <span>$</span><span>${fares[0] - 9}</span></div>`,
  }),
};

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
