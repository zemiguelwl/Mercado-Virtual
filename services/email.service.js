const nodemailer = require("nodemailer");
const { MailtrapTransport } = require("mailtrap");

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_API_TOKEN);
}

function createTransporter() {
  // Em testes, não criamos transportador para evitar envios reais
  if (process.env.NODE_ENV === "test") return null;
  if (!isEmailConfigured()) return null;
  return nodemailer.createTransport(
    MailtrapTransport({
      token: process.env.EMAIL_API_TOKEN,
    })
  );
}

const transporter = createTransporter();

if (transporter && process.env.NODE_ENV !== "test") {
  console.log("Servidor de email configurado com Mailtrap");
}

const STATUS_LABELS = {
  confirmed: "Confirmada",
  preparing: "Em preparação",
  ready: "Pronta para levantamento",
  in_delivery: "Em entrega",
  delivered: "Entregue",
  cancelled: "Cancelada"
};

function orderRefFromId(orderId) {
  return String(orderId).slice(-6).toUpperCase();
}

async function sendVerificationEmail(toEmail, userName, code) {
  if (!transporter) {
    throw new Error("Serviço de email não configurado");
  }
  try {
    return await transporter.sendMail({
      from: { address: process.env.EMAIL_FROM, name: "Mercadinho Virtual" },
      to: toEmail,
      subject: "Confirma o teu email | Mercadinho Virtual",
      html: `<h2>Olá, ${escapeHtml(userName)}!</h2><p>O teu código de verificação (6 dígitos):</p><p><strong style="font-size:28px;letter-spacing:6px">${escapeHtml(
        code
      )}</strong></p><p>Expira em 15 minutos.</p>`
    });
  } catch (err) {
    console.error("sendVerificationEmail:", err.message);
    throw err;
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendOrderStatusUpdate(order, newStatus, cancelReason = null) {
  try {
    if (!transporter) return;
    if (!order?.client?.email) return;
    const relevant = ["confirmed", "preparing", "ready", "in_delivery", "delivered", "cancelled"];
    if (!relevant.includes(newStatus)) return;

    const orderRef = orderRefFromId(order._id);
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    const clientName = order.client.name || "Cliente";
    const total = typeof order.total === "number" ? order.total.toFixed(2) : "não disponível";
    const reasonBlock =
      newStatus === "cancelled" && cancelReason
        ? `<p><strong>Motivo do cancelamento:</strong> ${escapeHtml(cancelReason)}</p>`
        : "";

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2>Atualização da encomenda</h2>
        <p>Olá, ${escapeHtml(clientName)}!</p>
        <p><strong>Referência:</strong> #${escapeHtml(orderRef)}</p>
        <p><strong>Estado atual:</strong> ${escapeHtml(statusLabel)}</p>
        <p><strong>Total:</strong> €${escapeHtml(total)}</p>
        ${reasonBlock}
        <p style="color:#666;font-size:14px">Mercadinho Virtual</p>
      </div>
    `;

    await transporter.sendMail({
      from: { address: process.env.EMAIL_FROM, name: "Mercadinho Virtual" },
      to: order.client.email,
      subject: `Encomenda #${orderRef} | ${statusLabel}`,
      html
    });
  } catch (err) {
    console.error("sendOrderStatusUpdate:", err.message);
  }
}

async function sendCouponEmail(toEmail, userName, couponCode, discountDescription, expiresAt) {
  if (!transporter) return false;
  try {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px">
        <div style="background:linear-gradient(135deg,#0d9488,#059669);color:#fff;padding:20px;border-radius:10px;text-align:center">
          <h1 style="margin:0;font-size:22px">Cupão exclusivo para ti</h1>
          <p style="margin:8px 0 0;opacity:.95">Olá, ${escapeHtml(userName)}! Aproveite já esta promoção.</p>
        </div>
        <div style="background:#fff;padding:24px;border-radius:10px;margin-top:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)">
          <p style="font-size:16px;color:#334155">${escapeHtml(discountDescription)}</p>
          <p style="text-align:center;margin:24px 0">
            <span style="display:inline-block;background:#ecfdf5;border:2px dashed #059669;color:#047857;font-size:20px;font-weight:700;letter-spacing:2px;padding:12px 24px;border-radius:8px">
              ${escapeHtml(couponCode)}
            </span>
          </p>
          <p style="color:#64748b;font-size:14px"><strong>Válido até:</strong> ${escapeHtml(expiresAt)}</p>
        </div>
      </div>
    `;
    await transporter.sendMail({
      from: { address: process.env.EMAIL_FROM, name: "Mercadinho Virtual" },
      to: toEmail,
      subject: `Novo cupão: ${couponCode} | Mercadinho Virtual`,
      html
    });
    return true;
  } catch (err) {
    console.error("sendCouponEmail:", err.message);
    return false;
  }
}

module.exports = { sendVerificationEmail, sendOrderStatusUpdate, sendCouponEmail };
