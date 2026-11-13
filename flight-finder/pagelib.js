// Injected into result pages (isolated world). Exposes window.cf = { extract, find, highlight, bags }.
// Core idea: a price only counts if it sits inside a flight OFFER CARD – the smallest container that holds
// at least two clock times (departure/arrival) plus flight details (nonstop/stops/duration).
// That excludes price-alert widgets, day tabs, filter lists, hotel/car ads, etc.
(() => {
  if (window.cf && window.cf.v === 3) return;
  const cf = (window.cf = { v: 3 });

  const code = (t) => {
    t = t.toLowerCase();
    if (/₪|ils|nis|shekel/.test(t)) return "ILS";
    if (/\$|usd|dollar/.test(t)) return "USD";
    if (/€|eur/.test(t)) return "EUR";
    if (/£|gbp/.test(t)) return "GBP";
    return null;
  };
  const NUM = "(\\d{1,3}(?:[,.\\u00a0\\u202f ]\\d{3})+|\\d{2,6})(?:[.,]\\d{1,2})?";
  const CUR = "([$€₪£]|USD|EUR|ILS|NIS|GBP|Israeli new shekels?|US dollars?|euros?)";
  const PRICE_RE = new RegExp(`${CUR}\\s?${NUM}(?!\\d)|${NUM}\\s?${CUR}`, "gi"); // shared: matchAll works on a copy
  const QUICK = /[$€₪£]|USD|EUR|ILS|NIS|GBP|shekel|dollar|euro/i; // cheap pre-check before the full parse
  const inRange = (cur, n) => (cur === "ILS" ? n >= 150 && n <= 40000 : n >= 40 && n <= 15000);
  const parse = (text) => {
    const out = [];
    for (const m of text.matchAll(PRICE_RE)) {
      const cur = code(m[1] || m[4] || ""), raw = m[2] || m[3];
      const n = parseInt(raw.replace(/[,.   ]/g, ""), 10);
      if (cur && inRange(cur, n)) out.push({ n, cur });
    }
    return out;
  };

  const TIME = /(?<!\d)\d{1,2}:\d{2}(?!\d)/g;
  // Text of an element with a space between every text node (so "El Al" + "16:50" never glue together). innerText is far slower.
  let cache = new Map(), lenCache = new Map();
  const tlen = (e) => { // cached textContent length: building it for <body> once per text node would cost seconds
    let v = lenCache.get(e);
    if (v === undefined) { v = e.textContent.length; lenCache.set(e, v); }
    return v;
  };
  const txt = (n) => {
    let s = cache.get(n);
    if (s === undefined) {
      s = "";
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      for (let x; (x = w.nextNode()); ) s += x.nodeValue + " ";
      cache.set(n, s);
    }
    return s;
  };
  const FLIGHTISH = /non-?stop|direct|\bstops?\b|\bstop\b|ישיר|עצירה|\b\d+\s?h\b|\b\d+\s?hr|\bflight\b|\bлет\b|escala|escale|nonstop/i;
  const PROMO = /alert|notify|we expect|expect prices|recommended|better deal|chances of success|track prices|sign up|newsletter|hotel|per night|car rental|per day|התראה|מלון|השכרת/i;

  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const struck = (el) => {
    for (let n = el, i = 0; n && i < 4; n = n.parentElement, i++) {
      if (/^(S|DEL|STRIKE)$/.test(n.tagName) || /line-through/.test(getComputedStyle(n).textDecorationLine)) return true;
    }
    return false;
  };

  // Smallest ancestor holding >= 2 clock times; accepted only if it looks like one flight offer.
  const cardOf = (el) => {
    let n = el;
    for (let i = 0; i < 14 && n.parentElement; i++) {
      n = n.parentElement;
      if (tlen(n) > 1800) return null; // cheap guard before building the spaced text
      const t = txt(n);
      const times = (t.match(TIME) || []).length;
      if (times >= 2) {
        if (times > 8 || PROMO.test(t) || !FLIGHTISH.test(t)) return null;
        // A container that holds some OTHER offer-like area (>= 2 times + a price) is a list, not a card.
        for (const d of n.querySelectorAll("*")) {
          if (d === el || d.contains(el)) continue;
          if ((txt(d).match(TIME) || []).length >= 2 && parse(txt(d)).length) return null;
        }
        return n;
      }
    }
    return null;
  };

  // All prices that sit in offer cards: [{ price, cur, el, card }] (one entry per card = its cheapest current price).
  const offers = () => {
    cache = new Map(); lenCache = new Map();
    const byCard = new Map(), seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode()); ) {
      if (!/[\d$€₪£]/.test(node.nodeValue)) continue;
      let el = node.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
      // price may be split across spans ("US$" + "208"): climb while the text is still short
      const hasPrice = (e) => { const t = e.textContent; return QUICK.test(t) && /\d{2}/.test(t); };
      for (let i = 0; i < 3 && el && !hasPrice(el); i++) {
        const p = el.parentElement;
        el = p && tlen(p) <= 40 ? p : null;
      }
      if (!el || el.textContent.length > 40 || seen.has(el)) continue;
      seen.add(el);
      const ps = parse(el.textContent);
      if (!ps.length || !visible(el) || struck(el)) continue;
      const card = cardOf(el);
      if (!card) continue;
      const cur = byCard.get(card);
      if (!cur || ps[0].n < cur.price) byCard.set(card, { price: ps[0].n, cur: ps[0].cur, el, card });
    }
    return [...byCard.values()];
  };
  const pickCurrency = (list, wanted) => {
    const counts = {};
    list.forEach((o) => (counts[o.cur] = (counts[o.cur] || 0) + 1));
    const cur = wanted && counts[wanted] ? wanted : Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return list.filter((o) => o.cur === cur);
  };

  const compact = (s) => s.replace(/\s+/g, " ").trim();
  cf.extract = (wanted) => {
    const list = pickCurrency(offers(), wanted);
    if (!list.length) return { min: null, count: 0, currency: wanted || null };
    const best = list.reduce((a, b) => (b.price < a.price ? b : a));
    return { min: best.price, ctx: compact(best.card.innerText || best.card.textContent).slice(0, 140), count: list.length, currency: best.cur };
  };

  // Locate the price element + its offer card (best match to the context text).
  cf.find = (price, cur, ctx) => {
    const list = offers().filter((o) => o.price === price && (!cur || o.cur === cur));
    if (!list.length) return null;
    const words = (ctx || "").toLowerCase().split(/[^\p{L}\d]+/u).filter((w) => w.length >= 3 && !/^\d+$/.test(w));
    const score = (o) => { const t = txt(o.card).toLowerCase(); return words.filter((w) => t.includes(w)).length; };
    const o = list.map((x) => [x, score(x)]).sort((a, b) => b[1] - a[1])[0][0];
    return { el: o.el, card: o.card };
  };

  cf.highlight = (price, cur, ctx, label) => {
    if (document.documentElement.dataset.cfHl === String(price)) return true;
    const f = cf.find(price, cur, ctx);
    if (!f) return false;
    const best = f.el;
    best.style.cssText += ";outline:3px solid #12874a !important;outline-offset:3px;border-radius:6px;background:rgba(18,135,74,.18) !important;box-shadow:0 0 0 6px rgba(18,135,74,.25) !important;transition:all .3s";
    best.scrollIntoView({ block: "center", behavior: "smooth" });
    const tag = document.createElement("div");
    tag.textContent = "✓ " + label;
    tag.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#12874a;color:#fff;font:600 13px system-ui,Arial,sans-serif;padding:8px 14px;border-radius:99px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer";
    tag.addEventListener("click", () => { tag.remove(); best.style.outline = best.style.background = best.style.boxShadow = ""; document.documentElement.dataset.cfHl = ""; });
    document.body.appendChild(tag);
    document.documentElement.dataset.cfHl = String(price);
    return true;
  };

  // Heuristic baggage reader for the offer card around `price`: { carry, checked } each { state: yes|no|unknown, ev }.
  cf.bags = (price, cur, ctx) => {
    const f = cf.find(price, cur, ctx);
    if (!f) return null;
    const card = f.card;
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const strs = [];
    const push = (s) => { s = norm(s); if (s && s.length <= 160) strs.push(s); };
    card.querySelectorAll("[aria-label],[title],img[alt]").forEach((e) => {
      const lab = [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("alt")].filter(Boolean).join(" ");
      push(lab);
      if (e.parentElement) push(lab + " " + norm(e.parentElement.innerText).slice(0, 40)); // icon label + the count next to it
    });
    (card.innerText || "").split("\n").forEach(push);
    // Judge clause by clause so "Checked bag: $45 fee. Carry-on included" doesn't mix the two.
    const clauses = strs.flatMap((x) => x.split(/[.;|•·]\s*/)).map(norm).filter(Boolean);
    strs.length = 0; strs.push(...clauses);

    const CARRY = /carry[- ]?on|cabin|hand (?:bag|luggage|baggage)|personal item|trolley|handbag|טרולי|כבודת יד/i;
    const CHECKED = /checked|check[- ]?in|hold (?:bag|luggage)|suitcase|baggage|luggage|\bbags?\b|מזוודה|כבודה/i;
    const EXC = /not included|\bno (?:free )?(?:carry|checked|cabin|bag|luggage|baggage)|(?:^|\D)0\s*(?:x\s*)?(?:bags?|pieces?|checked|carry|cabin)?(?:\s|$)|without|unavailable|not available|for a fee|extra fee|\bfee\b|(?:bag|checked|carry|cabin|luggage|baggage|suitcase)\W{0,6}(?:from |for |\+ ?)?[$€₪£]\s?\d|[$€₪£]\s?\d+\s*(?:per|each|extra)|ללא|לא כולל|בתשלום/i;
    const INC = /(?:^|\D)[1-9]\d?\s*(?:x\s*)?(?:bags?|pieces?|checked|carry|cabin|suitcase|מזוודה)|\bincluded\b|\bfree\b|\bכלול|\bכולל\b/i;
    const fareBasic = /\b(?:basic|light|saver|lite)\b|בייסיק/i.test(card.innerText || "");

    const judge = (keyRe, skipRe) => {
      const hits = strs.filter((s) => keyRe.test(s) && !(skipRe && skipRe.test(s) && !/checked/i.test(s)));
      let inc = null, exc = null;
      for (const s of hits) {
        if (EXC.test(s)) exc = exc || s;
        else if (INC.test(s)) inc = inc || s;
      }
      if (inc) return { state: "yes", ev: inc };
      if (exc) return { state: "no", ev: exc };
      if (fareBasic) return { state: "no", ev: "Basic fare (usually no bags)" };
      return { state: "unknown", ev: "" };
    };
    return { carry: judge(CARRY), checked: judge(CHECKED, CARRY) };
  };
})();
