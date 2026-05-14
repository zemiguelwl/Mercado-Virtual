/**
 * @swagger
 * tags:
 *   name: Catalog
 *   description: Catálogo público de produtos e supermercados
 */

const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/api/catalog.api.controller");

router.get("/products", ctrl.getProducts);
router.get("/products/:id", ctrl.getProductById);
router.get("/categories", ctrl.getCategories);
router.get("/supermarkets", ctrl.getSupermarkets);
router.get("/supermarkets/:id", ctrl.getSupermarketById);
router.get("/compare", ctrl.compareProducts);

module.exports = router;
