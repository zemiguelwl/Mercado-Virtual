const mongoose = require("mongoose");
const Order = require("../models/Order");
const Review = require("../models/Review");
const Delivery = require("../models/Delivery");
const Supermarket = require("../models/Supermarket");
const User = require("../models/User");

async function recalculateSupermarketRating(supermarketId) {
  const result = await Review.aggregate([
    { $match: { targetType: "supermarket", targetId: new mongoose.Types.ObjectId(supermarketId), isVisible: true } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]);
  const { average = 0, count = 0 } = result[0] || {};
  await Supermarket.findByIdAndUpdate(supermarketId, { "rating.average": Math.round(average * 10) / 10, "rating.count": count });
}

async function recalculateCourierRating(courierId) {
  const result = await Review.aggregate([
    { $match: { targetType: "courier", targetId: new mongoose.Types.ObjectId(courierId), isVisible: true } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]);
  const { average = 0, count = 0 } = result[0] || {};
  await User.findByIdAndUpdate(courierId, { "rating.average": Math.round(average * 10) / 10, "rating.count": count });
}

async function submitReview(req, res) {
  const { orderId } = req.params;
  const supermarketId = req.session.user.supermarketId;
  const { supermarketRating, supermarketComment, courierRating, courierComment } = req.body;

  const order = await Order.findById(orderId).populate("supermarket");
  if (!order || String(order.supermarket._id) !== String(supermarketId)) {
    req.flash("error", "Encomenda não encontrada ou sem permissão.");
    return res.redirect("/supermarket/orders");
  }
  if (order.status !== "delivered") {
    req.flash("error", "Só é possível avaliar encomendas entregues.");
    return res.redirect(`/supermarket/orders/${orderId}`);
  }
  if (order.reviewSubmitted) {
    req.flash("error", "A avaliação desta encomenda já foi registada.");
    return res.redirect(`/supermarket/orders/${orderId}`);
  }

  try {
    const existingSM = await Review.findOne({ order: orderId, targetType: "supermarket" });
    if (!existingSM && supermarketRating) {
      await Review.create({
        order: orderId,
        author: { name: order.client.name, userId: order.client.userId },
        targetType: "supermarket",
        targetId: order.supermarket._id,
        rating: parseInt(supermarketRating, 10),
        comment: supermarketComment || ""
      });
      await recalculateSupermarketRating(order.supermarket._id);
    }

    if (order.deliveryMethod === "courier" && courierRating) {
      const delivery = await Delivery.findOne({ order: orderId }).sort({ createdAt: -1 });
      if (delivery?.courier) {
        const existingCourier = await Review.findOne({ order: orderId, targetType: "courier" });
        if (!existingCourier) {
          await Review.create({
            order: orderId,
            author: { name: order.client.name, userId: order.client.userId },
            targetType: "courier",
            targetId: delivery.courier,
            rating: parseInt(courierRating, 10),
            comment: courierComment || ""
          });
          await recalculateCourierRating(delivery.courier);
        }
      }
    }

    await Order.findByIdAndUpdate(orderId, { reviewSubmitted: true });
    req.flash("success", "Avaliação registada com sucesso.");
    return res.redirect(`/supermarket/orders/${orderId}`);
  } catch (err) {
    console.error("submitReview:", err.message);
    req.flash("error", "Erro ao registar avaliação. Tenta novamente.");
    return res.redirect(`/supermarket/orders/${orderId}`);
  }
}

module.exports = { submitReview };
