export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }
  const { password } = req.body || {};
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return res.status(500).json({ error: "SITE_PASSWORD is not set on the server." });
  }

  if (password === sitePassword) {
    res.setHeader(
      "Set-Cookie",
      `auth=${encodeURIComponent(sitePassword)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`
    );
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: "Wrong password" });
}
