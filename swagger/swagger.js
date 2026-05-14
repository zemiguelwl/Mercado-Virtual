const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Mercadinho Virtual API",
      version: "1.0.0",
      description: "REST API do frontoffice da plataforma Mercadinho Virtual — Marketplace de Supermercados Locais"
    },
    servers: [
      { url: "http://localhost:3000", description: "Servidor de desenvolvimento" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: [
    "./routes/api/*.js",
    "./controllers/api/*.js"
  ]
};

module.exports = swaggerJsdoc(options);
