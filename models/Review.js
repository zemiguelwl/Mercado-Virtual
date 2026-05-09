const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  author: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true }
  },
  targetType: { type: String, enum: ["supermarket", "courier"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 500 },
  reply: {
    text: { type: String, maxlength: 500 },
    repliedAt: { type: Date }
  },
  isVisible: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Impede que a mesma encomenda tenha avaliação duplicada para o mesmo alvo

reviewSchema.index({ order: 1, targetType: 1 }, { unique: true });
reviewSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("Review", reviewSchema);
