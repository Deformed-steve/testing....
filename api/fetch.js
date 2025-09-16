export default async function handler(req, res) {
  const target = req.query.url;

  if (!target) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    const response = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const contentType = response.headers.get("content-type") || "text/plain";
    const body = await response.text();

    res.setHeader("Content-Type", contentType);
    res.status(200).send(body);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch: " + err.message });
  }
}
