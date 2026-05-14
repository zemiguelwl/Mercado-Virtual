const Coupon = require("../models/Coupon");
const { validateAndApply } = require("../services/coupon.service");

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
    next(err);
  }
}

module.exports = { validateClientCoupon, getCouponStats, statsPage };
