const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, default: null },
  phone: { type: String, required: true, unique: true, trim: true },
  address: { type: String, default: "N/A" },
  role: { type: String, enum: ["admin", "supermarket", "courier", "client"], required: true },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  welcomeCouponSent: { type: Boolean, default: false },
  accountStatus: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

// Comparar password guardada em hash bcrypt
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  // Clientes POS não têm password, nunca devem chegar aqui
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Índices para acelerar pesquisas frequentes por role e estado da conta
userSchema.index({ role: 1 });
userSchema.index({ accountStatus: 1 });

module.exports = mongoose.model("User", userSchema);
