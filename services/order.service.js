const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const User = require("../models/User");
const emailService = require("./email.service");

const VALID_TRANSITIONS = {
  pending:     ["confirmed", "cancelled"],
  confirmed:   ["preparing", "cancelled"],
  preparing:   ["ready", "cancelled"],
  ready:       ["in_delivery", "delivered", "cancelled"],
  in_delivery: ["delivered", "cancelled"],
  delivered:   [],
  cancelled:   []
};

async function transitionOrderStatus(orderId, newStatus, changedByUserId, reason = null) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Encomenda não encontrada");

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) throw new Error(`Transição inválida: ${order.status} → ${newStatus}`);

  if (newStatus === "cancelled" && changedByUserId) {
    const user = await User.findById(changedByUserId);
    if (user && user.role === "client") {
      if (order.status === "confirmed" && order.confirmedAt) {
        const minsElapsed = (Date.now() - new Date(order.confirmedAt).getTime()) / 60000;
        if (minsElapsed > 5) {
          throw new Error("O prazo de 5 minutos para cancelar esta encomenda já expirou.");
        }
      } else if (order.status !== "pending") {
        throw new Error("Não é possível cancelar esta encomenda.");
      }
    }
  }

  order.status = newStatus;
  order.statusHistory.push({ status: newStatus, changedBy: changedByUserId, reason });

  if (newStatus === "confirmed") {
    order.confirmedAt = new Date();

    if (order.deliveryMethod === "courier") {
      const existing = await Delivery.findOne({ order: order._id, status: { $ne: "cancelled" } });
      if (!existing) {
        await Delivery.create({
          order: order._id,
          supermarket: order.supermarket,
          status: "available",
          statusHistory: [{ status: "available", changedBy: changedByUserId }]
        });
      }
    }
  }

  if (newStatus === "cancelled") {
    // Restaurar stock dos produtos da encomenda
    if (order.items && order.items.length) {
      await Promise.all(
        order.items.map((item) =>
          Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
        )
      );
    }

    // Devolver uso do cupão se existir
    if (order.couponCode) {
      await Coupon.updateOne(
        { code: order.couponCode, currentUses: { $gt: 0 } },
        { $inc: { currentUses: -1 } }
      );
    }

    // Cancelar delivery associada
    const delivery = await Delivery.findOne({ order: order._id, status: { $in: ["available", "accepted", "picked_up"] } });
    if (delivery) {
      delivery.status = "cancelled";
      delivery.statusHistory.push({ status: "cancelled", changedBy: changedByUserId, reason: "Encomenda cancelada" });
      await delivery.save();
    }
  }

  await order.save();

  try {
    const cancelReason = newStatus === "cancelled" ? reason : null;
    await emailService.sendOrderStatusUpdate(order, newStatus, cancelReason);
  } catch (emailErr) {
    console.error("transitionOrderStatus: falha ao enviar email:", emailErr.message);
  }

  return order;
}

async function onCourierAcceptDelivery(deliveryId, courierId) {
  const deliveryCheck = await Delivery.findById(deliveryId).lean();
  if (!deliveryCheck) throw new Error("Entrega não encontrada no sistema.");

  // Atômico: só um estafeta consegue transitar de "available" para "accepted"
  const delivery = await Delivery.findOneAndUpdate(
    { _id: deliveryId, status: "available" },
    {
      $set: { courier: courierId, status: "accepted", acceptedAt: new Date() },
      $push: { statusHistory: { status: "accepted", changedBy: courierId } }
    },
    { new: true }
  ).populate("order");

  if (!delivery) {
    throw new Error(`Entrega não disponível para aceitação (estado atual: ${deliveryCheck.status}).`);
  }

  const validOrderStatuses = ["confirmed", "preparing", "ready"];
  if (!validOrderStatuses.includes(delivery.order.status)) {
    throw new Error(`A encomenda ainda está em estado ${delivery.order.status}. Aguarda confirmação.`);
  }

  return delivery;
}

async function onCourierPickedUp(deliveryId, courierId) {
  const delivery = await Delivery.findOne({ _id: deliveryId, courier: courierId, status: "accepted" });
  if (!delivery) throw new Error("Entrega não encontrada ou não pertence ao courier.");

  const order = await Order.findById(delivery.order);
  if (!order) throw new Error("Encomenda associada não encontrada.");
  if (order.status !== "ready") {
    throw new Error("Só podes levantar o pedido depois de o supermercado o marcar como pronto.");
  }

  delivery.status = "picked_up";
  delivery.statusHistory.push({ status: "picked_up", changedBy: courierId });
  await delivery.save();

  await transitionOrderStatus(delivery.order, "in_delivery", courierId, "Pedido levantado pelo estafeta");
  return { order, delivery };
}

async function onCourierCancelDelivery(deliveryId, courierId, reason) {
  const delivery = await Delivery.findOne({ _id: deliveryId, courier: courierId });
  if (!delivery) throw new Error("Entrega não encontrada ou não pertence ao courier.");
  if (!["accepted", "picked_up"].includes(delivery.status)) {
    throw new Error("Só podes cancelar entregas aceites ou levantadas.");
  }

  const wasPickedUp = delivery.status === "picked_up";

  delivery.status = "available";
  delivery.courier = null;
  delivery.acceptedAt = null;
  delivery.statusHistory.push(
    { status: "cancelled", changedBy: courierId, reason: reason || "Cancelada pelo courier" },
    { status: "available", changedBy: courierId, reason: "Entrega novamente disponível para atribuição" }
  );
  await delivery.save();

  const order = await Order.findById(delivery.order);
  if (!order) throw new Error("Encomenda associada não encontrada.");

  if (wasPickedUp) {
    // Ordem estava em in_delivery; repor para ready para que outro estafeta possa levantar
    // Transição inversa intencional: o courier cancelou após levantar o pedido
    order.status = "ready";
    order.statusHistory.push({
      status: "ready",
      changedBy: courierId,
      reason: "Courier cancelou após levantamento. Pronto para novo estafeta."
    });
    await order.save();

    try {
      await emailService.sendOrderStatusUpdate(order, "ready", null);
    } catch (emailErr) {
      console.error("onCourierCancelDelivery: falha ao enviar email:", emailErr.message);
    }
  }
  // Se estava apenas aceite (não levantado), a ordem mantém o seu estado atual

  return { order, delivery };
}

async function onCourierDelivered(deliveryId, courierId) {
  const delivery = await Delivery.findOne({ _id: deliveryId, courier: courierId });
  if (!delivery) throw new Error("Entrega não encontrada ou não pertence ao courier.");
  if (delivery.status !== "picked_up") {
    throw new Error("Só podes marcar como entregue após levantar o pedido.");
  }

  delivery.status = "delivered";
  delivery.deliveredAt = new Date();
  delivery.statusHistory.push({ status: "delivered", changedBy: courierId });
  await delivery.save();

  const order = await transitionOrderStatus(delivery.order, "delivered", courierId, "Entregue pelo courier");
  return { order, delivery };
}

async function createPOSSale(orderData, cashierId) {
  const order = new Order({
    ...orderData,
    source: "pos",
    status: "delivered",
    confirmedAt: new Date(),
    statusHistory: [
      { status: "confirmed", changedBy: cashierId, reason: "Venda registada em caixa" },
      { status: "preparing", changedBy: cashierId, reason: "Preparação imediata (venda presencial)" },
      { status: "delivered", changedBy: cashierId, reason: "Entrega imediata (venda presencial)" }
    ]
  });
  await order.save();
  return order;
}

module.exports = {
  transitionOrderStatus,
  onCourierAcceptDelivery,
  onCourierPickedUp,
  onCourierCancelDelivery,
  onCourierDelivered,
  createPOSSale
};
