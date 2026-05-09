document.addEventListener("DOMContentLoaded", () => {
  const cancelForm = document.querySelector(".js-confirm-cancel-order");
  if (!cancelForm) return;
  cancelForm.addEventListener("submit", (event) => {
    if (!window.confirm("Cancelar esta encomenda?")) {
      event.preventDefault();
    }
  });
});
