const mongoose = require("mongoose");
const User = require("../../models/User");
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const Supermarket = require("../../models/Supermarket");
const Delivery = require("../../models/Delivery");
const Review = require("../../models/Review");
const { transitionOrderStatus } = require("../../services/order.service");
const { validateAndApply, consumeCoupon } = require("../../services/coupon.service");
const { recalculateSupermarketRating, recalculateCourierRating } = require("../review.controller");

/**
 * @swagger
 * /api/v1/client/profile:
 *   get:
 *     summary: Obter perfil do cliente autenticado
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do perfil
 */
async function getProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "Utilizador não encontrado." });

    const [orderCount, topProducts] = await Promise.all([
      Order.countDocuments({ "client.userId": req.user.id }),
      Order.aggregate([
        { $match: { "client.userId": new mongoose.Types.ObjectId(req.user.id), status: "delivered" } },
        { $unwind: "$items" },
        { $group: { _id: "$items.productName", totalQty: { $sum: "$items.quantity" } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 }
      ])
    ]);

    return res.status(200).json({ user, orderCount, topProducts });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/client/profile:
 *   put:
 *     summary: Atualizar perfil do cliente
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               address: { type: string }
 *     responses:
 *       200:
 *         description: Perfil atualizado
 */
async function updateProfile(req, res, next) {
  try {
    const { name, phone, address } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      ...(name && { name: name.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(address && { address: address.trim() })
    });
    const updated = await User.findById(req.user.id).select("-password").lean();
    return res.status(200).json({ message: "Perfil atualizado.", user: updated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Este telefone já está associado a outra conta." });
    }
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/client/orders:
 *   get:
 *     summary: Listar encomendas do cliente
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de encomendas
 */
async function getOrders(req, res, next) {
  try {
    const orders = await Order.find({ "client.userId": req.user.id })
      .populate("supermarket", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/client/orders/{id}:
 *   get:
 *     summary: Detalhe de uma encomenda
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Dados da encomenda
 *       404:
 *         description: Encomenda não encontrada
 */
async function getOrderById(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, "client.userId": req.user.id })
      .populate("supermarket")
      .lean();
    if (!order) return res.status(404).json({ message: "Encomenda não encontrada." });

    const delivery = await Delivery.findOne({ order: order._id })
      .populate("courier", "name phone")
      .lean();

    let canCancel = false;
    if (order.status === "pending") canCancel = true;
    if (order.status === "confirmed" && order.confirmedAt) {
      const mins = (Date.now() - new Date(order.confirmedAt).getTime()) / 60000;
      if (mins <= 5) canCancel = true;
    }

    return res.status(200).json({ order, delivery, canCancel });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/client/orders/{id}/cancel:
 *   post:
 *     summary: Cancelar encomenda
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Encomenda cancelada
 *       400:
 *         description: Não é possível cancelar
 */
async function cancelOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, "client.userId": req.user.id });
    if (!order) return res.status(404).json({ message: "Encomenda não encontrada." });

    try {
      await transitionOrderStatus(req.params.id, "cancelled", req.user.id, req.body.reason || "Cancelado pelo cliente");
      return res.status(200).json({ message: "Encomenda cancelada com sucesso." });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/client/orders/{id}/review:
 *   post:
 *     summary: Submeter avaliação de uma encomenda entregue
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               supermarketRating: { type: integer, minimum: 1, maximum: 5 }
 *               supermarketComment: { type: string }
 *               courierRating: { type: integer, minimum: 1, maximum: 5 }
 *               courierComment: { type: string }
 *     responses:
 *       200:
 *         description: Avaliação registada
 *       400:
 *         description: Encomenda não elegível para avaliação
 */
async function submitReview(req, res, next) {
  try {
    const orderId = req.params.id;
    const { supermarketRating, supermarketComment, courierRating, courierComment } = req.body;

    const order = await Order.findOne({ _id: orderId, "client.userId": req.user.id }).populate("supermarket");
    if (!order) return res.status(404).json({ message: "Encomenda não encontrada." });
    if (order.status !== "delivered") return res.status(400).json({ message: "Só podes avaliar encomendas entregues." });
    if (order.reviewSubmitted) return res.status(400).json({ message: "Avaliação já registada para esta encomenda." });

    let reviewsCreated = 0;

    if (supermarketRating) {
      const existingSM = await Review.findOne({ order: orderId, targetType: "supermarket" });
      if (!existingSM) {
        await Review.create({
          order: orderId,
          author: { name: order.client.name, userId: req.user.id },
          targetType: "supermarket",
          targetId: order.supermarket._id,
          rating: parseInt(supermarketRating, 10),
          comment: supermarketComment || ""
        });
        reviewsCreated++;
        await recalculateSupermarketRating(order.supermarket._id);
      }
    }

    if (order.deliveryMethod === "courier" && courierRating) {
      const delivery = await Delivery.findOne({ order: orderId }).sort({ createdAt: -1 });
      if (delivery?.courier) {
        const existingCourier = await Review.findOne({ order: orderId, targetType: "courier" });
        if (!existingCourier) {
          await Review.create({
            order: orderId,
            author: { name: order.client.name, userId: req.user.id },
            targetType: "courier",
            targetId: delivery.courier,
            rating: parseInt(courierRating, 10),
            comment: courierComment || ""
          });
          reviewsCreated++;
          await recalculateCourierRating(delivery.courier);
        }
      }
    }

    if (reviewsCreated > 0) {
      await Order.findByIdAndUpdate(orderId, { reviewSubmitted: true });
      return res.status(200).json({ message: "Avaliação registada com sucesso!" });
    }
    return res.status(400).json({ message: "Seleciona pelo menos uma avaliação antes de submeter." });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/client/checkout:
 *   post:
 *     summary: Criar encomenda a partir do carrinho
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supermarketId, items, deliveryMethod]
 *             properties:
 *               supermarketId: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: string }
 *                     quantity: { type: integer }
 *               deliveryMethod: { type: string, enum: [pickup, courier] }
 *               couponCode: { type: string }
 *     responses:
 *       201:
 *         description: Encomenda criada com sucesso
 *       400:
 *         description: Dados inválidos ou stock insuficiente
 */
async function checkout(req, res, next) {
  const decremented = [];
  try {
    const { supermarketId, items, deliveryMethod, couponCode } = req.body;

    if (!supermarketId || !items?.length || !deliveryMethod) {
      return res.status(400).json({ message: "supermarketId, items e deliveryMethod são obrigatórios." });
    }
    if (!["pickup", "courier"].includes(deliveryMethod)) {
      return res.status(400).json({ message: "Método de entrega inválido. Usa 'pickup' ou 'courier'." });
    }

    const supermarket = await Supermarket.findById(supermarketId).lean();
    if (!supermarket || supermarket.status !== "approved") {
      return res.status(400).json({ message: "Supermercado indisponível." });
    }

    const dm = (supermarket.deliveryMethods || []).find((m) => m.type === deliveryMethod && m.active);
    if (!dm) {
      return res.status(400).json({ message: "Método de entrega não disponível neste supermercado." });
    }

    const user = await User.findById(req.user.id).lean();
    const orderItems = [];
    let subtotal = 0;

    for (const line of items) {
      const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
      const product = await Product.findOneAndUpdate(
        { _id: line.productId, supermarket: supermarketId, stock: { $gte: qty }, isActive: true },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!product) {
        await Promise.all(decremented.map((r) => Product.updateOne({ _id: r.productId }, { $inc: { stock: r.quantity } })));
        return res.status(400).json({ message: "Stock insuficiente para um dos produtos." });
      }
      decremented.push({ productId: product._id, quantity: qty });
      subtotal += product.price * qty;
      orderItems.push({ product: product._id, productName: product.name, productPrice: product.price, quantity: qty });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    let discountAmount = 0;
    let finalCouponCode = null;
    let deliveryFreeFromCoupon = false;

    if (couponCode && String(couponCode).trim()) {
      const couponResult = await validateAndApply(String(couponCode).trim(), supermarketId, subtotal);
      if (couponResult.valid) {
        const consumed = await consumeCoupon(couponResult.couponId);
        if (consumed) {
          discountAmount = couponResult.discountAmount;
          finalCouponCode = couponResult.code;
          deliveryFreeFromCoupon = Boolean(couponResult.deliveryFree);
        }
      }
    }

    const deliveryCost = deliveryFreeFromCoupon ? 0 : (Number(dm.cost) || 0);
    const total = Math.round((Math.max(0, subtotal - discountAmount) + deliveryCost) * 100) / 100;

    const order = await Order.create({
      supermarket: supermarketId,
      client: { userId: user._id, name: user.name, email: user.email, phone: user.phone },
      items: orderItems,
      subtotal,
      discountAmount,
      couponCode: finalCouponCode,
      deliveryMethod,
      deliveryCost,
      total,
      status: "pending",
      source: "online",
      statusHistory: [{ status: "pending", changedBy: user._id, reason: "Encomenda online via frontoffice" }]
    });

    return res.status(201).json({
      message: "Encomenda criada com sucesso.",
      orderId: order._id.toString(),
      total: order.total
    });
  } catch (err) {
    if (decremented.length) {
      await Promise.all(decremented.map((r) => Product.updateOne({ _id: r.productId }, { $inc: { stock: r.quantity } }))).catch(() => {});
    }
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/client/coupons/validate:
 *   get:
 *     summary: Validar código de cupão
 *     tags: [Client]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: supermarketId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: subtotal
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Resultado da validação do cupão
 */
async function validateCoupon(req, res, next) {
  try {
    const { code, supermarketId, subtotal } = req.query;
    if (!code || !supermarketId || !subtotal) {
      return res.status(400).json({ message: "code, supermarketId e subtotal são obrigatórios." });
    }

    const result = await validateAndApply(String(code).trim(), supermarketId, parseFloat(subtotal));
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, getOrders, getOrderById, cancelOrder, submitReview, checkout, validateCoupon };
