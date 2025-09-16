function loadSite() {
  const urlInput = document.getElementById('urlInput').value;
  if (!urlInput) return alert('Enter a URL!');
  const engine = document.getElementById('engineSelect').value;
  const viewer = document.getElementById('viewer');
  const fullUrl = urlInput.startsWith('http') ? urlInput : 'https://' + urlInput;
  viewer.src = `/api/fetcher?url=${encodeURIComponent(fullUrl)}&engine=${engine}`;
}
