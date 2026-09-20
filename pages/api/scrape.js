// Fetches an Airbnb listing page and pulls out photo URLs.
// Airbnb doesn't offer a public API for this, so this reads the page's
// own HTML/JSON. If Airbnb changes their markup this may need updating.

// Airbnb's photo tour data carries a room name per photo in its
// accessibility label ("Living room image 2"), which is where the room
// labels come from. Paired with baseUrl so a label can't drift onto the
// wrong photo.
const LABELLED_PHOTO =
  /"accessibilityLabel":"((?:[^"\\]|\\.)*)","baseUrl":"(https:\/\/a0\.muscache\.com\/im\/pictures\/[^"]+?)"/g;

// Fallback for when the photo tour isn't in the page: any listing-looking
// image URL, with no room label available.
const ANY_PHOTO = /https:\/\/a0\.muscache\.com\/[^"'\\]+\.(?:jpg|jpeg|png|webp)/gi;

const JUNK = /user|avatar|profile|icon/i;

// "Living room image 2" -> "Living room"
function roomFromLabel(label) {
  return label.replace(/\s*image\s*\d+\s*$/i, "").trim();
}

function collect(html) {
  const seen = new Set();
  const photos = [];

  const add = (rawUrl, room) => {
    const cleaned = rawUrl.replace(/\?.*$/, "");
    const key = cleaned.split("/").pop();
    if (seen.has(key) || JUNK.test(cleaned)) return;
    seen.add(key);
    photos.push({ url: `${cleaned}?im_w=1200`, room: room || "" });
  };

  LABELLED_PHOTO.lastIndex = 0;
  let match;
  while ((match = LABELLED_PHOTO.exec(html))) {
    add(match[2], roomFromLabel(match[1]));
  }

  // Only fall back if the photo tour gave us nothing at all; mixing the two
  // would pull in duplicate size variants of photos we already have.
  if (photos.length === 0) {
    for (const raw of html.match(ANY_PHOTO) || []) {
      add(raw, "");
    }
  }

  return photos;
}

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
    const photos = collect(html);

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
