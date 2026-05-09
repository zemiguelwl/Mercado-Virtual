// Backward-compatible loader for legacy POS script path.
(() => {
  const script = document.createElement("script");
  script.src = "/js/pos.js";
  document.body.appendChild(script);
})();
