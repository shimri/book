// Parses origin/destination/dates out of what scrapePage() returned. Used by popup.js.
// Month names/abbreviations in en, he, ar, ru, es, fr, de -> month number (exact words only, to avoid false hits like "5 markets").
const MONTH_FORMS = {
  1: "january jan janv janvier enero ene januar ינואר ינו январь января янв يناير",
  2: "february feb febr févr fév fevrier février febrero februar פברואר פבר февраль февраля фев февр فبراير",
  3: "march mar mars marzo märz maerz מרץ март марта مارس",
  4: "april apr avr avril abril אפריל אפר апрель апреля апр أبريل",
  5: "may mai mayo מאי май мая ماي مايو",
  6: "june jun juin junio juni יוני יונ июнь июня июн يونيو",
  7: "july jul juil juillet julio juli יולי יול июль июля июл يوليو",
  8: "august aug août aout agosto ago אוגוסט אוג август августа авг أغسطس",
  9: "september sep sept septembre septiembre ספטמבר ספט сентябрь сентября сен сент سبتمبر",
  10: "october oct okt octobre octubre אוקטובר אוק октябрь октября окт أكتوبر",
  11: "november nov novembre noviembre נובמבר נוב ноябрь ноября ноя нояб نوفمبر",
  12: "december dec dez déc decembre décembre diciembre dic dezember דצמבר דצמ декабрь декабря дек ديسمبر",
};
const MONTH_MAP = {};
for (const [n, forms] of Object.entries(MONTH_FORMS)) forms.split(" ").forEach((f) => (MONTH_MAP[f] = +n));
function monthOf(tok) {
  tok = tok.toLowerCase().replace(/\.$/, "");
  return MONTH_MAP[tok] || (/^[בלמ]/.test(tok) ? MONTH_MAP[tok.slice(1)] : undefined); // Hebrew prefixes: בדצמבר
}
const NOT_CODES = new Set(["USD", "EUR", "ILS", "NIS", "GBP", "FAQ", "PDF", "VAT", "SMS", "FAX", "TEL", "APP", "WWW", "CEO"]);
const p2 = (n) => String(n).padStart(2, "0");

function mkDate(day, mon, yearHint, today) {
  let y = yearHint || today.getFullYear();
  let d = new Date(Date.UTC(y, mon - 1, day));
  if (!yearHint && d < new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))) d = new Date(Date.UTC(y + 1, mon - 1, day));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

const T = "(\\p{L}{3,10})\\.?", D = "(\\d{1,2})", SEP = "\\s*[-–—]\\s*", WD = "(?:\\p{L}{2,9},?\\s*)?";
// Day-month ("15 Dec", "15 דצמ") and month-day ("Dec 15") ranges and single dates; order is sorted later (RTL can flip it).
function parseNamedDates(s, y, today) {
  const find = (pattern, pick) => {
    for (const m of s.matchAll(new RegExp(pattern, "gu"))) {
      const r = pick(m);
      if (r) return r;
    }
    return null;
  };
  const dm = (day, tok) => { const mo = monthOf(tok); return mo ? mkDate(+day, mo, y, today) : null; };
  const both = (a, b) => (a && b ? [a, b] : null);
  return (
    find(`${D}\\.?\\s*${T}${SEP}${WD}${D}\\.?\\s*${T}`, (m) => both(dm(m[1], m[2]), dm(m[3], m[4]))) || // 15 Dec - 18 Dec
    find(`${T}\\s+${D}${SEP}${WD}${T}\\s+${D}`, (m) => both(dm(m[2], m[1]), dm(m[4], m[3]))) || // Dec 15 - Wed, Dec 18
    find(`${T}\\s+${D}${SEP}${D}\\b`, (m) => both(dm(m[2], m[1]), dm(m[3], m[1]))) || // Dec 15 - 18
    find(`${D}${SEP}${D}\\.?\\s*${T}`, (m) => both(dm(m[1], m[3]), dm(m[2], m[3]))) || // 15 - 18 Dec
    find(`${D}\\.?\\s*${T}`, (m) => { const r = dm(m[1], m[2]); return r ? [r] : null; }) ||
    find(`${T}\\s+${D}`, (m) => { const r = dm(m[2], m[1]); return r ? [r] : null; }) ||
    []
  );
}

function parseDates(s, today = new Date()) {
  const out = [];
  for (const m of s.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of s.matchAll(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/g)) out.push(`${m[3]}-${p2(m[2])}-${p2(m[1])}`);
  for (const m of s.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  if (!out.length) {
    const yearHint = (s.match(/\b(20\d{2})\b/) || [])[1];
    const y = yearHint ? parseInt(yearHint, 10) : null;
    const named = parseNamedDates(s, y, today);
    out.push(...named);
  }
  return [...new Set(out)].filter((d) => !isNaN(Date.parse(d))).sort();
}

function parseCodes(data) {
  const out = [];
  const add = (c) => { if (c && !NOT_CODES.has(c) && !out.includes(c)) out.push(c); };
  for (const f of data.fields) {
    const m = f.match(/\(([A-Z]{3})\)/) || f.match(/^([A-Z]{3})$/);
    if (m) add(m[1]);
  }
  for (const m of data.url.matchAll(/(?:[?&\/=_-])([A-Z]{3})(?=[&\/=_-]|$)/g)) add(m[1]);
  for (const m of data.text.matchAll(/(?<![A-Za-z])[A-Z]{3}(?![A-Za-z])/g)) add(m[0]);
  return out;
}

function parsePage(data, today = new Date()) {
  const dates = parseDates([data.url, ...data.fields].join(" "), today);
  const d = dates.length ? dates : parseDates(data.text, today);
  const codes = parseCodes(data);
  let from = codes[0], to = codes[1];
  if (codes.includes("TLV")) { from = "TLV"; to = codes.find((c) => c !== "TLV"); }
  return { dep: d[0], ret: d[1], from, to };
}
if (typeof module !== "undefined") module.exports = { parsePage, parseDates, parseCodes };
