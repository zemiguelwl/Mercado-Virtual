const express = require("express");
const catalog = require("../controllers/catalog.controller");
const router = express.Router();

router.get("/", catalog.index);
router.get("/compare", catalog.compare);

module.exports = router;
