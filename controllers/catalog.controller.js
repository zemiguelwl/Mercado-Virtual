const Product = require("../models/Product");
const Supermarket = require("../models/Supermarket");
const Category = require("../models/Category");

async function approvedSupermarketIds() {
  const list = await Supermarket.find({ status: "approved" }).select("_id").lean();
  return list.map((s) => s._id);
}

async function index(req, res, next) {
  try {
    const smIds = await approvedSupermarketIds();
    const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
    const { q = "", category = "", sort = "name_asc", supermarket = "" } = req.query;

    if (supermarket && !smIds.some((id) => String(id) === String(supermarket))) {
      req.flash("error", "Supermercado inválido.");
      return res.redirect("/catalog");
    }

    const filter = { isActive: true, stock: { $gt: 0 } };
    if (supermarket) {
      filter.supermarket = supermarket;
    } else {
      filter.supermarket = { $in: smIds };
    }
    if (q && String(q).trim()) {
      filter.name = { $regex: String(q).trim(), $options: "i" };
    }
    if (category) filter.category = category;

    let sortOpt = { name: 1 };
    if (sort === "price_asc") sortOpt = { price: 1 };
    if (sort === "price_desc") sortOpt = { price: -1 };

    const products = await Product.find(filter)
      .populate("supermarket", "name isOpen")
      .populate("category", "name")
      .sort(sortOpt)
      .limit(120)
      .lean();

    const supermarkets = await Supermarket.find({ status: "approved" }).select("name").sort({ name: 1 }).lean();

    res.render("catalog/index", {
      title: "Catálogo",
      products,
      categories,
      supermarkets,
      q,
      category,
      sort,
      supermarket
    });
  } catch (err) {
    next(err);
  }
}

async function compare(req, res, next) {
  try {
    const nameQuery = String(req.query.name || "").trim();
    if (!nameQuery) {
      req.flash("error", "Indica o nome de um produto para comparar.");
      return res.redirect("/catalog");
    }

    const smIds = await approvedSupermarketIds();
    const products = await Product.find({
      supermarket: { $in: smIds },
      isActive: true,
      stock: { $gt: 0 },
      name: { $regex: nameQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }
    })
      .populate("supermarket", "name location")
      .populate("category", "name")
      .sort({ price: 1 })
      .lean();

    res.render("catalog/compare", {
      title: `Comparar: ${nameQuery}`,
      searchName: nameQuery,
      rows: products
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { index, compare };
