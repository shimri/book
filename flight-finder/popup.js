const $ = (id) => document.getElementById(id);
// i18n: strings come from _locales/<lang>/messages.json, chosen by Chrome from the browser language.
const t = (key, ...args) => chrome.i18n.getMessage(key, args.map(String)) || key;
const UI_LANG = chrome.i18n.getUILanguage();
document.documentElement.lang = UI_LANG;
document.documentElement.dir = chrome.i18n.getMessage("@@bidi_dir") || "ltr";
document.querySelectorAll("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n)));
document.querySelectorAll("[data-i18n-title]").forEach((e) => (e.title = t(e.dataset.i18nTitle)));
let curPrice = null, curCur = null;
const state = { trip: "round", adults: 1, carry: false, checked: false };
const saveUI = () => chrome.storage.local.set({ ui: state });
function paintUI() {
  document.querySelectorAll("#trip button").forEach((b) => b.classList.toggle("on", b.dataset.t === state.trip));
  $("dates").classList.toggle("dis", state.trip === "one");
  $("adults").textContent = state.adults;
  $("bagCarry").classList.toggle("on", state.carry);
  $("bagChecked").classList.toggle("on", state.checked);
}
document.querySelectorAll("#trip button").forEach((b) => b.addEventListener("click", () => { state.trip = b.dataset.t; paintUI(); saveUI(); }));
$("minus").addEventListener("click", () => { state.adults = Math.max(1, state.adults - 1); paintUI(); saveUI(); });
$("plus").addEventListener("click", () => { state.adults = Math.min(9, state.adults + 1); paintUI(); saveUI(); });
$("bagCarry").addEventListener("click", () => { state.carry = !state.carry; paintUI(); saveUI(); });
$("bagChecked").addEventListener("click", () => { state.checked = !state.checked; paintUI(); saveUI(); });
$("swap").addEventListener("click", () => { const t = $("from").value; $("from").value = $("to").value; $("to").value = t; });

// Runs inside the page: collect URL + visible form values + text that may hold codes/dates.
function scrapePage() {
  const fields = [...document.querySelectorAll("input, select")].map((e) => e.value).filter(Boolean);
  return { url: decodeURIComponent(location.href), fields, text: document.body.innerText.slice(0, 8000) };
}

const money = (n, cur) => new Intl.NumberFormat(UI_LANG, { style: "currency", currency: cur || "ILS", maximumFractionDigits: 0 }).format(n);

async function init() {
  const saved = await chrome.storage.local.get(["from", "ui"]);
  $("from").value = saved.from || "TLV";
  Object.assign(state, saved.ui || {});
  paintUI();
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
      $("cur").innerHTML = `<i class="fa-solid fa-tag"></i> <span>${t("pagePrice", "<b>" + money(pr.min, pr.currency) + "</b>")}</span>`;
    }
    $("status").textContent = p.dep || p.to ? t("statusRead") : t("statusNotFound");
  } catch {
    $("status").textContent = t("statusCantRead");
  }
  // Re-render now that the page price/currency are known (needed for the per-row comparison).
  chrome.storage.session.get("results").then((s) => render(s.results));
}

const SITE_UI = {
  google: { c: "#4285f4", l: "G" }, skyscanner: { c: "#0770e3", l: "S" },
  kayak: { c: "#ff690f", l: "K" }, momondo: { c: "#e6007e", l: "M" },
};

function render(results) {
  const entries = Object.entries(results || {});
  $("res").classList.toggle("show", entries.length > 0);
  if (!entries.length) return;
  const done = entries.filter(([, r]) => r.status === "done");
  const pending = entries.filter(([, r]) => r.status === "loading").length;
  const best = done.length ? Math.min(...done.map(([, r]) => r.price)) : null;
  $("bar").style.width = Math.round(((entries.length - pending) / entries.length) * 100) + "%";
  $("go").disabled = pending > 0;
  $("go").querySelector("span").textContent = pending ? t("checking") : t("searchOthers");

  const sum = $("summary");
  if (best !== null) {
    const w = done.find(([, r]) => r.price === best)[1];
    sum.className = "summary";
    sum.innerHTML = `<i class="fa-solid fa-trophy"></i><span>${t("cheapestSummary", w.name, money(best, w.currency))}${pending ? t("stillChecking") : ""}</span>`;
  } else {
    sum.className = "summary wait";
    sum.innerHTML = pending ? `<i class="fa-solid fa-spinner fa-spin"></i><span>${t("checkingN", pending)}</span>`
      : `<i class="fa-solid fa-triangle-exclamation"></i><span>${t("noPrices")}</span>`;
  }

  const rank = (r) => (r.status === "done" ? r.price : r.status === "loading" ? 1e8 : 1e9);
  $("results").innerHTML = "";
  entries.sort((a, b) => rank(a[1]) - rank(b[1])).forEach(([id, r]) => {
    const ui = SITE_UI[id] || { c: "#64748b", l: r.name[0] };
    const isBest = r.status === "done" && r.price === best && done.length > 1;
    let small = "", price = "";
    if (r.status === "loading") {
      small = '<i class="fa-solid fa-spinner fa-spin"></i> ' + t("loadingRes"); price = '<div class="skel"></div>';
    } else if (r.status === "fail") {
      small = '<i class="fa-solid fa-triangle-exclamation"></i> ' + t("failRes"); price = '<i class="fa-solid fa-arrow-up-right-from-square" style="color:var(--muted)"></i>';
    } else {
      price = `<span class="price">${money(r.price, r.currency)}</span>` + (isBest ? '<span class="badge"><i class="fa-solid fa-star"></i> ' + t("cheapestBadge") + "</span>" : "");
      small = '<i class="fa-solid fa-circle-check"></i> ' + t("foundPrice");
      if (state.trip === "one" && curPrice && r.currency === curCur) {
        const d = curPrice - r.price;
        if (d > 0) small = `<i class="fa-solid fa-arrow-trend-down"></i> ${t("cheaperBy", money(d, r.currency))}`;
        else if (d < 0) small = `<i class="fa-solid fa-arrow-trend-up"></i> ${t("pricierBy", money(-d, r.currency))}`;
        else small = t("samePrice");
      }
    }
    const cls = state.trip === "one" && curPrice && r.status === "done" && r.currency === curCur ? (curPrice > r.price ? "cheaper" : curPrice < r.price ? "pricier" : "") : "";
    const a = document.createElement("a");
    a.className = `site ${r.status}${isBest ? " best" : ""}`;
    a.href = r.url; a.target = "_blank";
    a.innerHTML = `<span class="logo" style="--c:${ui.c}">${ui.l}</span><div class="meta"><b>${r.name}</b><small class="${cls}">${small}</small></div><div class="end">${price}</div>`;
    $("results").appendChild(a);
    if (r.ctx) {
      const btn = document.createElement("button");
      btn.className = "info"; btn.title = t("infoTitle"); btn.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
      const ctx = document.createElement("div"); ctx.className = "ctx"; ctx.textContent = r.ctx;
      btn.addEventListener("click", (e) => { e.preventDefault(); ctx.classList.toggle("show"); });
      a.querySelector(".end").append(btn);
      $("results").appendChild(ctx);
    }
  });
}

$("go").addEventListener("click", async () => {
  const v = {
    from: $("from").value.trim().toUpperCase(), to: $("to").value.trim().toUpperCase(),
    dep: $("dep").value, ret: state.trip === "one" ? "" : $("ret").value,
    adults: state.adults, cur: curCur || "ILS", carry: state.carry, checked: state.checked,
  };
  if (!/^[A-Z]{3}$/.test(v.from) || !/^[A-Z]{3}$/.test(v.to) || !v.dep) {
    $("status").textContent = t("statusMissing");
    return;
  }
  await chrome.storage.local.set({ from: v.from });
  $("status").textContent = t("statusRunning");
  chrome.runtime.sendMessage({ type: "compare", params: v });
});

$("reset").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "reset" });
  ["dep", "ret", "to"].forEach((id) => ($(id).value = ""));
  $("results").innerHTML = "";
  $("res").classList.remove("show");
  $("go").disabled = false;
  $("go").querySelector("span").textContent = t("searchOthers");
  $("cur").hidden = true;
  Object.assign(state, { trip: "round", adults: 1, carry: false, checked: false });
  paintUI(); saveUI();
  $("status").textContent = t("statusReset");
  init();
});

chrome.storage.onChanged.addListener((c, area) => {
  if (area === "session" && c.results) render(c.results.newValue);
});
chrome.storage.session.get("results").then((s) => render(s.results));
init();
