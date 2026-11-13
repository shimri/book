const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

// Runs inside the page: collect URL + visible form values + text that may hold codes/dates.
function scrapePage() {
  const fields = [...document.querySelectorAll("input, select")]
    .map((e) => e.value).filter(Boolean);
  return { url: decodeURIComponent(location.href), fields, text: document.body.innerText.slice(0, 5000) };
}

function parseDates(s) {
  const out = [];
  for (const m of s.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of s.matchAll(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/g)) out.push(`${m[3]}-${pad(m[2])}-${pad(m[1])}`);
  for (const m of s.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  return [...new Set(out)].filter((d) => !isNaN(Date.parse(d))).sort();
}

function parseCodes(data) {
  const out = [];
  const add = (c) => { if (c && !out.includes(c)) out.push(c); };
  for (const f of data.fields) {
    const m = f.match(/\(([A-Z]{3})\)/) || f.match(/^([A-Z]{3})$/);
    if (m) add(m[1]);
  }
  for (const m of data.url.matchAll(/(?:[?&\/=_-])([A-Z]{3})(?=[&\/=_-]|$)/g)) add(m[1]);
  return out;
}

async function init() {
  const saved = await chrome.storage.local.get(["from"]);
  $("from").value = saved.from || "TLV";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapePage });
    const all = [result.url, ...result.fields].join(" ");
    const dates = parseDates(all);
    const codes = parseCodes(result);
    if (dates[0]) $("dep").value = dates[0];
    if (dates[1]) $("ret").value = dates[1];
    if (codes[0]) $("from").value = codes[0];
    if (codes[1]) $("to").value = codes[1];
    const [{ result: pr }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPrices });
    if (pr && pr.min) { curPrice = pr.min; $("cur").hidden = false; $("cur").textContent = "מחיר בעמוד הנוכחי (הערכה): " + fmt(pr.min); }
    $("status").textContent = dates.length || codes.length ? "הנתונים נקראו מהעמוד, אפשר לתקן." : "לא זוהה חיפוש בעמוד, מלאו ידנית.";
  } catch {
    $("status").textContent = "לא ניתן לקרוא את העמוד, מלאו ידנית.";
  }
}

const fmt = (n) => "₪" + n.toLocaleString("he-IL");
let curPrice = null;

function render(results) {
  const rows = Object.values(results || {});
  const prices = rows.filter((r) => r.status === "done").map((r) => r.price);
  const best = prices.length ? Math.min(...prices) : null;
  $("results").innerHTML = "";
  rows.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9)).forEach((r) => {
    const d = document.createElement("div");
    d.className = "r";
    const val = r.status === "loading" ? "טוען…" : r.status === "fail" ? "לא נמצא" : fmt(r.price);
    const diff = r.status === "done" && curPrice ? ` (${r.price < curPrice ? "-" : "+"}${fmt(Math.abs(curPrice - r.price))})` : "";
    d.innerHTML = `<a href="${r.url}" target="_blank">${r.name}</a><span class="${r.price === best ? "best" : ""}">${val}${diff}</span>`;
    $("results").appendChild(d);
  });
}

$("go").addEventListener("click", async () => {
  const v = {
    from: $("from").value.trim().toUpperCase(), to: $("to").value.trim().toUpperCase(),
    dep: $("dep").value, ret: $("ret").value, adults: $("adults").value || 1,
  };
  if (!/^[A-Z]{3}$/.test(v.from) || !/^[A-Z]{3}$/.test(v.to) || !v.dep) {
    $("status").textContent = "חסר קוד מוצא/יעד (3 אותיות) או תאריך הלוך.";
    return;
  }
  await chrome.storage.local.set({ from: v.from });
  $("status").textContent = "בודק אתרים ברקע, זה לוקח עד חצי דקה…";
  chrome.runtime.sendMessage({ type: "compare", params: v });
});

chrome.storage.onChanged.addListener((c, area) => {
  if (area === "session" && c.results) render(c.results.newValue);
});
chrome.storage.session.get("results").then((s) => render(s.results));
init();
