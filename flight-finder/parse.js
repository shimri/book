// Parses origin/destination/dates out of what scrapePage() returned. Used by popup.js.
const MONTHS = { "ינו": 1, "פבר": 2, "מרץ": 3, "אפר": 4, "מאי": 5, "יונ": 6, "יול": 7, "אוג": 8, "ספט": 9, "אוק": 10, "נוב": 11, "דצמ": 12 };
const MON = "(ינו|פבר|מרץ|אפר|מאי|יונ|יול|אוג|ספט|אוק|נוב|דצמ)";
const NOT_CODES = new Set(["USD", "EUR", "ILS", "NIS", "GBP", "FAQ", "PDF", "VAT", "SMS", "FAX", "TEL", "APP", "WWW", "CEO"]);
const p2 = (n) => String(n).padStart(2, "0");

function mkDate(day, mon, yearHint, today) {
  let y = yearHint || today.getFullYear();
  let d = new Date(Date.UTC(y, mon - 1, day));
  if (!yearHint && d < new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))) d = new Date(Date.UTC(y + 1, mon - 1, day));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

function parseDates(s, today = new Date()) {
  const out = [];
  for (const m of s.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of s.matchAll(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/g)) out.push(`${m[3]}-${p2(m[2])}-${p2(m[1])}`);
  for (const m of s.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  if (!out.length) {
    const yearHint = (s.match(/\b(20\d{2})\b/) || [])[1];
    const y = yearHint ? parseInt(yearHint, 10) : null;
    // Hebrew range like "15 דצמ - 18 דצמ" (order may be flipped by RTL, so we sort afterwards)
    const range = s.match(new RegExp(`(\\d{1,2})\\s*${MON}\\S*\\s*[-–]\\s*(\\d{1,2})\\s*${MON}`));
    if (range) {
      out.push(mkDate(+range[1], MONTHS[range[2]], y, today), mkDate(+range[3], MONTHS[range[4]], y, today));
    } else {
      const one = s.match(new RegExp(`(\\d{1,2})\\s*${MON}`));
      if (one) out.push(mkDate(+one[1], MONTHS[one[2]], y, today));
    }
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
