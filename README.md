# Mercadinho Virtual

> Trabalho Prático - Programação em Ambiente Web (PAW)
> ESTG - Instituto Politécnico do Porto
> **Estado:** Em desenvolvimento

---

## Descrição

O **Mercadinho Virtual** é uma plataforma web de marketplace para supermercados locais. O objetivo é centralizar numa só plataforma vários supermercados, permitindo que clientes pesquisem e comparem produtos, façam encomendas online, e as recebam em casa através de estafetas registados na plataforma ou as levantem diretamente na loja.

A aplicação está organizada em dois grandes contextos:

- **Backoffice** — área de gestão utilizada por administradores, supermercados e estafetas (Milestone 1)
- **Frontoffice** — interface pública para clientes finais, com catálogo, carrinho e encomendas online (Milestone 2)

---

## Contexto Académico

Este projeto é desenvolvido no âmbito da unidade curricular de **Programação em Ambiente Web (PAW)**, seguindo a metodologia de entregas por milestones:

| Milestone | Âmbito | Estado |
|-----------|--------|--------|
| Milestone 1 | Backoffice (admin, supermercado, estafeta) + POS | 🔄 Em desenvolvimento |
| Milestone 2 | Frontoffice Angular + API REST documentada com Swagger | ⏳ Pendente |

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js |
| Framework web | Express.js |
| Template engine | EJS |
| Base de dados | MongoDB + Mongoose (ODM) |
| Autenticação | express-session + bcrypt |
| Email | Nodemailer + Mailtrap API (token-based) |
| Upload de ficheiros | Multer |
| Segurança | Helmet, express-rate-limit, express-validator |
| Testes | Jest |
| Desenvolvimento | Nodemon |

---

Este projeto utiliza a variável de ambiente `NODE_ENV` para alternar o comportamento do servidor entre os modos de **Desenvolvimento** e **Produção**. Esta configuração é essencial para garantir a segurança dos dados e a melhor performance da aplicação.

### 🔄 Diferenças entre Modos

| Característica | Desenvolvimento (`development`) | Produção (`production`) |
| :--- | :--- | :--- |
| **Tratamento de Erros** | Exibe detalhado no browser para facilitar o debug. | Exibe apenas uma mensagem genérica, ocultando detalhes técnicos do servidor. |
| **Cookies de Sessão** | `secure: false`. Permite o login através de ligações normais (HTTP). | `secure: true`. Obriga o uso de ligações encriptadas (HTTPS). |
| **Performance** | Motor de views (EJS) recompila ficheiros em cada pedido. | Cache de views ativa para respostas mais rápidas. |

---

### ⚠️ Aviso Crítico: Login em Localhost

Para fins académicos e de desenvolvimento local, o ficheiro `.env` deve manter sempre `NODE_ENV=development`.

Se o modo for alterado para `production` enquanto corre em `http://localhost:3000`:
1. O servidor enviará o cookie de sessão com a flag **Secure**.
2. O navegador, por segurança, recusará guardar o cookie pois a ligação não é HTTPS.
3. O utilizador entrará num ciclo infinito de redirecionamento, pois o servidor não conseguirá "lembrar-se" da sessão após o login.

---

## Arquitetura

O projeto segue o padrão **MVC (Model-View-Controller)**:

```
PAW2526/
├── bin/www                    ← Ponto de entrada (inicializa servidor e MongoDB)
├── app.js                     ← Configuração do Express e middlewares
├── seed.js                    ← Script para popular a BD com dados de teste
├── controllers/               ← Lógica de negócio por domínio
├── middleware/                ← Middlewares de autenticação, roles e uploads
├── models/                    ← Schemas Mongoose (camada de dados)
├── public/                    ← Ficheiros estáticos (CSS, JS, imagens, uploads)
│   ├── css/
│   ├── images/
│   ├── javascripts/
│   └── uploads/
│       ├── products/          ← Imagens de produtos (geridas por multer)
│       └── supermarkets/      ← Logos de supermercados
├── routes/                    ← Definição de rotas por área
├── services/                  ← Lógica reutilizável (email, encomendas, cupões, entregas)
├── tests/
└── views/                     ← Templates EJS
    ├── layouts/
    │   └── backoffice-shell.ejs   ← Layout base injetado automaticamente
    ├── partials/
    ├── admin/
    ├── auth/
    ├── catalog/
    ├── client/
    ├── courier/
    ├── errors/
    └── supermarket/
```

### Sistema de layout automático

O `app.js` inclui um middleware que intercepta todos os `res.render()`. Se o HTML gerado pela view não começar com `<!doctype` ou `<html>`, é automaticamente envolvido no `backoffice-shell.ejs` (navbar, sidebar, flash messages). Isto permite que cada view escreva apenas o seu conteúdo, sem repetir o layout.

---

## Tipos de Utilizadores

### Cliente (`client`)
- Registo e autenticação com verificação de email obrigatória
- Pesquisa e comparação de produtos entre supermercados
- Carrinho de compras (guardado na sessão)
- Checkout com suporte a cupões de desconto
- Histórico de encomendas e cancelamento (até 5 minutos após confirmação)
- Avaliação de supermercado e courier após entrega

### Supermercado (`supermarket`)
- Registo com aprovação obrigatória pelo administrador
- Parametrização completa: nome, localização, horário, métodos de entrega e custos
- CRUD de produtos com upload de imagem obrigatório
- Gestão de encomendas recebidas com controlo de estados
- Ponto de Venda (POS) para registo de vendas presenciais
- Gestão de cupões de desconto próprios
- Visualização e resposta a avaliações

### Estafeta (`courier`)
- Registo com verificação de email
- Visualização de entregas disponíveis
- Aceitação de entregas (máximo 1 ativa em simultâneo)
- Atualização do estado da entrega (aceite → levantado → entregue)
- Cancelamento de entrega com devolução ao pool disponível
- Histórico de entregas realizadas
- Visualização de avaliações recebidas

### Administrador (`admin`)
- Aprovação e rejeição de supermercados
- Gestão de utilizadores (ativar/desativar contas)
- CRUD de categorias de produtos
- Monitorização de todas as encomendas
- Cancelamento forçado de encomendas
- Gestão de cupões globais (válidos em toda a plataforma)
- Envio manual de cupões a todos os utilizadores verificados
- Ocultação de avaliações inadequadas

---

## Sistema de Email (Mailtrap API)

O projeto utiliza a **API HTTP do Mailtrap** através do pacote oficial `mailtrap` para Node.js, integrado com Nodemailer via `MailtrapTransport`. **Não usa SMTP tradicional.**

### Configuração

```js
// email.service.js
const { MailtrapTransport } = require("mailtrap");
nodemailer.createTransport(MailtrapTransport({ token: process.env.EMAIL_API_TOKEN }))
```

A variável de ambiente necessária é `EMAIL_API_TOKEN` (token gerado no painel do Mailtrap). O endereço remetente é controlado por `EMAIL_FROM`.

### Comportamento quando não configurado

Se `EMAIL_API_TOKEN` não estiver definido, o transporter fica `null` e todas as funções de envio retornam silenciosamente — **exceto** `sendVerificationEmail`, que lança erro. Isto significa que o registo de utilizadores fica bloqueado se o token não estiver configurado.

### Emails enviados

| Situação | Função | Comportamento em caso de erro |
|----------|--------|-------------------------------|
| Registo de utilizador | `sendVerificationEmail()` | **Bloqueia o registo** — erro crítico |
| Reenvio de código | `sendVerificationEmail()` | Propaga para o error handler → página 500 |
| Atualização de estado de encomenda | `sendOrderStatusUpdate()` | Erro silencioso (não bloqueia a transição) |
| Envio de cupão | `sendCouponEmail()` | Erro silencioso por utilizador |

### Estados de encomenda que geram email

`confirmed` · `preparing` · `ready` · `in_delivery` · `delivered` · `cancelled`

Emails só são enviados se `order.client.email` existir.

---

## Modelos de Dados

### `User`
Campos principais: `name`, `email` (único), `password` (hash bcrypt), `phone`, `address`, `role` (admin / supermarket / courier / client), `isActive`, `isEmailVerified`, `accountStatus` (enum: ACTIVE / INACTIVE), `welcomeCouponSent` (boolean), `rating` (average + count — para couriers).

O método `user.comparePassword(candidate)` encapsula o `bcrypt.compare` — usar sempre este método no login, nunca comparar diretamente com `user.password`.

### `Supermarket`
Associado 1:1 a um `User` com `role: 'supermarket'`. Campos relevantes: `status` (pending / approved / rejected), `rejectionReason`, `isOpen`, `schedule` (7 dias), `deliveryMethods` (array com type, label, cost, active), `rating` (average + count — recalculado automaticamente após cada avaliação).

### `Product`
Campos: `supermarket` (ref), `category` (ref), `name`, `description`, `price`, `stock`, `image`, `isActive`. A imagem é obrigatória, o controller rejeita a criação sem ficheiro. Eliminação por soft delete (`isActive: false`) para preservar o histórico de encomendas.

### `Order`
Campos críticos:
- `client` — snapshot embutido `{userId, name, email, phone}` no momento da compra
- `items` — array com `{product, productName, productPrice, quantity}` (snapshots — os preços não mudam mesmo que o produto seja editado posteriormente)
- `subtotal`, `discountAmount`, `couponCode`, `deliveryMethod`, `deliveryCost`, `total`
- `status` — enum com 7 estados (ver secção de estados)
- `statusHistory` — log imutável de todas as transições `{status, changedAt, changedBy, reason}`
- `source` — `'online'` ou `'pos'`
- `confirmedAt` — usado para a regra dos 5 minutos de cancelamento
- `reviewSubmitted` — controla se a encomenda já foi avaliada

### `Delivery`
Criada automaticamente pelo `order.service.js` quando uma encomenda com `deliveryMethod: 'courier'` passa para o estado `preparing`. Campos: `order` (ref), `courier` (null até ser aceite), `supermarket`, `status` (available / accepted / picked_up / delivered / cancelled), `statusHistory`.

### `Review`
Campos: `order` (ref), `author` `{userId, name}`, `targetType` (supermarket / courier), `targetId`, `rating` (1-5), `comment`, `reply` `{text, repliedAt}`, `isVisible`. Índice único em `{order, targetType}` — impede avaliações duplicadas para o mesmo alvo na mesma encomenda.

### `Coupon`
Campos: `code` (uppercase), `discountType` (percentage / fixed_amount / fixed_shipping), `discountValue`, `minOrderValue`, `maxUses` (null = ilimitado), `currentUses`, `validFrom`, `validUntil`, `isActive`, `supermarket` (null = global), `sentToUsers` (array de ObjectIds — registo de quem já recebeu).

### `EmailVerification`
Campos: `user` (ref), `email`, `code` (hash bcrypt do código de 6 dígitos), `expiresAt` (15 min), `used`. TTL index no campo `expiresAt` — MongoDB apaga automaticamente documentos expirados.

---

## Rotas da Aplicação

### Autenticação — `/auth` (pública)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/auth/login` | Formulário de login |
| POST | `/auth/login` | Processar login (rate limit: 10 tentativas / 15 min) |
| GET | `/auth/register` | Formulário de registo |
| POST | `/auth/register` | Criar conta e enviar código de verificação |
| GET | `/auth/verify-email` | Página de inserção do código |
| POST | `/auth/verify-email` | Validar código + enviar cupão de boas-vindas |
| POST | `/auth/resend-verification` | Reenviar código |
| POST | `/auth/logout` | Destruir sessão e redirecionar para `/catalog` |

### Catálogo — `/catalog` (pública)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/catalog` | Listar produtos com filtros (nome, categoria, supermercado, ordenação por preço) |
| GET | `/catalog/compare` | Comparar preços do mesmo produto entre supermercados |

### Cliente — `/client` (requer login + role `client`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/client/dashboard` | Dashboard com contagem de encomendas e produtos mais comprados |
| GET | `/client/profile` | Ver perfil |
| POST | `/client/profile` | Atualizar nome, telefone e morada |
| GET | `/client/orders` | Histórico de encomendas |
| GET | `/client/orders/:id` | Detalhe de encomenda |
| POST | `/client/orders/:id/cancel` | Cancelar encomenda (regras de negócio aplicadas) |
| GET | `/client/cart` | Ver carrinho (lido da sessão) |
| POST | `/client/cart/add` | Adicionar produto ao carrinho |
| POST | `/client/cart/update` | Alterar quantidade |
| POST | `/client/cart/remove` | Remover item |
| GET | `/client/checkout` | Formulário de checkout |
| POST | `/client/checkout` | Finalizar encomenda (com suporte a cupões) |
| GET | `/client/coupons/validate` | AJAX — validar cupão antes de submeter o checkout |
| GET | `/client/orders/:id/review` | Formulário de avaliação (requer `status: delivered`, não avaliada) |
| POST | `/client/orders/:orderId/review` | Submeter avaliação do supermercado e/ou courier |

### Supermercado — `/supermarket` (requer login + role `supermarket` + aprovação pelo admin)

**Perfil**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/supermarket/dashboard` | Dashboard com métricas, stock baixo e produtos mais vendidos |
| GET | `/supermarket/profile` | Ver e editar perfil completo |
| POST | `/supermarket/profile` | Guardar alterações (nome, localização, horário, métodos de entrega) |
| POST | `/supermarket/profile/toggle-open` | Alternar estado aberto/fechado |

**Produtos**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/supermarket/products` | Listar produtos com pesquisa e filtro por categoria |
| GET | `/supermarket/products/create` | Formulário de criação |
| POST | `/supermarket/products` | Criar produto (imagem obrigatória via multer) |
| GET | `/supermarket/products/:id/edit` | Formulário de edição |
| PUT | `/supermarket/products/:id` | Guardar edição |
| DELETE | `/supermarket/products/:id` | Desativar produto (soft delete) |
| POST | `/supermarket/products/:id/stock` | Ajustar stock manualmente |

**Encomendas**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/supermarket/orders` | Listar encomendas ordenadas por prioridade de estado |
| GET | `/supermarket/orders/:id` | Detalhe da encomenda |
| POST | `/supermarket/orders/:id/confirm` | Confirmar encomenda (pending → confirmed) |
| POST | `/supermarket/orders/:id/reject` | Rejeitar encomenda (pending → cancelled) |
| POST | `/supermarket/orders/:id/start-preparing` | Iniciar preparação (confirmed → preparing) |
| POST | `/supermarket/orders/:id/ready` | Marcar como pronta para levantamento (preparing → ready) |
| POST | `/supermarket/orders/:id/delivered` | Confirmar entrega ao cliente (ready → delivered) |
| GET | `/supermarket/orders/:id/review` | Formulário de avaliação |
| POST | `/supermarket/orders/:orderId/review` | Submeter avaliação |

**POS (Ponto de Venda)**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/supermarket/pos` | Interface de caixa |
| GET | `/supermarket/pos/products` | AJAX — pesquisa de produtos (stock > 0, do próprio supermercado) |
| GET | `/supermarket/pos/clients` | AJAX — pesquisa de clientes existentes (mínimo 2 caracteres) |
| POST | `/supermarket/pos/clients` | AJAX — criação rápida de novo cliente |
| GET | `/supermarket/pos/validate-coupon` | AJAX — validar cupão |
| POST | `/supermarket/pos/checkout` | Finalizar venda presencial |

**Cupões**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/supermarket/coupons` | Listar cupões do supermercado |
| GET | `/supermarket/coupons/create` | Formulário de criação |
| POST | `/supermarket/coupons` | Criar cupão (scope: supermercado) |
| PUT | `/supermarket/coupons/:id` | Editar cupão |
| DELETE | `/supermarket/coupons/:id` | Desativar cupão |

**Avaliações**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/supermarket/reviews` | Ver avaliações recebidas com média |
| POST | `/supermarket/reviews/:id/reply` | Responder a uma avaliação |

### Estafeta — `/courier` (requer login + role `courier`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/courier/dashboard` | Dashboard com entrega ativa, total de entregas e top supermercados |
| GET | `/courier/available` | Lista de entregas disponíveis para aceitar |
| POST | `/courier/deliveries/:id/accept` | Aceitar entrega (máximo 1 ativa em simultâneo, aceitação atómica) |
| POST | `/courier/deliveries/:id/picked-up` | Marcar como levantado no supermercado |
| POST | `/courier/deliveries/:id/delivered` | Marcar como entregue ao cliente |
| POST | `/courier/deliveries/:id/cancel` | Cancelar entrega ativa |
| GET | `/courier/history` | Histórico de todas as entregas |
| GET | `/courier/reviews` | Avaliações recebidas com média |

### Admin — `/admin` (requer login + role `admin`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/dashboard` | Métricas globais e supermercados pendentes de aprovação |
| GET | `/admin/supermarkets` | Listar supermercados (filtro por status) |
| POST | `/admin/supermarkets/:id/approve` | Aprovar supermercado |
| POST | `/admin/supermarkets/:id/reject` | Rejeitar supermercado com motivo |
| GET | `/admin/users` | Listar utilizadores (filtro por role) |
| POST | `/admin/users/:id/deactivate` | Desativar conta |
| POST | `/admin/users/:id/activate` | Ativar conta |
| GET | `/admin/categories` | Listar categorias |
| POST | `/admin/categories` | Criar categoria |
| PUT | `/admin/categories/:id` | Editar categoria |
| DELETE | `/admin/categories/:id` | Desativar categoria (soft delete) |
| GET | `/admin/orders` | Monitorizar todas as encomendas (filtro por status) |
| GET | `/admin/orders/:id` | Detalhe de encomenda |
| POST | `/admin/orders/:id/cancel` | Forçar cancelamento com motivo |
| GET | `/admin/coupons` | Listar cupões globais com contagem de envios |
| GET | `/admin/coupons/create` | Formulário de criação |
| POST | `/admin/coupons` | Criar cupão global |
| PUT | `/admin/coupons/:id` | Editar cupão |
| DELETE | `/admin/coupons/:id` | Desativar cupão |
| POST | `/admin/coupons/:id/send` | Enviar cupão a todos os utilizadores verificados |
| POST | `/admin/reviews/:id/hide` | Ocultar avaliação (`isVisible: false`) |

---

## Sistema de Autenticação e Permissões

### Fluxo de registo

1. Utilizador preenche o formulário (`nome`, `email`, `password`, `telefone`, `morada`, `role`)
2. `express-validator` valida os campos
3. Se o email já existe mas não está verificado, os dados são atualizados e um novo código é enviado (permite corrigir registos falhados)
4. Gera um código de 6 dígitos, faz hash com `bcrypt` (salt 6) e guarda em `EmailVerification` com expiração de 15 minutos
5. Envia o código por email via Mailtrap API — **se o envio falhar, o registo é bloqueado**
6. Redireciona para a página de verificação de email

### Verificação de email

O utilizador introduz o código recebido. O sistema compara com `bcrypt.compare`, verifica se expirou, e marca `User.isEmailVerified = true`. Após verificação bem-sucedida, é enviado automaticamente o cupão de boas-vindas `BEMVINDO10` (10% de desconto, válido 30 dias). Sem verificação não é possível fazer login.

### Login

1. Verifica email + password com `user.comparePassword()`
2. Verifica `isEmailVerified` — se não, redireciona para verificação
3. Verifica `isActive` — se não, mensagem de conta desativada
4. Se `role === 'supermarket'`, verifica se não está `rejected`
5. Cria `req.session.user = { id, name, email, role, supermarketId }`
6. Suporta parâmetro `?next=/caminho` para redirecionar após login (apenas caminhos internos válidos)

### Middlewares de proteção

**`isAuthenticated`** — verifica se `req.session.user` existe. Se não, redireciona para `/auth/login` com o caminho original como parâmetro `next` (exceto rotas `/auth/*` para evitar loops).

**`hasRole(...roles)`** — verifica se o role do utilizador está na lista. Se não, renderiza `errors/403`.

**`isSupermarketApproved`** — aplicado em todas as rotas de supermercado. Se o status for `pending`, renderiza página de espera. Se `rejected`, a conta está bloqueada ao nível do login.

---

## Sistema de Encomendas e Máquina de Estados

Toda a mudança de estado de uma encomenda passa obrigatoriamente pela função `transitionOrderStatus()` em `order.service.js`. Nunca se altera `order.status` diretamente num controller.

### Estados e transições válidas

```
pending ──────────────────────────────────► cancelled
   │
   ▼ supermercado confirma (confirmedAt = agora)
confirmed ─── cliente cancela (≤ 5 min) ──► cancelled
   │
   ▼ supermercado inicia preparação
preparing ── (se deliveryMethod = courier) → cria Delivery { status: 'available' }
   │
   ├── pickup / instore ──► ready ──► delivered
   │
   └── courier aceita ──► in_delivery ──► delivered
                                    └────► cancelled (admin)
```

### Regras de negócio

- **Regra dos 5 minutos:** Clientes só podem cancelar encomendas nos primeiros 5 minutos após confirmação. Após esse prazo, o cancelamento é apenas permitido ao admin.
- **Delivery automática:** Quando uma encomenda com `deliveryMethod: 'courier'` passa para `preparing`, um documento `Delivery` é criado automaticamente com `status: 'available'`.
- **Cancelamento em cadeia:** Cancelar uma encomenda cancela automaticamente a `Delivery` associada se existir.
- **Courier que cancela:** A entrega volta a `available` (o mesmo documento é reutilizado), e a encomenda volta a `preparing`.
- **Aceitação atómica:** Usa `findOneAndUpdate({ _id, status: 'available' })` para evitar que dois couriers aceitem a mesma entrega em simultâneo.
- **Encomendas POS:** São criadas diretamente com `status: 'delivered'`, com `statusHistory` completo pré-preenchido.
- **Email em cada transição:** `sendOrderStatusUpdate()` é chamado após cada transição. Se o envio falhar, o erro é registado mas não bloqueia a transição (comportamento best-effort).

### Serviços de suporte

**`order.service.js`** — máquina de estados central. Todas as transições e a criação de vendas POS passam por aqui.

**`delivery.service.js`** — funções auxiliares de consulta para o sistema de entregas: entrega ativa do courier, entregas disponíveis, entregas pendentes por supermercado, estatísticas de desempenho do courier e histórico. A lógica de ciclo de vida (aceitar, levantar, entregar, cancelar) está em `order.service.js`.

---

## POS — Ponto de Venda

O POS permite ao funcionário do supermercado registar vendas presenciais.

### Funcionamento

1. O funcionário pesquisa produtos por nome ou categoria via AJAX (`/supermarket/pos/products`) — apenas produtos do próprio supermercado com stock > 0
2. Adiciona itens ao carrinho (gerido em JavaScript no frontend)
3. **Associa o cliente — obrigatório.** O funcionário pode pesquisar um cliente existente por nome, email ou telefone (mínimo 2 caracteres), ou criar um novo cliente inline com nome, email e telefone
4. Aplica um cupão de desconto se disponível (validação via AJAX antes de submeter)
5. Submete o formulário — o servidor valida o cliente, decrementa o stock atomicamente e cria a encomenda

---

## Sistema de Avaliações

As avaliações podem ser submetidas pelo **cliente** (no detalhe da sua encomenda) ou registadas pelo **funcionário do supermercado** em nome do cliente (no detalhe da encomenda recebida). Em ambos os casos, a encomenda tem de ter `status: 'delivered'` e `reviewSubmitted: false`.

- Cada encomenda pode gerar no máximo **2 avaliações**: uma para o supermercado e uma para o courier (apenas se a entrega foi feita por courier)
- O índice único `{order, targetType}` no modelo `Review` impede avaliações duplicadas
- Após submissão, `order.reviewSubmitted` é marcado como `true`
- O rating médio do supermercado é recalculado automaticamente e guardado em `Supermarket.rating`
- O rating médio do courier é recalculado e guardado em `User.rating`
- Supermercados e couriers podem responder às suas avaliações
- O admin pode ocultar avaliações inadequadas (`isVisible: false`)

---

## Sistema de Cupões

### Tipos de cupão

| Tipo | Comportamento |
|------|---------------|
| `percentage` | Desconta X% do subtotal da encomenda |
| `fixed_amount` | Desconta um valor fixo em euros do subtotal |
| `fixed_shipping` | Entrega gratuita (`deliveryCost = 0`) |

### Âmbito

- **Global** (`supermarket: null`) — válido em qualquer supermercado, criado pelo admin
- **Específico** — válido apenas num supermercado, criado pelo próprio supermercado

### Validação (`validateAndApply`)

A função verifica os seguintes critérios, por esta ordem:

1. Cupão existe e `isActive: true`
2. Data atual entre `validFrom` e `validUntil`
3. `discountType` é um dos três tipos válidos
4. `currentUses < maxUses` (ou `maxUses === null`)
5. `subtotal >= minOrderValue`
6. Scope correto (global ou do supermercado em questão)

A validação **não incrementa** `currentUses` — essa operação é feita no controller após confirmar que tudo correu bem.

### Cupão de boas-vindas

O cupão `BEMVINDO10` (10% de desconto, sem mínimo, válido 30 dias) é enviado por email automaticamente após a primeira verificação de email de qualquer utilizador. O campo `welcomeCouponSent` no modelo `User` garante que o cupão só é enviado uma vez por utilizador.

### Envio manual pelo admin

O admin pode enviar qualquer cupão global a todos os utilizadores com email verificado via `POST /admin/coupons/:id/send`. O campo `sentToUsers` regista quem já recebeu cada cupão para evitar duplicados.

---

## Gestão de Produtos

- Cada produto pertence a um supermercado e tem: nome, descrição, categoria, preço, stock, imagem
- **Imagem obrigatória** — o controller rejeita a criação sem ficheiro (sem fallback para placeholder)
- Os uploads são tratados pelo `multer` e guardados em `public/uploads/products/`
- Produtos são eliminados por **soft delete** (`isActive: false`) para não quebrar o histórico de encomendas
- O stock é decrementado de forma **atómica** no checkout: `findOneAndUpdate({ stock: { $gte: qty } }, { $inc: { stock: -qty } })` — se retornar `null`, o stock esgotou entre o carrinho e o pagamento, e os stocks já decrementados são revertidos manualmente

---

## Estado Atual do Projeto

### ✅ Implementado

- Autenticação completa com verificação de email via Mailtrap API
- Sistema de sessões seguro com rate limiting no login
- Área do admin: aprovação de supermercados, gestão de utilizadores, categorias, encomendas, cupões globais e ocultação de reviews
- Área do supermercado: perfil, CRUD de produtos com imagem obrigatória, gestão de encomendas com máquina de estados, POS com cliente obrigatório, cupões próprios, reviews
- Área do courier: entregas disponíveis, aceitação atómica, fluxo completo de entrega, cancelamento com devolução ao pool, histórico, reviews
- Catálogo público com pesquisa, filtros e comparação de preços
- Área do cliente: carrinho em sessão, checkout com cupões, histórico de encomendas, cancelamento com regra dos 5 minutos, avaliação de supermercado e courier
- Notificações por email em cada transição de estado de encomenda (best-effort — falha não bloqueia a transição)
- Cupão de boas-vindas `BEMVINDO10` enviado automaticamente após verificação de email
- Envio manual de cupões globais a todos os utilizadores verificados pelo admin
- Sistema de avaliações de supermercados e couriers com resposta
- Proteção de recursos por ownership (cada supermercado só acede aos seus próprios dados)

### ⏳ Pendente (Milestone 2)

- Frontend Angular para clientes finais
- API REST documentada com Swagger
- Autenticação via JWT para o frontoffice Angular

---

## Decisões Técnicas

| Decisão | Motivo |
|---------|--------|
| Snapshots de preço/nome em `Order.items` | Preservar histórico — o preço pode mudar após a compra |
| Decremento atómico de stock com rollback manual | Garantir integridade sem necessitar de MongoDB Transactions (exige ReplicaSet) |
| Soft delete em produtos e categorias | Manter integridade do histórico de encomendas |
| Sessões server-side | Segurança — token não exposto no cliente |
| `accountStatus` em User | Distinguir contas totalmente ativas de contas criadas no POS ainda não ativadas |
| Cliente obrigatório no POS | Rastreabilidade total de vendas presenciais |
| Email best-effort nas transições de estado | Uma falha de email não deve impedir a operação de negócio |