// Saved history of past listings: list, save and delete.
// Everything here is behind the SITE_PASSWORD cookie via middleware.js, so
// there's a single shared history rather than per-user accounts.

import { getSql } from "../../lib/db";

const MAX_ENTRIES = 50;

export default async function handler(req, res) {
  try {
    const sql = await getSql();

    if (req.method === "GET") {
      const entries = await sql`
        SELECT id, created_at, listing_url, provider, prompt, photos, selected, settings
        FROM listing_history
        ORDER BY created_at DESC
        LIMIT ${MAX_ENTRIES}
      `;
      return res.status(200).json({ entries });
    }

    if (req.method === "POST") {
      const {
        listingUrl = "",
        provider = "",
        prompt,
        photos = [],
        selected = [],
        settings = {},
      } = req.body || {};

      if (!prompt) {
        return res.status(400).json({ error: "Nothing to save." });
      }

      const rows = await sql`
        INSERT INTO listing_history (listing_url, provider, prompt, photos, selected, settings)
        VALUES (
          ${listingUrl},
          ${provider},
          ${prompt},
          ${JSON.stringify(photos)},
          ${JSON.stringify(selected)},
          ${JSON.stringify(settings)}
        )
        RETURNING id, created_at
      `;

      return res.status(200).json({ entry: rows[0] });
    }

    if (req.method === "DELETE") {
      const id = Number(req.query.id);
      if (!id) {
        return res.status(400).json({ error: "Missing id." });
      }
      await sql`DELETE FROM listing_history WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Use GET, POST or DELETE." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
