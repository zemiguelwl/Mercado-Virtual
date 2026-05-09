const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: { type: String }
  },
  { _id: false }
);

const orderClientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: "Supermarket", required: true },
  client: { type: orderClientSchema, required: true },
  items: { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  couponCode: { type: String },
  deliveryMethod: { type: String, enum: ["pickup", "courier", "instore"], required: true },
  deliveryCost: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "preparing", "ready", "in_delivery", "delivered", "cancelled"],
    default: "pending"
  },
  statusHistory: [statusHistorySchema],
  source: { type: String, enum: ["online", "pos"], default: "online" },
  confirmedAt: { type: Date },
  reviewSubmitted: { type: Boolean, default: false },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// o cliente é guardado em snapshot para preservar o estado da encomenda, mesmo que o perfil do utilizador seja alterado mais tarde

orderSchema.index({ supermarket: 1, status: 1 });
orderSchema.index({ supermarket: 1, createdAt: -1 });
orderSchema.index({ "client.userId": 1 });
orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
