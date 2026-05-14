const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const Supermarket = require("../../models/Supermarket");
const EmailVerification = require("../../models/EmailVerification");
const emailService = require("../../services/email.service");
const couponService = require("../../services/coupon.service");

function generateToken(user, supermarketId = null) {
  return jwt.sign(
    { id: user._id.toString(), name: user.name, email: user.email, role: user.role, supermarketId },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
}

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Registo de novo utilizador
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, phone, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               phone: { type: string }
 *               address: { type: string }
 *               role: { type: string, enum: [client, courier] }
 *     responses:
 *       201:
 *         description: Utilizador criado, código de verificação enviado por email
 *       400:
 *         description: Dados inválidos ou email já registado
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone, address, role } = req.body;

    if (!name || !email || !password || !phone || !role) {
      return res.status(400).json({ message: "Todos os campos obrigatórios devem ser preenchidos." });
    }
    if (!["client", "courier"].includes(role)) {
      return res.status(400).json({ message: "Papel inválido. Apenas 'client' ou 'courier' são permitidos." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "A password deve ter pelo menos 6 caracteres." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    let user;
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({ message: "Email já registado." });
    }

    if (existingUser && !existingUser.isEmailVerified) {
      existingUser.name = name.trim();
      existingUser.password = await bcrypt.hash(password, 10);
      existingUser.phone = phone.trim();
      existingUser.role = existingUser.password ? role : "client";
      existingUser.address = address?.trim() || "N/A";
      existingUser.accountStatus = "ACTIVE";
      existingUser.isActive = true;
      await existingUser.save();
      user = existingUser;
    } else {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        phone: phone.trim(),
        address: address?.trim() || "N/A",
        role,
        isEmailVerified: false
      });
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
    }

    return res.status(201).json({
      message: "Registo efetuado. Verifica o teu email para ativar a conta.",
      userId: user._id.toString()
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Email ou telefone já registado." });
    }
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verificar email com código recebido
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, code]
 *             properties:
 *               userId: { type: string }
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Email verificado com sucesso
 *       400:
 *         description: Código inválido ou expirado
 */
async function verifyEmail(req, res, next) {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ message: "userId e código são obrigatórios." });
    }

    const verification = await EmailVerification.findOne({ user: userId, used: false }).sort({ createdAt: -1 });
    if (!verification) {
      return res.status(400).json({ message: "Código inválido ou expirado." });
    }
    if (verification.expiresAt < new Date()) {
      return res.status(400).json({ message: "O código expirou. Solicita um novo código." });
    }
    const isMatch = await bcrypt.compare(String(code).trim(), verification.code);
    if (!isMatch) {
      return res.status(400).json({ message: "Código incorreto." });
    }

    verification.used = true;
    await verification.save();
    const user = await User.findByIdAndUpdate(userId, { isEmailVerified: true }, { new: true });

    if (user) {
      try {
        await couponService.sendWelcomeCoupon(user);
      } catch (err) {
        console.error("Falha ao enviar cupão de boas-vindas:", err.message);
      }
    }

    return res.status(200).json({ message: "Email verificado com sucesso. Podes fazer login." });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Reenviar código de verificação
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *     responses:
 *       200:
 *         description: Novo código enviado
 *       404:
 *         description: Utilizador não encontrado
 */
async function resendVerification(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId é obrigatório." });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilizador não encontrado." });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email já verificado." });

    const plainCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await bcrypt.hash(plainCode, 6);
    await EmailVerification.deleteMany({ user: userId });
    await EmailVerification.create({
      user: user._id,
      email: user.email,
      code: hashedCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    await emailService.sendVerificationEmail(user.email, user.name, plainCode);
    return res.status(200).json({ message: "Novo código enviado para o teu email." });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login do utilizador — retorna JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login com sucesso, retorna token JWT e dados do utilizador
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     role: { type: string }
 *       401:
 *         description: Credenciais inválidas
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email e password são obrigatórios." });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Email ou password incorretos." });
    }
    if (!user.isEmailVerified) {
      return res.status(401).json({
        message: "Email ainda não verificado.",
        userId: user._id.toString(),
        requiresVerification: true
      });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: "Conta desativada. Contacta o administrador." });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Email ou password incorretos." });
    }

    // Apenas clientes e estafetas podem usar o frontoffice Angular
    if (!["client", "courier"].includes(user.role)) {
      return res.status(403).json({ message: "Esta interface é exclusiva para clientes e estafetas." });
    }

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, address: user.address, phone: user.phone }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Obter dados do utilizador autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do utilizador
 *       401:
 *         description: Não autenticado
 */
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "Utilizador não encontrado." });
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verifyEmail, resendVerification, login, me };
