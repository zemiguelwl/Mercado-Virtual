const mongoose = require("mongoose");
const Order = require("../models/Order");

async function getGlobalStats() {
  const [byStatus, totals] = await Promise.all([
    Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, totalValue: { $sum: "$total" } } },
      { $sort: { count: -1 } }
    ]),
    Order.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" }, totalDelivered: { $sum: 1 } } }
    ])
  ]);

  const { totalRevenue = 0, totalDelivered = 0 } = totals[0] || {};
  return { byStatus, totalRevenue, totalDelivered };
}

async function getOrdersByClient(clientId) {
  return Order.find({ "client.userId": new mongoose.Types.ObjectId(clientId) })
    .populate("supermarket", "name location")
    .sort({ createdAt: -1 })
    .lean();
}

async function getRevenueBySupermarket() {
  return Order.aggregate([
    { $match: { status: "delivered" } },
    { $group: { _id: "$supermarket", totalOrders: { $sum: 1 }, totalRevenue: { $sum: "$total" } } },
    { $lookup: { from: "supermarkets", localField: "_id", foreignField: "_id", as: "supermarketInfo" } },
    { $unwind: "$supermarketInfo" },
    { $project: { supermarketName: "$supermarketInfo.name", totalOrders: 1, totalRevenue: { $round: ["$totalRevenue", 2] } } },
    { $sort: { totalRevenue: -1 } }
  ]);
}

async function getOrdersByDateRange(startDate, endDate) {
  return Order.find({ createdAt: { $gte: startDate, $lte: endDate } })
    .populate("supermarket", "name")
    .sort({ createdAt: -1 })
    .lean();
}

async function statsPage(req, res, next) {
  try {
    const [stats, revenueBySupermarket] = await Promise.all([
      getGlobalStats(),
      getRevenueBySupermarket()
    ]);
    return res.render("admin/order-stats", { title: "Estatísticas de Encomendas", stats, revenueBySupermarket });
  } catch (err) {
    next(err);
  }
}

async function clientHistory(req, res, next) {
  try {
    const orders = await getOrdersByClient(req.params.id);
    return res.render("admin/client-orders", { title: "Histórico do Cliente", orders, clientId: req.params.id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  statsPage,
  clientHistory,
  getGlobalStats,
  getOrdersByClient,
  getRevenueBySupermarket,
  getOrdersByDateRange
};
