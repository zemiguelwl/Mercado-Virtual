// Funções auxiliares para o sistema de entregas.

const mongoose = require("mongoose");
const Delivery = require("../models/Delivery");


async function getActiveDelivery(courierId) {
  return Delivery.findOne({
    courier: new mongoose.Types.ObjectId(courierId),
    status: { $in: ["accepted", "picked_up"] }
  })
    .populate({
      path: "order",
      populate: { path: "supermarket", select: "name location phone" }
    })
    .lean();
}


async function hasActiveDelivery(courierId) {
  const count = await Delivery.countDocuments({
    courier: new mongoose.Types.ObjectId(courierId),
    status: { $in: ["accepted", "picked_up"] }
  });
  return count > 0;
}


async function getAvailableDeliveries() {
  return Delivery.find({ status: "available" })
    .populate({
      path: "order",
      populate: { path: "supermarket", select: "name location phone" }
    })
    .sort({ createdAt: 1 }) // mais antigas primeiro 
    .lean();
}


async function getPendingDeliveriesForSupermarket(supermarketId) {
  return Delivery.find({
    supermarket: new mongoose.Types.ObjectId(supermarketId),
    status: { $in: ["available", "accepted", "picked_up"] }
  })
    .populate("courier", "name phone")
    .populate("order", "client total createdAt")
    .lean();
}

async function getCourierStats(courierId) {
  const courierObjectId = new mongoose.Types.ObjectId(courierId);

  const [statusCounts, topSupermarkets] = await Promise.all([
    // Contagem por estado
    Delivery.aggregate([
      { $match: { courier: courierObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    // Top supermercados com mais entregas concluídas
    Delivery.aggregate([
      { $match: { courier: courierObjectId, status: "delivered" } },
      { $group: { _id: "$supermarket", totalDeliveries: { $sum: 1 } } },
      { $sort: { totalDeliveries: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: "supermarkets",
          localField: "_id",
          foreignField: "_id",
          as: "supermarketInfo"
        }
      },
      { $unwind: "$supermarketInfo" },
      { $project: { name: "$supermarketInfo.name", totalDeliveries: 1 } }
    ])
  ]);

  const byStatus = {};
  statusCounts.forEach((s) => { byStatus[s._id] = s.count; });

  return {
    totalDelivered: byStatus.delivered || 0,
    totalCancelled: byStatus.cancelled || 0,
    topSupermarkets
  };
}


async function getCourierHistory(courierId) {
  return Delivery.find({
    courier: new mongoose.Types.ObjectId(courierId),
    status: { $in: ["delivered", "cancelled"] }
  })
    .populate({
      path: "order",
      populate: { path: "supermarket", select: "name" }
    })
    .sort({ createdAt: -1 })
    .lean();
}

module.exports = {
  getActiveDelivery,
  hasActiveDelivery,
  getAvailableDeliveries,
  getPendingDeliveriesForSupermarket,
  getCourierStats,
  getCourierHistory
};
