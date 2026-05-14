const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const Supermarket = require("../models/Supermarket");
const { validateAndApply, consumeCoupon } = require("../services/coupon.service");
const { createPOSSale } = require("../services/order.service");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function page(req, res, next) {
  try {
    const supermarket = await Supermarket.findById(req.session.user.supermarketId).lean();
    const categories = await Category.find({ isActive: true }).select("name").lean();
    res.render("supermarket/pos/index", { title: "POS / Caixa", categories, supermarket });
  } catch (err) {
    next(err);
  }
}

async function searchProducts(req, res, next) {
  try {
    const supermarketId = req.session.user.supermarketId;
    const q = String(req.query.q || "").trim();
    const category = req.query.category ? String(req.query.category) : null;

    const filter = { supermarket: supermarketId, isActive: true, stock: { $gt: 0 } };
    if (q) {
      const safeQ = escapeRegex(q);
      filter.$or = [
        { name: { $regex: safeQ, $options: "i" } },
        { description: { $regex: safeQ, $options: "i" } }
      ];
    }
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .populate("category", "name")
      .select("name price stock image category")
      .limit(20)
      .lean();
    return res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
}

async function searchClients(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ success: false, message: "Pesquisa mínima de 2 caracteres" });

    const safeQ = escapeRegex(q);
    const clients = await User.find({
      role: "client",
      isActive: true,
      $or: [
        { email: { $regex: safeQ, $options: "i" } },
        { phone: { $regex: safeQ, $options: "i" } },
        { name:  { $regex: safeQ, $options: "i" } }
      ]
    })
      .select("name email phone _id accountStatus")
      .limit(10)
      .lean();

    return res.json({ success: true, clients });
  } catch (err) {
    next(err);
  }
}

async function createQuickClient(req, res, next) {
  try {
    const { name, email, phone } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return res.json({ success: false, message: "Nome, email e telefone são obrigatórios." });
    }

    // Validar formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.json({ success: false, message: "Formato de email inválido." });
    }

    // Validar formato de telefone (apenas dígitos, entre 9 e 15 caracteres)
    if (!/^\d{9,15}$/.test(phone.trim())) {
      return res.json({ success: false, message: "Formato de telefone inválido (9 a 15 dígitos)." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedPhone = String(phone).trim();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }]
    }).select("_id name email phone");

    if (existingUser) {
      // Devolve apenas o mínimo necessário para o POS selecionar o cliente
      return res.json({
        success: true,
        client: {
          _id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phone
        },
        message: "Cliente já registado. Selecionado automaticamente."
      });
    }

    const newClient = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      address: "N/A",
      password: null,
      role: "client",
      isEmailVerified: false,
      isActive: true,
      accountStatus: "ACTIVE"
    });

    return res.json({
      success: true,
      client: {
        _id: newClient._id,
        name: newClient.name,
        email: newClient.email,
        phone: newClient.phone
      },
      message: "Novo cliente criado com sucesso."
    });

  } catch (err) {
    console.error("Erro em createQuickClient:", err);
    if (err.code === 11000) {
      return res.json({ success: false, message: "Email ou telefone já existem no sistema." });
    }
    return res.json({ success: false, message: "Erro técnico ao processar cliente. Verifique se os dados são válidos." });
  }
}

async function validateCoupon(req, res, next) {
  try {
    const result = await validateAndApply(
      String(req.query.code || ""), req.session.user.supermarketId, Number(req.query.subtotal || 0));

    if (result.valid) {
      return res.json({
        valid: true,
        discountAmount: result.discountAmount,
        deliveryFree: Boolean(result.deliveryFree),
        description: result.description || ""
      });
    }
    return res.json({
      valid: false,
      discountAmount: 0,
      deliveryFree: false,
      description: "",
      message: result.message || "Cupão inválido."
    });
  } catch (err) {
    next(err);
  }
}

async function checkout(req, res, next) {
  const supermarketId = req.session.user.supermarketId;
  const cashierId = req.session.user.id;
  const decremented = [];

  try {
    if (!req.body.clientId) {
      req.flash("error", "Cliente é obrigatório para finalizar a venda.");
      return res.redirect("/supermarket/pos");
    }

    const client = await User.findById(req.body.clientId).select("_id name email phone accountStatus role");
    if (!client || client.role !== "client") {
      req.flash("error", "Cliente inválido.");
      return res.redirect("/supermarket/pos");
    }

    let items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length && req.body.itemsJson) {
      try {
        const parsed = JSON.parse(req.body.itemsJson);
        if (Array.isArray(parsed)) items = parsed;
      } catch (_err) {
        items = [];
      }
    }

    if (!items.length) {
      req.flash("error", "Não podes finalizar uma venda sem produtos.");
      return res.redirect("/supermarket/pos");
    }

    const orderItems = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity, 10);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        await Promise.all(
          decremented.map((row) =>
            Product.updateOne({ _id: row.productId, supermarket: supermarketId }, { $inc: { stock: row.quantity } })
          )
        );
        req.flash("error", "Quantidade inválida no carrinho.");
        return res.redirect("/supermarket/pos");
      }

      const product = await Product.findOneAndUpdate(
        { _id: item.productId, supermarket: supermarketId, stock: { $gte: quantity }, isActive: true },
        { $inc: { stock: -quantity } },
        { new: true }
      );

      if (!product) {
        await Promise.all(
          decremented.map((row) =>
            Product.updateOne({ _id: row.productId, supermarket: supermarketId }, { $inc: { stock: row.quantity } })
          )
        );
        req.flash("error", `Produto sem stock suficiente: ${item.productName}`);
        return res.redirect("/supermarket/pos");
      }

      decremented.push({ productId: product._id, quantity });
      orderItems.push({
        product: product._id,
        productName: product.name,
        productPrice: product.price,
        quantity
      });
    }

    const subtotal = orderItems.reduce((sum, i) => sum + i.productPrice * i.quantity, 0);
    let discountAmount = 0;
    let validatedCouponCode = null;
    let deliveryFreeFromCoupon = false;

    if (req.body.couponCode) {
      const couponResult = await validateAndApply(req.body.couponCode.trim(), supermarketId, subtotal);
      if (couponResult.valid) {
        // Incremento atómico: garante que maxUses não é ultrapassado em concorrência
        const consumed = await consumeCoupon(couponResult.couponId);
        if (consumed) {
          discountAmount = couponResult.discountAmount;
          validatedCouponCode = couponResult.code;
          deliveryFreeFromCoupon = Boolean(couponResult.deliveryFree);
        }
      }
    }

    const deliveryMethod = "instore";
    const deliveryCost = 0;
    const total = Math.max(0, subtotal - discountAmount) + deliveryCost;

    const order = await createPOSSale({
      supermarket: supermarketId,
      client: {
        userId: client._id,
        name: client.name,
        email: client.email,
        phone: client.phone
      },
      items: orderItems,
      subtotal,
      discountAmount,
      couponCode: validatedCouponCode,
      deliveryMethod,
      deliveryCost,
      total
    }, cashierId);

    req.flash("success", `Venda registada com sucesso! Encomenda #${order._id.toString().slice(-6).toUpperCase()}`);
    return res.redirect("/supermarket/pos");

  } catch (err) {
    // Rollback de stock em caso de erro inesperado
    if (decremented.length) {
      await Promise.all(
        decremented.map((row) =>
          Product.updateOne({ _id: row.productId, supermarket: supermarketId }, { $inc: { stock: row.quantity } })
        )
      ).catch((rollbackErr) => console.error("Erro no rollback de stock POS:", rollbackErr.message));
    }
    req.flash("error", "Erro ao processar venda. Tenta novamente.");
    return next(err);
  }
}

module.exports = { page, searchProducts, searchClients, createQuickClient, validateCoupon, checkout };
