/**
 * coupon.controller.js
 *
 * Controlador dedicado à lógica de cupões no lado do cliente (checkout online).
 * A gestão de cupões pelo admin e supermercado já está implementada nos
 * respetivos controllers (admin.controller.js e supermarket.controller.js).
 *
 * Este módulo trata de:
 *  - Validação de cupão via AJAX durante o checkout do cliente
 *  - Aplicação de cupão ao finalizar encomenda online
 *  - Estatísticas de cupões (para uso futuro em dashboards)
 */

const Coupon = require("../models/Coupon");
const { validateAndApply } = require("../services/coupon.service");

/**
 * GET /client/coupons/validate?code=XXX&subtotal=YY&supermarketId=ZZZ
 *
 * Endpoint AJAX chamado pelo checkout do cliente para verificar se um cupão
 * é válido antes de submeter o formulário. Não incrementa `currentUses` —
 * isso só acontece no POST do checkout.
 *
 * Resposta JSON:
 *  { valid: true,  discountAmount: 2.5, deliveryFree: false, description: "10% desconto" }
 *  { valid: false, message: "Cupão expirado." }
 */
async function validateClientCoupon(req, res, next) {
  try {
    const rawCode = String(req.query.code || "").trim();
    const numSubtotal = parseFloat(req.query.subtotal) || 0;
    const smId = req.query.supermarketId ? String(req.query.supermarketId) : null;

    if (!rawCode) {
      return res.json({ valid: false, message: "Introduz um código de cupão." });
    }

    const result = await validateAndApply(rawCode, smId, numSubtotal);

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
      message: result.message || "Cupão inválido."
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Função auxiliar (não é uma rota) — chamada internamente pelo client.controller.js
 * durante o checkoutPost para aplicar e registar o uso do cupão.
 *
 * @param {string} code          - Código inserido pelo utilizador
 * @param {string} supermarketId - ID do supermercado do carrinho
 * @param {number} subtotal      - Valor dos produtos antes de desconto
 * @returns {{ discountAmount, deliveryFree, couponCode, couponId } | null}
 *
 * Devolve null se o cupão for inválido (não lança erro — o checkout continua sem desconto).
 */
async function applyAndIncrementCoupon(code, supermarketId, subtotal) {
  if (!code || !String(code).trim()) return null;

  const result = await validateAndApply(String(code).trim(), supermarketId, subtotal);
  if (!result.valid) return null;

  // Incrementar contador de utilizações de forma atómica
  await Coupon.findByIdAndUpdate(result.couponId, { $inc: { currentUses: 1 } });

  return {
    discountAmount: result.discountAmount,
    deliveryFree: Boolean(result.deliveryFree),
    couponCode: result.code,
    couponId: result.couponId
  };
}

/**
 * Estatísticas globais de cupões — usado em dashboards ou relatórios.
 * Devolve um objeto com contagens e totais agregados.
 *
 * @returns {{ total, active, global, byType }}
 */
async function getCouponStats() {
  const [total, active, global, byType] = await Promise.all([
    Coupon.countDocuments(),
    Coupon.countDocuments({ isActive: true }),
    Coupon.countDocuments({ supermarket: null }),
    Coupon.aggregate([
      { $group: { _id: "$discountType", count: { $sum: 1 }, totalUses: { $sum: "$currentUses" } } }
    ])
  ]);

  return { total, active, global, byType };
}

/**
 * GET /admin/coupons/stats (rota opcional para o admin ver métricas de cupões)
 *
 * Renderiza ou devolve JSON com estatísticas dos cupões.
 * A rota correspondente pode ser adicionada a admin.routes.js se necessário.
 */
async function statsPage(req, res, next) {
  try {
    const stats = await getCouponStats();
    // Os 5 cupões com mais utilizações
    const topUsed = await Coupon.find()
      .sort({ currentUses: -1 })
      .limit(5)
      .lean();

    return res.render("admin/coupon-stats", {
      title: "Estatísticas de Cupões",
      stats,
      topUsed
    });
  } catch (err) {
    console.error("statsPage:", err.message);
    req.flash("error", "Erro ao carregar estatísticas.");
    next(err);
    return res.redirect("/admin/coupons");
  }
}

module.exports = {
  validateClientCoupon, // rota AJAX do cliente
  applyAndIncrementCoupon, // (não é rota)
  getCouponStats, // helper interno
  statsPage // rota opcional do admin
};
