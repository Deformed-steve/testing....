const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

// Simple in-memory cookie jar
let cookieJar = {};

module.exports = async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url');

    const method = req.method.toUpperCase();
    const body = method === 'POST' ? req.body : undefined;

    // Full browser headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': req.headers['referer'] || '',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    };
    if (cookieJar[targetUrl]) headers['Cookie'] = cookieJar[targetUrl];

    const response = await fetch(targetUrl, { method, headers, body, redirect: 'manual' });

    const setCookie = response.headers.raw()['set-cookie'];
    if (setCookie) {
      cookieJar[targetUrl] = setCookie.map(c => c.split(';')[0]).join('; ');
      res.setHeader('Set-Cookie', setCookie);
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      const location = response.headers.get('location');
      const redirectUrl = location.startsWith('http') ? location : new URL(location, targetUrl).href;
      return res.redirect(`/api/fetcher?url=${encodeURIComponent(redirectUrl)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      const buffer = await response.buffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache');
      return res.send(buffer);
    }

    let html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Rewrite helper
    const rewriteAttr = (el, attr) => {
      let val = el.getAttribute(attr);
      if (!val) return;
      if (!val.startsWith('http') && !val.startsWith('//')) {
        try { val = new URL(val, targetUrl).href; } catch { return; }
      }
      el.setAttribute(attr, `/api/fetcher?url=${encodeURIComponent(val)}`);
    };

    document.querySelectorAll('a[href], form[action]').forEach(el => {
      rewriteAttr(el, el.tagName === 'A' ? 'href' : 'action');
    });
    document.querySelectorAll('img[src], script[src], link[href]').forEach(el => {
      const attr = el.tagName === 'IMG' ? 'src' : el.tagName === 'SCRIPT' ? 'src' : 'href';
      rewriteAttr(el, attr);
    });

    // Inline style="url(...)"
    document.querySelectorAll('[style]').forEach(el => {
      let style = el.getAttribute('style');
      style = style.replace(/url\(["']?(.*?)["']?\)/g, (_, url) => {
        if (!url.startsWith('http') && !url.startsWith('//')) {
          try { url = new URL(url, targetUrl).href; } catch {}
        }
        return `url(/api/fetcher?url=${encodeURIComponent(url)})`;
      });
      el.setAttribute('style', style);
    });

    // Rewrite <style> blocks
    document.querySelectorAll('style').forEach(s => {
      s.textContent = s.textContent
        .replace(/url\(["']?(.*?)["']?\)/g, (_, url) => {
          if (!url.startsWith('http') && !url.startsWith('//')) {
            try { url = new URL(url, targetUrl).href; } catch {}
          }
          return `url(/api/fetcher?url=${encodeURIComponent(url)})`;
        })
        .replace(/@import\s+["'](.*?)["']/g, (_, url) => {
          if (!url.startsWith('http') && !url.startsWith('//')) {
            try { url = new URL(url, targetUrl).href; } catch {}
          }
          return `@import "/api/fetcher?url=${encodeURIComponent(url)}"`;
        });
    });

    // Rewrite inline JS fetch/XHR
    document.querySelectorAll('script').forEach(s => {
      if (!s.src) {
        s.textContent = s.textContent
          .replace(/fetch\(["'](.*?)["']/g, (_, url) => {
            if (!url.startsWith('http') && !url.startsWith('//')) {
              try { url = new URL(url, targetUrl).href; } catch {}
            }
            return `fetch("/api/fetcher?url=${encodeURIComponent(url)}"`;
          })
          .replace(/XMLHttpRequest\(["'](.*?)["']/g, (_, url) => {
            if (!url.startsWith('http') && !url.startsWith('//')) {
              try { url = new URL(url, targetUrl).href; } catch {}
            }
            return `XMLHttpRequest("/api/fetcher?url=${encodeURIComponent(url)}"`;
          });
      }
    });

    // Frontend shim
    const frontendShim = document.createElement('script');
    frontendShim.textContent = `
      const oldFetch = window.fetch;
      window.fetch = function(url, options) {
        if (!url.startsWith('http')) url = '/api/fetcher?url=' + encodeURIComponent(url);
        return oldFetch(url, options);
      };
      const oldXHR = window.XMLHttpRequest.prototype.open;
      window.XMLHttpRequest.prototype.open = function(method, url) {
        if (!url.startsWith('http')) url = '/api/fetcher?url=' + encodeURIComponent(url);
        return oldXHR.apply(this, arguments);
      };
    `;
    document.head.appendChild(frontendShim);

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(dom.serialize());

  } catch (err) {
    console.error(err);
    res.status(500).send('Proxy error: ' + err.message);
  }
};
