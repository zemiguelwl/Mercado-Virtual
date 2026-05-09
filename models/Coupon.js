const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  description: { type: String },
  discountType: {
    type: String,
    enum: ["percentage", "fixed_amount", "fixed_shipping"],
    required: true
  },
  discountValue: { type: Number, required: true, min: 0 },
  minOrderValue: { type: Number, default: 0 },
  maxUses: { type: Number, default: null },
  currentUses: { type: Number, default: 0 },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: "Supermarket", default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sentToUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});

// O código deve ser único dentro do mesmo supermercado
// Para cupões globais, supermarket = null
couponSchema.index({ code: 1, supermarket: 1 }, { unique: true });

module.exports = mongoose.model("Coupon", couponSchema);
