/* XProces Log Renderer v6 ASCII STRICT
   Sustituir SOLO xproces-log-renderer.js.
   Todo el texto mostrado por este renderer sale sin tildes ni caracteres especiales.
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

  function normalizeAscii(value) {
    let t = String(value || "");

    // Intento de arreglar mojibake comun.
    const pairs = [
      ["Ã¡", "a"], ["Ã©", "e"], ["Ã­", "i"], ["Ã³", "o"], ["Ãº", "u"],
      ["Ã ", "A"], ["Ã‰", "E"], ["Ã“", "O"], ["Ãš", "U"],
      ["Ã±", "n"], ["Ã‘", "N"], ["Âº", "o"], ["Âª", "a"], ["Â·", "-"], ["Â", ""],

      [" ", ""],
      ["á", "a"], ["é", "e"], ["í", "i"], ["ó", "o"], ["ú", "u"],
      ["Á", "A"], ["É", "E"], ["Í", "I"], ["Ó", "O"], ["Ú", "U"],
      ["ñ", "n"], ["Ñ", "N"], ["ü", "u"], ["Ü", "U"],
      ["·", "-"], ["º", "o"], ["ª", "a"]
    ];
    for (const [a, b] of pairs) t = t.split(a).join(b);

    // Limpieza final: quita diacriticos si quedara alguno.
    t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return t;
  }

  function keyOf(value) {
    return normalizeAscii(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function prettyMessage(value) {
    const raw = normalizeAscii(value).replace(/Metashape/gi, "Xproces").trim();
    const key = keyOf(raw);

    const known = [
      ["preparandoproyecto", "Preparando proyecto"],
      ["importandofotografias", "Importando fotografias"],
      ["detectandopuntosclavealta", "Detectando puntos clave (Alta)"],
      ["alineandocamaras", "Alineando camaras"],
      ["generandomapasdeprofundidadalta", "Generando mapas de profundidad (Alta)"],
      ["generandonubedepuntoscomoxprocesgui", "Generando nube de puntos como Xproces GUI"],
      ["generandomodelo3dcomobatchmanualxproces", "Generando modelo 3D como Batch manual Xproces"],
      ["generandotexturacomoxprocesguiexplicito", "Generando textura como Xproces GUI explicito"],
      ["generandomodelodeteselascomoxprocesgui", "Generando modelo de teselas como Xproces GUI"],
      ["generandomdecomoxprocesgui", "Generando MDE como Xproces GUI"],
      ["generandoortomosaicocomoxprocesgui", "Generando ortomosaico como Xproces GUI"],
      ["generandodtmdesdeclaseground", "Generando DTM desde clase Ground"],
      ["generandocurvasdeniveldxf", "Generando curvas de nivel DXF"],
      ["exportandoarchivosfinales", "Exportando archivos finales"],
      ["generandoinformefinaldelproyecto", "Generando informe final del proyecto"],
      ["comprimiendoresultados", "Comprimiendo resultados"],
      ["trabajoprocesadocorrectamente", "Trabajo procesado correctamente"]
    ];

    const hit = known.find(([k]) => key.includes(k));
    if (hit) return hit[1];

    return raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
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
      contours_shp: "Curvas SHP",
      pdf_report: "Informe PDF",
      mesh_obj: "OBJ",
      mesh_fbx: "FBX",
      mesh_glb: "GLB",
      tiled_model: "Modelo teselado",
      resultado_zip: "ZIP final"
    };
    const key = normalizeAscii(value).trim().toLowerCase();
    return map[key] || prettyMessage(value);
  }

  function normalizeOutputList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "object") return Object.entries(value).filter(([, v]) => Boolean(v)).map(([k]) => k);
    return String(value).split(/[;,]/).map(x => x.trim()).filter(Boolean);
  }

  function outputListFromJob(job) {
    const candidates = [job?.outputs, job?.requested_outputs, job?.outputs_requested, job?.output_files, job?.delivery, job?.deliverables];
    for (const c of candidates) {
      const list = normalizeOutputList(c);
      if (list.length) return list;
    }
    return [];
  }

  function parseOutputList(line) {
    return line.replace(/^Salidas solicitadas(?: finales)?:\s*/i, "")
      .split(",").map(x => x.trim()).filter(Boolean);
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
      lastImportantOk: "",
      fallbackCompletedStep: "",
      processLines: [],
      warnings: []
    };

    const rawLines = String(text || "").split(/\r?\n/).map(stripPrefix).filter(Boolean);

    for (const rawLine of rawLines) {
      const fixedRaw = normalizeAscii(rawLine).trim();
      if (!fixedRaw) continue;

      // Leer XPROCES_PROGRESS antes de embellecer.
      if (/^XPROCES_PROGRESS\|/i.test(fixedRaw)) {
        const parts = fixedRaw.split("|");
        const p = Number(parts[1]);
        const msg = prettyMessage(parts.slice(2).join("|") || "Procesando proyecto");
        if (Number.isFinite(p)) info.progress = Math.max(0, Math.min(100, p));
        info.progressMessage = msg;
        info.processLines.push(msg);
        info.fallbackCompletedStep = msg;
        if (p >= 100 || /correctamente|completado/i.test(msg)) {
          info.status = "completed";
          info.lastImportantOk = msg;
        }
        continue;
      }

      const line = prettyMessage(fixedRaw);

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
        info.requestedOutputs = parseOutputList(line);
        continue;
      }

      if (/^Aviso:/i.test(line)) {
        info.warnings.push(line.replace(/^Aviso:\s*/i, ""));
        continue;
      }

      const aligned = line.match(/Camaras alineadas:\s*(.*)$/i);
      if (aligned) {
        info.alignedCameras = aligned[1].trim();
        info.lastImportantOk = `Camaras alineadas: ${info.alignedCameras}`;
        continue;
      }

      const points = line.match(/PUNTOS NUBE:\s*(.*)$/i);
      if (points) {
        info.pointCount = points[1].trim();
        info.lastImportantOk = `Puntos nube: ${info.pointCount}`;
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
        info.lastImportantOk = line;
        continue;
      }

      if (/^PROCESO OK\b/i.test(line)) {
        info.status = "completed";
        info.progress = 100;
        info.progressMessage = "Trabajo procesado correctamente";
        info.lastImportantOk = "PROCESO OK";
        continue;
      }

      if (/PROCESO ERROR|Traceback|Error:/i.test(line)) {
        info.status = "failed";
        info.lastImportantOk = line;
        continue;
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
    const title = parsed.progressMessage || prettyMessage(job?.message || "Procesando proyecto");

    const start = firstLogDate(logText) || (job?.processing_started_at ? new Date(job.processing_started_at) : null) || (job?.created_at ? new Date(job.created_at) : null);
    const elapsed = start && !Number.isNaN(start.getTime()) ? Math.floor((Date.now() - start.getTime()) / 1000) : Number(job?.total_seconds || 0);

    let remaining = 0;
    if (parsed.status !== "completed" && progress > 0 && progress < 100 && elapsed > 0) {
      remaining = Math.max(0, Math.round((elapsed / progress) * (100 - progress)));
    } else if (eta && eta.total_estimated_seconds && elapsed > 0 && parsed.status !== "completed") {
      remaining = Math.max(0, Number(eta.total_estimated_seconds) - elapsed);
    }

    const jobOutputs = outputListFromJob(job);
    const outputSource = parsed.requestedOutputs.length ? parsed.requestedOutputs : jobOutputs;
    const outputs = outputSource.length ? outputSource.map(outputLabel).filter(Boolean).join(" - ") : "Segun solicitud";

    const photos = parsed.photos ? `${parsed.photos} fotos` : (job?.photos_count ? `${job.photos_count} fotos` : "Fotos en proceso");
    const quality = parsed.quality || job?.quality || job?.quality_mode || "Calidad seleccionada";
    const projectName = job?.project_name || job?.client_name || "Proyecto";

    const detail =
      parsed.lastImportantOk ||
      (parsed.alignedCameras ? `Camaras alineadas: ${parsed.alignedCameras}` : "") ||
      (parsed.pointCount ? `Puntos nube: ${parsed.pointCount}` : "") ||
      (parsed.fallbackCompletedStep ? `Ultimo proceso leido: ${parsed.fallbackCompletedStep}` : "Pendiente");

    const done = parsed.status === "completed" || progress >= 100;
    const remainingText = done ? "Finalizado" : formatRemaining(remaining);
    const finishText = done ? "Finalizado" : finishClock(remaining);
    const lastSteps = parsed.processLines.slice(-8);

    return `
      <div class="xproces-live-card">
        <div class="xproces-live-top">
          <div>
            <div class="xproces-live-eyebrow">
              <span class="xproces-live-chip">${esc(statusChip(job, parsed))}</span>
              <span class="xproces-live-chip">${esc(normalizeAscii(quality))}</span>
              <span class="xproces-live-chip">${esc(normalizeAscii(photos))}</span>
            </div>
            <h2 class="xproces-live-title" style="word-break:normal;overflow-wrap:anywhere;">${esc(normalizeAscii(title))}</h2>
            <div class="xproces-live-subtitle">${esc(normalizeAscii(projectName))} - Leyendo progreso desde el log real</div>
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
            <div class="xproces-live-metric-label">Finalizacion estimada</div>
            <div class="xproces-live-metric-value">${esc(finishText)}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Entrega</div>
            <div class="xproces-live-metric-value">${esc(normalizeAscii(outputs))}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Control de calidad</div>
            <div class="xproces-live-metric-value">${esc(normalizeAscii(detail))}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">ID del trabajo</div>
            <div class="xproces-live-metric-value">${esc(String(job?.id || "").slice(0, 8))}</div>
          </div>
        </div>

        ${lastSteps.length ? `
          <div class="process-live-list">
            <div class="process-summary-section">
              <div class="process-summary-section-title">Ultimos procesos del log</div>
              <div class="process-summary-list">
                ${lastSteps.map((x) => `<div>${esc(normalizeAscii(x))}</div>`).join("")}
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  window.XProcesLogRenderer = { render, parseLog };
})();
