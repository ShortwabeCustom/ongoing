# -*- coding: utf-8 -*-
"""Inserta el logo en el header fijo y los chips Diseño/Copy en cada hallazgo."""
import io
import json
import re

HTML = "public/app.html"
MAP = "public/contenido/clasificacion-diseno-copy.json"

h = io.open(HTML, encoding="utf-8").read()
tags = json.load(open(MAP, encoding="utf-8"))

# ---------------------------------------------------------------- 1. estilos
css = """
/* ---- Logo en el header ---- */
nav .brand{display:flex;align-items:center;gap:11px;min-width:0}
nav .brand img{height:22px;width:auto;flex:none;display:block}
nav .brand b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:620px){
  nav .brand img{height:18px}
  nav .brand b{font-size:10px;white-space:normal}
}
/* ---- Chips de eje: Diseño / Copy ---- */
summary{grid-template-columns:54px 1fr auto}
.chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.tag{font-style:normal;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;padding:4px 9px;border-radius:99px;white-space:nowrap}
.tag-d{background:#10553d;color:#fff}
.tag-c{background:transparent;color:#10553d;box-shadow:inset 0 0 0 1px #10553d}
@media(max-width:700px){
  summary{grid-template-columns:40px 1fr;gap:10px 12px;padding:16px}
  .chips{grid-column:1/-1;justify-content:flex-start}
}
"""
h = h.replace("/* ---- Horarios de las pr\u00f3ximas pruebas ---- */", css + "/* ---- Horarios de las pr\u00f3ximas pruebas ---- */", 1)

# ------------------------------------------------------------------ 2. logo
old_nav = '<nav><b>Originaci\u00f3n \u00danica \u00b7 Reporte ejecutivo</b>'
new_nav = ('<nav><span class="brand">'
           '<img src="/images/uix-logo.png" alt="uix" width="62" height="22">'
           '<b>Originaci\u00f3n \u00danica \u00b7 Reporte ejecutivo</b></span>')
assert h.count(old_nav) == 1, "nav no encontrado"
h = h.replace(old_nav, new_nav, 1)

# ------------------------------------------------------------------ 3. chips
LABEL = {"Dise\u00f1o": "tag-d", "Copy": "tag-c"}
stats = {"Dise\u00f1o": 0, "Copy": 0, "Ambos": 0, "none": 0}


# Reescritura de: <b>NNN</b><span>título</span><i class="done|pending">…</i></summary>
pattern = re.compile(
    r'<b>(\d{3})</b>(<span>.*?</span>)(<i class="(?:done|pending)">[^<]*</i>)</summary>',
    re.S,
)


def repl2(m):
    num, title, status = m.group(1), m.group(2), m.group(3)
    axes = tags.get(str(int(num)), [])

    if len(axes) == 2:
        stats["Ambos"] += 1
    elif axes:
        stats[axes[0]] += 1
    else:
        stats["none"] += 1

    chips = "".join(f'<i class="tag {LABEL[a]}">{a}</i>' for a in axes)
    return f'<b>{num}</b>{title}<span class="chips">{chips}{status}</span></summary>'


h, n = pattern.subn(repl2, h)

io.open(HTML, "w", encoding="utf-8").write(h)

print("hallazgos con chips inyectados:", n)
print("  sólo Dise\u00f1o :", stats["Dise\u00f1o"])
print("  s\u00f3lo Copy   :", stats["Copy"])
print("  ambos       :", stats["Ambos"])
print("  sin eje     :", stats["none"])
print("logo en nav :", h.count('/images/uix-logo.png'))
