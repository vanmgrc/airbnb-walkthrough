// Sends the selected listing photos to Claude and gets back a
// Higgsfield-ready walkthrough video prompt.

function buildSystemPrompt({ aspectRatio, duration, includeTitle, titleText }) {
  const titleLine = includeTitle
    ? `The video must open with a title card before any room footage: display the text "${titleText || "the property name"}" on screen for roughly 2 seconds, then cut to the first shot. Say this explicitly in the shot structure section.`
    : `Do not include a title card or any on-screen text. Open directly on the first room shot.`;

  return `You write prompts for Higgsfield, an AI video generator, based on real estate photos.

Higgsfield prompts work best as short, direct sentences rather than long descriptive paragraphs. Keep these as separate, clearly labeled parts rather than blending them into one block:

1. Shot structure: state the aspect ratio (${aspectRatio}) and total duration (${duration} seconds) at the very top. ${titleLine} Then lay out how many shots/scenes make up the rest of the walkthrough and how they're sequenced room to room, so the total adds up to ${duration} seconds.
2. Space and identity: what the property actually looks like, room by room, in plain concrete language (layout, materials, colors, furniture, standout features). This should stay consistent with what's actually in the photos, don't invent rooms or features you can't see.
3. Camera movement: for each shot, one clear camera instruction (e.g. "slow dolly forward into the living room", "smooth pan left across the kitchen island"). Use real estate walkthrough conventions: steady, welcoming, not chaotic.
4. Lighting and mood: keep this separate from camera instructions. Describe the lighting quality and overall mood/style (warm, bright, cozy, minimal, etc.) based on what's in the photos.

Output the final prompt as plain text formatted with those four labeled sections, ready to paste directly into Higgsfield. Do not add commentary before or after it.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const {
    photos,
    notes,
    aspectRatio = "9:16",
    duration = 30,
    includeTitle = false,
    titleText = "",
  } = req.body || {};

  if (!Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: "No photos selected." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it in Vercel's project settings." });
  }

  try {
    // Fetch each image and convert to base64 so Claude can see them.
    const imageBlocks = [];
    for (const photoUrl of photos) {
      const imgRes = await fetch(photoUrl);
      if (!imgRes.ok) continue;
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";
      imageBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: contentType,
          data: buffer.toString("base64"),
        },
      });
    }

    if (imageBlocks.length === 0) {
      return res.status(400).json({ error: "Couldn't load any of the selected photos." });
    }

    const userText = notes
      ? `Here are the selected listing photos. Additional notes from the host: ${notes}`
      : "Here are the selected listing photos.";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        system: buildSystemPrompt({ aspectRatio, duration, includeTitle, titleText }),
        messages: [
          {
            role: "user",
            content: [...imageBlocks, { type: "text", text: userText }],
          },
        ],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return res.status(502).json({ error: data?.error?.message || "Claude API request failed." });
    }

    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");

    return res.status(200).json({ prompt: text });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate prompt: " + err.message });
  }
}
