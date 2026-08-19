(function (root) {
  "use strict";

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function option(value, label) {
    const node = el("option", label);
    node.value = String(value);
    return node;
  }

  function replaceStatCards(container, stats) {
    if (!container) return;
    const values = [
      [stats.observations, "observaciones"],
      [stats.completed, "completadas"],
      [stats.pending, "pendientes"],
      [stats.evidenceCount, "evidencias"],
    ];
    container.replaceChildren(...values.map(([value, label]) => {
      const span = el("span");
      span.append(el("b", value), document.createTextNode(label));
      return span;
    }));
  }

  function replaceInsights(container, stats) {
    if (!container) return;
    const values = [
      [stats.observations, "Observaciones", "Inventario integrado · 100%"],
      [stats.completed, "Completadas", `${stats.completedPercent}% del inventario`],
      [stats.pending, "Pendientes", `${stats.pendingPercent}% del inventario`],
      [stats.evidenceCount, "Evidencias", "Archivos públicos disponibles"],
    ];
    container.replaceChildren(...values.map(([value, label, detail]) => {
      const article = el("article", undefined, "insight");
      article.append(el("strong", value), el("b", label), el("small", detail));
      return article;
    }));
  }

  function isSafeLegacyUrl(value) {
    if (typeof value !== "string") return false;
    try {
      const parsed = new URL(value, window.location.origin);
      return parsed.origin === window.location.origin && parsed.pathname.startsWith("/images/");
    } catch (_error) {
      return false;
    }
  }

  function createFinding(finding) {
    const details = el("details");
    details.dataset.status = finding.status === "completado" ? "completado" : "pendiente";
    details.dataset.ronda = String(finding.roundId || "");

    const summary = el("summary");
    const chips = el("span", undefined, "chips");
    const tags = Array.isArray(finding.tags) ? finding.tags : [];
    tags.forEach((tag) => chips.append(el("i", tag, `tag ${tag === "Diseño" ? "tag-d" : "tag-c"}`)));
    const completed = finding.status === "completado";
    chips.append(el("i", completed ? "Completado" : "Pendiente", completed ? "done" : "pending"));
    summary.append(el("b", finding.number), el("span", finding.title), chips);

    const detail = el("div", undefined, "detail");
    detail.append(el("small", finding.metaLine));
    const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
    const safeEvidence = evidence.filter((item) => isSafeLegacyUrl(item && item.url));
    if (safeEvidence.length) {
      const evidenceContainer = el("div", undefined, "evidence");
      safeEvidence.forEach((item, index) => {
        const link = el("a");
        link.href = item.url;
        const image = el("img");
        image.loading = "lazy";
        image.decoding = "async";
        image.src = item.url;
        image.alt = `Evidencia ${index + 1}`;
        link.append(image, el("span", item.filename));
        evidenceContainer.append(link);
      });
      detail.append(evidenceContainer);
    }
    details.append(summary, detail);
    return details;
  }

  function updateStaticCopy(stats, roundCount) {
    const description = `Inventario integral de ${roundCount} sesiones de pruebas: ${stats.observations} observaciones, ${stats.completed} completadas y ${stats.pending} pendientes, con ${stats.evidenceCount} evidencias públicas.`;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (descriptionMeta) descriptionMeta.content = description;
    if (ogDescription) ogDescription.content = description;

    const sourceDocumentCopy = document.querySelector('.docs-grid .doc:first-child small');
    if (sourceDocumentCopy) sourceDocumentCopy.textContent = `Documento fuente original de las ${roundCount} sesiones de pruebas.`;
    const inventoryCopy = document.querySelector('.docs-grid .doc:nth-child(3) small');
    if (inventoryCopy) inventoryCopy.textContent = `Las ${stats.observations} observaciones con estatus, categoría y etapa.`;
    const footerLast = document.querySelector('footer.site span:last-child');
    if (footerLast) footerLast.textContent = `${stats.observations} observaciones · ${stats.evidenceCount} evidencias públicas · Disponible sin conexión`;
  }

  function renderReport(data) {
    if (!data || !data.stats || !Array.isArray(data.rounds) || !Array.isArray(data.findings)) return false;
    const { stats, rounds, findings } = data;
    replaceStatCards(document.querySelector(".stats"), stats);
    replaceInsights(document.querySelector(".insight-grid"), stats);

    const range = document.querySelector(".insights-head small");
    if (range && rounds.length) {
      range.textContent = `${rounds[0].label}${rounds.length > 1 ? ` — ${rounds[rounds.length - 1].label}` : ""} · ${rounds.length} sesión${rounds.length === 1 ? "" : "es"}`;
    }

    const roundSelect = document.getElementById("f-ronda");
    if (roundSelect) roundSelect.replaceChildren(
      option("", `Todas las rondas (${stats.observations})`),
      ...rounds.map((round) => option(round.id, `${round.label} (${round.count})`)),
    );
    const statusSelect = document.getElementById("f-status");
    if (statusSelect) statusSelect.replaceChildren(
      option("", `Todos (${stats.observations})`),
      option("completado", `Completado (${stats.completed})`),
      option("pendiente", `Pendiente (${stats.pending})`),
    );

    const list = document.querySelector(".list");
    if (list) list.replaceChildren(...findings.map(createFinding));
    const count = document.querySelector(".count");
    if (count) {
      const shown = el("b", stats.observations);
      shown.id = "shown";
      count.replaceChildren(shown, document.createTextNode(` de ${stats.observations} hallazgos`));
    }
    updateStaticCopy(stats, rounds.length);
    return true;
  }

  async function init() {
    try {
      const response = await fetch("/api/public/report", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!renderReport(await response.json())) throw new Error("Invalid public report payload");
    } catch (error) {
      console.warn("[PUBLIC REPORT] Fetch/render failed, using static data:", error);
    }
    if (typeof root.initFindingsFilters === "function") root.initFindingsFilters();
  }

  root.PublicReportRuntime = { init, isSafeLegacyUrl, renderReport };
  if (!root.__PUBLIC_REPORT_DISABLE_AUTO_INIT__) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }
})(window);
