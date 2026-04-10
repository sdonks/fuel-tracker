/**
 * Cloudflare Worker — fuel-prices
 * Scrape peco.ro pentru preturi benzina 95
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const STATION_NAMES = ['MOL', 'Rompetrol', 'OMV', 'Petrom', 'Socar', 'Lukoil', 'Gazprom'];

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      const html = await fetchPeco();
      const prices = extractPrices(html);

      return new Response(JSON.stringify({
        prices,
        fetched_at: new Date().toISOString(),
        source: 'peco.ro',
      }), { headers: CORS });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, prices: [] }), {
        status: 500, headers: CORS
      });
    }
  }
};

async function fetchPeco() {
  const res = await fetch('https://peco.ro/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    },
    cf: { cacheTtl: 1800, cacheEverything: true },
  });
  if (!res.ok) throw new Error('peco.ro HTTP ' + res.status);
  return res.text();
}

function extractPrices(html) {
  const results = [];
  const seen = new Set();

  // Strategie 1: cauta blocuri HTML care contin numele statiei langa un pret
  for (const name of STATION_NAMES) {
    // Cauta aparitia numelui statiei si extrage primul numar de pret (5.xx - 9.xx) din urmatorii 600 chars
    const re = new RegExp(`${name}[\\s\\S]{0,600}?(\\d{1,2}[.,]\\d{2})`, 'i');
    const m  = html.match(re);
    if (m) {
      const p = parseFloat(m[1].replace(',', '.'));
      if (p >= 5.5 && p <= 12 && !seen.has(name)) {
        seen.add(name);
        results.push({ station: name, price: p, fuel: 'Benzina 95' });
      }
    }
  }

  // Strategie 2: fallback - extrage toate preturile din range valid si asociaza cu statii
  if (results.length < 2) {
    const allMatches = [...html.matchAll(/(\d{1,2}[.,]\d{2})/g)];
    const valid = allMatches
      .map(m => parseFloat(m[1].replace(',', '.')))
      .filter(p => p >= 5.5 && p <= 12);

    // Deduplica si pastreaza doar valori distincte (diferenta > 0.01)
    const deduped = [];
    for (const p of valid) {
      if (!deduped.some(x => Math.abs(x - p) < 0.02)) deduped.push(p);
      if (deduped.length >= 6) break;
    }

    deduped.forEach((price, i) => {
      const station = STATION_NAMES[i] || `Stație ${i + 1}`;
      if (!seen.has(station)) {
        seen.add(station);
        results.push({ station, price, fuel: 'Benzina 95' });
      }
    });
  }

  // Sorteaza dupa pret crescator
  results.sort((a, b) => a.price - b.price);
  return results.slice(0, 6);
}
