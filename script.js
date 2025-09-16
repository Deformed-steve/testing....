const iframe = document.getElementById("viewer");
const urlInput = document.getElementById("urlInput");
const engineSelect = document.getElementById("engineSelect");

// Load engine choice from localStorage
engineSelect.value = localStorage.getItem("engine") || "uv";

engineSelect.addEventListener("change", () => {
  localStorage.setItem("engine", engineSelect.value);
});

function loadSite() {
  const url = urlInput.value.trim();
  if (!url) return;
  const engine = engineSelect.value;
  iframe.src = `/api/${engine}?url=${encodeURIComponent("https://" + url)}`;
}
