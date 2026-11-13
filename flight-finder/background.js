importScripts("extract.js");

const ymd = (d) => d.slice(2).replace(/-/g, "");
const SITES = [
  { id: "google", name: "Google Flights", url: (p) =>
    `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${p.from} to ${p.to} on ${p.dep}${p.ret ? " through " + p.ret : ""}`)}&curr=ILS&hl=en` },
  { id: "skyscanner", name: "Skyscanner", url: (p) =>
    `https://www.skyscanner.co.il/transport/flights/${p.from}/${p.to}/${ymd(p.dep)}/${p.ret ? ymd(p.ret) + "/" : ""}?adultsv2=${p.adults}&currency=ILS` },
  { id: "kayak", name: "Kayak", url: (p) =>
    `https://www.kayak.com/flights/${p.from}-${p.to}/${p.dep}${p.ret ? "/" + p.ret : ""}/${p.adults}adults?currency=ILS` },
  { id: "momondo", name: "Momondo", url: (p) =>
    `https://www.momondo.com/flight-search/${p.from}-${p.to}/${p.dep}${p.ret ? "/" + p.ret : ""}/${p.adults}adults?currency=ILS` },
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
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPrices });
      // Accept once the same minimum shows up on two consecutive reads (page finished rendering).
      if (result && result.min && result.min === last) {
        await publish(site.id, { status: "done", price: result.min });
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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "compare") return;
  const myRun = ++runId;
  results = {};
  chrome.storage.session.set({ results, params: msg.params });
  SITES.forEach((s) => scrapeSite(s, msg.params, myRun));
});
