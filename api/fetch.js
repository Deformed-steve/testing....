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

    // Strip headers that block iframing
    res.setHeader("Content-Type", contentType);
    res.removeHeader?.("content-security-policy");
    res.removeHeader?.("x-frame-options");

    // If HTML → rewrite links/resources
    if (contentType.includes("text/html")) {
      let body = await upstream.text();
      const baseUrl = new URL(target);

      // Rewrite src, href, action attributes → route through /fetch
      body = body.replace(
        /(src|href|action)=["'](?!https?:\/\/)([^"']+)["']/g,
        (match, attr, relPath) => {
          const absoluteUrl = new URL(relPath, baseUrl).href;
          return `${attr}="/api/fetch?url=${encodeURIComponent(absoluteUrl)}"`;
        }
      );

      // Also rewrite absolute external links → through /fetch
      body = body.replace(
        /(src|href|action)=["']https?:\/\/([^"']+)["']/g,
        (match, attr, link) => {
          return `${attr}="/api/fetch?url=https://${link}"`;
        }
      );

      res.status(200).send(body);
    } else {
      // Non-HTML → stream raw
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.status(200).send(buffer);
    }
  } catch (err) {
    res.status(500).send("Error fetching: " + err.message);
  }
}
