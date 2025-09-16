import { Ultraviolet } from "ultraviolet";

const uv = new Ultraviolet({ 
  debug: false,
  inject: false
});

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing url parameter");

  try {
    const content = await uv.fetch(url);
    res.setHeader("Content-Type", "text/html");
    res.send(content);
  } catch (err) {
    res.status(500).send("UV Fetch Error: " + err.message);
  }
}
