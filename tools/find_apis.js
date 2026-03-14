#!/usr/bin/env node
// Simple educational scanner that discovers potentially public API endpoints on a site.
// WARNING: Run this only against sites you own or have explicit permission to test.

const { argv } = require('process');
const fetch = global.fetch;
if (!fetch) {
  console.error('Node environment without global fetch. Use Node >=18 or run with a fetch polyfill.');
  process.exit(1);
}

function usage() {
  console.log('Usage: node tools/find_apis.js <url> [maxDepth]');
  console.log('Example: node tools/find_apis.js https://example.com 2');
}

if (argv.length < 3) {
  usage();
  process.exit(1);
}

const startUrl = argv[2];
const maxDepth = Number(argv[3] || 2);
const origin = (() => { try { return new URL(startUrl).origin } catch(e){ return null } })();
if (!origin) { console.error('Invalid URL'); process.exit(1) }

const visited = new Set();
const queue = [{ url: startUrl, depth: 0 }];
const found = new Set();

const commonApiCandidates = [
  '/openapi.json', '/swagger.json', '/swagger/v1/swagger.json', '/api', '/api/', '/api/v1/', '/api/v1', '/api-docs', '/docs', '/.well-known/openid-configuration'
];

function extractUrls(base, text) {
  const urls = new Set();
  const hrefRe = /href=["']([^"'#>]+)["']/ig;
  const srcRe = /src=["']([^"'#>]+)["']/ig;
  const fetchRe = /fetch\(\s*["']([^"']+)["']/ig;
  const axiosRe = /axios\.(?:get|post|put|delete)\(\s*["']([^"']+)["']/ig;

  let m;
  while ((m = hrefRe.exec(text))) urls.add(m[1]);
  while ((m = srcRe.exec(text))) urls.add(m[1]);
  while ((m = fetchRe.exec(text))) urls.add(m[1]);
  while ((m = axiosRe.exec(text))) urls.add(m[1]);

  // quick API pattern matches like /api/... or .json endpoints
  const apiRe = /["'\(]((?:https?:)?\/\/[^"'\)\s]+|\/[^"'\)\s]+|api\/[A-Za-z0-9_\-/\.]+)["'\)]/ig;
  while ((m = apiRe.exec(text))) urls.add(m[1]);

  const resolved = [];
  for (const u of urls) {
    try {
      const absolute = new URL(u, base).href;
      resolved.push(absolute);
    } catch (e) {
    }
  }
  return resolved;
}

async function probeUrl(u) {
  try {
    const res = await fetch(u, { method: 'HEAD', redirect: 'follow', cache: 'no-store' , headers: { 'User-Agent': 'educational-api-scanner/1.0' }, timeout: 10000 });
    return { url: u, status: res.status, ok: res.ok, contentType: res.headers.get('content-type') || '' };
  } catch (e) {
    return { url: u, error: e.message };
  }
}

async function crawl() {
  while (queue.length) {
    const { url, depth } = queue.shift();
    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);
    process.stdout.write(`Crawling (${visited.size}) ${url}\n`);
    let text = '';
    try {
      const res = await fetch(url, { redirect: 'follow', cache: 'no-store', headers: { 'User-Agent': 'educational-api-scanner/1.0' }, timeout: 15000 });
      text = await res.text();
    } catch (e) {
      continue;
    }

    // find candidate endpoints embedded in the page
    const urls = extractUrls(url, text);
    for (const u of urls) {
      try {
        const parsed = new URL(u);
        // only consider same-origin or absolute API-looking hosts
        if (parsed.origin === origin || parsed.pathname.match(/api|openapi|swagger|json|docs/i)) {
          found.add(parsed.href);
        }
      } catch (e) {
      }
      // enqueue same-origin links for crawling
      try {
        const nu = new URL(u, url);
        if (nu.origin === origin && !visited.has(nu.href)) queue.push({ url: nu.href, depth: depth + 1 });
      } catch (e) {}
    }

    // also probe common API paths
    for (const p of commonApiCandidates) {
      try {
        const u = new URL(p, origin).href;
        found.add(u);
      } catch(e){}
    }
  }

  // probe discovered endpoints (HEAD, then GET if content-type looks like json)
  const results = [];
  for (const u of [...found]) {
    const info = await probeUrl(u);
    results.push(info);
    if (info.ok && info.contentType && info.contentType.includes('application/json')) {
      try {
        const res = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'educational-api-scanner/1.0' }, timeout: 15000 });
        const j = await res.text();
        results.push({ url: u + ' (GET)', snippet: j.slice(0, 1000) });
      } catch (e) {}
    }
  }

  // print summary
  console.log('\n--- Scan results ---');
  for (const r of results) {
    if (r.error) console.log(`- ${r.url} -> ERROR: ${r.error}`);
    else console.log(`- ${r.url} -> ${r.status} ${r.contentType || ''}`);
  }
}

// Run
(async () => {
  console.log('Educational API scanner — only use on sites you own or have permission to test.');
  await crawl();
})();
