import { HttpError } from "../lib/http-error.js";

export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

/* HttpErrors and body-parser errors (bad JSON, too large) are safe to show;
   anything else is logged and hidden behind a generic message. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const known = err instanceof HttpError || err.expose;
  const status = known ? err.status || err.statusCode || 400 : 500;
  if (!known || status >= 500) console.error("[error]", err);
  res.status(status).json({
    error: known ? err.message : "Something went wrong",
    ...(err.extra || {}),
  });
}
