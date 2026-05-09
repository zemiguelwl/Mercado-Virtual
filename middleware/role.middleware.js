const Supermarket = require("../models/Supermarket");

function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) return res.redirect("/auth/login");
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render("errors/403", {
        title: "Acesso negado",
        message: "Não tens permissão para aceder a esta página."
      });
    }
    return next();
  };
}

async function isSupermarketApproved(req, res, next) {
  try {
    const supermarketId = req.session.user?.supermarketId;
    if (!supermarketId) {
      return res.render("supermarket/pending", { title: "Conta pendente", status: "pending" });
    }
    const supermarket = await Supermarket.findById(supermarketId).select("status").lean();
    if (!supermarket || supermarket.status !== "approved") {
      return res.render("supermarket/pending", {
        title: "Conta pendente",
        status: supermarket?.status || "pending"
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { hasRole, isSupermarketApproved };
