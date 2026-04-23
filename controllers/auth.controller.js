const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const Supermarket = require("../models/Supermarket");
const EmailVerification = require("../models/EmailVerification");
const emailService = require("../services/email.service");
const couponService = require("../services/coupon.service");

// Controlador de autenticação e registo.
// Responsável por enviar códigos de verificação por email, criar/atualizar utilizadores e gerir a sessão após login.

function showLogin(req, res) {
  const next = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : "";
  res.render("auth/login", { title: "Login", next });
}

function showRegister(req, res) {
  res.render("auth/register", { title: "Registo", errors: [], formData: {} });
}

async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("auth/register", { title: "Registo", errors: errors.array(), formData: req.body });
    }

    const { name, email, password, phone, address, role, supermarketName } = req.body;
    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser && existingUser.isEmailVerified) {
      req.flash("error", "Email já registado");
      return res.redirect("/auth/register");
    }

    let user;
    if (existingUser && !existingUser.isEmailVerified) {
      // Reutiliza conta existente ainda por verificar para não criar duplicados.
      user = existingUser;
      user.name = name;
      user.password = await bcrypt.hash(password, 10);
      user.phone = phone;
      // se a conta existente não tinha password (criada no POS), forçar role client
      // isto impede que um registo via POS converta um cliente POS num supermercado ou estafeta
      user.role = existingUser.password ? role : "client";
      user.accountStatus = "ACTIVE";
      user.isActive = true;
      await user.save();

      if (role === "supermarket") {
        const supermarket = await Supermarket.findOne({ user: user._id });
        if (supermarket) {
          supermarket.name = supermarketName || `Supermercado de ${name}`;
          supermarket.location = address;
          supermarket.phone = phone;
          supermarket.status = "pending";
          await supermarket.save();
        } else {
          await Supermarket.create({
            user: user._id,
            name: supermarketName || `Supermercado de ${name}`,
            location: address,
            phone,
            status: "pending",
            deliveryMethods: [
              { type: "pickup", label: "Levantamento em loja", cost: 0, active: true },
              { type: "instore", label: "Venda em loja", cost: 0, active: true }
            ]
          });
        }
      }

      req.flash("info", "Este email ainda não foi verificado. Enviámos um novo código para o mesmo email.");
    } else {
      user = await User.create({
        name,
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        phone,
        address,
        role,
        isEmailVerified: false
      });

      if (role === "supermarket") {
        await Supermarket.create({
          user: user._id,
          name: supermarketName || `Supermercado de ${name}`,
          location: address,
          phone,
          status: "pending",
          deliveryMethods: [
            { type: "pickup", label: "Levantamento em loja", cost: 0, active: true },
            { type: "instore", label: "Venda em loja", cost: 0, active: true }
          ]
        });
      }
    }

    const plainCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await bcrypt.hash(plainCode, 6);
    await EmailVerification.deleteMany({ user: user._id });
    await EmailVerification.create({
      user: user._id,
      email: user.email,
      code: hashedCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    try {
      await emailService.sendVerificationEmail(user.email, user.name, plainCode);
    } catch (err) {
      console.error("Falha ao enviar email de verificação:", err.message);
      req.flash("error", "Não foi possível enviar o código de verificação. Tenta novamente.");
      next(err);
      return res.redirect("/auth/register");
    }

    req.session.pendingVerificationUserId = user._id.toString();
    return res.redirect("/auth/verify-email");
  } catch (err) {
    next(err);
  }
}

async function showVerifyEmail(req, res, next) {
  try {
    if (!req.session.pendingVerificationUserId) return res.redirect("/auth/login");
    const user = await User.findById(req.session.pendingVerificationUserId).select("email");
    const maskedEmail = user?.email ? `${user.email[0]}***${user.email.slice(user.email.indexOf("@"))}` : "teu email";
    return res.render("auth/verify-email", { title: "Verificar email", email: maskedEmail });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { code } = req.body;
    const userId = req.session.pendingVerificationUserId;
    if (!userId) return res.redirect("/auth/login");

    const verification = await EmailVerification.findOne({ user: userId, used: false }).sort({ createdAt: -1 });
    if (!verification) {
      req.flash("error", "Código inválido ou expirado");
      return res.redirect("/auth/verify-email");
    }
    if (verification.expiresAt < new Date()) {
      req.flash("error", "O código expirou. Pede um novo código.");
      return res.redirect("/auth/verify-email");
    }
    const isMatch = await bcrypt.compare(String(code || "").trim(), verification.code);
    if (!isMatch) {
      req.flash("error", "Código incorreto");
      return res.redirect("/auth/verify-email");
    }
    verification.used = true;
    await verification.save();
    const user = await User.findByIdAndUpdate(userId, { isEmailVerified: true }, { new: true });
    if (user) {
      try {
        // Envia coupon de boas-vindas apenas após a verificação de email.
        await couponService.sendWelcomeCoupon(user);
      } catch (err) {
        console.error("Falha ao enviar cupão de boas-vindas:", err.message);
        next(err);
      }
    }
    delete req.session.pendingVerificationUserId;
    req.flash("success", "Email verificado com sucesso! Podes fazer login.");
    return res.redirect("/auth/login");
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const userId = req.session.pendingVerificationUserId;
    if (!userId) return res.redirect("/auth/login");
    const user = await User.findById(userId);
    if (!user) return res.redirect("/auth/login");
    await EmailVerification.deleteMany({ user: userId });
    const plainCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await bcrypt.hash(plainCode, 6);
    await EmailVerification.create({ user: user._id, email: user.email, code: hashedCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
    await emailService.sendVerificationEmail(user.email, user.name, plainCode);
    req.flash("success", "Novo código enviado para o teu email.");
    return res.redirect("/auth/verify-email");
  } catch (err) {
    next(err);
  }
}

function safeInternalNext(body) {
  // Protege a redireção após login contra caminhos externos ou abusivos.
  const raw = typeof body?.next === "string" ? body.next : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "";
}

async function processLogin(req, res, next) {
  try {
    const nextAfterLogin = safeInternalNext(req.body);
    const loginWithNext = nextAfterLogin
      ? `/auth/login?next=${encodeURIComponent(nextAfterLogin)}`
      : "/auth/login";

    const { email, password } = req.body;
    // auth.controller
    const user = await User.findOne({ email: String(email || "").toLowerCase() });

    // 1. Utilizador existe?
    if (!user) {
      req.flash("error", "Email ou password incorretos.");
      return res.status(401).redirect(loginWithNext);
    }

    // 2. Conta autenticável? Clientes POS têm password=null e não podem fazer login
    // Esta verificação tem de vir ANTES de comparePassword para evitar TypeError
    if (!user.password) {
      req.flash("error", "Esta conta não tem login associado. Regista-te para criar uma conta completa.");
      return res.status(401).redirect(loginWithNext);
    }

    // 3. Email verificado?
    if (!user.isEmailVerified) {
      req.session.pendingVerificationUserId = user._id.toString();
      req.flash("error", "Precisas de verificar o teu email antes de fazer login.");
      return res.redirect("/auth/verify-email");
    }

    // 4. Conta ativa?
    if (!user.isActive) {
      req.flash("error", "A tua conta está desativada. Contacta o administrador.");
      return res.status(401).redirect(loginWithNext);
    }

    // 5. Password correcta? só aqui é seguro chamar comparePassword
    if (!(await user.comparePassword(password || ""))) {
      req.flash("error", "Email ou password incorretos.");
      return res.status(401).redirect(loginWithNext);
    }

    let supermarketId = null;
    if (user.role === "supermarket") {
      const supermarket = await Supermarket.findOne({ user: user._id });
      if (!supermarket || supermarket.status === "rejected") {
        req.flash("error", "A sua conta foi rejeitada. Contacte o administrador.");
        return res.status(401).redirect(loginWithNext);
      }
      supermarketId = supermarket?._id?.toString() || null;
      req.session.supermarketStatus = supermarket?.status || null;
    }

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      supermarketId
    };

    const redirectMap = {
      admin: "/admin/dashboard",
      supermarket: "/supermarket/dashboard",
      courier: "/courier/dashboard",
      client: "/client/dashboard"
    };
    if (nextAfterLogin) return res.redirect(nextAfterLogin);
    return res.redirect(redirectMap[user.role] || "/catalog");
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  req.session.destroy(() => res.redirect("/catalog"));
}

module.exports = { showLogin, showRegister, register, showVerifyEmail, verifyEmail, resendVerification, processLogin, logout };