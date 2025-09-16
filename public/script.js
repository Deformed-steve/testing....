const iframe = document.getElementById("viewer");
const urlInput = document.getElementById("urlInput");
const engineSelect = document.getElementById("engineSelect");
const enterBtn = document.getElementById("enterBtn");

// Remember engine choice
engineSelect.value = localStorage.getItem("engine") || "uv";

engineSelect.addEventListener("change", () => {
  localStorage.setItem("engine", engineSelect.value);
});

function loadSite() {
  const url = urlInput.value.trim();
  if (!url) return;

  // Set iframe to our backend fetcher
  iframe.src = `/api/fetcher?url=${encodeURIComponent("https://" + url)}`;
}

// Attach to button
enterBtn.addEventListener("click", loadSite);

// Optional: Enter key triggers load
urlInput.addEventListener("keyup", e => {
  if (e.key === "Enter") loadSite();
});
