const Coupon = require("../models/Coupon");
const User = require("../models/User");
const emailService = require("./email.service");

const WELCOME_COUPON_CODE = "BEMVINDO10";
const WELCOME_COUPON_VALID_DAYS = 30;

// Serviço responsável pela validação e envio de cupões

function normalizeDiscountType(raw) {
  if (raw === "fixed_shipping" || raw === "percentage" || raw === "fixed_amount") return raw;
  if (raw === "fixed") return "percentage";
  return raw;
}

async function validateAndApply(code, supermarketId, subtotal) {
  const invalidBase = { valid: false, discountAmount: 0, deliveryFree: false, description: "" };
  try {
    const now = new Date();
    const coupon = await Coupon.findOne({
      code: String(code || "").toUpperCase().trim(),
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [{ supermarket: null }, { supermarket: supermarketId }]
    });

    // Verifica existência, estado, validade temporal e âmbito (global ou específico de supermrcado)
    if (!coupon) {
      return { ...invalidBase, message: "Cupão não encontrado ou inativo." };
    }

    const discountType = normalizeDiscountType(coupon.discountType);
    if (!["percentage", "fixed_shipping", "fixed_amount"].includes(discountType)) {
      return { ...invalidBase, message: "Tipo de cupão inválido." };
    }

    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      return { ...invalidBase, message: "Este cupão já atingiu o número máximo de utilizações." };
    }
    // O valor mínimo de encomenda garante que cupões promocionais não são usados em valores muito baixos
    if (subtotal < coupon.minOrderValue) {
      return { ...invalidBase, message: `Encomenda mínima de €${coupon.minOrderValue.toFixed(2)}.` };
    }

    let discountAmount = 0;
    let deliveryFree = false;
    let description = coupon.description || "";

    if (discountType === "fixed_shipping") {
      deliveryFree = true;
      if (!description) description = "Entrega gratuita";
    } else if (discountType === "fixed_amount") {
      discountAmount = Math.round(coupon.discountValue * 100) / 100;
      if (!description) description = `Desconto de €${discountAmount.toFixed(2)}`;
    } else {
      discountAmount = (coupon.discountValue / 100) * subtotal;
      discountAmount = Math.round(discountAmount * 100) / 100;
      if (!description) description = `Desconto de ${coupon.discountValue}%`;
    }

    return {
      valid: true,
      discountAmount,
      deliveryFree,
      description,
      code: coupon.code,
      couponId: coupon._id.toString()
    };
  } catch (err) {
    console.error("validateAndApply:", err.message);
    return { ...invalidBase, message: "Erro ao validar cupão." };
  }
}

async function findAdminUserId() {
  const adminUser = await User.findOne({ role: "admin" }).select("_id").lean();
  return adminUser?._id || null;
}

async function ensureWelcomeCouponExists() {
  let coupon = await Coupon.findOne({ code: WELCOME_COUPON_CODE, supermarket: null }).lean();
  if (coupon) return coupon;

  // O cupão de boas-vindas é global e precisa de um admin 
  const createdBy = await findAdminUserId();
  if (!createdBy) {
    console.error("ensureWelcomeCouponExists: não existe admin para o campo createdBy.");
    return null;
  }
  const now = new Date();
  const validUntil = new Date(now.getTime() + WELCOME_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000);

  coupon = await Coupon.create({
    code: WELCOME_COUPON_CODE,
    description: "Cupão de boas-vindas: 10% de desconto na tua primeira compra.",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 0,
    maxUses: null,
    currentUses: 0,
    validFrom: now,
    validUntil,
    isActive: true,
    supermarket: null,
    createdBy,
    sentToUsers: []
  });

  return coupon;
}

async function sendWelcomeCoupon(user) {
  if (!user || user.welcomeCouponSent || !user.email) return false;

  const coupon = await ensureWelcomeCouponExists();
  if (!coupon) return false;

  const expiresLabel = coupon.validUntil.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  const sent = await emailService.sendCouponEmail(
    user.email,
    user.name,
    coupon.code,
    coupon.description || "Cupão de boas-vindas para a tua primeira compra.",
    expiresLabel
  );

  if (sent) {
    await User.findByIdAndUpdate(user._id, { welcomeCouponSent: true });
    await Coupon.findByIdAndUpdate(coupon._id, { $addToSet: { sentToUsers: user._id } });
    return true;
  }

  return false;
}

async function sendCouponToAllVerifiedUsers(couponId) {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw new Error("Cupão não encontrado.");
  if (!coupon.isActive) throw new Error("Cupão inativo não pode ser enviado.");

  const recipients = await User.find({ isActive: true, isEmailVerified: true }).select("_id name email").lean(); //carrega todos os utilizadores de uma vez, melhorar no futuro
  const existingIds = new Set((coupon.sentToUsers || []).map((id) => String(id)));
  const newRecipients = [];

  for (const user of recipients) {
    if (!user.email) continue;
    const expiresLabel = coupon.validUntil.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    const sent = await emailService.sendCouponEmail(user.email, user.name, coupon.code, coupon.description || "Cupão especial", expiresLabel);
    if (sent && !existingIds.has(String(user._id))) {
      existingIds.add(String(user._id));
      newRecipients.push(user._id);
    }
  }

  if (newRecipients.length > 0) {
    await Coupon.findByIdAndUpdate(couponId, { $addToSet: { sentToUsers: { $each: newRecipients } } });
  }

  return {
    sentCount: newRecipients.length,
    totalRecipients: recipients.length
  };
}

module.exports = { validateAndApply, sendWelcomeCoupon, sendCouponToAllVerifiedUsers };

