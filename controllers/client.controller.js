const mongoose = require("mongoose");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Supermarket = require("../models/Supermarket");
const Delivery = require("../models/Delivery");
const Coupon = require("../models/Coupon");
const Review = require("../models/Review");
const { transitionOrderStatus } = require("../services/order.service");
const { validateAndApply } = require("../services/coupon.service");

function ensureCart(session) {
  if (!session.cart) session.cart = { supermarketId: null, items: [] };
  return session.cart;
}

async function dashboard(req, res, next) {
  try {
    const userId = req.session.user.id;
    const [orderCount, topProducts] = await Promise.all([
      Order.countDocuments({ "client.userId": userId }),
      Order.aggregate([
        { $match: { "client.userId": new mongoose.Types.ObjectId(userId), status: "delivered" } },
        { $unwind: "$items" },
        { $group: { _id: "$items.productName", totalQty: { $sum: "$items.quantity" } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 }
      ])
    ]);
    res.render("client/dashboard", {
      title: "A minha conta",
      user: req.session.user,
      orderCount,
      topProducts
    });
  } catch (err) {
    next(err);
  }
}

async function profileGet(req, res, next) {
  try {
    const user = await User.findById(req.session.user.id).select("-password").lean();
    res.render("client/profile", { title: "Perfil", user });
  } catch (err) {
    next(err);
  }
}

async function profilePost(req, res, next) {
  try {
    const { name, phone, address } = req.body;
    await User.findByIdAndUpdate(req.session.user.id, {
      name: name?.trim(),
      phone: phone?.trim(),
      address: address?.trim()
    });
    if (req.session.user) {
      req.session.user.name = name?.trim() || req.session.user.name;
    }
    req.flash("success", "Perfil atualizado.");
    res.redirect("/client/profile");
  } catch (err) {
    next(err);
  }
}

async function ordersList(req, res, next) {
  try {
    const orders = await Order.find({ "client.userId": req.session.user.id })
      .populate("supermarket", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.render("client/orders/index", { title: "As minhas encomendas", orders });
  } catch (err) {
    next(err);
  }
}

async function orderDetail(req, res, next) {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      "client.userId": req.session.user.id
    })
      .populate("supermarket")
      .lean();
    if (!order) return res.status(404).render("errors/404", { title: "Encomenda não encontrada" });
    const delivery = await Delivery.findOne({ order: order._id })
      .populate("courier", "name phone")
      .lean();

    let canCancel = false;
    if (order.status === "pending") canCancel = true;
    if (order.status === "confirmed" && order.confirmedAt) {
      const mins = (Date.now() - new Date(order.confirmedAt).getTime()) / 60000;
      if (mins <= 5) canCancel = true;
    }

    res.render("client/orders/detail", { title: "Encomenda", order, delivery, canCancel });
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, "client.userId": req.session.user.id });
    if (!order) {
      req.flash("error", "Encomenda não encontrada.");
      return res.redirect("/client/orders");
    }
    try {
      await transitionOrderStatus(req.params.id, "cancelled", req.session.user.id, req.body.reason || "Cancelado pelo cliente");
      req.flash("success", "Encomenda cancelada.");
    } catch (err) {
      req.flash("error", err.message);
      next(err);
    }
    res.redirect(`/client/orders/${req.params.id}`);
  } catch (err) {
    next(err);
  }
}

async function cartView(req, res, next) {
  try {
    const cart = ensureCart(req.session);
    let lines = [];
    let supermarketName = "";
    if (cart.supermarketId && cart.items.length) {
      const sm = await Supermarket.findById(cart.supermarketId).lean();
      supermarketName = sm?.name || "";
      for (const line of cart.items) {
        const p = await Product.findById(line.productId).populate("category", "name").lean();
        if (!p || !p.isActive || p.stock < line.quantity) {
          line.invalid = true;
        }
        lines.push({ ...line, product: p });
      }
    }
    res.render("client/cart", { title: "Carrinho", cart, lines, supermarketName });
  } catch (err) {
    next(err);
  }
}

async function cartAdd(req, res, next) {
  try {
    const { productId, quantity = 1 } = req.body;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const product = await Product.findById(productId).lean();
    if (!product || !product.isActive || product.stock < qty) {
      req.flash("error", "Produto indisponível ou sem stock suficiente.");
      return res.redirect("back");
    }
    const sm = await Supermarket.findById(product.supermarket);
    if (!sm || sm.status !== "approved") {
      req.flash("error", "Este supermercado não está disponível.");
      return res.redirect("back");
    }

    const cart = ensureCart(req.session);
    const sid = String(product.supermarket);

    if (cart.supermarketId && String(cart.supermarketId) !== sid) {
      req.flash("error", "Só podes ter produtos de um supermercado por encomenda. Esvazia o carrinho primeiro.");
      return res.redirect("/client/cart");
    }

    cart.supermarketId = sid;
    const existing = cart.items.find((i) => String(i.productId) === String(productId));
    if (existing) {
      const nextQty = existing.quantity + qty;
      if (nextQty > product.stock) {
        req.flash("error", "Stock insuficiente para esta quantidade.");
        return res.redirect("back");
      }
      existing.quantity = nextQty;
    } else {
      cart.items.push({ productId: String(productId), quantity: qty });
    }

    req.flash("success", "Produto adicionado ao carrinho.");
    return res.redirect("/client/cart");
  } catch (err) {
    next(err);
  }
}

async function cartUpdate(req, res, next) {
  try {
    const cart = ensureCart(req.session);
    const { productId, quantity } = req.body;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const line = cart.items.find((i) => String(i.productId) === String(productId));
    if (!line) return res.redirect("/client/cart");
    const product = await Product.findById(productId);
    if (!product || qty > product.stock) {
      req.flash("error", "Quantidade inválida face ao stock.");
      return res.redirect("/client/cart");
    }
    line.quantity = qty;
    req.flash("success", "Carrinho atualizado.");
    res.redirect("/client/cart");
  } catch (err) {
    next(err);
  }
}

async function cartRemove(req, res, next) {
  try {
    const cart = ensureCart(req.session);
    const { productId } = req.body;
    cart.items = cart.items.filter((i) => String(i.productId) !== String(productId));
    if (!cart.items.length) cart.supermarketId = null;
    req.flash("success", "Item removido.");
    res.redirect("/client/cart");
  } catch (err) {
    next(err);
  }
}

async function checkoutGet(req, res, next) {
  try {
    const cart = ensureCart(req.session);
    if (!cart.items.length || !cart.supermarketId) {
      req.flash("error", "O carrinho está vazio.");
      return res.redirect("/client/cart");
    }
    const supermarket = await Supermarket.findById(cart.supermarketId).lean();
    if (!supermarket) {
      req.session.cart = { supermarketId: null, items: [] };
      req.flash("error", "Supermercado inválido.");
      return res.redirect("/client/cart");
    }
    let subtotal = 0;
    const lines = [];
    for (const line of cart.items) {
      const p = await Product.findById(line.productId);
      if (!p || String(p.supermarket) !== String(cart.supermarketId) || p.stock < line.quantity) {
        req.flash("error", "Atualiza o carrinho — alguns produtos já não estão disponíveis.");
        return res.redirect("/client/cart");
      }
      subtotal += p.price * line.quantity;
      lines.push({ product: p, quantity: line.quantity });
    }
    const deliveryOptions = (supermarket.deliveryMethods || []).filter(
      (m) => m.active && (m.type === "pickup" || m.type === "courier")
    );

    res.render("client/checkout", {
      title: "Finalizar encomenda",
      supermarket,
      lines,
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryOptions
    });
  } catch (err) {
    next(err);
  }
}

async function checkoutPost(req, res, next) {
  try {
    const cart = ensureCart(req.session);
    const deliveryMethod = req.body.deliveryMethod;
    if (!cart.items.length || !cart.supermarketId) {
      req.flash("error", "Carrinho vazio.");
      return res.redirect("/client/cart");
    }

    const supermarket = await Supermarket.findById(cart.supermarketId).lean();
    if (!supermarket || supermarket.status !== "approved") {
      req.flash("error", "Supermercado indisponível.");
      return res.redirect("/client/cart");
    }

    if (!["pickup", "courier"].includes(deliveryMethod)) {
      req.flash("error", "Escolhe levantamento em loja ou entrega ao domicílio.");
      return res.redirect("/client/checkout");
    }

    const dm = (supermarket.deliveryMethods || []).find((m) => m.type === deliveryMethod && m.active);
    if (!dm) {
      req.flash("error", "Este método de entrega não está disponível para este supermercado.");
      return res.redirect("/client/checkout");
    }

    const user = await User.findById(req.session.user.id).lean();
    const orderItems = [];
    let subtotal = 0;
    const decremented = [];

    for (const line of cart.items) {
      const qty = line.quantity;
      const product = await Product.findOneAndUpdate(
        { _id: line.productId, supermarket: cart.supermarketId, stock: { $gte: qty }, isActive: true },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!product) {
        // Reverter stocks já decrementados
        if (decremented.length) {
          await Promise.all(
            decremented.map((row) =>
              Product.updateOne({ _id: row.productId, supermarket: cart.supermarketId }, { $inc: { stock: row.quantity } })
            )
          );
        }
        req.flash("error", "Stock insuficiente para um dos produtos. Atualiza o carrinho.");
        return res.redirect("/client/cart");
      }
      decremented.push({ productId: product._id, quantity: qty });
      subtotal += product.price * qty;
      orderItems.push({
        product: product._id,
        productName: product.name,
        productPrice: product.price,
        quantity: qty
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;

    // ── CUPÃO ─────────────────────────────────────────────────────────────────
    // Validar e aplicar cupão se o cliente inseriu um código
    let discountAmount = 0;
    let couponCode = null;
    let deliveryFreeFromCoupon = false;

    const rawCouponCode = String(req.body.couponCode || "").trim();
    if (rawCouponCode) {
      const couponResult = await validateAndApply(rawCouponCode, cart.supermarketId, subtotal);
      if (couponResult.valid) {
        discountAmount = couponResult.discountAmount;
        couponCode = couponResult.code;
        deliveryFreeFromCoupon = Boolean(couponResult.deliveryFree);
        // Incrementar contador de utilizações de forma atómica
        await Coupon.findByIdAndUpdate(couponResult.couponId, { $inc: { currentUses: 1 } });
      } else {
        // Cupão inválido — continuar sem desconto (não bloquear o checkout)
        req.flash("error", `Cupão inválido: ${couponResult.message} A encomenda foi criada sem desconto.`);
      }
    }

    // Custo de entrega (gratuito se cupão de entrega grátis)
    const deliveryCost = deliveryFreeFromCoupon ? 0 : (Number(dm.cost) || 0);
    const total = Math.round((Math.max(0, subtotal - discountAmount) + deliveryCost) * 100) / 100;
    // ──────────────────────────────────────────────────────────────────────────

    const order = await Order.create({
      supermarket: cart.supermarketId,
      client: {
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      items: orderItems,
      subtotal,
      discountAmount,
      couponCode,
      deliveryMethod,
      deliveryCost,
      total,
      status: "pending",
      source: "online",
      statusHistory: [{ status: "pending", changedBy: user._id, reason: "Encomenda online" }]
    });

    req.session.cart = { supermarketId: null, items: [] };
    req.flash("success", `Encomenda #${order._id.toString().slice(-6).toUpperCase()} criada com sucesso.`);
    res.redirect(`/client/orders/${order._id}`);
  } catch (err) {
    next(err);
  }
}

async function reviewFormGet(req, res, next) {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      "client.userId": req.session.user.id
    })
      .populate("supermarket")
      .lean();

    if (!order) {
      return res.status(404).render("errors/404", { title: "Encomenda não encontrada" });
    }

    if (order.status !== "delivered") {
      req.flash("error", "Só podes avaliar encomendas entregues.");
      return res.redirect(`/client/orders/${req.params.id}`);
    }

    if (order.reviewSubmitted) {
      req.flash("error", "A avaliação desta encomenda já foi registada.");
      return res.redirect(`/client/orders/${req.params.id}`);
    }

    const delivery = order.deliveryMethod === "courier" 
      ? await Delivery.findOne({ order: order._id })
          .populate("courier", "name phone")
          .lean()
      : null;

    res.render("client/orders/review", { title: "Avaliar Encomenda", order, delivery });
  } catch (err) {
    next(err);
  }
}

async function reviewFormPost(req, res, next) {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;
    const { supermarketRating, supermarketComment, courierRating, courierComment } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      "client.userId": userId
    }).populate("supermarket");

    if (!order) {
      req.flash("error", "Encomenda não encontrada ou sem permissão.");
      return res.redirect("/client/orders");
    }
    if (order.status !== "delivered") {
      req.flash("error", "Só é possível avaliar encomendas entregues.");
      return res.redirect(`/client/orders/${orderId}`);
    }
    if (order.reviewSubmitted) {
      req.flash("error", "A avaliação desta encomenda já foi registada.");
      return res.redirect(`/client/orders/${orderId}`);
    }

    try {
      // proteção contra duplicados 
      const existingSM = await Review.findOne({ order: orderId, targetType: "supermarket" });
      if (!existingSM && supermarketRating) {
        await Review.create({
          order: orderId,
          author: { name: order.client.name, userId },
          targetType: "supermarket",
          targetId: order.supermarket._id,
          rating: parseInt(supermarketRating, 10),
          comment: supermarketComment || ""
        });

        // Recalcular rating do supermercado imediatamente após criar a review
        const smReviews = await Review.aggregate([
          { $match: { targetType: "supermarket", targetId: order.supermarket._id, isVisible: true } },
          { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]);
        if (smReviews.length) {
          await Supermarket.findByIdAndUpdate(order.supermarket._id, {
            "rating.average": Math.round(smReviews[0].average * 10) / 10,
            "rating.count": smReviews[0].count
          });
        }
      }

      // estafeta vai buscar encomenda apenas uma vez, reutilizar para criar review e recalcular rating
      if (order.deliveryMethod === "courier" && courierRating) {
        const delivery = await Delivery.findOne({ order: orderId }).sort({ createdAt: -1 });
        if (delivery?.courier) {
          const existingCourier = await Review.findOne({ order: orderId, targetType: "courier" });
          if (!existingCourier) {
            await Review.create({
              order: orderId,
              author: { name: order.client.name, userId },
              targetType: "courier",
              targetId: delivery.courier,
              rating: parseInt(courierRating, 10),
              comment: courierComment || ""
            });

            // recalcular rating do courier -> ObjectId para garantir que o match funciona
            const courierReviews = await Review.aggregate([
              { $match: { targetType: "courier", targetId: new mongoose.Types.ObjectId(delivery.courier), isVisible: true } },
              { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
            ]);
            if (courierReviews.length) {
              await User.findByIdAndUpdate(delivery.courier, {
                "rating.average": Math.round(courierReviews[0].average * 10) / 10,
                "rating.count": courierReviews[0].count
              });
            }
          }
        }
      }

      await Order.findByIdAndUpdate(orderId, { reviewSubmitted: true });
      req.flash("success", "Avaliação registada com sucesso!");
      return res.redirect(`/client/orders/${orderId}`);
    } catch (err) {
      console.error("Erro ao registar review:", err);
      req.flash("error", "Erro ao registar avaliação. Tenta novamente.");
      next(err);
      return res.redirect(`/client/orders/${orderId}`);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  profileGet,
  profilePost,
  ordersList,
  orderDetail,
  cancelOrder,
  cartView,
  cartAdd,
  cartUpdate,
  cartRemove,
  checkoutGet,
  checkoutPost,
  reviewFormGet,
  reviewFormPost
};
