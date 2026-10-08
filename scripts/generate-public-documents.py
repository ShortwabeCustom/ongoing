#!/usr/bin/env python3
"""Regenerate the public consultation package from /api/public/report.

Runtime dependencies (kept outside the production Node.js dependency tree):
    pip install reportlab pypdf pillow

The script deliberately consumes only the public report endpoint. It never reads
private finding fields or connects directly to the production database.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import os
import re
import tempfile
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image as PILImage
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


GREEN = colors.HexColor("#00A85A")
DARK = colors.HexColor("#062C21")
INK = colors.HexColor("#17251F")
MUTED = colors.HexColor("#65766E")
PALE = colors.HexColor("#E8F3EC")
LINE = colors.HexColor("#D3E1D8")
WHITE = colors.white


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-url",
        default="http://127.0.0.1:3123/api/public/report",
        help="Public JSON endpoint used as the only data source.",
    )
    parser.add_argument(
        "--base-url",
        default="https://uix.productdesign.mx",
        help="Public origin used to expand evidence links.",
    )
    parser.add_argument(
        "--frozen-at",
        required=True,
        help="Snapshot date in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--output-dir",
        default="public/contenido",
        help="Directory containing the downloadable consultation package.",
    )
    parser.add_argument(
        "--existing-source-pdf",
        default="public/contenido/fuentes-originales/Pruebas Maria 2.0.pdf",
        help="Existing assembled source PDF whose original five pages are preserved.",
    )
    return parser.parse_args()


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def register_fonts(output_dir: Path) -> None:
    font_dir = output_dir / "componentes" / "fonts"
    pdfmetrics.registerFont(TTFont("Poppins", str(font_dir / "Poppins-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Poppins-Medium", str(font_dir / "Poppins-Medium.ttf")))
    pdfmetrics.registerFont(TTFont("Poppins-Bold", str(font_dir / "Poppins-Bold.ttf")))


def esc(value: Any) -> str:
    return (
        str(value if value is not None else "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def source_row(meta_line: str) -> int | None:
    match = re.search(r"\bFila\s+(\d+)\b", meta_line or "", flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def clean_public_text(value: Any) -> str:
    """Normalize source line endings and remove invisible trailing whitespace."""
    return "\n".join(line.rstrip() for line in str(value or "").splitlines()).strip()


def numeric_id(value: Any) -> int | str:
    text = str(value)
    return int(text) if text.isdigit() else text


def normalize_report(report: dict[str, Any], base_url: str) -> list[dict[str, Any]]:
    round_map = {
        item["id"]: {"label": item["label"], "order": index + 1}
        for index, item in enumerate(report["rounds"])
    }
    category_labels = {
        item["value"]: item["label"] for item in report.get("facets", {}).get("categories", [])
    }
    project_labels = {
        item["value"]: item["label"] for item in report.get("facets", {}).get("projects", [])
    }
    normalized: list[dict[str, Any]] = []
    for finding in report["findings"]:
        round_info = round_map.get(finding.get("roundId"), {"label": "Sin ronda", "order": 999})
        categories = finding.get("tags") or [
            category_labels.get(value, value) for value in finding.get("categories", [])
        ]
        evidence = [
            urllib.parse.urljoin(base_url.rstrip("/") + "/", item["url"].lstrip("/"))
            for item in finding.get("evidence", [])
        ]
        normalized.append(
            {
                "id": numeric_id(finding["number"]),
                "project": project_labels.get(finding.get("projectId"), "PWA 2.0"),
                "round": round_info["label"],
                "roundOrder": round_info["order"],
                "sourceRow": source_row(finding.get("metaLine", "")),
                "observation": clean_public_text(finding["title"]),
                "status": "Completado" if finding["status"] == "completado" else "Pendiente",
                "workflowStatus": finding.get("workflowStatus"),
                "categories": categories,
                "type": finding.get("findingType"),
                "channel": finding.get("channel"),
                "evidence": evidence,
                "evidenceFilenames": [item["filename"] for item in finding.get("evidence", [])],
            }
        )
    normalized.sort(key=lambda item: (item["roundOrder"], item["sourceRow"] or 999999, str(item["id"])))
    return normalized


def validate_snapshot(report: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, int]:
    derived = {
        "observations": len(rows),
        "completed": sum(row["status"] == "Completado" for row in rows),
        "pending": sum(row["status"] == "Pendiente" for row in rows),
        "evidenceFiles": sum(len(row["evidence"]) for row in rows),
        "rounds": len(report["rounds"]),
    }
    expected = report["stats"]
    comparisons = {
        "observations": expected["observations"],
        "completed": expected["completed"],
        "pending": expected["pending"],
        "evidenceFiles": expected["evidenceCount"],
    }
    for key, value in comparisons.items():
        if derived[key] != value:
            raise ValueError(f"Snapshot mismatch for {key}: derived={derived[key]} API={value}")
    return derived


def write_json_csv_manifest(
    output_dir: Path,
    rows: list[dict[str, Any]],
    stats: dict[str, int],
    frozen_at: str,
    source_url: str,
) -> None:
    json_path = output_dir / "inventario-observaciones.json"
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    csv_path = output_dir / "inventario-observaciones.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle, quoting=csv.QUOTE_ALL, lineterminator="\n")
        writer.writerow(
            [
                "ID",
                "Proyecto",
                "Ronda",
                "Fila fuente",
                "Observación",
                "Estatus",
                "Categoría",
                "Tipo",
                "Canal",
                "Evidencias",
                "URLs de evidencia",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row["id"],
                    row["project"],
                    row["round"],
                    row["sourceRow"] or "",
                    row["observation"],
                    row["status"],
                    " | ".join(row["categories"]),
                    row["type"] or "",
                    row["channel"] or "",
                    " | ".join(row["evidenceFilenames"]),
                    " | ".join(row["evidence"]),
                ]
            )

    manifest = {
        "name": "paquete-compartible-pruebas-maria-2",
        "project": "PWA 2.0",
        "frozenAt": frozen_at,
        **stats,
        "source": source_url,
        "schemaVersion": 2,
    }
    (output_dir / "MANIFIESTO.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    readme = f"""ARCHIVOS DE CONSULTA — PRUEBAS MARÍA 2.0

Corte: {frozen_at}
Proyecto publicado: PWA 2.0
Fuente única: {source_url}

Contenido del corte:
- {stats['observations']} observaciones
- {stats['completed']} completadas
- {stats['pending']} pendientes
- {stats['evidenceFiles']} evidencias públicas
- {stats['rounds']} rondas

Archivos:
- fuentes-originales/Pruebas Maria 2.0.pdf: documento fuente, cinco pantallas originales y registro actualizado.
- resumen-ejecutivo-con-pantallas-originales.pdf: síntesis ejecutiva, backlog integral y anexo original.
- inventario-observaciones.csv: inventario tabular compatible con hojas de cálculo.
- inventario-observaciones.json: inventario estructurado con enlaces públicos a evidencia.
- MANIFIESTO.json: fecha, alcance y cifras de control del corte.

Los documentos se generan únicamente con datos disponibles en /api/public/report.
No incluyen comentarios, storageKey ni rutas privadas de evidencia.
"""
    (output_dir / "LEEME.txt").write_text(readme, encoding="utf-8")


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Poppins-Bold",
            fontSize=30,
            leading=33,
            textColor=DARK,
            alignment=TA_LEFT,
            spaceAfter=10 * mm,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName="Poppins",
            fontSize=12,
            leading=18,
            textColor=MUTED,
            spaceAfter=7 * mm,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Poppins-Bold",
            fontSize=19,
            leading=23,
            textColor=DARK,
            spaceBefore=4 * mm,
            spaceAfter=4 * mm,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Poppins-Bold",
            fontSize=13,
            leading=16,
            textColor=DARK,
            spaceBefore=3 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Poppins",
            fontSize=8.5,
            leading=12,
            textColor=INK,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Poppins",
            fontSize=6.7,
            leading=9,
            textColor=MUTED,
        ),
        "table": ParagraphStyle(
            "Table",
            parent=base["BodyText"],
            fontName="Poppins",
            fontSize=6.2,
            leading=8.2,
            textColor=INK,
        ),
        "table_bold": ParagraphStyle(
            "TableBold",
            parent=base["BodyText"],
            fontName="Poppins-Bold",
            fontSize=6.2,
            leading=8.2,
            textColor=INK,
        ),
        "cover_kicker": ParagraphStyle(
            "CoverKicker",
            parent=base["Normal"],
            fontName="Poppins-Medium",
            fontSize=9,
            leading=12,
            textColor=GREEN,
            alignment=TA_CENTER,
            spaceAfter=8 * mm,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Title"],
            fontName="Poppins-Bold",
            fontSize=36,
            leading=39,
            textColor=DARK,
            alignment=TA_CENTER,
            spaceAfter=8 * mm,
        ),
        "cover_body": ParagraphStyle(
            "CoverBody",
            parent=base["Normal"],
            fontName="Poppins",
            fontSize=11,
            leading=17,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }


def footer(canvas: Any, doc: Any) -> None:
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.setFont("Poppins", 6.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9.5 * mm, "Pruebas María 2.0 · PWA 2.0")
    canvas.drawRightString(A4[0] - 18 * mm, 9.5 * mm, f"{doc.page}")
    canvas.restoreState()


def build_pdf(path: Path, story: list[Any], *, title: str) -> None:
    document = BaseDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title=title,
        author="UIX · Originación Única",
        subject="Corte público de Pruebas María 2.0",
    )
    frame = Frame(document.leftMargin, document.bottomMargin, document.width, document.height, id="main")
    document.addPageTemplates([PageTemplate(id="content", frames=[frame], onPage=footer)])
    document.build(story)


def stat_cards(stats: dict[str, int], styles: dict[str, ParagraphStyle]) -> Table:
    values = [
        (stats["observations"], "Observaciones"),
        (stats["completed"], "Completadas"),
        (stats["pending"], "Pendientes"),
        (stats["evidenceFiles"], "Evidencias"),
    ]
    cells = []
    for value, label in values:
        cells.append(
            Paragraph(
                f'<font name="Poppins-Bold" size="22" color="#062C21">{value}</font><br/>'
                f'<font name="Poppins" size="7" color="#65766E">{label}</font>',
                styles["body"],
            )
        )
    table = Table([cells], colWidths=[document_width() / 4] * 4, rowHeights=[27 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    return table


def document_width() -> float:
    return A4[0] - 36 * mm


def cover_story(
    title: str,
    subtitle: str,
    stats: dict[str, int],
    frozen_label: str,
    styles: dict[str, ParagraphStyle],
) -> list[Any]:
    return [
        Spacer(1, 38 * mm),
        Paragraph(f"CORTE {esc(frozen_label).upper()} · PWA 2.0", styles["cover_kicker"]),
        Paragraph(esc(title), styles["cover_title"]),
        Paragraph(esc(subtitle), styles["cover_body"]),
        Spacer(1, 18 * mm),
        stat_cards(stats, styles),
        Spacer(1, 54 * mm),
        Paragraph(
            "Generado exclusivamente desde el registro público vigente. "
            "No contiene comentarios ni referencias privadas de almacenamiento.",
            styles["cover_body"],
        ),
    ]


def table_header(labels: list[str], styles: dict[str, ParagraphStyle]) -> list[Paragraph]:
    return [Paragraph(esc(label), styles["table_bold"]) for label in labels]


def build_summary_story(
    report: dict[str, Any],
    rows: list[dict[str, Any]],
    stats: dict[str, int],
    frozen_label: str,
    styles: dict[str, ParagraphStyle],
) -> list[Any]:
    story = cover_story(
        "Del hallazgo a la acción.",
        "Resumen ejecutivo del registro público, con backlog integral y las cinco pantallas originales.",
        stats,
        frozen_label,
        styles,
    )
    story.extend([PageBreak(), Paragraph("Lectura ejecutiva", styles["title"])])
    completed_pct = round(stats["completed"] * 100 / stats["observations"]) if stats["observations"] else 0
    story.append(
        Paragraph(
            f'<font name="Poppins-Bold" size="24" color="#00A85A">{stats["completed"]}</font> de '
            f'<font name="Poppins-Bold" size="24">{stats["observations"]}</font> observaciones están completadas '
            f'({completed_pct}%). El backlog vigente conserva {stats["pending"]} pendientes y '
            f'{stats["evidenceFiles"]} archivos de evidencia publicados.',
            styles["subtitle"],
        )
    )
    story.append(stat_cards(stats, styles))
    story.extend([Spacer(1, 7 * mm), Paragraph("Avance por ronda", styles["h1"])])
    by_round: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_round[row["round"]].append(row)
    round_rows = [table_header(["Ronda", "Total", "Completadas", "Pendientes", "Avance"], styles)]
    for round_item in report["rounds"]:
        group = by_round[round_item["label"]]
        done = sum(item["status"] == "Completado" for item in group)
        total = len(group)
        round_rows.append(
            [
                Paragraph(esc(round_item["label"]), styles["table"]),
                str(total),
                str(done),
                str(total - done),
                f"{round(done * 100 / total) if total else 0}%",
            ]
        )
    round_table = Table(round_rows, repeatRows=1, colWidths=[88 * mm, 18 * mm, 25 * mm, 22 * mm, 20 * mm])
    round_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONT", (1, 1), (-1, -1), "Poppins", 6.5),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F6F9F7")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.extend([round_table, PageBreak(), Paragraph("Backlog integral", styles["title"])])
    story.append(
        Paragraph(
            f'{stats["observations"]} observaciones públicas, agrupadas en {stats["rounds"]} rondas. '
            "Los enlaces completos de evidencia se incluyen en los inventarios CSV y JSON.",
            styles["subtitle"],
        )
    )
    backlog = [table_header(["ID / fuente", "Observación", "Categoría", "Estado", "Evid."], styles)]
    for row in rows:
        source = f'{row["id"]}<br/><font color="#65766E">{esc(row["round"])}'
        if row["sourceRow"]:
            source += f' · fila {row["sourceRow"]}'
        source += "</font>"
        backlog.append(
            [
                Paragraph(source, styles["table_bold"]),
                Paragraph(esc(row["observation"]), styles["table"]),
                Paragraph(esc(", ".join(row["categories"]) or "—"), styles["table"]),
                Paragraph(row["status"], styles["table_bold"]),
                str(len(row["evidence"])),
            ]
        )
    backlog_table = Table(
        backlog,
        repeatRows=1,
        colWidths=[34 * mm, 84 * mm, 27 * mm, 23 * mm, 10 * mm],
        splitByRow=1,
    )
    backlog_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("GRID", (0, 0), (-1, -1), 0.3, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (-1, 1), (-1, -1), "CENTER"),
                ("FONT", (-1, 1), (-1, -1), "Poppins", 6.3),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F6F9F7")]),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]
        )
    )
    story.extend(
        [
            backlog_table,
            PageBreak(),
            Spacer(1, 55 * mm),
            Paragraph("Anexo original", styles["cover_title"]),
            Paragraph(
                "Las cinco páginas siguientes provienen del documento fuente y se anexan sin modificar su contenido, tamaño o composición.",
                styles["cover_body"],
            ),
        ]
    )
    return story


def download_thumbnail(url: str, output: Path) -> tuple[str, str | None]:
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "UIX-public-doc-generator/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()
        with PILImage.open(io.BytesIO(payload)) as image:
            image = image.convert("RGB")
            image.thumbnail((520, 360))
            canvas = PILImage.new("RGB", (520, 360), "white")
            x = (canvas.width - image.width) // 2
            y = (canvas.height - image.height) // 2
            canvas.paste(image, (x, y))
            canvas.save(output, "JPEG", quality=72, optimize=True)
        return url, None
    except Exception as exc:  # noqa: BLE001 - failures are reported and rendered as text.
        return url, f"{type(exc).__name__}: {exc}"


def download_thumbnails(rows: list[dict[str, Any]], directory: Path) -> tuple[dict[str, Path], list[str]]:
    urls = sorted({url for row in rows for url in row["evidence"]})
    mapping: dict[str, Path] = {}
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {}
        for url in urls:
            digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:20]
            output = directory / f"{digest}.jpg"
            mapping[url] = output
            futures[pool.submit(download_thumbnail, url, output)] = url
        for future in as_completed(futures):
            url, error = future.result()
            if error:
                errors.append(f"{url}: {error}")
                mapping.pop(url, None)
    return mapping, errors


def thumbnail_flowable(path: Path) -> Image:
    return Image(str(path), width=42 * mm, height=29 * mm)


def build_registry_story(
    report: dict[str, Any],
    rows: list[dict[str, Any]],
    thumbnails: dict[str, Path],
    styles: dict[str, ParagraphStyle],
) -> list[Any]:
    story: list[Any] = [
        Paragraph("Registro actualizado", styles["title"]),
        Paragraph(
            "Inventario público agrupado por ronda. Cada ficha conserva el estado vigente, la clasificación disponible y una vista previa de la evidencia publicada.",
            styles["subtitle"],
        ),
    ]
    by_round: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_round[row["round"]].append(row)
    for round_index, round_item in enumerate(report["rounds"]):
        if round_index:
            story.append(PageBreak())
        group = by_round[round_item["label"]]
        story.append(Paragraph(f'{esc(round_item["label"])} · {len(group)} observaciones', styles["h1"]))
        for row in group:
            meta_parts = [row["status"]]
            if row["categories"]:
                meta_parts.append(", ".join(row["categories"]))
            if row["sourceRow"]:
                meta_parts.append(f'Fila {row["sourceRow"]}')
            title = Paragraph(
                f'<font name="Poppins-Bold">{esc(row["id"])}</font> · {esc(row["observation"])}',
                styles["body"],
            )
            meta = Paragraph(" · ".join(esc(part) for part in meta_parts), styles["small"])
            left = [title, Spacer(1, 2 * mm), meta]
            preview_items: list[Any] = []
            for url, filename in zip(row["evidence"][:3], row["evidenceFilenames"][:3]):
                if url in thumbnails:
                    preview_items.append(thumbnail_flowable(thumbnails[url]))
                else:
                    preview_items.append(Paragraph(esc(filename), styles["small"]))
            if not preview_items:
                preview_items = [Paragraph("Sin evidencia publicada", styles["small"])]
            evidence_table = Table([preview_items], colWidths=[44 * mm] * len(preview_items))
            evidence_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
            block = Table(
                [[left, evidence_table]],
                colWidths=[document_width() - min(3, len(preview_items)) * 44 * mm, min(3, len(preview_items)) * 44 * mm],
            )
            block.setStyle(
                TableStyle(
                    [
                        ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#F6F9F7")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 7),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.extend([KeepTogether(block), Spacer(1, 2.5 * mm)])
    return story


def merge_pdf(
    output: Path,
    generated_parts: list[Path],
    original_reader: PdfReader,
    original_page_indexes: range,
    *,
    original_after_part: int,
    metadata: dict[str, str],
) -> None:
    writer = PdfWriter()
    for part_index, part in enumerate(generated_parts):
        reader = PdfReader(str(part))
        for page in reader.pages:
            writer.add_page(page)
        if part_index == original_after_part:
            for page_index in original_page_indexes:
                writer.add_page(original_reader.pages[page_index])
    writer.add_metadata(metadata)
    temporary = output.with_suffix(output.suffix + ".tmp")
    with temporary.open("wb") as handle:
        writer.write(handle)
    os.replace(temporary, output)


def build_pdfs(
    output_dir: Path,
    existing_source_pdf: Path,
    report: dict[str, Any],
    rows: list[dict[str, Any]],
    stats: dict[str, int],
    frozen_label: str,
) -> list[str]:
    styles = make_styles()
    source_bytes = io.BytesIO(existing_source_pdf.read_bytes())
    original_reader = PdfReader(source_bytes)
    if len(original_reader.pages) < 6:
        raise ValueError("The existing source PDF does not contain the five original pages.")
    with tempfile.TemporaryDirectory(prefix="uix-public-docs-") as temp_name:
        temp_dir = Path(temp_name)
        thumbnails, errors = download_thumbnails(rows, temp_dir)

        summary_main = temp_dir / "summary-main.pdf"
        build_pdf(
            summary_main,
            build_summary_story(report, rows, stats, frozen_label, styles),
            title="Pruebas María 2.0 - Resumen ejecutivo",
        )
        summary_output = output_dir / "resumen-ejecutivo-con-pantallas-originales.pdf"
        merge_pdf(
            summary_output,
            [summary_main],
            original_reader,
            range(1, 6),
            original_after_part=0,
            metadata={
                "/Title": "Pruebas María 2.0 - Resumen ejecutivo",
                "/Author": "UIX · Originación Única",
                "/Subject": f"Corte {frozen_label} · PWA 2.0",
            },
        )

        source_cover = temp_dir / "source-cover.pdf"
        source_registry = temp_dir / "source-registry.pdf"
        build_pdf(
            source_cover,
            cover_story(
                "Pruebas María 2.0",
                "Documento fuente: cinco pantallas originales y registro público actualizado con evidencia.",
                stats,
                frozen_label,
                styles,
            ),
            title="Pruebas María 2.0 - Documento fuente",
        )
        build_pdf(
            source_registry,
            build_registry_story(report, rows, thumbnails, styles),
            title="Pruebas María 2.0 - Registro actualizado",
        )
        source_output = output_dir / "fuentes-originales" / "Pruebas Maria 2.0.pdf"
        merge_pdf(
            source_output,
            [source_cover, source_registry],
            original_reader,
            range(1, 6),
            original_after_part=0,
            metadata={
                "/Title": "Pruebas María 2.0 - Documento fuente",
                "/Author": "UIX · Originación Única",
                "/Subject": f"Corte {frozen_label} · PWA 2.0",
            },
        )
        return errors


def static_findings_html(report: dict[str, Any]) -> str:
    blocks: list[str] = []
    for finding in report["findings"]:
        status_class = "done" if finding["status"] == "completado" else "pending"
        status_text = "Completado" if finding["status"] == "completado" else "Pendiente"
        chips = "".join(
            f'<i class="tag {"tag-d" if tag == "Diseño" else "tag-c"}">{html.escape(tag)}</i>'
            for tag in finding.get("tags", [])
        )
        evidence = ""
        if finding.get("evidence"):
            evidence_items = "".join(
                f'<a href="{html.escape(item["url"], quote=True)}">'
                f'<img loading="lazy" decoding="async" src="{html.escape(item["url"], quote=True)}" '
                f'alt="Evidencia {index + 1}"><span>{html.escape(item["filename"])}</span></a>'
                for index, item in enumerate(finding["evidence"])
            )
            evidence = f'<div class="evidence">{evidence_items}</div>'
        blocks.append(
            f'<details data-status="{html.escape(finding["status"], quote=True)}" '
            f'data-ronda="{html.escape(finding["roundId"], quote=True)}" '
            f'data-cat="{html.escape(" ".join(finding.get("categories", [])), quote=True)}" '
            f'data-tipo="{html.escape(finding.get("findingType") or "", quote=True)}" '
            f'data-canal="{html.escape(finding.get("channel") or "", quote=True)}" '
            f'data-project="{html.escape(finding.get("projectId") or "", quote=True)}">\n'
            f'  <summary><b>{html.escape(str(finding["number"]))}</b>'
            f'<span>{html.escape(clean_public_text(finding["title"]))}</span><span class="chips">{chips}'
            f'<i class="{status_class}">{status_text}</i></span></summary>\n'
            f'  <div class="detail"><small>{html.escape(clean_public_text(finding.get("metaLine", "")))}</small>\n'
            f'  {evidence}</div>\n</details>'
        )
    return "\n".join(blocks)


def replace_once(source: str, pattern: str, replacement: str, label: str, *, flags: int = 0) -> str:
    result, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count != 1:
        raise ValueError(f"Unable to update {label}; expected one match, found {count}.")
    return result


def update_public_shell(
    project_root: Path,
    report: dict[str, Any],
    stats: dict[str, int],
    frozen_at: str,
) -> None:
    app_path = project_root / "public" / "app.html"
    app = app_path.read_text(encoding="utf-8")
    frozen_label = spanish_date(frozen_at)
    cache_version = frozen_at.replace("-", "")
    description = (
        f'Inventario público de PWA 2.0: {stats["observations"]} observaciones, '
        f'{stats["completed"]} completadas, {stats["pending"]} pendientes y '
        f'{stats["evidenceFiles"]} evidencias en {stats["rounds"]} rondas.'
    )
    app = replace_once(
        app,
        r'<meta name="description" content="[^"]*">',
        f'<meta name="description" content="{description}">',
        "HTML description",
    )
    app = replace_once(
        app,
        r'<meta property="og:description" content="[^"]*">',
        f'<meta property="og:description" content="{description}">',
        "Open Graph description",
    )
    app = replace_once(app, r'\.hero:after\{content:"\d+"', f'.hero:after{{content:"{stats["rounds"]:02d}"', "hero round marker")
    app = replace_once(
        app,
        r'(<span class="doc-meta"><a class="doc-link" href="#documentos">Documentos</a> · )[^<]+(</span>)',
        rf'\g<1>{frozen_label}\g<2>',
        "document snapshot date",
    )
    app = replace_once(
        app,
        r'(<section class="hero" id="portada">.*?<p>).*?(</p></section>)',
        rf'\g<1>Inventario público de PWA 2.0 en {stats["rounds"]} rondas, listo para consulta y presentación sin conexión.\g<2>',
        "hero summary",
        flags=re.DOTALL,
    )
    first_round = report["rounds"][0]["label"]
    last_round = report["rounds"][-1]["label"]
    app = replace_once(
        app,
        r'(<div class="insights-head">.*?<small>).*?(</small></div><div class="insight-grid">)',
        rf'\g<1>{html.escape(first_round)} — {html.escape(last_round)} · {stats["rounds"]} rondas\g<2>',
        "static round range",
        flags=re.DOTALL,
    )
    static_insights = (
        '<div class="insight-grid">'
        f'<article class="insight"><strong>{stats["observations"]}</strong><b>Observaciones</b><small>Inventario integrado · 100%</small></article>'
        f'<article class="insight"><strong>{stats["completed"]}</strong><b>Completadas</b><small>{round(stats["completed"] * 100 / stats["observations"])}% del inventario</small></article>'
        f'<article class="insight"><strong>{stats["pending"]}</strong><b>Pendientes</b><small>{round(stats["pending"] * 100 / stats["observations"])}% del inventario</small></article>'
        f'<article class="insight"><strong>{stats["evidenceFiles"]}</strong><b>Evidencias</b><small>Archivos disponibles</small></article>'
        '</div></section><section class="ps"'
    )
    app = replace_once(
        app,
        r'<div class="insight-grid">.*?</div></section><section class="ps"',
        static_insights,
        "static insight cards",
        flags=re.DOTALL,
    )
    round_options = '<option value="">Todas las rondas</option>' + "".join(
        f'<option value="{html.escape(item["id"], quote=True)}">{html.escape(item["label"])}</option>'
        for item in report["rounds"]
    )
    app = replace_once(
        app,
        r'(<select id="f-ronda">).*?(</select>)',
        rf'\g<1>{round_options}\g<2>',
        "static round filter",
        flags=re.DOTALL,
    )
    app = replace_once(
        app,
        r'<p class="count" role="status" aria-live="polite"><b id="shown">\d+</b> de \d+ hallazgos</p>',
        f'<p class="count" role="status" aria-live="polite"><b id="shown">{stats["observations"]}</b> de {stats["observations"]} hallazgos</p>',
        "static finding count",
    )
    app = replace_once(
        app,
        r'(<main class="list">).*?(</main><p class="empty")',
        rf'\g<1>\n{static_findings_html(report)}\g<2>',
        "static finding inventory",
        flags=re.DOTALL,
    )
    document_cards = (
        f'<a class="doc" href="/contenido/fuentes-originales/Pruebas%20Maria%202.0.pdf?v={cache_version}" target="_blank" rel="noopener"><b>Pruebas María 2.0</b><small>Documento fuente: cinco pantallas originales y registro de PWA 2.0 actualizado al {frozen_label}.</small><span>PDF</span></a>\n'
        f'<a class="doc" href="/contenido/resumen-ejecutivo-con-pantallas-originales.pdf?v={cache_version}" target="_blank" rel="noopener"><b>Resumen ejecutivo</b><small>Síntesis del corte vigente, backlog integral y anexo con las pantallas originales.</small><span>PDF</span></a>\n'
        f'<a class="doc" href="/contenido/inventario-observaciones.csv?v={cache_version}" download><b>Inventario de observaciones</b><small>{stats["observations"]} observaciones con proyecto, ronda, estatus, categoría y evidencia pública.</small><span>CSV</span></a>\n'
        f'<a class="doc" href="/contenido/inventario-observaciones.json?v={cache_version}" download><b>Inventario estructurado</b><small>Mismo corte en formato legible por máquina, con enlaces públicos a la evidencia.</small><span>JSON</span></a>\n'
        f'<a class="doc" href="/contenido/MANIFIESTO.json?v={cache_version}" download><b>Manifiesto del paquete</b><small>Fecha y cifras de control del corte: observaciones, estatus, rondas y evidencias.</small><span>JSON</span></a>'
    )
    app = replace_once(
        app,
        r'(<div class="docs-grid">).*?(</div></div></section>)',
        rf'\g<1>\n{document_cards}\n\g<2>',
        "document cards",
        flags=re.DOTALL,
    )
    app = replace_once(
        app,
        r'<footer class="site">.*?</footer>',
        f'<footer class="site"><span>Originación Única · Pruebas María 2.0 · Corte {frozen_label}</span><span>{stats["observations"]} observaciones · {stats["evidenceFiles"]} evidencias · Disponible sin conexión</span></footer>',
        "document footer",
        flags=re.DOTALL,
    )
    app_path.write_text(app, encoding="utf-8")

    manifest_path = project_root / "public" / "manifest.webmanifest"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["description"] = description
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    worker_path = project_root / "public" / "sw.js"
    worker = worker_path.read_text(encoding="utf-8")
    worker = re.sub(r'pruebas-maria-shell-v[^"\s]+', f'pruebas-maria-shell-v{cache_version}', worker, count=1)
    worker = re.sub(r'pruebas-maria-assets-v[^"\s]+', f'pruebas-maria-assets-v{cache_version}', worker, count=1)
    worker_path.write_text(worker, encoding="utf-8")


def spanish_date(iso_date: str) -> str:
    value = datetime.strptime(iso_date, "%Y-%m-%d")
    months = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
    ]
    return f"{value.day} de {months[value.month - 1]} de {value.year}"


def main() -> None:
    args = parse_args()
    datetime.strptime(args.frozen_at, "%Y-%m-%d")
    output_dir = Path(args.output_dir).resolve()
    existing_source_pdf = Path(args.existing_source_pdf).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "fuentes-originales").mkdir(parents=True, exist_ok=True)
    register_fonts(output_dir)

    report = fetch_json(args.source_url)
    rows = normalize_report(report, args.base_url)
    stats = validate_snapshot(report, rows)
    write_json_csv_manifest(output_dir, rows, stats, args.frozen_at, "/api/public/report")
    errors = build_pdfs(
        output_dir,
        existing_source_pdf,
        report,
        rows,
        stats,
        spanish_date(args.frozen_at),
    )
    update_public_shell(Path.cwd(), report, stats, args.frozen_at)
    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "frozenAt": args.frozen_at,
        **stats,
        "thumbnailErrors": len(errors),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        print("Evidence preview errors:")
        for error in errors:
            print(f"- {error}")


if __name__ == "__main__":
    main()
