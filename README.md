# Calculator Benzină

Webapp static pentru calculat costul benzinei între două adrese.

## Structura

```
index.html     — frontend (GitHub Pages)
worker.js      — Cloudflare Worker (scraper peco.ro)
wrangler.toml  — config deploy worker
```

---

## Setup pas cu pas

### 1. Deploy Cloudflare Worker

Ai nevoie de un cont Cloudflare (gratuit).

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Dupa deploy, Wrangler iti da un URL de tipul:
`https://fuel-prices.YOUR_SUBDOMAIN.workers.dev`

### 2. Actualizeaza URL-ul in index.html

Deschide `index.html` si inlocuieste linia:

```js
const WORKER_URL = 'https://fuel-prices.YOUR_SUBDOMAIN.workers.dev';
```

cu URL-ul real primit de la Wrangler.

### 3. Deploy pe GitHub Pages

```bash
git init
git add .
git commit -m "init fuel calculator"
git remote add origin https://github.com/TU/REPO.git
git push -u origin main
```

Mergi la **Settings → Pages → Source: main / root** si activeaza.

---

## Note

- Workerul face cache 30 minute pe raspunsul de la peco.ro (CF edge cache)
- Daca scraping-ul esueaza (peco.ro isi schimba structura HTML), poti folosi campul manual
- Workerul e gratuit pe planul Cloudflare Free (100k req/zi)
