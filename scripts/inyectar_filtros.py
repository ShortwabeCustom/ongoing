# -*- coding: utf-8 -*-
"""
Añade a la sección de hallazgos:
  1. data-status y data-ronda en cada <details> (leídos del propio HTML).
  2. Un filtro por estatus y otro por ronda de pruebas.
  3. Contraste garantizado en los botones de Expandir/Contraer en todos los estados.
"""
import io
import re
import collections

HTML = "public/app.html"
h = io.open(HTML, encoding="utf-8").read()

# --------------------------------------------------- 1. etiquetar cada hallazgo
# Las rondas se declaran en el <small> de cada detalle: "Pruebas 30 de julio · Fila 2 · …"
# El estatus vive en el chip <i class="done|pending">.
RONDAS = [
    ("Pruebas 30 de julio", "30-jul", "30 de julio"),
    ("Mod 31 Jul", "31-jul", "Modificaciones 31 de julio"),
    ("Pruebas 3 agosto", "03-ago", "3 de agosto"),
    ("Pruebas 4 - 5 agosto", "04-ago", "4 y 5 de agosto"),
]

stats_r = collections.Counter()
stats_s = collections.Counter()

# Cada hallazgo: <details> … <i class="done|pending"> … <small>RONDA · …
bloque = re.compile(r'<details>(.*?)</details>', re.S)


def etiquetar(m):
    cuerpo = m.group(1)

    estatus = "completado" if '<i class="done"' in cuerpo else "pendiente"

    slug = ""
    small = re.search(r"<small>([^<·]+)", cuerpo)
    if small:
        texto = small.group(1).strip()
        for fuente, s, _ in RONDAS:
            if texto.startswith(fuente):
                slug = s
                break

    stats_s[estatus] += 1
    stats_r[slug or "SIN RONDA"] += 1

    return f'<details data-status="{estatus}" data-ronda="{slug}">{cuerpo}</details>'


h, n = bloque.subn(etiquetar, h)

# ------------------------------------------------------------------ 2. estilos
css = """
/* ---- Filtros de hallazgos ---- */
.filters{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;max-width:1200px;margin:0 auto 18px}
.field{display:flex;flex-direction:column;gap:6px;min-width:0}
.field label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:#4b5f56}
.field select{appearance:none;-webkit-appearance:none;background:#fff no-repeat right 12px center;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' fill='none' stroke='%2310553d' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");border:1px solid #9fb3a7;color:var(--d);font:600 12px Poppins,Arial,sans-serif;padding:11px 36px 11px 14px;border-radius:12px;cursor:pointer;min-height:44px;max-width:100%}
.field select:focus-visible{outline:2px solid var(--g);outline-offset:2px;border-color:var(--d)}
.filters .count{margin-left:auto;font-size:11px;color:#4b5f56;padding-bottom:12px;white-space:nowrap}
.filters .count b{color:var(--d);font-size:14px}
#reset{align-self:flex-end}
details[hidden]{display:none}
.empty{max-width:1200px;margin:auto;padding:44px 22px;text-align:center;border:1px dashed #9fb3a7;background:rgba(255,255,255,.6);color:#4b5f56;font-size:13px}
.empty[hidden]{display:none}

/* ---- Contraste fijo en los botones de la cabecera ---- */
/* El color se declara en cada estado, nunca heredado: as\u00ed el texto mantiene
   contraste tanto sobre el fondo blanco como sobre el verde oscuro. */
.controls button,#reset{border:1px solid #9fb3a7;background:#fff;color:var(--d);padding:12px 15px;border-radius:22px;font:600 9px Poppins,Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;cursor:pointer;min-height:44px}
/* Sólo en dispositivos con puntero real: en pantallas t\u00e1ctiles el :hover se
   queda pegado tras el toque y dejar\u00eda el bot\u00f3n en su estado invertido. */
@media(hover:hover){
  .controls button:hover,#reset:hover{background:var(--d);border-color:var(--d);color:#fff}
}
.controls button:focus-visible,#reset:focus-visible{outline:2px solid var(--g);outline-offset:2px;background:#fff;color:var(--d)}
.controls button:active,#reset:active{background:var(--d);border-color:var(--d);color:#fff}
@media(max-width:700px){
  .filters{gap:10px}
  .field,.field select{width:100%}
  .filters .count{margin-left:0;padding-bottom:0}
  .controls{width:100%}
  .controls button{flex:1}
}
"""
h = h.replace("/* ---- Logo en el header ---- */", css + "/* ---- Logo en el header ---- */", 1)

# ------------------------------------------------------------------ 3. markup
opciones_ronda = "".join(
    f'<option value="{s}">{etiqueta} ({stats_r[s]})</option>' for _, s, etiqueta in RONDAS
)

filtros = (
    '<div class="filters">'
    '<div class="field"><label for="f-status">Estatus</label>'
    '<select id="f-status">'
    f'<option value="">Todos ({n})</option>'
    f'<option value="completado">Completado ({stats_s["completado"]})</option>'
    f'<option value="pendiente">Pendiente ({stats_s["pendiente"]})</option>'
    "</select></div>"
    '<div class="field"><label for="f-ronda">Ronda de pruebas</label>'
    '<select id="f-ronda">'
    f'<option value="">Todas las rondas ({n})</option>'
    f"{opciones_ronda}"
    "</select></div>"
    '<button id="reset" type="button">Limpiar filtros</button>'
    '<p class="count" role="status" aria-live="polite">'
    f'<b id="shown">{n}</b> de {n} hallazgos</p>'
    "</div>"
)

ancla = '<main class="list">'
assert h.count(ancla) == 1
h = h.replace(ancla, filtros + ancla, 1)

# Mensaje para cuando ninguna combinación devuelve resultados.
h = h.replace(
    "</main>",
    '</main><p class="empty" id="empty" hidden>Ning\u00fan hallazgo coincide con esta combinaci\u00f3n. '
    "Prueba con otra ronda o limpia los filtros.</p>",
    1,
)

# ------------------------------------------------------------------ 4. script
# Expandir/Contraer se reescriben para actuar sólo sobre lo visible.
viejo = (
    "document.querySelector('#expand').onclick=()=>document.querySelectorAll('details')"
    ".forEach(d=>d.open=true);document.querySelector('#collapse').onclick=()=>"
    "document.querySelectorAll('details').forEach(d=>d.open=false);"
)
assert viejo in h, "handlers de expandir/contraer no encontrados"

nuevo = """
(function(){
  var items=[].slice.call(document.querySelectorAll('.list details')),
      fs=document.getElementById('f-status'),fr=document.getElementById('f-ronda'),
      shown=document.getElementById('shown'),empty=document.getElementById('empty'),
      reset=document.getElementById('reset');

  function visibles(){return items.filter(function(d){return !d.hidden})}

  function aplicar(){
    var s=fs.value,r=fr.value,n=0;
    items.forEach(function(d){
      var ok=(!s||d.dataset.status===s)&&(!r||d.dataset.ronda===r);
      d.hidden=!ok;
      if(!ok)d.open=false; else n++;
    });
    shown.textContent=n;
    empty.hidden=n>0;
  }

  fs.addEventListener('change',aplicar);
  fr.addEventListener('change',aplicar);
  reset.addEventListener('click',function(){fs.value='';fr.value='';aplicar()});

  // Expandir y contraer respetan el filtro activo.
  document.getElementById('expand').onclick=function(){visibles().forEach(function(d){d.open=true})};
  document.getElementById('collapse').onclick=function(){visibles().forEach(function(d){d.open=false})};
})();
"""
h = h.replace(viejo, nuevo, 1)

io.open(HTML, "w", encoding="utf-8").write(h)

print("hallazgos etiquetados:", n)
print("estatus :", dict(stats_s))
print("rondas  :", dict(stats_r))
print("filtros :", h.count('id="f-status"'), h.count('id="f-ronda"'))
