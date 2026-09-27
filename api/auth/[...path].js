export default async function handler(req, res) {
  const base = process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL;
  if (!base) return res.status(503).json({ error: "Auth not configured" });

  const path = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path || "";

  // Neon Auth's generated URL may already include /api/auth.
  // Appending it unconditionally produced /api/auth/api/auth/* and 404s.
  const cleanBase = base.replace(/\/$/, "");
  const authBase = /\/api\/auth$/i.test(cleanBase)
    ? cleanBase
    : cleanBase + "/api/auth";
  const url = authBase + "/" + path;

  const headers = {};
  ["content-type", "cookie", "authorization"].forEach((key) => {
    if (req.headers[key]) headers[key] = req.headers[key];
  });

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body),
      redirect: "manual",
    });

    const body = await upstream.text();
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) res.setHeader("set-cookie", setCookie);

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("content-type", contentType);

    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error("Neon Auth proxy error", error);
    return res
      .status(502)
      .json({ error: "Authentication service unavailable" });
  }
}
