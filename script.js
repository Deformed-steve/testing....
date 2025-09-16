const iframe = document.getElementById("viewer");
const urlInput = document.getElementById("urlInput");
const engineSelect = document.getElementById("engineSelect");

engineSelect.value = localStorage.getItem("engine") || "uv";

engineSelect.addEventListener("change", () => {
  localStorage.setItem("engine", engineSelect.value);
});

function loadSite() {
  const url = urlInput.value.trim();
  if (!url) return;
  iframe.src = `/api/fetcher?url=${encodeURIComponent("https://" + url)}`;
}
