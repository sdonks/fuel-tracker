/**
 * Cloudflare Worker — Fuel Price Scraper
 * Scrape peco.ro si returneaza preturile pentru benzina 95
 * Deploy: wrangler deploy
 */

const PECO_URL = 'https://peco.ro/';

const STATIONS = ['MOL', 'Rompetrol', 'OMV', 'Petrom', 'Socar', 'Lukoil'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const res = await fetch(PECO_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ro-RO,ro;q=0.9',
        },
        cf: { cacheTtl: 1800, cacheEverything: true },
      });

      if (!res.ok) throw new Error('peco.ro returned ' + res.status);

      const html = await res.text();
      const prices = parsePrices(html);

      if (prices.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nu s-au putut extrage prețuri', raw_length: html.length }),
          { status: 500, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({
          prices,
          fetched_at: new Date().toISOString(),
          source: 'peco.ro',
        }),
        { headers: CORS_HEADERS }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  },
};

function parsePrices(html) {
  const results = [];
  const seen = new Set();

  // peco.ro foloseste structuri de tip tabel sau card pentru fiecare statie
  // Pattern 1: gasim randul/cardul care contine numele statiei si pretul benzinei 95
  // Regex-ul cauta combinatii de tip "MOL ... 6.85" sau "6,85" in vecinatatea numelui statiei

  const priceRegex = /(\d{1,2}[.,]\d{2})/g;

  // Incercam sa gasim sectiuni per statie
  for (const station of STATIONS) {
    // cauta blocul HTML care contine numele statiei (case-insensitive)
    const stationPattern = new RegExp(
      `(?:${station})[\\s\\S]{0,400}?(\\d{1,2}[.,]\\d{2})`,
      'i'
    );
    const match = html.match(stationPattern);

    if (match) {
      const priceStr = match[1].replace(',', '.');
      const price = parseFloat(priceStr);

      // filtrare valori reale de pret (benzina in Romania 5.50-9.99)
      if (price >= 5.0 && price <= 12.0 && !seen.has(station)) {
        seen.add(station);
        results.push({ station, price, fuel: 'Benzina 95' });
      }
    }
  }

  // Fallback: daca n-am gasit prin statie, luam primele N preturi distincte din pagina
  if (results.length === 0) {
    const allPrices = [...html.matchAll(/(\d{1,2}[.,]\d{2})/g)]
      .map(m => parseFloat(m[1].replace(',', '.')))
      .filter(p => p >= 5.0 && p <= 12.0);

    const unique = [...new Set(allPrices)].slice(0, 6);
    unique.forEach((price, i) => {
      results.push({ station: STATIONS[i] || `Statie ${i+1}`, price, fuel: 'Benzina 95' });
    });
  }

  return results;
}
