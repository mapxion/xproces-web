/* XProces Log Renderer limpio v9 - procesos cortos sin tildes */
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

  function repairText(value) {
    let t = String(value || "");

    // 1) Reparar mojibake habitual si el log llega mal codificado.
    const replacements = [
      ["Ã¡", "a"], ["Ã©", "e"], ["Ã­", "i"], ["Ã³", "o"], ["Ãº", "u"],
      ["\u00c3\u0081", "A"], ["\u00c3\u0089", "E"], ["\u00c3\u008d", "I"], ["\u00c3\u0093", "O"], ["\u00c3\u009a", "U"],
      ["Ã±", "n"], ["Ã‘", "N"],
      ["Â·", " - "], ["Âº", "o"], ["Âª", "a"], ["Â", ""]
    ];
    for (const [a, b] of replacements) t = t.split(a).join(b);

    // 2) Si ya aparece el caracter roto, corregir palabras conocidas antes de borrarlo.
    t = t
      .replace(/fotograf.as/gi, "fotografias")
      .replace(/fotograf.a/gi, "fotografia")
      .replace(/c.maras/gi, "camaras")
      .replace(/c.mara/gi, "camara")
      .replace(/expl.cito/gi, "explicito")
      .replace(/par.metros/gi, "parametros")
      .replace(/rotaci.n/gi, "rotacion")
      .replace(/localizaci.n/gi, "localizacion")
      .replace(/generaci.n/gi, "generacion")
      .replace(/clasificaci.n/gi, "clasificacion")
      .replace(/exportaci.n/gi, "exportacion")
      .replace(/compresi.n/gi, "compresion")
      .replace(/t.cnic/gi, "tecnic")
      .replace(/a.ad/gi, "anad");

    // 3) Quitar tildes reales y cualquier caracter de sustitucion restante.
    try {
      t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (_) {}

    t = t
      .replace(/[\u00e1\u00e0\u00e4\u00e2]/gi, "a")
      .replace(/[\u00e9\u00e8\u00eb\u00ea]/gi, "e")
      .replace(/[\u00ed\u00ec\u00ef\u00ee]/gi, "i")
      .replace(/[\u00f3\u00f2\u00f6\u00f4]/gi, "o")
      .replace(/[\u00fa\u00f9\u00fc\u00fb]/gi, "u")
      .replace(/\u00f1/gi, "n")
      .replace(/[ºª]/g, "")
      .replace(/·/g, " - ")
      .replace(/\ufffd/g, "");

    return t.replace(/\s+/g, " ").trim();
  }

  function compactKey(text) {
    return repairText(text)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function prettyMessage(text) {
    const original = repairText(text).replace(/Metashape/gi, "Xproces").trim();
    const key = compactKey(original);

    // Textos limpios para cliente final: sin tildes, sin GUI, sin Batch manual, sin detalles internos.
    const known = [
      [["preparandoproyecto"], "Preparando proyecto"],
      [["importandofotografias", "importandofotografas"], "Importando fotografias"],
      [["detectandopuntosclave"], "Detectando puntos clave"],
      [["alineandocamaras", "alineandocmaras"], "Alineando camaras"],
      [["generandomapasdeprofundidad"], "Generando mapas de profundidad"],
      [["generandonubedepuntos"], "Generando nube de puntos"],
      [["generandomodelo3d"], "Generando modelo 3D"],
      [["generandotextura"], "Generando textura"],
      [["generandomodelodeteselas"], "Generando modelo de teselas"],
      [["generandomde"], "Generando MDE"],
      [["generandoortomosaico"], "Generando ortomosaico"],
      [["generandodtm"], "Generando DTM"],
      [["generandocurvasdenivel"], "Generando curvas de nivel"],
      [["exportandoarchivosfinales", "exportandoresultados"], "Exportando resultados"],
      [["generandoinformefinaldelproyecto", "generandoinforme"], "Generando informe"],
      [["comprimiendoresultados"], "Comprimiendo resultados"],
      [["trabajoprocesadocorrectamente"], "Trabajo procesado correctamente"]
    ];

    for (const [keys, label] of known) {
      if (keys.some((k) => key.includes(k))) return label;
    }

    return original
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
    return map[String(value || "").trim().toLowerCase()] || prettyMessage(value);
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

    for (const raw of rawLines) {
      const fixedRaw = repairText(raw).trim();
      if (!fixedRaw) continue;

      // PROGRESO: se parsea ANTES de embellecer el texto para no perder XPROCES_PROGRESS.
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

      const aligned = line.match(/C[aa]maras alineadas:\s*(.*)$/i) || line.match(/Camaras alineadas:\s*(.*)$/i);
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
    const title = parsed.progressMessage || job?.message || "Procesando proyecto";

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
      (parsed.fallbackCompletedStep ? `Ultimo proceso leido: ${parsed.fallbackCompletedStep}` : "") ||
      (String(job?.status || "").toLowerCase() === "done" || String(job?.status || "").toLowerCase() === "completed" ? "Control de calidad correcto" : "Procesando");

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
              <span class="xproces-live-chip">${esc(repairText(quality))}</span>
              <span class="xproces-live-chip">${esc(repairText(photos))}</span>
            </div>
            <h2 class="xproces-live-title" style="word-break:normal;overflow-wrap:anywhere;">${esc(repairText(title))}</h2>
            <div class="xproces-live-subtitle">${esc(repairText(projectName))} - Leyendo progreso desde el log real</div>
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
            <div class="xproces-live-metric-value">${esc(repairText(outputs))}</div>
          </div>
          <div class="xproces-live-metric">
            <div class="xproces-live-metric-label">Control de calidad</div>
            <div class="xproces-live-metric-value">${esc(repairText(detail))}</div>
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
                ${lastSteps.map((x) => `<div>${esc(repairText(x))}</div>`).join("")}
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  window.XProcesLogRenderer = { render, parseLog };
})();


    function cleanLiveStepText(item) {
      let text = String(item || "")
        .replace(/^\[[^\]]+\]\s*/g, "")
        .replace(/^Metashape\s+(stdout|stderr):\s*/i, "")
        .replace(/\s*\(\d+%\)\s*$/g, "")
        .replace(/Metashape/gi, "Xproces")
        .trim();

      if (!text) return "";

      // Ocultar nombres internos de presets/scripts
      if (/XPROCES_GUI_REPORT|METASHAPE_GUI_REPORT|STRICT_NO_FALLBACKS|GUI_STEP_BY_STEP/i.test(text)) {
        return "Configuración fotogramétrica aplicada";
      }

      // Estados limpios
      if (/^PROCESO OK/i.test(text) || /^Trabajo procesado correctamente/i.test(text)) {
        return "Trabajo procesado correctamente";
      }

      if (/Subiendo ZIP final|Subiendo resultado\.zip|Subiendo resultados/i.test(text)) {
        return "Subiendo resultados al servidor";
      }

      if (/Comprimiendo resultados|INICIO ZIP final|ZIP añadiendo/i.test(text)) {
        return "Preparando descarga final";
      }

      // Exportaciones limpias
      if (/^DSM\/DEM TIFF:\s*OK/i.test(text) || /^DSM:?\s*OK/i.test(text)) return "DSM generado correctamente";
      if (/^DTM TIFF:\s*OK/i.test(text) || /^DTM:?\s*OK/i.test(text)) return "DTM generado correctamente";
      if (/^Ortomosaico TIFF:\s*OK/i.test(text) || /^Ortofoto/i.test(text)) return "Ortofoto generada correctamente";
      if (/^LAS:\s*OK/i.test(text)) return "Nube LAS generada correctamente";
      if (/^Curvas DXF:\s*OK/i.test(text)) return "Curvas de nivel generadas correctamente";
      if (/^Curvas PRJ:\s*OK/i.test(text)) return "Archivo PRJ de curvas generado";
      if (/^PDF report:\s*OK/i.test(text)) return "Informe PDF generado correctamente";
      if (/^ZIP final:\s*OK/i.test(text)) return "Resultados preparados para descarga";

      // Mensajes de inicio/export con rutas
      text = text
        .replace(/INICIO exportación DSM\/DEM TIFF:.*$/i, "Exportando DSM")
        .replace(/INICIO exportación DTM TIFF:.*$/i, "Exportando DTM")
        .replace(/INICIO exportación Ortomosaico TIFF:.*$/i, "Exportando ortofoto")
        .replace(/INICIO exportación LAS:.*$/i, "Exportando nube LAS")
        .replace(/INICIO exportación PDF report:.*$/i, "Generando informe PDF")
        .replace(/INICIO exportación Curvas DXF.*$/i, "Exportando curvas de nivel");

      // Quitar rutas Windows y flechas
      text = text
        .replace(/\s*->\s*[A-Z]:\\.*$/i, "")
        .replace(/[A-Z]:\\[^\s]+/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      return text;
    }

