const express = require("express");
const { isAuthenticated } = require("../middleware/auth.middleware");
const { hasRole, isSupermarketApproved } = require("../middleware/role.middleware");
const { uploadProduct } = require("../middleware/upload.middleware");
const supermarket = require("../controllers/supermarket.controller");
const product = require("../controllers/product.controller");
const pos = require("../controllers/pos.controller");
const review = require("../controllers/review.controller");
const router = express.Router();

router.use(isAuthenticated);
router.use(hasRole("supermarket"));
router.use(isSupermarketApproved);

router.get("/dashboard", supermarket.dashboard);
router.get("/profile", supermarket.profile);
router.post("/profile", supermarket.updateProfile);
router.post("/profile/toggle-open", supermarket.toggleOpen);

router.get("/products", product.index);
router.get("/products/create", product.createForm);
router.post("/products", uploadProduct.single("image"), product.create);
router.get("/products/:id/edit", product.editForm);
router.put("/products/:id", uploadProduct.single("image"), product.update);
router.delete("/products/:id", product.remove);
router.post("/products/:id/stock", product.adjustStock);

router.get("/orders", supermarket.orders);
router.get("/orders/:id", supermarket.orderDetail);
router.post("/orders/:id/confirm", supermarket.confirmOrder);
router.post("/orders/:id/reject", supermarket.rejectOrder);
router.post("/orders/:id/start-preparing", supermarket.startPreparing);
router.post("/orders/:id/ready", supermarket.markReady);
router.post("/orders/:id/delivered", supermarket.markDelivered);
router.get("/orders/:id/review", supermarket.reviewForm);
router.post("/orders/:orderId/review", review.submitReview);

router.get("/pos", pos.page);
router.get("/pos/products", pos.searchProducts);
router.get("/pos/clients", pos.searchClients);
router.post("/pos/clients/create-quick", pos.createQuickClient);
router.get("/pos/validate-coupon", pos.validateCoupon);
router.post("/pos/checkout", pos.checkout);

router.get("/coupons", supermarket.coupons);
router.get("/coupons/create", supermarket.createCouponForm);
router.post("/coupons", supermarket.createCoupon);
router.put("/coupons/:id", supermarket.updateCoupon);
router.delete("/coupons/:id", supermarket.deleteCoupon);

router.get("/reviews", supermarket.reviews);
router.post("/reviews/:id/reply", supermarket.replyReview);

module.exports = router;
