require("dotenv").config();

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET não está definido no ambiente. A aplicação não pode arrancar.");
  process.exit(1);
}

const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger/swagger");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// Permitir CORS para o frontoffice Angular (localhost:4200)
app.use((req, res, next) => {
  const allowedOrigins = ["http://localhost:4200"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    }
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.use((req, res, next) => {
  const originalRender = res.render.bind(res);
  res.render = (view, options = {}, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }

    return originalRender(view, options, (renderErr, html) => {
      if (renderErr) {
        if (callback) return callback(renderErr);
        return next(renderErr);
      }

      const isFullHtml = /^\s*<!doctype|^\s*<html/i.test(html);
      const isShellView = view === "layouts/backoffice-shell";
      if (isFullHtml || isShellView) {
        if (callback) return callback(null, html);
        return res.send(html);
      }

      const shellOptions = {
        ...res.locals,
        ...options,
        title: options?.title || "Mercadinho Virtual",
        body: html
      };

      return originalRender("layouts/backoffice-shell", shellOptions, (shellErr, wrappedHtml) => {
        if (shellErr) {
          if (callback) return callback(shellErr);
          return next(shellErr);
        }
        if (callback) return callback(null, wrappedHtml);
        return res.send(wrappedHtml);
      });
    });
  };
  next();
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: "Demasiadas tentativas de login. Tenta novamente em 10 minutos."
});
app.use("/auth/login", loginLimiter);

// Documentação Swagger — disponível em /api/docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// REST API para o frontoffice Angular
app.use("/api/v1", require("./routes/api/index"));

// Backoffice EJS (Milestone 1)
app.use("/", require("./routes/index"));

app.use((req, res) => {
  res.status(404).render("errors/404", { title: "Página não encontrada" });
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err.stack || err.message);
  const message = process.env.NODE_ENV === "production"
    ? "Ocorreu um erro interno. Tenta novamente."
    : err.message;

  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ message });
  }

  res.status(500).render("errors/500", { title: "Erro interno", message }, (renderErr, html) => {
    if (renderErr) {
      return res.status(500).render("errors/404", { title: "Erro interno", message });
    }
    res.send(html);
  });
});

module.exports = app;
