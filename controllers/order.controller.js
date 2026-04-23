/**
 * order.controller.js
 *
 * Controlador dedicado a relatórios e análises de encomendas.
 * A gestão do ciclo de vida das encomendas (confirmar, preparar, entregar,
 * cancelar) já está implementada em:
 *   - supermarket.controller.js  (ações do supermercado)
 *   - client.controller.js       (encomendas e cancelamento pelo cliente)
 *   - admin.controller.js        (monitorização e cancelamento forçado pelo admin)
 *   - order.service.js           (máquina de estados central)
 *
 * Este módulo trata de:
 *   - Estatísticas agregadas de encomendas (para dashboards)
 *   - Histórico de encomendas de um cliente (para o admin consultar)
 *   - Revenue e métricas por supermercado
 */

const mongoose = require("mongoose");
const Order = require("../models/Order");

/**
 * Retorna estatísticas globais de encomendas.
 * Útil para o dashboard do admin ou relatórios.
 */
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

/**
 * Retorna todas as encomendas de um cliente específico.
 * @param {string} clientId
 */
async function getOrdersByClient(clientId) {
  return Order.find({ "client.userId": new mongoose.Types.ObjectId(clientId) })
    .populate("supermarket", "name location")
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * retorna receita e número de encomendas agrupado por supermercado
 */
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

/**
 * Retorna encomendas criadas num intervalo de datas.
 * @param {Date} startDate
 * @param {Date} endDate
 */
async function getOrdersByDateRange(startDate, endDate) {
  return Order.find({ createdAt: { $gte: startDate, $lte: endDate } })
    .populate("supermarket", "name")
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * GET /admin/orders/stats
 * Rota opcional — para ativar, adicionar em admin.routes.js:
 *   const orderCtrl = require('../controllers/order.controller');
 *   router.get('/orders/stats', orderCtrl.statsPage);
 */
async function statsPage(req, res, next) {
  try {
    const [stats, revenueBySupermarket] = await Promise.all([
      getGlobalStats(),
      getRevenueBySupermarket()
    ]);
    return res.render("admin/order-stats", { title: "Estatísticas de Encomendas", stats, revenueBySupermarket });
  } catch (err) {
    console.error("order.controller statsPage:", err.message);
    req.flash("error", "Erro ao carregar estatísticas.");
    next(err);
    return res.redirect("/admin/orders");
  }
}

/**
 * GET /admin/users/:id/orders
 * Rota opcional — para ativar, adicionar em admin.routes.js:
 *   const orderCtrl = require('../controllers/order.controller');
 *   router.get('/users/:id/orders', orderCtrl.clientHistory);
 */
async function clientHistory(req, res, next) {
  try {
    const orders = await getOrdersByClient(req.params.id);
    return res.render("admin/client-orders", { title: "Histórico do Cliente", orders, clientId: req.params.id });
  } catch (err) {
    console.error("order.controller clientHistory:", err.message);
    req.flash("error", "Erro ao carregar encomendas do cliente.");
    next(err);
    return res.redirect("/admin/users");
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
