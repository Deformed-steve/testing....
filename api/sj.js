import { HttpClient } from "scramjet";

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing url parameter");

  try {
    const response = await HttpClient.get(url);
    const body = await response.body(); 
    res.setHeader("Content-Type", "text/html");
    res.send(body.toString());
  } catch (err) {
    res.status(500).send("Scramjet Fetch Error: " + err.message);
  }
}
