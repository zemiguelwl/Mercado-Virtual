// Middleware que protege rotas privadas, garantindo que apenas utilizadores autenticados conseguem aceder a páginas sensíveis 

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash("error", "Precisas de estar autenticado para aceder a esta página.");

  const dest = req.originalUrl || "/";
  const isAuthRoute = dest.startsWith("/auth/");
  const safeNext = !isAuthRoute && dest.startsWith("/") && !dest.startsWith("//")
    ? dest
    : "";

  const redirectUrl = safeNext
    ? `/auth/login?next=${encodeURIComponent(safeNext)}`
    : "/auth/login";

  return res.redirect(redirectUrl);
}

module.exports = { isAuthenticated };
