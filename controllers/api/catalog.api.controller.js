const Product = require("../../models/Product");
const Supermarket = require("../../models/Supermarket");
const Category = require("../../models/Category");

async function approvedSupermarketIds() {
  const list = await Supermarket.find({ status: "approved" }).select("_id").lean();
  return list.map((s) => s._id);
}

/**
 * @swagger
 * /api/v1/catalog/products:
 *   get:
 *     summary: Listar produtos com pesquisa, filtros e ordenação
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Pesquisa por nome do produto
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: ID da categoria
 *       - in: query
 *         name: supermarket
 *         schema: { type: string }
 *         description: ID do supermercado
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [name_asc, price_asc, price_desc] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Lista de produtos
 */
async function getProducts(req, res, next) {
  try {
    const smIds = await approvedSupermarketIds();
    const { q = "", category = "", sort = "name_asc", supermarket = "", page = 1 } = req.query;
    const limit = 24;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * limit;

    const filter = { isActive: true, stock: { $gt: 0 } };

    if (supermarket) {
      const isValid = smIds.some((id) => String(id) === String(supermarket));
      if (!isValid) return res.status(400).json({ message: "Supermercado inválido." });
      filter.supermarket = supermarket;
    } else {
      filter.supermarket = { $in: smIds };
    }

    if (q && String(q).trim()) {
      filter.name = { $regex: String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }
    if (category) filter.category = category;

    let sortOpt = { name: 1 };
    if (sort === "price_asc") sortOpt = { price: 1 };
    if (sort === "price_desc") sortOpt = { price: -1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("supermarket", "name isOpen location")
        .populate("category", "name")
        .sort(sortOpt)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter)
    ]);

    return res.status(200).json({
      products,
      pagination: { total, page: parseInt(page, 10), limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/catalog/products/{id}:
 *   get:
 *     summary: Obter detalhe de um produto
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Produto encontrado
 *       404:
 *         description: Produto não encontrado
 */
async function getProductById(req, res, next) {
  try {
    const smIds = await approvedSupermarketIds();
    const product = await Product.findOne({
      _id: req.params.id,
      supermarket: { $in: smIds },
      isActive: true
    })
      .populate("supermarket", "name isOpen location deliveryMethods schedule rating")
      .populate("category", "name")
      .lean();

    if (!product) return res.status(404).json({ message: "Produto não encontrado." });
    return res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/catalog/categories:
 *   get:
 *     summary: Listar categorias ativas
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Lista de categorias
 */
async function getCategories(req, res, next) {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
    return res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/catalog/supermarkets:
 *   get:
 *     summary: Listar supermercados aprovados
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Lista de supermercados
 */
async function getSupermarkets(req, res, next) {
  try {
    const supermarkets = await Supermarket.find({ status: "approved" })
      .select("name description location isOpen schedule rating deliveryMethods logoImage")
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({ supermarkets });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/catalog/supermarkets/{id}:
 *   get:
 *     summary: Obter detalhe de um supermercado
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Supermercado encontrado
 *       404:
 *         description: Supermercado não encontrado
 */
async function getSupermarketById(req, res, next) {
  try {
    const supermarket = await Supermarket.findOne({ _id: req.params.id, status: "approved" })
      .select("name description location isOpen schedule rating deliveryMethods logoImage")
      .lean();
    if (!supermarket) return res.status(404).json({ message: "Supermercado não encontrado." });
    return res.status(200).json({ supermarket });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/catalog/compare:
 *   get:
 *     summary: Comparar preços do mesmo produto entre supermercados
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema: { type: string }
 *         description: Nome do produto a comparar
 *     responses:
 *       200:
 *         description: Lista de produtos com preços por supermercado
 *       400:
 *         description: Parâmetro name em falta
 */
async function compareProducts(req, res, next) {
  try {
    const nameQuery = String(req.query.name || "").trim();
    if (!nameQuery) return res.status(400).json({ message: "Indica o nome de um produto para comparar." });

    const smIds = await approvedSupermarketIds();
    const products = await Product.find({
      supermarket: { $in: smIds },
      isActive: true,
      stock: { $gt: 0 },
      name: { $regex: nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }
    })
      .populate("supermarket", "name location isOpen")
      .populate("category", "name")
      .sort({ price: 1 })
      .lean();

    return res.status(200).json({ searchName: nameQuery, results: products });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts, getProductById, getCategories, getSupermarkets, getSupermarketById, compareProducts };
