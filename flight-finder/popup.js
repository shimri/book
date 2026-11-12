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
    $("status").textContent = dates.length || codes.length ? "הנתונים נקראו מהעמוד, אפשר לתקן." : "לא זוהה חיפוש בעמוד, מלאו ידנית.";
  } catch {
    $("status").textContent = "לא ניתן לקרוא את העמוד, מלאו ידנית.";
  }
}

const yymmdd = (d) => d.slice(2).replace(/-/g, "");

function links({ from, to, dep, ret, adults }) {
  const q = encodeURIComponent(`Flights from ${from} to ${to} on ${dep}${ret ? " through " + ret : ""}`);
  return [
    `https://www.google.com/travel/flights?q=${q}&curr=ILS`,
    `https://www.skyscanner.co.il/transport/flights/${from}/${to}/${yymmdd(dep)}/${ret ? yymmdd(ret) + "/" : ""}?adultsv2=${adults}&currency=ILS`,
    `https://www.kayak.com/flights/${from}-${to}/${dep}${ret ? "/" + ret : ""}/${adults}adults?currency=ILS`,
    `https://www.momondo.com/flight-search/${from}-${to}/${dep}${ret ? "/" + ret : ""}/${adults}adults?currency=ILS`,
  ];
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
  links(v).forEach((url) => chrome.tabs.create({ url, active: false }));
});

init();
