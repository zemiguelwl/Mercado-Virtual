const mongoose = require("mongoose");

const deliveryMethodSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["pickup", "courier", "instore"], required: true },
    label: { type: String },
    cost: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true }
  },
  { _id: false }
);

const scheduleSchema = new mongoose.Schema(
  {
    monday: { type: String, default: "Fechado" },
    tuesday: { type: String, default: "Fechado" },
    wednesday: { type: String, default: "Fechado" },
    thursday: { type: String, default: "Fechado" },
    friday: { type: String, default: "Fechado" },
    saturday: { type: String, default: "Fechado" },
    sunday: { type: String, default: "Fechado" }
  },
  { _id: false }
);

const supermarketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  location: { type: String, required: true },
  phone: { type: String },
  schedule: { type: scheduleSchema, default: () => ({}) },
  deliveryMethods: [deliveryMethodSchema],
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  rejectionReason: { type: String },
  isOpen: { type: Boolean, default: false },
  logoImage: { type: String },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

supermarketSchema.index({ status: 1 });

module.exports = mongoose.model("Supermarket", supermarketSchema);
