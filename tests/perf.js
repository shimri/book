// Rough performance check: extraction time on a large synthetic page (~13k nodes, 300 offer cards).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const cards = Array.from({ length: 300 }, (_, i) => `<div class="card"><div><img><span>Airline ${i}</span></div><div><div>${10 + (i % 12)}:${10 + (i % 50)} TLV</div><div>5h 10m Nonstop</div><div>${15 + (i % 8)}:${10 + (i % 40)} CDG</div></div><div><span>$</span><span>${200 + i}</span> <s>$${230 + i}</s><button>Select</button></div></div>`).join("");
  const noise = Array.from({ length: 4000 }, (_, i) => `<div class="n"><span>item ${i}</span><span>${i}</span></div>`).join("");
  await p.setContent(`<body>${noise}${cards}${noise}</body>`);
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "../flight-finder/pagelib.js"), "utf8") });
  const r = await p.evaluate(() => {
    const t = performance.now();
    const x = window.cf.extract("USD");
    return { ms: Math.round(performance.now() - t), x, nodes: document.querySelectorAll("*").length };
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
