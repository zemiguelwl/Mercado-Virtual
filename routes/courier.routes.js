const express = require("express");
const { isAuthenticated } = require("../middleware/auth.middleware");
const { hasRole } = require("../middleware/role.middleware");
const courier = require("../controllers/courier.controller");
const router = express.Router();

router.use(isAuthenticated);
router.use(hasRole("courier"));

router.get("/dashboard", courier.dashboard);
router.get("/available", courier.available);
router.post("/deliveries/:id/accept", courier.accept);
router.post("/deliveries/:id/picked-up", courier.pickedUp);
router.post("/deliveries/:id/delivered", courier.delivered);
router.post("/deliveries/:id/cancel", courier.cancel);
router.get("/history", courier.history);
router.get("/reviews", courier.reviews);

module.exports = router;
