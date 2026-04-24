// Estado global do POS
const posState = {
  items: [],
  selectedClient: null,
  couponCode: null,
  discountAmount: 0,
  deliveryFreeFromCoupon: false
};

let debounceTimer;

function euro(v) {
  return Number(v || 0).toFixed(2);
}

function subtotal() {
  return posState.items.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
}

function recalculateTotal() {
  const sub = subtotal();
  const total = Math.max(0, sub - posState.discountAmount);
  document.getElementById("subtotalValue").textContent = euro(sub);
  document.getElementById("discountValue").textContent = euro(posState.discountAmount);
  document.getElementById("totalValue").textContent = euro(total);
  
  // Habilitar checkout apenas se há cliente e produtos
  const hasClient = !!posState.selectedClient;
  const hasItems = posState.items.length > 0;
  document.getElementById("checkoutBtn").disabled = !(hasClient && hasItems);
}

function syncHiddenFields() {
  // Sincroniza Itens
  document.getElementById("itemsJson").value = JSON.stringify(
    posState.items.map((it) => ({ 
      productId: it.productId, 
      quantity: it.quantity, 
      productName: it.productName 
    }))
  );
  
  // Sincroniza Cupão
  document.getElementById("couponCodeHidden").value = posState.couponCode || "";
  
  // Sincroniza o ID do Cliente 
  const clientHidden = document.getElementById("clientIdHidden");
  if (clientHidden) {
    clientHidden.value = posState.selectedClient ? posState.selectedClient._id : "";
  }
}

function renderCart() {
  const container = document.getElementById("cartItems");
  if (!posState.items.length) {
    container.innerHTML = "<p>Sem itens no carrinho.</p>";
    recalculateTotal();
    syncHiddenFields();
    return;
  }
  container.innerHTML = posState.items
    .map(
      (item) => `
      <div style="border:1px solid #ddd;padding:8px;margin-bottom:8px;border-radius:8px;display:flex;gap:10px;align-items:center">
        <img src="${item.image || "/images/product-placeholder.svg"}" alt="${item.productName}" style="width:56px;height:56px;object-fit:cover;border-radius:6px">
        <div style="flex:1">
          <strong>${item.productName}</strong> - €${euro(item.productPrice)} (stock ${item.stock})
          <div>
            <input type="number" min="1" max="${item.stock}" value="${item.quantity}" data-qty-id="${item.productId}" style="width:80px">
            <button type="button" data-remove-id="${item.productId}">Remover</button>
          </div>
        </div>
      </div>
    `
    )
    .join("");

  container.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      posState.items = posState.items.filter((i) => i.productId !== btn.dataset.removeId);
      renderCart();
    });
  });
  container.querySelectorAll("[data-qty-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.qtyId;
      const item = posState.items.find((i) => i.productId === id);
      if (!item) return;
      const qty = Number(input.value);
      if (qty < 1 || qty > item.stock) {
        input.value = item.quantity;
        return;
      }
      item.quantity = qty;
      recalculateTotal();
      syncHiddenFields();
    });
  });

  recalculateTotal();
  syncHiddenFields();
}

function addItem(product) {
  if (product.stock <= 0) return;
  const exists = posState.items.find((i) => i.productId === product._id);
  if (exists) {
    if (exists.quantity < exists.stock) exists.quantity += 1;
  } else {
    posState.items.push({
      productId: product._id,
      productName: product.name,
      productPrice: Number(product.price),
      image: product.image || "/images/product-placeholder.svg",
      quantity: 1,
      stock: Number(product.stock)
    });
  }
  renderCart();
}

function renderProducts(products) {
  const list = document.getElementById("productsList");
  if (!products.length) {
    list.innerHTML = "<p>Sem resultados.</p>";
    return;
  }
  list.innerHTML = products
    .map(
      (p) => `
    <div style="border:1px solid #ddd;border-radius:10px;overflow:hidden;margin-bottom:10px;background:#fff">
      <img src="${p.image || "/images/product-placeholder.svg"}" alt="${p.name}" style="width:100%;height:150px;object-fit:cover;display:block">
      <div style="padding:10px">
        <strong>${p.name}</strong><br>
        €${euro(p.price)} | stock: ${p.stock}<br>
        <button type="button" data-add-id="${p._id}" ${p.stock <= 0 ? "disabled" : ""}>Adicionar</button>
      </div>
    </div>
  `
    )
    .join("");
  list.querySelectorAll("[data-add-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const product = products.find((p) => p._id === btn.dataset.addId);
      if (product) addItem(product);
    });
  });
}

async function loadProducts() {
  const q = document.getElementById("productSearch").value.trim();
  const category = document.getElementById("productCategory").value;
  const url = `/supermarket/pos/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`;
  const res = await fetch(url);
  const data = await res.json();
  renderProducts(data.products || []);
}

async function searchClient() {
  const q = document.getElementById("clientSearch").value.trim();
  if (!q) return;

  try {
    const res = await fetch(`/supermarket/pos/clients?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const resultDiv = document.getElementById("clientSearchResult");

    if (data.success && data.clients.length > 0) {
      resultDiv.innerHTML = '<div class="list-group mt-2">' + 
        data.clients.map(c => `
          <button type="button" class="list-group-item list-group-item-action" 
            onclick='selectClient(${JSON.stringify(c)})'>
            ${c.name} (${c.phone})
          </button>
        `).join('') + '</div>';
    } else {
      resultDiv.innerHTML = '<div class="text-danger mt-2">Nenhum cliente encontrado.</div>';
    }
  } catch (err) {
    console.error("Erro na pesquisa:", err);
  }
}

function selectClient(client) {
  posState.selectedClient = client;
  document.getElementById("clientName").textContent = client.name;
  document.getElementById("clientEmail").textContent = client.email;
  document.getElementById("clientPhone").textContent = client.phone;
  document.getElementById("selectedClientInfo").style.display = "block";
  document.getElementById("clientSearch").value = "";
  document.getElementById("clientSearchResult").innerHTML = "";
  // Se o formulário de criação estiver aberto, fecha-o
  const createForm = document.getElementById("createClientForm");
  if (createForm) createForm.style.display = "none";
  recalculateTotal();
  syncHiddenFields();
}

async function createQuickClient() {
  const name = document.getElementById("newClientName").value.trim();
  const email = document.getElementById("newClientEmail").value.trim();
  const phone = document.getElementById("newClientPhone").value.trim();

  if (!name || !email || !phone) {
    alert("Todos os campos são obrigatórios.");
    return;
  }

  try {
    const res = await fetch("/supermarket/pos/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone })
    });

    const data = await res.json();
    if (data.success) {
      selectClient(data.client);
      document.getElementById("newClientName").value = "";
      document.getElementById("newClientEmail").value = "";
      document.getElementById("newClientPhone").value = "";
      alert("Cliente criado com sucesso!");
    } else {
      alert("Erro: " + (data.message || "Falha ao criar cliente"));
    }
  } catch (err) {
    alert("Erro ao criar cliente: " + err.message);
  }
}

async function applyCoupon() {
  const code = document.getElementById("couponCodeInput").value.trim();
  if (!code) return;
  const res = await fetch(`/supermarket/pos/validate-coupon?code=${encodeURIComponent(code)}&subtotal=${subtotal()}`);
  const data = await res.json();
  const msg = document.getElementById("couponMessage");
  if (data.valid) {
    posState.couponCode = code;
    posState.discountAmount = Number(data.discountAmount || 0);
    posState.deliveryFreeFromCoupon = Boolean(data.deliveryFree);
    if (posState.deliveryFreeFromCoupon) {
      msg.textContent = `Cupão aplicado: entrega gratuita. ${data.description || ""}`;
    } else {
      msg.textContent = `Cupão aplicado: -€${euro(posState.discountAmount)}`;
    }
  } else {
    posState.couponCode = null;
    posState.discountAmount = 0;
    posState.deliveryFreeFromCoupon = false;
    msg.textContent = data.message || "Cupão inválido";
  }
  recalculateTotal();
  syncHiddenFields();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("productSearch").addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadProducts, 300);
  });
  document.getElementById("productCategory").addEventListener("change", loadProducts);
  document.getElementById("searchClientBtn").addEventListener("click", searchClient);
  document.getElementById("applyCouponBtn").addEventListener("click", applyCoupon);
  document.getElementById("createClientQuickBtn").addEventListener("click", () => {
    document.getElementById("createClientForm").style.display = 
      document.getElementById("createClientForm").style.display === "none" ? "block" : "none";
  });
  document.getElementById("submitCreateClientBtn").addEventListener("click", createQuickClient);

  loadProducts();
  renderCart();
});
