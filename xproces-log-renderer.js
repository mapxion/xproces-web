/* XProces Log Renderer
   Fuente principal: metashape-python-log.txt vía /jobs/:id/log.
   El index solo llama a window.XProcesLogRenderer.render(job, logText, eta).
*/
(function () {
  "use strict";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripPrefix(line) {
    return String(line || "").replace(/^\[[^\]]+\]\s*/, "").trim();
  }

  function firstLogDate(text) {
    const m = String(text || "").match(/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]/m);
    if (!m) return null;
    const d = new Date(m[1].replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    if (!total) return "Calculando";
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h} h ${m} min`;
    if (m > 0) return `${m} min ${s} s`;
    return `${s} s`;
  }

  function formatRemaining(seconds) {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    if (!total) return "Finalizando";
    const h = Math.floor(total / 3600);
    const m = Math.ceil((total % 3600) / 60);
    if (h > 0) return `${h} h ${m} min`;
    return `${Math.max(1, m)} min`;
  }

  function finishClock(seconds) {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    if (!total) return "Finalizando";
    const d = new Date(Date.now() + total * 1000);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  function outputLabel(value) {
    const map = {
      las: "LAS",
      laz: "LAZ",
      e57: "E57",
      ply: "PLY",
      pts: "PTS",
      orthomosaic_tif: "Ortomosaico TIFF",
      orthomosaic_jpg: "Ortomosaico JPG",
      dem_tif: "DSM/DEM TIFF",
      dtm_tif: "DTM TIFF",
      contours_dxf: "Curvas DXF",
      pdf_report: "Informe PDF",
      mesh_obj: "OBJ",
      mesh_fbx: "FBX",
      mesh_glb: "GLB",
      tiled_model: "Modelo teselado"
    };
    return map[String(value || "").trim().toLowerCase()] || String(value || "").trim();
  }

  function fixEncodingArtifacts(text) {
    // Reparaciones visibles cuando el log llega con charset incorrecto
    // y el navegador muestra el carácter de sustitución  .
    return String(text || "")
      .replace(/c maras/gi, "camaras")
      .replace(/c mara/gi, "camara")
      .replace(/fotograf as/gi, "fotografias")
      .replace(/fotograf a/gi, "fotografia")
      .replace(/expl cito/gi, "explicito")
      .replace(/t cnic/gi, "tecnic")
      .replace(/par metros/gi, "parametros")
      .replace(/rotaci n/gi, "rotacion")
      .replace(/localizaci n/gi, "localizacion")
      .replace(/generaci n/gi, "generacion")
      .replace(/clasificaci n/gi, "clasificacion")
      .replace(/exportaci n/gi, "exportacion")
      .replace(/compresi n/gi, "compresion")
      .replace(/ /g, "");
  }

  function cleanStep(text) {
    return fixEncodingArtifacts(text)
      .replace(/Metashape/gi, "Xproces")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isImportantOkLine(line) {
    // Solo mensajes útiles para el usuario en Control de calidad.
    // No usamos "buildModel completado" ni detalles internos similares.
    if (/^PROCESO OK\b/i.test(line)) return true;
    if (/C[áa]maras alineadas:/i.test(line) || /Camaras alineadas:/i.test(line)) return true;
    if (/PUNTOS NUBE:/i.test(line)) return true;
    if (/^(LAS|LAZ|E57|PLY|PTS):\s*OK\b/i.test(line)) return true;
    if (/^(DSM\/DEM TIFF|DEM TIFF|MDE TIFF|DTM TIFF|Curvas DXF|Ortomosaico TIFF|Ortomosaico JPG|PDF report|OBJ|FBX|GLB|ZIP final):\s*OK\b/i.test(line)) return true;
    return false;
  }

  function parseLog(text) {
    const info = {
      progress: null,
      progressMessage: "",
      status: "processing",
      photos: "",
      quality: "",
      requestedOutputs: [],
      generatedOutputs: [],
      alignedCameras: "",
      pointCount: "",
      lastOk: "Pendiente",
      lastUsefulLine: "Procesando proyecto",
      processLines: [],
      warnings: []
    };

    const lines = String(text || "").split(/\r?\n/).map(stripPrefix).filter(Boolean);

    for (const lineRaw of lines) {
      const line = cleanStep(lineRaw);
      if (!line) continue;

      if (/^Fotos encontradas:/i.test(line)) {
        info.photos = line.replace(/^Fotos encontradas:\s*/i, "").trim();
        continue;
      }

      if (/^Preset activo:/i.test(line) && !info.quality) {
        info.quality = line.replace(/^Preset activo:\s*/i, "").trim();
        continue;
      }

      if (/^Modo de calidad:/i.test(line) || /^Modo solicitado por UI:/i.test(line)) {
        info.quality = line.split(":").slice(1).join(":").trim();
        continue;
      }

      if (/^Salidas solicitadas:/i.test(line) || /^Salidas solicitadas finales:/i.test(line)) {
        info.requestedOutputs = line.replace(/^Salidas solicitadas(?: finales)?:\s*/i, "")
          .split(",").map(x => x.trim()).filter(Boolean);
        continue;
      }

      if (/^Aviso:/i.test(line)) {
        info.warnings.push(line.replace(/^Aviso:\s*/i, ""));
        continue;
      }

      if (/^XPROCES_PROGRESS\|/i.test(line)) {
        const parts = line.split("|");
        const p = Number(parts[1]);
        const msg = cleanStep(parts.slice(2).join("|") || "Procesando proyecto");
        if (Number.isFinite(p)) info.progress = Math.max(0, Math.min(100, p));
        info.progressMessage = msg;
        info.lastUsefulLine = msg;
        info.processLines.push(msg);
        if (p >= 100 || /correctamente|completado/i.test(msg)) {
          info.status = "completed";
          info.lastOk = msg;
        }
        continue;
      }

      const aligned = line.match(/C[áa]maras alineadas:\s*(.*)$/i) || line.match(/Camaras alineadas:\s*(.*)$/i);
      if (aligned) {
        info.alignedCameras = aligned[1].trim();
        info.lastOk = `Cámaras alineadas: ${info.alignedCameras}`;
        continue;
      }

      const points = line.match(/PUNTOS NUBE:\s*(.*)$/i);
      if (points) {
        info.pointCount = points[1].trim();
        info.lastOk = `Puntos nube: ${info.pointCount}`;
        continue;
      }

      const exportMap = [
        [/^LAS:\s*OK\b/i, "las"], [/^LAZ:\s*OK\b/i, "laz"], [/^E57:\s*OK\b/i, "e57"],
        [/^PLY:\s*OK\b/i, "ply"], [/^PTS:\s*OK\b/i, "pts"],
        [/^DSM\/DEM TIFF:\s*OK\b/i, "dem_tif"], [/^DEM TIFF:\s*OK\b/i, "dem_tif"], [/^MDE TIFF:\s*OK\b/i, "dem_tif"],
        [/^DTM TIFF:\s*OK\b/i, "dtm_tif"], [/^Curvas DXF:\s*OK\b/i, "contours_dxf"],
        [/^Ortomosaico TIFF:\s*OK\b/i, "orthomosaic_tif"], [/^Ortomosaico JPG:\s*OK\b/i, "orthomosaic_jpg"],
        [/^PDF report:\s*OK\b/i, "pdf_report"], [/^OBJ:\s*OK\b/i, "mesh_obj"], [/^FBX:\s*OK\b/i, "mesh_fbx"],
        [/^GLB:\s*OK\b/i, "mesh_glb"], [/^ZIP final:\s*OK\b/i, "resultado_zip"]
      ];
      const foundExport = exportMap.find(([rx]) => rx.test(line));
      if (foundExport) {
        if (!info.generatedOutputs.includes(foundExport[1])) info.generatedOutputs.push(foundExport[1]);
        info.lastOk = line;
        continue;
      }

      if (/^PROCESO OK\b/i.test(line)) {
        info.status = "completed";
        info.progress = 100;
        info.progressMessage = "Trabajo procesado correctamente";
        info.lastUsefulLine = "Trabajo procesado correctamente";
        info.lastOk = "PROCESO OK";
        continue;
      }

      if (/PROCESO ERROR|Traceback|Error:/i.test(line)) {
        info.status = "failed";
        info.lastOk = line;
        continue;
      }

      if (isImportantOkLine(line)) {
        info.lastOk = line;
      }
    }

    return info;
  }

  function statusChip(job, parsed) {
    if (parsed.status === "completed") return "Completado";
    if (parsed.status === "failed") return "Fallido";
    const s = String(job?.status || "").toLowerCase();
    if (s === "queued") return "En cola";
    if (s === "completed" || s === "done") return "Completado";
    if (s === "failed") return "Fallido";
    return "Procesando";
  }

  function render(job, logText, eta) {
    const parsed = parseLog(logText || "");
    const progress = parsed.progress != null ? parsed.progress : Math.max(0, Math.min(100, Number(job?.progress || 0)));
    const title = parsed.progressMessage || parsed.lastUsefulLine || job?.message || "Procesando proyecto";

    const start = firstLogDate(logText) || (job?.processing_started_at ? new Date(job.processing_started_at) : null) || (job?.created_at ? new Date(job.created_at) : null);
    const elapsed = start && !Number.isNaN(start.getTime()) ? Math.floor((Date.now() - start.getTime()) / 1000) : Number(job?.total_seconds || 0);

    let remaining = 0;
    if (parsed.status !== "completed" && progress > 0 && progress < 100 && elapsed > 0) {
      remaining = Math.max(0, Math.round((elapsed / progress) * (100 - progress)));
    } else if (eta && eta.total_estimated_seconds && elapsed > 0 && parsed.status !== "completed") {
      remaining = Math.max(0, Number(eta.total_estimated_seconds) - elapsed);
    }

    const outputs = parsed.requestedOutputs.length ? parsed.requestedOutputs.map(outputLabel).join(" · ") : "Según solicitud";
    const photos = parsed.photos ? `${parsed.photos} fotos` : (job?.photos_count ? `${job.photos_count} fotos` : "Fotos en proceso");
    const quality = parsed.quality || job?.quality || job?.quality_mode || "Calidad seleccionada";
    const projectName = job?.project_name || job?.client_name || "Proyecto";
    const detail = parsed.lastOk || (parsed.alignedCameras ? `Cámaras alineadas: ${parsed.alignedCameras}` : "Pendiente");

    const done = parsed.status === "completed" || progress >= 100;
    const remainingText = done ? "Finalizado" : formatRemaining(remaining);
    const finishText = done ? "Finalizado" : finishClock(remaining);

    const lastSteps = parsed.processLines.slice(-10);

    return `
      <div class="xproces-live-card">
        <div class="xproces-live-top">
          <div>
            <div class="xproces-live-eyebrow">
              <span class="xproces-live-chip">${esc(statusChip(job, parsed))}</span>
              <span class="xproces-live-chip">${esc(quality)}</span>
              <span class="xproces-live-chip">${esc(photos)}</span>
            </div>
            <h2 class="xproces-live-title">${esc(title)}</h2>
            <div class="xproces-live-subtitle">${esc(projectName)} · Leyendo progreso desde el log real</div>
          </div>
          <div class="xproces-live-percent">${esc(String(Math.round(progress)))}%</div>
        </div>

        <div class="xproces-live-progress"><div style="width:${Math.max(0, Math.min(100, progress))}%"></div></div>

        <div class="xproces-live-metrics">
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Tiempo transcurrido</div>
            <div class="xproces-live-metric-value">${esc(formatDuration(elapsed))}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Tiempo restante aprox.</div>
            <div class="xproces-live-metric-value">${esc(remainingText)}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Finalización estimada</div>
            <div class="xproces-live-metric-value">${esc(finishText)}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Entrega</div>
            <div class="xproces-live-metric-value">${esc(outputs)}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Control de calidad</div>
            <div class="xproces-live-metric-value">${esc(detail)}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">ID del trabajo</div>
            <div class="xproces-live-metric-value">${esc(String(job?.id || "").slice(0, 8))}</div>
          </div>
        </div>

        ${lastSteps.length ? `
          <div class="process-live-list">
            <div class="process-summary-section">
              <div class="process-summary-section-title">Últimos procesos del log</div>
              <div class="process-summary-list">
                ${lastSteps.map((x) => `<div>${esc(x)}</div>`).join("")}
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  window.XProcesLogRenderer = { render, parseLog };
})();
