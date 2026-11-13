// Injected into result pages (isolated world). Exposes window.cf = { find, highlight, bags }.
(() => {
  const cf = (window.cf = window.cf || {});
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const AD = /hotel|\broom|\bnights?\b|\bcar\b|\brental|per day|מלון|חדר|לילה|השכרת|רכב/i;

  // Locate the element showing `price` and the "card" (offer container) around it. ctx = text seen near the price.
  cf.find = (price, cur, ctx) => {
    const sym = { USD: "$", EUR: "€", ILS: "₪", GBP: "£" }[cur] || "";
    const num = price >= 1000 ? `${Math.floor(price / 1000)},${String(price % 1000).padStart(3, "0")}` : String(price);
    const codes = "USD|EUR|ILS|NIS|GBP";
    const re = new RegExp(`(?:^|[^\\d,.])(?:${sym ? esc(sym) + "\\s?" + num + "|" + num + "\\s?" + esc(sym) + "|" : ""}(?:${codes})\\s?${num}|${num}\\s?(?:${codes}|shekels?|dollars?))(?!\\d)`, "i");
    const matches = (el) => el.innerText && el.innerText.length <= 60 && re.test(el.innerText);
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
    let cands = [...document.body.querySelectorAll("*")].filter((el) => matches(el) && visible(el));
    cands = cands.filter((el) => ![...el.children].some((c) => matches(c))); // deepest only
    if (!cands.length) return null;
    // Card = largest ancestor holding this candidate and no other matching price.
    const card = (el) => {
      let n = el;
      while (n.parentElement && n.parentElement !== document.body && (n.parentElement.innerText || "").length <= 800
             && !cands.some((c) => c !== el && n.parentElement.contains(c))) n = n.parentElement;
      return n;
    };
    const words = (ctx || "").toLowerCase().split(/[^\p{L}\d]+/u).filter((w) => w.length >= 3 && !/^\d+$/.test(w));
    const score = (el) => {
      const t = card(el).innerText.toLowerCase();
      return words.filter((w) => t.includes(w)).length - (AD.test(t) ? 100 : 0);
    };
    const el = cands.map((e) => [e, score(e)]).sort((a, b) => b[1] - a[1])[0][0];
    return { el, card: card(el) };
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
