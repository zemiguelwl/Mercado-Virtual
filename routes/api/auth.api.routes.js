/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticação e registo de utilizadores
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { verifyToken } = require("../../middleware/jwt.middleware");
const ctrl = require("../../controllers/api/auth.api.controller");

const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, skipSuccessfulRequests: true });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });

router.post("/register", registerLimiter, ctrl.register);
router.post("/verify-email", ctrl.verifyEmail);
router.post("/resend-verification", ctrl.resendVerification);
router.post("/login", loginLimiter, ctrl.login);
router.get("/me", verifyToken, ctrl.me);

module.exports = router;
