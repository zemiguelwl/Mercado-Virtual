require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Importação dos Modelos
const User = require("./models/User");
const Supermarket = require("./models/Supermarket");
const Category = require("./models/Category");
const Product = require("./models/Product");
const Coupon = require("./models/Coupon");
const Order = require("./models/Order");
const Delivery = require("./models/Delivery");
const Review = require("./models/Review");
const EmailVerification = require("./models/EmailVerification");

async function seed() {
  const mongoUri = process.env.DB_URI || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error(" Erro: Define DB_URI ou MONGODB_URI no ficheiro .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log(" Conetado à base de dados. A iniciar limpeza...");

    await Promise.all([
      User.deleteMany({}),
      Supermarket.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Coupon.deleteMany({}),
      Order.deleteMany({}),
      Delivery.deleteMany({}),
      Review.deleteMany({}),
      EmailVerification.deleteMany({})
    ]);

    const saltRounds = 10;
    const commonPassword = await bcrypt.hash("password123", saltRounds);

    console.log(" A criar utilizadores (Admin, 3 Owners, 3 Clientes)...");
    
    const admin = await User.create({
      name: "Administrador Geral",
      email: "admin@mercadinho.pt",
      password: commonPassword,
      role: "admin",
      phone: "910000000",
      isEmailVerified: true
    });

    const owners = await User.insertMany([
      { name: "António Silva", email: "antonio@gmail.com", password: commonPassword, role: "supermarket", isEmailVerified: true, phone: "912345678" },
      { name: "Carla Santos", email: "carla@gmail.com", password: commonPassword, role: "supermarket", isEmailVerified: true, phone: "923456789" },
      { name: "Rui Oliveira", email: "rui@gmail.com", password: commonPassword, role: "supermarket", isEmailVerified: true, phone: "934567890" }
    ]);

    const clients = await User.insertMany([
      { name: "João Pereira", email: "joao@hotmail.com", password: commonPassword, role: "client", isEmailVerified: true, address: "Rua Direita 123, Porto", phone: "961112233" },
      { name: "Sofia Martins", email: "sofia@sapo.pt", password: commonPassword, role: "client", isEmailVerified: true, address: "Avenida Central 45, Lisboa", phone: "962223344" },
      { name: "Tiago Costa", email: "tiago@gmail.com", password: commonPassword, role: "client", isEmailVerified: true, address: "Praça da Alegria 7, Braga", phone: "963334455" }
    ]);

    console.log(" A criar supermercados e categorias...");
    
    const smBairro = await Supermarket.create({
      name: "Mini-Mercado do Bairro",
      user: owners[0]._id,
      status: "approved",
      location: "Rua do Comércio, Porto",
      description: "O essencial sempre à mão."
    });

    const smAvenida = await Supermarket.create({
      name: "Frutaria d'Avenida",
      user: owners[1]._id,
      status: "approved",
      location: "Avenida da Boavista, Porto",
      description: "Fruta fresca todos os dias."
    });

    const smTalho = await Supermarket.create({
      name: "Talho do Povo",
      user: owners[2]._id,
      status: "approved",
      location: "Rua das Flores, Porto",
      description: "As melhores carnes da região."
    });

    const catHorto = await Category.create({ name: "Hortofrutícolas", isActive: true, createdBy: admin._id });
    const catLati = await Category.create({ name: "Laticínios e Ovos", isActive: true, createdBy: admin._id });
    const catPada = await Category.create({ name: "Padaria", isActive: true, createdBy: admin._id });
    const catTalho = await Category.create({ name: "Talho", isActive: true, createdBy: admin._id });

    console.log(" A criar produtos com imagens e duplicados para comparação...");

    await Product.insertMany([
      { name: "Pão de Mafra", price: 1.20, stock: 50, category: catPada._id, supermarket: smBairro._id, isActive: true, image: "/uploads/products/pao-mafra.jpg" },
      { name: "Leite Meio Gordo 1L", price: 0.85, stock: 100, category: catLati._id, supermarket: smBairro._id, isActive: true, image: "/uploads/products/leite.jpg" },
      { name: "Ovos Classe L (Emb. 6)", price: 1.65, stock: 30, category: catLati._id, supermarket: smBairro._id, isActive: true, image: "/uploads/products/ovos.jpg" },
      { name: "Maçã Alcobaça 1kg", price: 1.95, stock: 30, category: catHorto._id, supermarket: smBairro._id, isActive: true, image: "/uploads/products/maca.jpg" },

      { name: "Maçã Alcobaça 1kg", price: 2.10, stock: 40, category: catHorto._id, supermarket: smAvenida._id, isActive: true, image: "/uploads/products/maca.jpg" },
      { name: "Banana da Madeira 1kg", price: 1.95, stock: 25, category: catHorto._id, supermarket: smAvenida._id, isActive: true, image: "/uploads/products/banana.jpg" },
      { name: "Pêra Rocha 1kg", price: 2.30, stock: 35, category: catHorto._id, supermarket: smAvenida._id, isActive: true, image: "/uploads/products/pera.jpg" },
      { name: "Leite Meio Gordo 1L", price: 0.79, stock: 60, category: catLati._id, supermarket: smAvenida._id, isActive: true, image: "/uploads/products/leite.jpg" },

      { name: "Bife de Novilho (kg)", price: 12.90, stock: 15, category: catTalho._id, supermarket: smTalho._id, isActive: true, image: "/uploads/products/bife.jpg" },
      { name: "Peito de Frango (kg)", price: 6.50, stock: 20, category: catTalho._id, supermarket: smTalho._id, isActive: true, image: "/uploads/products/frango.jpg" },
      { name: "Entrecosto de Porco (kg)", price: 7.80, stock: 18, category: catTalho._id, supermarket: smTalho._id, isActive: true, image: "/uploads/products/porco.jpg" },
      { name: "Pão de Mafra", price: 1.10, stock: 40, category: catPada._id, supermarket: smTalho._id, isActive: true, image: "/uploads/products/pao-mafra.jpg" }
    ]);

    console.log(" A criar cupões...");

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await Coupon.insertMany([
      { 
        code: "BENVINDO10", 
        discountType: "percentage", 
        discountValue: 10, 
        isActive: true,
        validFrom: new Date(),
        validUntil: nextYear,
        createdBy: admin._id
      },
      { 
        code: "ENTREGAGRATIS", 
        discountType: "fixed_shipping", 
        discountValue: 5, 
        isActive: true,
        validFrom: new Date(),
        validUntil: nextYear,
        createdBy: admin._id
      }
    ]);

    console.log("\n Seed concluído com sucesso!");
    console.log("--------------------------------------");
    console.log("Admin: admin@mercadinho.pt / password123");
    console.log("Clientes: joao@hotmail.com, sofia@sapo.pt, tiago@gmail.com");
    console.log("Produtos para comparar: 'Leite', 'Pão de Mafra', 'Maçã'");
    console.log("--------------------------------------");
    
    process.exit(0);
  } catch (err) {
    console.error("Erro durante o seed:", err);
    process.exit(1);
  }
}

seed();