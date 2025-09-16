const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

// Simple in-memory cookie jar per target URL
let cookieJar = {};

module.exports = async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url");

    const method = req.method.toUpperCase();
    const body = method === "POST" ? req.body : undefined;

    // Forward headers and cookies
    const headers = {
      "User-Agent": "Mozilla/5.0",
      "Accept": req.headers["accept"] || "*/*",
      "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9",
      "Referer": req.headers["referer"] || ""
    };
    if (cookieJar[targetUrl]) headers["Cookie"] = cookieJar[targetUrl];

    // Fetch target page
    const response = await fetch(targetUrl, { method, headers, body, redirect: "manual" });

    // Handle set-cookie headers
    const setCookie = response.headers.raw()["set-cookie"];
    if (setCookie) {
      cookieJar[targetUrl] = setCookie.map(c => c.split(";")[0]).join("; ");
      res.setHeader("Set-Cookie", setCookie);
    }

    // Handle redirects
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      const location = response.headers.get("location");
      const redirectUrl = location.startsWith("http") ? location : new URL(location, targetUrl).href;
      return res.redirect(`/api/fetcher?url=${encodeURIComponent(redirectUrl)}`);
    }

    const contentType = response.headers.get("content-type") || "";

    // Non-HTML: just stream through
    if (!contentType.includes("text/html")) {
      const buffer = await response.buffer();
      res.setHeader("Content-Type", contentType);
      return res.send(buffer);
    }

    // HTML rewriting
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Helper to rewrite URLs
    const rewriteAttr = (el, attr) => {
      let val = el.getAttribute(attr);
      if (!val) return;
      if (!val.startsWith("http") && !val.startsWith("//")) {
        try { val = new URL(val, targetUrl).href; } catch { return; }
      }
      el.setAttribute(attr, `/api/fetcher?url=${encodeURIComponent(val)}`);
    };

    // Rewrite links, forms, images, scripts, styles
    document.querySelectorAll("a[href], form[action]").forEach(el => {
      rewriteAttr(el, el.tagName === "A" ? "href" : "action");
    });
    document.querySelectorAll("img[src], script[src], link[href]").forEach(el => {
      const attr = el.tagName === "IMG" ? "src" : el.tagName === "SCRIPT" ? "src" : "href";
      rewriteAttr(el, attr);
    });

    // Rewrite inline style="url(...)"
    document.querySelectorAll("[style]").forEach(el => {
      let style = el.getAttribute("style");
      style = style.replace(/url\(["']?(.*?)["']?\)/g, (_, url) => {
        if (!url.startsWith("http") && !url.startsWith("//")) {
          try { url = new URL(url, targetUrl).href; } catch {}
        }
        return `url(/api/fetcher?url=${encodeURIComponent(url)})`;
      });
      el.setAttribute("style", style);
    });

    // Rewrite <style> blocks
    document.querySelectorAll("style").forEach(s => {
      s.textContent = s.textContent.replace(/url\(["']?(.*?)["']?\)/g, (_, url) => {
        if (!url.startsWith("http") && !url.startsWith("//")) {
          try { url = new URL(url, targetUrl).href; } catch {}
        }
        return `url(/api/fetcher?url=${encodeURIComponent(url)})`;
      });
    });

    // Rewrite inline JS fetch/ajax calls (simple regex)
    document.querySelectorAll("script").forEach(s => {
      if (!s.src) {
        s.textContent = s.textContent.replace(/fetch\(["'](.*?)["']/g, (_, url) => {
          if (!url.startsWith("http") && !url.startsWith("//")) {
            try { url = new URL(url, targetUrl).href; } catch {}
          }
          return `fetch("/api/fetcher?url=${encodeURIComponent(url)}"`;
        });
        s.textContent = s.textContent.replace(/XMLHttpRequest\(["'](.*?)["']/g, (_, url) => {
          if (!url.startsWith("http") && !url.startsWith("//")) {
            try { url = new URL(url, targetUrl).href; } catch {}
          }
          return `XMLHttpRequest("/api/fetcher?url=${encodeURIComponent(url)}"`;
        });
      }
    });

    // Proper headers
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    res.send(dom.serialize());
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error: " + err.message);
  }
};
