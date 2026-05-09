const express = require("express");
const { isAuthenticated } = require("../middleware/auth.middleware");
const { hasRole } = require("../middleware/role.middleware");
const admin = require("../controllers/admin.controller");
const router = express.Router();

router.use(isAuthenticated);
router.use(hasRole("admin"));

router.get("/dashboard", admin.dashboard);
router.get("/supermarkets", admin.supermarkets);
router.post("/supermarkets/:id/approve", admin.approveSupermarket);
router.post("/supermarkets/:id/reject", admin.rejectSupermarket);
router.get("/users", admin.users);
router.post("/users/:id/deactivate", admin.deactivateUser);
router.post("/users/:id/activate", admin.activateUser);
router.get("/categories", admin.categories);
router.post("/categories", admin.createCategory);
router.put("/categories/:id", admin.updateCategory);
router.delete("/categories/:id", admin.deleteCategory);
router.get("/orders", admin.orders);
router.get("/orders/:id", admin.orderDetail);
router.post("/orders/:id/cancel", admin.forceCancelOrder);
router.get("/coupons", admin.coupons);
router.get("/coupons/create", admin.createCouponForm);
router.post("/coupons", admin.createCoupon);
router.put("/coupons/:id", admin.updateCoupon);
router.delete("/coupons/:id", admin.disableCoupon);
router.post("/coupons/:id/toggle", admin.toggleCouponActive);
router.post("/coupons/:id/send", admin.sendCoupon);
router.post("/reviews/:id/hide", admin.hideReview);

module.exports = router;
