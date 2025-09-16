const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

// Simple in-memory cookie jar (per serverless invocation)
let cookieJar = {};

module.exports = async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Missing url");

  try {
    // Prepare headers including cookies
    let headers = { "User-Agent": "Mozilla/5.0" };
    if (cookieJar[targetUrl]) headers["Cookie"] = cookieJar[targetUrl];

    // Fetch the target page
    const response = await fetch(targetUrl, { headers });
    const contentType = response.headers.get("content-type") || "";

    // Capture cookies from response
    const setCookie = response.headers.raw()["set-cookie"];
    if (setCookie) {
      cookieJar[targetUrl] = setCookie.map(c => c.split(";")[0]).join("; ");
    }

    // If it's not HTML, just pipe it directly (images, CSS, JS)
    if (!contentType.includes("text/html")) {
      const buffer = await response.buffer();
      res.setHeader("Content-Type", contentType);
      return res.send(buffer);
    }

    // Parse HTML and rewrite URLs
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Rewrite <a href>, <form action>
    document.querySelectorAll("a[href], form[action]").forEach(el => {
      const attr = el.tagName === "A" ? "href" : "action";
      let val = el.getAttribute(attr);
      if (!val) return;
      if (!val.startsWith("http")) val = new URL(val, targetUrl).href;
      el.setAttribute(attr, `/api/fetcher?url=${encodeURIComponent(val)}`);
    });

    // Rewrite <img src>, <script src>, <link href>
    document.querySelectorAll("img[src], script[src], link[href]").forEach(el => {
      const attr = el.tagName === "IMG" ? "src" : el.tagName === "SCRIPT" ? "src" : "href";
      let val = el.getAttribute(attr);
      if (!val) return;
      if (!val.startsWith("http")) val = new URL(val, targetUrl).href;
      el.setAttribute(attr, `/api/fetcher?url=${encodeURIComponent(val)}`);
    });

    // Serve rewritten HTML
    res.setHeader("Content-Type", "text/html");
    res.send(dom.serialize());

  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch target URL: " + err.message);
  }
};
