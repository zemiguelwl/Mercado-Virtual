const express = require("express");
const rateLimit = require("express-rate-limit");
const { isAuthenticated } = require("../middleware/auth.middleware");
const { hasRole } = require("../middleware/role.middleware");
const client = require("../controllers/client.controller");
const { validateClientCoupon } = require("../controllers/coupon.controller");
const router = express.Router();

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Demasiadas tentativas de checkout. Tenta novamente em 10 minutos."
});

router.use(isAuthenticated);
router.use(hasRole("client"));

router.get("/dashboard", client.dashboard);
router.get("/profile", client.profileGet);
router.post("/profile", client.profilePost);
router.get("/orders", client.ordersList);
router.get("/orders/:id", client.orderDetail);
router.post("/orders/:id/cancel", client.cancelOrder);
router.get("/orders/:id/review", client.reviewFormGet);
router.post("/orders/:id/review", client.reviewFormPost);

router.get("/cart", client.cartView);
router.post("/cart/add", client.cartAdd);
router.post("/cart/update", client.cartUpdate);
router.post("/cart/remove", client.cartRemove);
router.get("/checkout", client.checkoutGet);
router.post("/checkout", checkoutLimiter, client.checkoutPost);
router.get("/coupons/validate", validateClientCoupon);

module.exports = router;
