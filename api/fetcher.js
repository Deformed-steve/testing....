import fetch from "node-fetch";
import { JSDOM } from "jsdom";

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing url");

  try {
    // Fetch original page
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    let html = await response.text();

    // Rewrite HTML links, scripts, forms to point through this proxy
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Rewrite all <a href>
    document.querySelectorAll("a[href]").forEach(a => {
      let href = a.getAttribute("href");
      if (!href.startsWith("http")) href = new URL(href, url).href;
      a.setAttribute("href", `/api/fetcher?url=${encodeURIComponent(href)}`);
    });

    // Rewrite <form action>
    document.querySelectorAll("form[action]").forEach(f => {
      let action = f.getAttribute("action");
      if (!action.startsWith("http")) action = new URL(action, url).href;
      f.setAttribute("action", `/api/fetcher?url=${encodeURIComponent(action)}`);
    });

    // Rewrite <script src>
    document.querySelectorAll("script[src]").forEach(s => {
      let src = s.getAttribute("src");
      if (!src.startsWith("http")) src = new URL(src, url).href;
      s.setAttribute("src", `/api/fetcher?url=${encodeURIComponent(src)}`);
    });

    // Rewrite <link href>
    document.querySelectorAll("link[href]").forEach(l => {
      let href = l.getAttribute("href");
      if (!href.startsWith("http")) href = new URL(href, url).href;
      l.setAttribute("href", `/api/fetcher?url=${encodeURIComponent(href)}`);
    });

    // Rewrite <img src>
    document.querySelectorAll("img[src]").forEach(img => {
      let src = img.getAttribute("src");
      if (!src.startsWith("http")) src = new URL(src, url).href;
      img.setAttribute("src", `/api/fetcher?url=${encodeURIComponent(src)}`);
    });

    res.setHeader("Content-Type", "text/html");
    res.send(dom.serialize());
  } catch (err) {
    res.status(500).send("Error fetching page: " + err.message);
  }
}
