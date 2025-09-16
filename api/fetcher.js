const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const urlModule = require("url");

// Simple in-memory cookie jar (per serverless invocation)
let cookieJar = {};

module.exports = async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url");

    // Determine method and body
    const method = req.method.toUpperCase();
    const body = method === "POST" ? req.body : undefined;

    // Build request headers
    const headers = { "User-Agent": "Mozilla/5.0" };
    if (cookieJar[targetUrl]) headers["Cookie"] = cookieJar[targetUrl];

    // Forward certain client headers
    ["Accept", "Accept-Language", "Referer"].forEach(h => {
      if (req.headers[h.toLowerCase()]) headers[h] = req.headers[h.toLowerCase()];
    });

    // Fetch target URL
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual"
    });

    // Handle cookies from target
    const setCookie = response.headers.raw()["set-cookie"];
    if (setCookie) {
      cookieJar[targetUrl] = setCookie.map(c => c.split(";")[0]).join("; ");
      res.setHeader("Set-Cookie", setCookie);
    }

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      const location = response.headers.get("location");
      const redirectUrl = location.startsWith("http") ? location : new URL(location, targetUrl).href;
      return res.redirect(`/api/fetcher?url=${encodeURIComponent(redirectUrl)}`);
    }

    const contentType = response.headers.get("content-type") || "";

    // Non-HTML (JS/CSS/images etc.)
    if (!contentType.includes("text/html")) {
      const buffer = await response.buffer();
      res.setHeader("Content-Type", contentType);
      return res.send(buffer);
    }

    // HTML rewriting
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const rewriteAttr = (el, attr) => {
      let val = el.getAttribute(attr);
      if (!val) return;
      if (!val.startsWith("http") && !val.startsWith("//")) {
        try {
          val = new URL(val, targetUrl).href;
        } catch { return; }
      }
      el.setAttribute(attr, `/api/fetcher?url=${encodeURIComponent(val)}`);
    };

    // Rewrite links, scripts, forms, images, CSS
    document.querySelectorAll("a[href], form[action]").forEach(el => {
      const attr = el.tagName === "A" ? "href" : "action";
      rewriteAttr(el, attr);
    });

    document.querySelectorAll("script[src], link[href], img[src]").forEach(el => {
      const attr = el.tagName === "IMG" ? "src" : el.tagName === "SCRIPT" ? "src" : "href";
      rewriteAttr(el, attr);
    });

    // Rewrite inline CSS url()
    document.querySelectorAll("[style]").forEach(el => {
      let style = el.getAttribute("style");
      style = style.replace(/url\(["']?(.*?)["']?\)/g, (m, url) => {
        if (!url.startsWith("http") && !url.startsWith("//")) {
          try { url = new URL(url, targetUrl).href; } catch {}
        }
        return `url(/api/fetcher?url=${encodeURIComponent(url)})`;
      });
      el.setAttribute("style", style);
    });

    // Rewrite <style> blocks with url()
    document.querySelectorAll("style").forEach(s => {
      let css = s.textContent;
      css = css.replace(/url\(["']?(.*?)["']?\)/g, (m, url) => {
        if (!url.startsWith("http") && !url.startsWith("//")) {
          try { url = new URL(url, targetUrl).href; } catch {}
        }
        return `url(/api/fetcher?url=${encodeURIComponent(url)})`;
      });
      s.textContent = css;
    });

    // Headers for proper rendering
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    res.send(dom.serialize());
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error: " + err.message);
  }
};
