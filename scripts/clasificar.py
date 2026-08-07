# -*- coding: utf-8 -*-
"""
Clasifica cada observación del inventario en dos ejes no exclusivos:
Diseño (forma visual) y Copy (contenido textual). Un hallazgo puede ser
Diseño, Copy o ambos. Los que no muestran señales de ninguno (típicamente
backend o reglas de negocio) se quedan sin chip en lugar de etiquetarse mal.
"""
import csv
import json
import re
import unicodedata
from collections import Counter

CSV = "public/contenido/inventario-observaciones.csv"
OUT = "public/contenido/clasificacion-diseno-copy.json"


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


# Señales de forma visual: medidas, color, tipografía como objeto de estilo, layout.
DISENO = [
    r"\bcolor(es)?\b", r"hexadecimal", r"#[0-9a-f]{6}\b", r"degrad", r"gradient",
    r"\bpadding", r"\bmargen", r"\bmargin", r"\bgap\b", r"espaciad", r"\bpt\b",
    r"\bpts\b", r"\bpx\b", r"\brem(s)?\b", r"tipografi", r"font", r"\bsora\b",
    r"satoshi", r"\bbody\s?[12]\b", r"\bdisplay\b", r"\bh[1-6]\b", r"interlineado",
    r"\bleading\b", r"\bshadow", r"\bsombra", r"\bstroke\b", r"\bborde", r"\bradio\b",
    r"\bblur\b", r"\bopacidad", r"contraste", r"aline", r"centrar", r"\btamano",
    r"proporcion", r"\bancho\b", r"\balto\b", r"\baltura\b", r"\bicono", r"\bimagen",
    r"\blogo\b", r"subrayad", r"negrit", r"\bbold\b", r"\bregular\b",
    r"\bchip\b", r"\bcard\b", r"\bbutton\b", r"\bboton", r"componente",
    r"\blayout\b", r"\bgrid\b", r"\bcolumna", r"\bmascara", r"mascar", r"\bfondo\b",
    r"\bestilo", r"\bvisual", r"\bpantalla\s+se\s+ve", r"\bdesfasad", r"\bcortad",
    r"\bencimad", r"\bsalto de (parrafo|linea)", r"\bordenar\b", r"\bposicion",
    r"\bverde\b", r"\bslider\b", r"\bselector\b", r"\bcheck\b", r"\bhover\b",
]

# Señales de contenido textual. Deliberadamente NO incluye referencias
# estructurales como "título", "label" o "subtítulo": nombrar el elemento que
# contiene texto no convierte el hallazgo en un ajuste de redacción — "gap
# entre título y subtítulo de 12 px" es puramente de diseño.
COPY = [
    r"\bcopy\b", r"redacci", r"\bpunto final\b", r"\bacento", r"\btilde",
    r"ortograf", r"\bpalabra", r"\bsingular\b", r"\bplural\b", r"\bheadline\b",
    r"\bsubhead\b", r"\bdebe decir\b", r"\bdice\b", r"\bdecir\b", r"\bleyenda\b",
    r"\btono y voz\b", r"\bcoma\b", r"\bcomunica", r"\bquitar la s\b",
    r"\bwording\b", r"mayuscul", r"minuscul", r"\bortografia\b", r"capitaliz",
    r"\bsustituy", r"\bpunto, no coma\b", r"\bacronimo\b",
    r"\b(ajuste|ajustar|cambiar|cambio|nuevo|este|el) (de )?(copy|texto)\b",
    r"\btextos?\b(?=[^.]*\b(dice|debe|cambi|ajust|elimin|reemplaz|agreg|nuevo)\b)",
    r"\bse (elimino|reemplazo|adapto|ajusto)\b",
]

DISENO_RX = [re.compile(p) for p in DISENO]
COPY_RX = [re.compile(p) for p in COPY]


def hits(rx_list, text):
    return [rx.pattern for rx in rx_list if rx.search(text)]


def classify(row):
    text = norm(" ".join([row["Observación"], row.get("Ajuste", ""), row.get("Comentarios", "")]))
    area = row["Área"]

    d_hits = hits(DISENO_RX, text)
    c_hits = hits(COPY_RX, text)

    # El área de la fuente actúa como respaldo, no como veredicto: varias
    # reescrituras de redacción están archivadas como "UI" y varios ajustes de
    # medida como "Copy". Si el texto sólo muestra señales del eje contrario,
    # el texto manda sobre el área.
    diseno = bool(d_hits) or (area == "UI" and not c_hits)
    copy = bool(c_hits) or (area == "Copy" and not d_hits)

    return diseno, copy, d_hits, c_hits


def main():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8-sig")))
    out = {}
    tally = Counter()
    by_area = Counter()

    for r in rows:
        d, c, dh, ch = classify(r)
        tags = []
        if d:
            tags.append("Diseño")
        if c:
            tags.append("Copy")
        label = "Ambos" if len(tags) == 2 else (tags[0] if tags else "Sin clasificar")
        out[r["ID"]] = tags
        tally[label] += 1
        by_area[(r["Área"], label)] += 1

    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print("total", len(rows))
    for k, v in tally.most_common():
        print(f"  {k:14} {v}")
    print("\npor área:")
    for (a, l), v in sorted(by_area.items()):
        print(f"  {a:14} {l:14} {v}")

    print("\n--- muestras sin clasificar ---")
    n = 0
    for r in rows:
        if out[r["ID"]] == [] and n < 12:
            print("  ", r["Área"], "|", r["Observación"][:110].replace("\n", " "))
            n += 1

    print("\n--- muestras Ambos ---")
    n = 0
    for r in rows:
        if len(out[r["ID"]]) == 2 and n < 10:
            print("  ", r["Área"], "|", r["Observación"][:110].replace("\n", " "))
            n += 1


if __name__ == "__main__":
    main()
