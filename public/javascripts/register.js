function syncRole() {
  const selectedRole = document.querySelector('input[name="role"]:checked');
  const supermarketWrap = document.getElementById("supermarketNameWrap");
  if (!supermarketWrap) return;
  supermarketWrap.style.display = selectedRole && selectedRole.value === "supermarket" ? "block" : "none";
}

document.querySelectorAll('input[name="role"]').forEach((el) => {
  el.addEventListener("change", syncRole);
});
syncRole();
