export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) {
    res.status(400).send("Missing url parameter");
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
      }
    });

    let contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    // Strip blocking headers
    res.removeHeader?.("content-security-policy");
    res.removeHeader?.("x-frame-options");

    if (contentType.includes("text/html")) {
      let body = await upstream.text();
      const baseUrl = new URL(target);

      // Add <base> so relative paths resolve correctly in browser
      body = body.replace(
        /<head[^>]*>/i,
        match => `${match}<base href="${baseUrl.origin}">`
      );

      // Rewrite relative URLs (scripts, links, forms, images, etc.)
      body = body.replace(
        /(src|href|action)=["'](?!https?:\/\/|data:|mailto:|#)([^"']+)["']/gi,
        (m, attr, rel) => {
          const absoluteUrl = new URL(rel, baseUrl).href;
          return `${attr}="/api/fetch?url=${encodeURIComponent(absoluteUrl)}"`;
        }
      );

      // Rewrite absolute external URLs → funnel through /api/fetch
      body = body.replace(
        /(src|href|action)=["']https?:\/\/([^"']+)["']/gi,
        (m, attr) => {
          const url = m.match(/["'](https?:\/\/[^"']+)["']/)[1];
          return `${attr}="/api/fetch?url=${encodeURIComponent(url)}"`;
        }
      );

      res.status(200).send(body);
    } else {
      // Non-HTML (CSS, JS, images, fonts, etc.)
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.status(200).send(buffer);
    }
  } catch (err) {
    res.status(500).send("Error fetching: " + err.message);
  }
}
