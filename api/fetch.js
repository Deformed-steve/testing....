export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
    let contentType = response.headers.get("content-type") || "text/html";

    // Only rewrite if it's HTML
    if (contentType.includes("text/html")) {
      let body = await response.text();
      const baseUrl = new URL(target);

      // Fix <script>, <link>, <img>, <a>, etc.
      body = body.replace(
        /(src|href)=["'](?!https?:\/\/)([^"']+)["']/g,
        (match, attr, relPath) => {
          const absoluteUrl = new URL(relPath, baseUrl).href;
          return `${attr}="${absoluteUrl}"`;
        }
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(body);
    } else {
      // Non-HTML (CSS, JS, images) → pipe as-is
      const buf = await response.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.status(200).send(Buffer.from(buf));
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch: " + err.message });
  }
}
