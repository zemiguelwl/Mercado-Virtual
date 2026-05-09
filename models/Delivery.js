  const mongoose = require("mongoose");

const deliveryStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: { type: String }
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
  courier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: "Supermarket", required: true },
  status: {
    type: String,
    enum: ["available", "accepted", "picked_up", "delivered", "cancelled"],
    default: "available"
  },
  statusHistory: [deliveryStatusHistorySchema],
  acceptedAt: { type: Date },
  deliveredAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Cada encomenda tem no máximo uma entrega ligada a ela
deliverySchema.index({ status: 1 });
deliverySchema.index({ courier: 1, status: 1 });

module.exports = mongoose.model("Delivery", deliverySchema);
