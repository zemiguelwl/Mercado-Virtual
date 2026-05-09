const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  if (req.session.user) {
    const redirectMap = {
      admin: "/admin/dashboard",
      supermarket: "/supermarket/dashboard",
      courier: "/courier/dashboard",
      client: "/client/dashboard"
    };
    return res.redirect(redirectMap[req.session.user.role] || "/catalog");
  }
  return res.redirect("/catalog");
});

router.use("/catalog", require("./catalog.routes"));
router.use("/client", require("./client.routes"));
router.use("/auth", require("./auth.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/supermarket", require("./supermarket.routes"));
router.use("/courier", require("./courier.routes"));

module.exports = router;
