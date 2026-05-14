/**
 * @swagger
 * tags:
 *   name: Client
 *   description: Endpoints exclusivos para clientes autenticados
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { verifyToken, requireRole } = require("../../middleware/jwt.middleware");
const ctrl = require("../../controllers/api/client.api.controller");

const checkoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10 });

router.use(verifyToken, requireRole("client"));

router.get("/profile", ctrl.getProfile);
router.put("/profile", ctrl.updateProfile);

router.get("/orders", ctrl.getOrders);
router.get("/orders/:id", ctrl.getOrderById);
router.post("/orders/:id/cancel", ctrl.cancelOrder);
router.post("/orders/:id/review", ctrl.submitReview);

router.post("/checkout", checkoutLimiter, ctrl.checkout);

router.get("/coupons/validate", ctrl.validateCoupon);

module.exports = router;
