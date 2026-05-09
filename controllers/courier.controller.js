const mongoose = require("mongoose");
const Delivery = require("../models/Delivery");
const Review = require("../models/Review");
const { onCourierAcceptDelivery, onCourierPickedUp, onCourierCancelDelivery, onCourierDelivered } = require("../services/order.service");

async function dashboard(req, res, next) {
  try {
    const courierId = req.session.user.id;
    const [activeDelivery, totalDeliveries, topSupermarkets] = await Promise.all([
      Delivery.findOne({ courier: courierId, status: { $in: ["accepted", "picked_up"] } }).populate("order").lean(),
      Delivery.countDocuments({ courier: courierId, status: "delivered" }),
      Delivery.aggregate([
        { $match: { courier: new mongoose.Types.ObjectId(req.session.user.id), status: "delivered" } },
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
    // Extrair a activeOrder da entrega populada
    let activeOrder = activeDelivery?.order || null;

    // DEBUG: Verificar o que está a ser enviado para a vista
    console.log(`[DEBUG Dashboard] Delivery ID: ${activeDelivery?._id}`);
    console.log(`[DEBUG Dashboard] Delivery Status: ${activeDelivery?.status}`);
    console.log(`[DEBUG Dashboard] Order Status via Populate: ${activeOrder?.status}`);

    // Se por alguma razão o populate falhou mas temos o ID, tentamos carregar manualmente
    if (!activeOrder && activeDelivery?.order) {
      const Order = require("../models/Order");
      activeOrder = await Order.findById(activeDelivery.order).lean();
      console.log(`[DEBUG Dashboard] Order Status via Manual Fetch: ${activeOrder?.status}`);
    }

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
    const deliveries = await Delivery.find({ status: "available" }).populate("order").populate("supermarket", "name location").lean();
    res.render("courier/available", { title: "Entregas Disponíveis", deliveries });
  } catch (err) {
    next(err);
  }
}

async function accept(req, res, next) {
  try {
    const courierId = req.session.user.id;
    const deliveryId = req.params.id;

    // 1. Verificar se o estafeta já tem uma entrega ativa
    const activeDelivery = await Delivery.findOne({ courier: courierId, status: { $in: ["accepted", "picked_up"] } });
    if (activeDelivery) {
      req.flash("error", "Já tens uma entrega ativa.");
      return res.redirect("/courier/available");
    }

    // 2. lógica de aceitação e validação ao serviço
    await onCourierAcceptDelivery(deliveryId, courierId);

    req.flash("success", "Entrega aceite.");
    res.redirect("/courier/dashboard");
  } catch (err) {
    // Capturar qualquer erro do serviço e mostrar ao utilizador 
    console.error(`[CONTROLLER ERROR] Falha na aceitação: ${err.message}`);
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
    const deliveries = await Delivery.find({ courier: req.session.user.id }).populate("order").sort({ createdAt: -1 }).lean();
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