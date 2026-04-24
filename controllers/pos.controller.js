const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const Supermarket = require("../models/Supermarket");
const Coupon = require("../models/Coupon");
const { validateAndApply } = require("../services/coupon.service");
const { createPOSSale } = require("../services/order.service");

// Controlador do ponto de venda 
// Esta rota processa vendas presenciais, gere stock de produtos e regista vendas como encomendas entregues.

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
    // Forçar string em todos os query params antes de qualquer operação
    const q = String(req.query.q || "").trim();
    const category = req.query.category ? String(req.query.category) : null;

    const filter = { supermarket: supermarketId, isActive: true, stock: { $gt: 0 } };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } }
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
    // Forçar string antes de qualquer operação.
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ success: false, message: "Pesquisa mínima de 2 caracteres" });

    const clients = await User.find({
      role: "client",
      isActive: true,
      $or: [
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { name:  { $regex: q, $options: "i" } }
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

// createQuickClient

async function createQuickClient(req, res, next) {
  try {
    const { name, email, phone } = req.body;

    // Validação básica
    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return res.json({ success: false, message: "Nome, email e telefone são obrigatórios." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedPhone = String(phone).trim();

    // 1. Verificar se já existe um utilizador (por email ou telefone)
    // Usamos $or para verificar ambos numa só consulta
    const existingUser = await User.findOne({ 
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] 
    });

    if (existingUser) {
      // Se já existe, devolvemos o utilizador encontrado para o POS o selecionar
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

    // 2. Criar novo cliente 
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
    return res.json({ 
      success: false, 
      message: "Erro técnico ao processar cliente. Verifique se os dados são válidos." 
    });
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
  try {
    const supermarketId = req.session.user.supermarketId;
    const cashierId = req.session.user.id;
    
    // Validar que cliente foi selecionado
    if (!req.body.clientId) {
      req.flash("error", "Cliente é obrigatório para finalizar a venda.");
      return res.redirect("/supermarket/pos");
    }

    // Validar cliente existe
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
    const decremented = [];

    try {
      // Processar cada item e decrementar stock.
      // Em caso de falha, o rollback restaura o stock já decrementado.
      for (const item of items) {
        const quantity = parseInt(item.quantity, 10);
        
        if (!Number.isInteger(quantity) || quantity <= 0) {
          req.flash("error", "Quantidade inválida no carrinho.");
          return res.redirect("/supermarket/pos");
        }

        const product = await Product.findOneAndUpdate(
          { _id: item.productId, supermarket: supermarketId, stock: { $gte: quantity }, isActive: true },
          { $inc: { stock: -quantity } },
          { new: true }
        );

        if (!product) {
          req.flash("error", `Produto sem stock suficiente: ${item.productName}`);
          
          // Reverter stock de produtos já processados
          for (const row of decremented) {
            await Product.updateOne(
              { _id: row.productId, supermarket: supermarketId },
              { $inc: { stock: row.quantity } }
            );
          }
          
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

      // Calcular valores da venda
      const subtotal = orderItems.reduce((sum, i) => sum + i.productPrice * i.quantity, 0);
      let discountAmount = 0;
      let validatedCouponCode = null;
      let deliveryFreeFromCoupon = false;

      if (req.body.couponCode) {
        const couponResult = await validateAndApply(req.body.couponCode.trim(), supermarketId, subtotal);
        if (couponResult.valid) {
          discountAmount = couponResult.discountAmount;
          validatedCouponCode = couponResult.code;
          deliveryFreeFromCoupon = Boolean(couponResult.deliveryFree);
          
          await Coupon.findByIdAndUpdate(couponResult.couponId, { $inc: { currentUses: 1 } });
        }
      }

      const deliveryMethod = "instore"; // POS é sempre venda presencial
      const deliveryCost = 0;
      const total = Math.max(0, subtotal - discountAmount) + deliveryCost;

      // Criar venda POS
      const order = await createPOSSale({
        // A venda POS cria uma encomenda já no estado "delivered", porque é uma transacção imediata.
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
      console.error("Erro durante checkout POS:", err);
      
      // Reverter stock em caso de erro
      for (const row of decremented) {
        await Product.updateOne(
          { _id: row.productId, supermarket: supermarketId },
          { $inc: { stock: row.quantity } }
        );
      }
      
      req.flash("error", "Erro ao processar venda. Tenta novamente.");
      next(err);
      return res.redirect("/supermarket/pos");
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { page, searchProducts, searchClients, createQuickClient, validateCoupon, checkout };
