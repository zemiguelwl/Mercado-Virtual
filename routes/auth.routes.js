const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/auth.controller");
const router = express.Router();

const registerValidation = [
  body("name").trim().notEmpty().withMessage("Nome obrigatório").isLength({ max: 100 }),
  body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
  body("password").isLength({ min: 8 }).withMessage("Password mínimo 8 caracteres"),
  body("passwordConfirm").custom((value, { req }) => {
    if (value !== req.body.password) throw new Error("As passwords não coincidem");
    return true;
  }),
  body("phone").trim().notEmpty().withMessage("Telefone obrigatório"),
  body("address").trim().notEmpty().withMessage("Morada obrigatória"),
  body("role").isIn(["supermarket", "courier", "client"]).withMessage("Tipo de conta inválido")
];

router.get("/login", controller.showLogin);
router.post("/login", controller.processLogin);
router.get("/register", controller.showRegister);
router.post("/register", registerValidation, controller.register);
router.get("/verify-email", controller.showVerifyEmail);
router.post("/verify-email", controller.verifyEmail);
router.post("/resend-verification", controller.resendVerification);
router.post("/logout", controller.logout);

module.exports = router;
