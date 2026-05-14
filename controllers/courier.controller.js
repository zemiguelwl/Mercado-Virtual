const mongoose = require("mongoose");
const Delivery = require("../models/Delivery");
const Review = require("../models/Review");
const deliveryService = require("../services/delivery.service");
const { onCourierAcceptDelivery, onCourierPickedUp, onCourierCancelDelivery, onCourierDelivered } = require("../services/order.service");

async function dashboard(req, res, next) {
  try {
    const courierId = req.session.user.id;
    const [activeDelivery, totalDeliveries, topSupermarkets] = await Promise.all([
      deliveryService.getActiveDelivery(courierId),
      Delivery.countDocuments({ courier: courierId, status: "delivered" }),
      Delivery.aggregate([
        { $match: { courier: new mongoose.Types.ObjectId(courierId), status: "delivered" } },
        { $group: { _id: "$supermarket", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "supermarkets",
            localField: "_id",
            foreignField: "_id",
            as: "supermarket"
          }
        },
        { $unwind: { path: "$supermarket", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, supermarketName: "$supermarket.name", total: 1 } }
      ])
    ]);

    const activeOrder = activeDelivery?.order || null;

    res.render("courier/dashboard", {
      title: "Dashboard Estafeta",
      activeDelivery,
      activeOrder,
      totalDeliveries,
      topSupermarkets
    });
  } catch (err) {
    next(err);
  }
}

async function available(req, res, next) {
  try {
    const deliveries = await deliveryService.getAvailableDeliveries();
    res.render("courier/available", { title: "Entregas Disponíveis", deliveries });
  } catch (err) {
    next(err);
  }
}

async function accept(req, res, next) {
  try {
    const courierId = req.session.user.id;
    const deliveryId = req.params.id;

    const alreadyActive = await deliveryService.hasActiveDelivery(courierId);
    if (alreadyActive) {
      req.flash("error", "Já tens uma entrega ativa.");
      return res.redirect("/courier/available");
    }

    await onCourierAcceptDelivery(deliveryId, courierId);
    req.flash("success", "Entrega aceite.");
    res.redirect("/courier/dashboard");
  } catch (err) {
    req.flash("error", err.message);
    return res.redirect("/courier/available");
  }
}

async function pickedUp(req, res, next) {
  try {
    await onCourierPickedUp(req.params.id, req.session.user.id);
    req.flash("success", "Pedido levantado.");
    return res.redirect("/courier/dashboard");
  } catch (err) {
    req.flash("error", err.message);
    return res.redirect("/courier/dashboard");
  }
}

async function delivered(req, res, next) {
  try {
    try {
      await onCourierDelivered(req.params.id, req.session.user.id);
      req.flash("success", "Entrega concluída.");
    } catch (error) {
      req.flash("error", error.message);
    }
    return res.redirect("/courier/history");
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    try {
      await onCourierCancelDelivery(req.params.id, req.session.user.id, req.body.reason);
      req.flash("success", "Entrega cancelada e novamente disponível.");
    } catch (error) {
      req.flash("error", error.message);
    }
    return res.redirect("/courier/dashboard");
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const deliveries = await deliveryService.getCourierHistory(req.session.user.id);
    res.render("courier/history", { title: "Histórico", deliveries });
  } catch (err) {
    next(err);
  }
}

async function reviews(req, res, next) {
  try {
    const reviews = await Review.find({ targetType: "courier", targetId: req.session.user.id, isVisible: true }).lean();
    const averageRating = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : 0;
    res.render("courier/reviews/index", { title: "Avaliações", reviews, averageRating });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, available, accept, pickedUp, delivered, cancel, history, reviews };
