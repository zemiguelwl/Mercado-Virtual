const Product = require("../models/Product");
const Category = require("../models/Category");

async function index(req, res, next) {
  try {
    const supermarketId = req.session.user.supermarketId;
    const filter = { supermarket: supermarketId, isActive: true };

    // conversão em String antes da operação porque recebe inputs de query params
    if (req.query.category) filter.category = String(req.query.category);
    const searchTerm = String(req.query.search || "").trim();
    if (searchTerm) filter.name = { $regex: searchTerm, $options: "i" };

    const products = await Product.find(filter).populate("category").lean();
    const categories = await Category.find({ isActive: true }).lean();
    res.render("supermarket/products/index", {
      title: "Produtos",
      products,
      categories,
      currentCategory: req.query.category || "",
      search: searchTerm
    });
  } catch (err) {
    next(err);
  }
}

async function createForm(req, res, next) {
  try {
    const categories = await Category.find({ isActive: true }).lean();
    res.render("supermarket/products/create", { title: "Novo Produto", categories, errors: [] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const supermarketId = req.session.user.supermarketId;

    if (!req.file) {
      req.flash("error", "Imagem do produto é obrigatória.");
      return res.redirect("/supermarket/products/create");
    }

    const price = parseFloat(req.body.price);
    const stock = parseInt(req.body.stock, 10);

    if (!req.body.name || !String(req.body.name).trim()) {
      req.flash("error", "Nome do produto é obrigatório.");
      return res.redirect("/supermarket/products/create");
    }
    if (isNaN(price) || price < 0) {
      req.flash("error", "Preço inválido. Deve ser um número positivo.");
      return res.redirect("/supermarket/products/create");
    }
    if (isNaN(stock) || stock < 0) {
      req.flash("error", "Stock inválido. Deve ser um número não negativo.");
      return res.redirect("/supermarket/products/create");
    }

    await Product.create({
      supermarket: supermarketId,
      category: req.body.category,
      name: String(req.body.name).trim(),
      description: String(req.body.description || "").trim(),
      price,
      stock,
      image: `/uploads/products/${req.file.filename}`
    });
    req.flash("success", "Produto criado.");
    res.redirect("/supermarket/products");
  } catch (err) {
    next(err);
  }
}

async function editForm(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).render("errors/404", { title: "Produto não encontrado" });
    if (String(product.supermarket) !== String(req.session.user.supermarketId)) {
      return res.status(403).render("errors/403", { message: "Sem permissão." });
    }
    const categories = await Category.find({ isActive: true }).lean();
    return res.render("supermarket/products/edit", { title: "Editar Produto", product, categories, errors: [] });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).render("errors/404", { title: "Produto não encontrado" });
    if (String(product.supermarket) !== String(req.session.user.supermarketId)) {
      return res.status(403).render("errors/403", { message: "Sem permissão." });
    }

    const price = parseFloat(req.body.price);
    const stock = parseInt(req.body.stock, 10);

    if (!req.body.name || !String(req.body.name).trim()) {
      req.flash("error", "Nome do produto é obrigatório.");
      return res.redirect(`/supermarket/products/${req.params.id}/edit`);
    }
    if (isNaN(price) || price < 0) {
      req.flash("error", "Preço inválido.");
      return res.redirect(`/supermarket/products/${req.params.id}/edit`);
    }
    if (isNaN(stock) || stock < 0) {
      req.flash("error", "Stock inválido.");
      return res.redirect(`/supermarket/products/${req.params.id}/edit`);
    }

    product.name = String(req.body.name).trim();
    product.description = String(req.body.description || "").trim();
    product.price = price;
    product.stock = stock;
    product.category = req.body.category;
    if (req.file) {
      product.image = `/uploads/products/${req.file.filename}`;
    }
    if (!product.image) {
      req.flash("error", "Produto deve ter uma imagem.");
      return res.redirect(`/supermarket/products/${req.params.id}/edit`);
    }
    await product.save();
    req.flash("success", "Produto atualizado.");
    return res.redirect("/supermarket/products");
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/supermarket/products");
    if (String(product.supermarket) !== String(req.session.user.supermarketId)) {
      return res.status(403).render("errors/403", { message: "Sem permissão." });
    }
    product.isActive = false;
    await product.save();
    req.flash("success", "Produto desativado.");
    return res.redirect("/supermarket/products");
  } catch (err) {
    next(err);
  }
}

async function adjustStock(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/supermarket/products");
    if (String(product.supermarket) !== String(req.session.user.supermarketId)) {
      return res.status(403).render("errors/403", { message: "Sem permissão." });
    }
    const amount = Number(req.body.amount || 0);
    product.stock = Math.max(0, product.stock + amount);
    await product.save();
    req.flash("success", "Stock atualizado.");
    return res.redirect("/supermarket/products");
  } catch (err) {
    next(err);
  }
}

module.exports = { index, createForm, create, editForm, update, remove, adjustStock };
