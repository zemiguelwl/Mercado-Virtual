const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: "Supermarket", required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  image: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.pre("save", function preSave(next) {
  this.updatedAt = new Date();
  next();
});

// Índices para pesquisas frequentes no supermercado, filtragem por categoria e pesquisa textual por nome de produto.
productSchema.index({ supermarket: 1, isActive: 1 });
productSchema.index({ supermarket: 1, category: 1 });
productSchema.index({ name: "text" });

module.exports = mongoose.model("Product", productSchema);
