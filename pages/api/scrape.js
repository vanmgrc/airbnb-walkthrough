// Fetches an Airbnb listing page and pulls out photo URLs.
// Airbnb doesn't offer a public API for this, so this reads the page's
// own HTML/JSON. If Airbnb changes their markup this may need updating.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { url } = req.body || {};
  if (!url || !/airbnb\.[a-z.]+\/rooms\//i.test(url)) {
    return res.status(400).json({ error: "That doesn't look like an Airbnb listing URL." });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Airbnb returned status ${response.status}. The listing may be unavailable or blocked automated access.` });
    }

    const html = await response.text();

    // Airbnb serves listing photos from muscache.com. Pull every URL that
    // looks like a real listing photo (not icons/avatars) and dedupe.
    const matches = html.match(/https:\/\/a0\.muscache\.com\/[^"'\\]+\.(?:jpg|jpeg|png|webp)/gi) || [];

    const seen = new Set();
    const photos = [];
    for (const raw of matches) {
      // Normalize to a decent-sized version of the image
      const cleaned = raw.replace(/\?.*$/, "");
      const key = cleaned.split("/").pop();
      if (seen.has(key)) continue;
      // Filter out obvious non-listing assets (tiny icons, user avatars)
      if (/user|avatar|profile|icon/i.test(cleaned)) continue;
      seen.add(key);
      photos.push(`${cleaned}?im_w=1200`);
    }

    if (photos.length === 0) {
      return res.status(404).json({
        error:
          "Couldn't find any photos on that page. Airbnb may have changed their page structure, or the listing requires login to view.",
      });
    }

    return res.status(200).json({ photos: photos.slice(0, 60) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch that URL: " + err.message });
  }
}
