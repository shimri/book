importScripts("extract.js");

const ymd = (d) => d.slice(2).replace(/-/g, "");
const mdy = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
const SITES = [
  { id: "google", name: "Google Flights", url: (p) =>
    `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${p.from} to ${p.to} on ${p.dep}${p.ret ? " through " + p.ret : ""}`)}&curr=${p.cur}&hl=en` },
  { id: "skyscanner", name: "Skyscanner", url: (p) =>
    `https://www.skyscanner.co.il/transport/flights/${p.from}/${p.to}/${ymd(p.dep)}/${p.ret ? ymd(p.ret) + "/" : ""}?adultsv2=${p.adults}&currency=${p.cur}` },
  { id: "kayak", name: "Kayak", url: (p) =>
    `https://www.kayak.com/flights/${p.from}-${p.to}/${p.dep}${p.ret ? "/" + p.ret : ""}/${p.adults}adults?currency=${p.cur}` },
  { id: "expedia", name: "Expedia", url: (p) =>
    `https://www.expedia.com/Flights-Search?mode=search&trip=${p.ret ? "roundtrip" : "oneway"}&leg1=from:${p.from},to:${p.to},departure:${mdy(p.dep)}TANYT${p.ret ? `&leg2=from:${p.to},to:${p.from},departure:${mdy(p.ret)}TANYT` : ""}&passengers=adults:${p.adults}&options=cabinclass:economy` },
  { id: "booking", name: "Booking.com", url: (p) =>
    `https://flights.booking.com/flights/${p.from}.AIRPORT-${p.to}.AIRPORT/?type=${p.ret ? "ROUNDTRIP" : "ONEWAY"}&adults=${p.adults}&cabinClass=ECONOMY&from=${p.from}.AIRPORT&to=${p.to}.AIRPORT&depart=${p.dep}${p.ret ? "&return=" + p.ret : ""}&sort=BEST&currency=${p.cur}` },
  { id: "trip", name: "Trip.com", url: (p) =>
    `https://www.trip.com/flights/showfarefirst?dcity=${p.from.toLowerCase()}&acity=${p.to.toLowerCase()}&ddate=${p.dep}${p.ret ? "&rdate=" + p.ret : ""}&triptype=${p.ret ? "rt" : "ow"}&class=y&quantity=${p.adults}&curr=${p.cur}` },
  { id: "momondo", name: "Momondo", url: (p) =>
    `https://www.momondo.com/flight-search/${p.from}-${p.to}/${p.dep}${p.ret ? "/" + p.ret : ""}/${p.adults}adults?currency=${p.cur}` },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let results = {};
let runId = 0;

async function publish(id, patch) {
  results[id] = { ...results[id], ...patch };
  await chrome.storage.session.set({ results });
}

async function scrapeSite(site, params, myRun) {
  const url = site.url(params);
  await publish(site.id, { name: site.name, url, status: "loading", price: null });
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    const deadline = Date.now() + 40000;
    let last = null;
    while (Date.now() < deadline && myRun === runId) {
      await sleep(3000);
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPrices, args: [params.cur] });
      // Accept once the same minimum shows up on two consecutive reads (page finished rendering).
      if (result && result.min && result.min === last) {
        let bags = null;
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["pagelib.js"] });
          [{ result: bags }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (...a) => window.cf.bags(...a), args: [result.min, result.currency, result.ctx || ""] });
        } catch {}
        await publish(site.id, { status: "done", price: result.min, currency: result.currency, ctx: result.ctx, bags });
        return;
      }
      last = result ? result.min : null;
    }
    await publish(site.id, { status: "fail" });
  } catch {
    await publish(site.id, { status: "fail" });
  } finally {
    if (tab) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// Open a result site and keep trying to highlight the price the extension read (pages render late).
async function openAndHighlight(msg) {
  const tab = await chrome.tabs.create({ url: msg.url, active: true });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await sleep(1500);
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["pagelib.js"] });
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: (...a) => window.cf.highlight(...a), args: [msg.price, msg.currency, msg.ctx || "", msg.label],
      });
      if (result) return;
    } catch { return; } // tab closed or not scriptable
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "open") { openAndHighlight(msg); return; }
  if (msg.type === "reset") {
    runId++; // running scrapes notice this, stop, and close their tabs
    results = {};
    chrome.storage.session.set({ results });
    return;
  }
  if (msg.type !== "compare") return;
  const myRun = ++runId;
  results = {};
  chrome.storage.session.set({ results, params: msg.params });
  // Only the sources the user enabled, at most 4 tabs at a time.
  const list = SITES.filter((s) => !msg.params.sites || msg.params.sites.includes(s.id));
  list.forEach((s) => { results[s.id] = { name: s.name, url: s.url(msg.params), status: "loading", price: null }; });
  chrome.storage.session.set({ results });
  const queue = [...list];
  const worker = async () => { while (queue.length && myRun === runId) await scrapeSite(queue.shift(), msg.params, myRun); };
  Array.from({ length: Math.min(4, queue.length) }, worker);
});
