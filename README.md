# Mercadinho Virtual

> Plataforma web de marketplace para supermercados locais — Trabalho Prático de PAW (Programação em Ambiente Web), ESTG · Instituto Politécnico do Porto

---

## Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Instalação e Configuração](#instalação-e-configuração)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Executar o Projeto](#executar-o-projeto)
- [Credenciais de Teste](#credenciais-de-teste)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Rotas da API](#rotas-da-api)
- [Milestones](#milestones)

---

## Sobre o Projeto

O **Mercadinho Virtual** é uma plataforma digital centralizada onde vários supermercados locais podem disponibilizar os seus produtos e onde os clientes podem pesquisar, comparar preços e realizar encomendas online. A logística de entrega é assegurada por estafetas registados na plataforma, com suporte a entregas ao domicílio ou levantamento em loja.

---

## Funcionalidades

### Cliente
- Registo e autenticação com verificação de email
- Pesquisa e filtragem de produtos por nome, categoria e preço
- Comparação de preços do mesmo produto entre supermercados
- Carrinho de compras com suporte a cupões de desconto
- Checkout online com escolha do método de entrega
- Histórico de encomendas e cancelamento (até 5 minutos após confirmação)
- Avaliação de supermercados e estafetas após entrega

### Supermercado
- Registo com aprovação obrigatória pelo administrador
- Parametrização completa: nome, localização, horário, métodos de entrega e custos
- CRUD de produtos com upload de imagem
- Gestão de encomendas com máquina de estados completa
- **Ponto de Venda (POS)** para registo de vendas presenciais com associação de cliente
- Gestão de cupões de desconto próprios
- Dashboard com métricas de vendas e stock baixo

### Estafeta
- Visualização e aceitação de entregas disponíveis (máximo 1 ativa em simultâneo)
- Atualização do estado da entrega (aceite → levantado → entregue)
- Cancelamento com devolução automática ao pool de entregas disponíveis
- Histórico de entregas e avaliações recebidas

### Administrador
- Aprovação e rejeição de supermercados
- Gestão de utilizadores (ativar/desativar contas)
- CRUD de categorias de produtos
- Monitorização de todas as encomendas com cancelamento forçado
- Gestão de cupões globais e envio massivo a utilizadores verificados

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js |
| Framework web | Express.js |
| Template engine | EJS |
| Base de dados | MongoDB + Mongoose |
| Autenticação | express-session + bcrypt |
| Email | Nodemailer + Mailtrap API |
| Upload de ficheiros | Multer |
| Segurança | Helmet, express-rate-limit, express-validator |

---

## Arquitetura

O projeto segue o padrão **MVC (Model-View-Controller)**:

```
├── bin/www                    ← Ponto de entrada (servidor + conexão MongoDB)
├── app.js                     ← Configuração Express e middlewares globais
├── seed.js                    ← Script de população da base de dados
├── controllers/               ← Lógica de negócio por domínio
├── middleware/                ← Autenticação, roles e upload
├── models/                    ← Schemas Mongoose
├── public/                    ← Ficheiros estáticos (CSS, JS, imagens)
├── routes/                    ← Definição de rotas por área
├── services/                  ← Lógica reutilizável (email, encomendas, cupões, entregas)
└── views/                     ← Templates EJS
    ├── layouts/
    ├── partials/
    ├── admin/
    ├── auth/
    ├── catalog/
    ├── client/
    ├── courier/
    └── supermarket/
```

### Modelos de Dados

| Modelo | Descrição |
|---|---|
| `User` | Utilizadores com roles: admin, supermarket, courier, client |
| `Supermarket` | Supermercado associado a um utilizador owner |
| `Product` | Produto pertencente a um supermercado e categoria |
| `Order` | Encomenda com snapshot de cliente e itens, histórico de estados |
| `Delivery` | Entrega associada a uma encomenda e estafeta |
| `Category` | Categorias de produtos geridas pelo admin |
| `Coupon` | Cupões de desconto globais ou por supermercado |
| `Review` | Avaliações de supermercados e estafetas |
| `EmailVerification` | Códigos de verificação de email com TTL automático |

---

## Instalação e Configuração

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- [MongoDB](https://www.mongodb.com/) (local ou Atlas)
- Conta [Mailtrap](https://mailtrap.io/) para envio de emails (obrigatório para registo)

### Passos

```bash
# 1. Clonar o repositório
git clone https://github.com/zemiguelwl/Mercado-Virtual.git
cd Mercado-Virtual

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar o ficheiro .env com os valores reais

# 4. (Opcional) Popular a base de dados com dados de teste
node seed.js

# 5. Iniciar o servidor
npm start
```

---

> **Nota:** Em `NODE_ENV=development`, o login funciona via HTTP (localhost). Em `production`, é exigido HTTPS — não alterar para produção em ambiente local.

> **Nota:** `SESSION_SECRET` é obrigatório — a aplicação não arranca sem esta variável definida.

> **Nota:** Se `EMAIL_API_TOKEN` não estiver definido, o registo de novos utilizadores fica bloqueado. Usa as contas do `seed.js` para contornar.

---

## Executar o Projeto

```bash
# Desenvolvimento
npm start

# Popular base de dados com dados de teste
node seed.js
```

O servidor fica disponível em `http://localhost:3000`.

A página inicial redireciona para o catálogo público (`/catalog`). Para aceder ao backoffice, faz login em `/auth/login`.

---

## Credenciais de Teste

Após correr `node seed.js`:

### Administrador

| Email | Password |
|---|---|
| `admin@mercadinho.pt` | `password123` |

### Supermercados (aprovados)

| Email | Password |
|---|---|
| `antonio@gmail.com` | `password123` |
| `carla@gmail.com` | `password123` |
| `rui@gmail.com` | `password123` |

### Clientes

| Email | Password |
|---|---|
| `joao@hotmail.com` | `password123` |
| `sofia@sapo.pt` | `password123` |
| `tiago@gmail.com` | `password123` |

---

## Estrutura do Projeto

```
controllers/
├── admin.controller.js        ← Dashboard, aprovações, utilizadores, categorias, cupões, encomendas
├── auth.controller.js         ← Login, registo, verificação de email, logout
├── catalog.controller.js      ← Catálogo público, comparação de preços
├── client.controller.js       ← Dashboard, perfil, carrinho, checkout, encomendas, avaliações
├── coupon.controller.js       ← Validação de cupões
├── courier.controller.js      ← Entregas, histórico, avaliações
├── order.controller.js        ← Gestão de encomendas
├── pos.controller.js          ← Ponto de venda presencial
├── product.controller.js      ← CRUD de produtos e stock
├── review.controller.js       ← Submissão e gestão de avaliações
└── supermarket.controller.js  ← Perfil, encomendas, produtos, cupões, avaliações

models/
├── Category.js
├── Coupon.js
├── Delivery.js
├── EmailVerification.js
├── Order.js
├── Product.js
├── Review.js
├── Supermarket.js
└── User.js

services/
├── coupon.service.js          ← Validação e aplicação de cupões
├── delivery.service.js        ← Consultas e estatísticas de entregas
├── email.service.js           ← Envio de emails (verificação, notificações de estado)
└── order.service.js           ← Máquina de estados central de encomendas
```

---

## Rotas da API

### Públicas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/catalog` | Catálogo de produtos com filtros |
| GET | `/catalog/compare` | Comparação de preços entre supermercados |
| GET | `/auth/login` | Formulário de login |
| POST | `/auth/login` | Processar login |
| GET | `/auth/register` | Formulário de registo |
| POST | `/auth/register` | Criar conta |
| POST | `/auth/verify-email` | Validar código de verificação |

### Cliente `/client` — requer autenticação + role `client`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/client/dashboard` | Dashboard pessoal |
| GET | `/client/cart` | Carrinho de compras |
| POST | `/client/cart/add` | Adicionar produto |
| GET | `/client/checkout` | Formulário de checkout |
| POST | `/client/checkout` | Finalizar encomenda |
| GET | `/client/orders` | Histórico de encomendas |
| POST | `/client/orders/:id/cancel` | Cancelar encomenda |

### Supermercado `/supermarket` — requer autenticação + role `supermarket` + aprovação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/supermarket/dashboard` | Dashboard do supermercado |
| GET/POST | `/supermarket/profile` | Ver e editar perfil |
| GET | `/supermarket/products` | Listar produtos |
| POST | `/supermarket/products` | Criar produto |
| PUT | `/supermarket/products/:id` | Editar produto |
| DELETE | `/supermarket/products/:id` | Desativar produto |
| GET | `/supermarket/pos` | Interface de caixa (POS) |
| POST | `/supermarket/pos/checkout` | Finalizar venda presencial |
| GET | `/supermarket/orders` | Gerir encomendas |

### Estafeta `/courier` — requer autenticação + role `courier`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/courier/dashboard` | Dashboard do estafeta |
| GET | `/courier/available` | Entregas disponíveis |
| POST | `/courier/deliveries/:id/accept` | Aceitar entrega |
| POST | `/courier/deliveries/:id/picked-up` | Marcar como levantado |
| POST | `/courier/deliveries/:id/delivered` | Marcar como entregue |
| GET | `/courier/history` | Histórico de entregas |

### Administrador `/admin` — requer autenticação + role `admin`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/admin/dashboard` | Dashboard global |
| POST | `/admin/supermarkets/:id/approve` | Aprovar supermercado |
| POST | `/admin/supermarkets/:id/reject` | Rejeitar supermercado |
| GET | `/admin/users` | Gerir utilizadores |
| GET | `/admin/categories` | Gerir categorias |
| GET | `/admin/orders` | Monitorizar encomendas |
| GET | `/admin/coupons` | Gerir cupões globais |

