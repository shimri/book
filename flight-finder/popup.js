const $ = (id) => document.getElementById(id);
let curPrice = null, curCur = null;

// Runs inside the page: collect URL + visible form values + text that may hold codes/dates.
function scrapePage() {
  const fields = [...document.querySelectorAll("input, select")].map((e) => e.value).filter(Boolean);
  return { url: decodeURIComponent(location.href), fields, text: document.body.innerText.slice(0, 8000) };
}

const money = (n, cur) => new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "ILS", maximumFractionDigits: 0 }).format(n);

async function init() {
  const saved = await chrome.storage.local.get(["from"]);
  $("from").value = saved.from || "TLV";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapePage });
    const p = parsePage(result);
    if (p.dep) $("dep").value = p.dep;
    if (p.ret) $("ret").value = p.ret;
    if (p.from) $("from").value = p.from;
    if (p.to) $("to").value = p.to;
    const [{ result: pr }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPrices, args: [null] });
    if (pr && pr.min) {
      curPrice = pr.min; curCur = pr.currency;
      $("cur").hidden = false;
      $("cur").textContent = "המחיר הזול בעמוד הנוכחי: " + money(pr.min, pr.currency) + " (לרוב לכיוון אחד)";
    }
    $("status").textContent = p.dep || p.to ? "הנתונים נקראו מהעמוד, אפשר לתקן." : "לא זוהה חיפוש בעמוד, מלאו ידנית.";
  } catch {
    $("status").textContent = "לא ניתן לקרוא את העמוד, מלאו ידנית.";
  }
}

function render(results) {
  const rows = Object.values(results || {});
  const prices = rows.filter((r) => r.status === "done").map((r) => r.price);
  const best = prices.length ? Math.min(...prices) : null;
  $("results").innerHTML = "";
  rows.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9)).forEach((r) => {
    const d = document.createElement("div");
    d.className = "r";
    const val = r.status === "loading" ? "טוען…" : r.status === "fail" ? "לא נמצא" : money(r.price, r.currency);
    d.innerHTML = `<a href="${r.url}" target="_blank">${r.name}</a><span class="${r.price === best ? "best" : ""}">${val}</span>`;
    $("results").appendChild(d);
  });
}

$("go").addEventListener("click", async () => {
  const v = {
    from: $("from").value.trim().toUpperCase(), to: $("to").value.trim().toUpperCase(),
    dep: $("dep").value, ret: $("oneway").checked ? "" : $("ret").value,
    adults: $("adults").value || 1, cur: curCur || "ILS",
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
