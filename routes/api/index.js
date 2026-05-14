const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth.api.routes"));
router.use("/catalog", require("./catalog.api.routes"));
router.use("/client", require("./client.api.routes"));

router.use((req, res) => {
  res.status(404).json({ message: "Endpoint não encontrado." });
});

module.exports = router;
