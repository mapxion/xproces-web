(function () {
  const REFRESH_MS = 5000;
  let currentJobId = "";
  let timer = null;
  let lastUpdatedAt = null;

  function getApiBase() {
    return window.API_BASE || "";
  }

  function ensurePanel() {
    let panel = document.getElementById("xprocesLiveViewportPanel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "xprocesLiveViewportPanel";
    panel.className = "xproces-live-viewport-panel";
    panel.innerHTML = `
      <div class="xproces-live-viewport-head">
        <div class="xproces-live-viewport-title">Proceso</div>
        <div class="xproces-live-viewport-state" id="xprocesLiveViewportState">Esperando imagen</div>
      </div>
      <div class="xproces-live-viewport-frame">
        <img id="xprocesLiveViewportImg" class="xproces-live-viewport-img" alt="Proceso">
        <div id="xprocesLiveViewportPlaceholder" class="xproces-live-viewport-placeholder">
          Esperando captura del procesado.<br>La imagen aparecerá cuando inicie el proceso.
        </div>
      </div>
      <div class="xproces-live-viewport-note">
        La vista se actualiza automáticamente.
      </div>
    `;

    const anchor = document.getElementById("jobStatus") || document.getElementById("processPanel") || document.body;
    if (anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    else document.body.appendChild(panel);
    return panel;
  }

  async function refreshOnce() {
    if (!currentJobId) return;
    const panel = ensurePanel();
    const img = document.getElementById("xprocesLiveViewportImg");
    const placeholder = document.getElementById("xprocesLiveViewportPlaceholder");
    const state = document.getElementById("xprocesLiveViewportState");

    try {
      const statusUrl = `${getApiBase()}/jobs/${encodeURIComponent(currentJobId)}/live/status?ts=${Date.now()}`;
      const resp = await fetch(statusUrl, { cache: "no-store" });
      const data = resp.ok ? await resp.json() : null;

      panel.classList.add("show");

      if (!data || !data.available) {
        if (img) img.style.display = "none";
        if (placeholder) placeholder.style.display = "block";
        if (state) state.textContent = "Esperando imagen";
        return;
      }

      lastUpdatedAt = data.updated_at || new Date().toISOString();
      const imageUrl = `${getApiBase()}/jobs/${encodeURIComponent(currentJobId)}/live.jpg?ts=${Date.now()}`;

      if (img) {
        img.onload = () => {
          img.style.display = "block";
          if (placeholder) placeholder.style.display = "none";
        };
        img.onerror = () => {
          img.style.display = "none";
          if (placeholder) placeholder.style.display = "block";
        };
        img.src = imageUrl;
      }

      if (state) state.textContent = "Actualizado ahora";
    } catch (e) {
      if (state) state.textContent = "Sin conexión live";
    }
  }

  function start(jobId) {
    const id = String(jobId || "").trim();
    if (!id) return;
    if (currentJobId === id && timer) return;

    stop(false);
    currentJobId = id;
    ensurePanel().classList.add("show");
    refreshOnce();
    timer = setInterval(refreshOnce, REFRESH_MS);
  }

  function stop(hide = true) {
    if (timer) clearInterval(timer);
    timer = null;
    currentJobId = "";
    if (hide) {
      const panel = document.getElementById("xprocesLiveViewportPanel");
      if (panel) panel.classList.remove("show");
    }
  }

  function update(job) {
    const id = String(job?.id || "").trim();
    const status = String(job?.status || "").toLowerCase();
    if (!id) return;

    if (["queued", "receiving", "running"].includes(status)) {
      start(id);
      return;
    }

    if (["done", "completed", "failed", "cancelled"].includes(status)) {
      start(id);
      setTimeout(() => stop(false), 15000);
    }
  }

  window.XProcesLiveViewport = { start, stop, update, refreshOnce };
})();
