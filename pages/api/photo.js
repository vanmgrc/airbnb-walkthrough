// Proxies a single listing photo so the browser can read its bytes.
// Airbnb's CDN doesn't send CORS headers, so fetching these directly from
// client JS fails even though the same URLs load fine in an <img> tag.

// Only proxy Airbnb's own image CDN. Without this the endpoint would be an
// open proxy that could be pointed at anything, including internal hosts.
function isAllowedHost(hostname) {
  return hostname === "muscache.com" || hostname.endsWith(".muscache.com");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url." });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid url." });
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    return res.status(400).json({ error: "That host isn't allowed." });
  }

  try {
    const imgRes = await fetch(parsed.toString());
    if (!imgRes.ok) {
      return res.status(502).json({ error: `Image request failed with status ${imgRes.status}.` });
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch that image: " + err.message });
  }
}
