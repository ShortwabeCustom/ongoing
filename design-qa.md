# Design QA — Reporte PWA 2.0

**Source visual truth path**

- Referencia principal del usuario: adjuntos 3 y 4 de esta conversación.
- Copia local comparable del lenguaje visual anterior: `/tmp/claude-1000/-var-www/f063bdba-6e44-45d0-acca-a9fd0c72c4cb/images/15.png` (2322 × 1382 px).

**Implementation evidence**

- Escritorio: `/tmp/pwa2-report-desktop.png` (1440 × 1481 px; sección completa, CSS viewport 1440 px, device scale factor 1).
- Móvil: `/tmp/pwa2-report-mobile.png` (390 × 1437 px; sección completa, device scale factor 1).
- Acceso anónimo con CTA público: /tmp/pwa2-report-anonymous-cta.png (1440 × 1481 px; sección completa, device scale factor 1).
- Comparación normalizada: `/tmp/pwa2-report-comparison.png` (1800 × 980 px). Ambos lados se normalizaron a cajas de 900 × 926 px con `contain`.

**State**

Vista pública anónima, PWA 2.0, 262 hallazgos: 102 abiertos y 160 validados. PWA 1.0 no aparece. La sección se evaluó después de hidratar datos y activar su entrada en viewport.

**Findings**

No hay diferencias P0, P1 ni P2 pendientes.

- Tipografía: Poppins, pesos, jerarquía y saltos se conservan; el título y las cifras ganan escala conforme al foco exclusivo en PWA 2.0.
- Espaciado y composición: se eliminó la columna de “Proyectos”, la tarjeta ocupa el ancho disponible y conserva aire suficiente entre anillo, leyenda y responsables.
- Colores: se mantienen fondo verde profundo, menta, amarillo de estado, bordes translúcidos y contraste legible.
- Imágenes: los retratos existentes mantienen recorte circular, nitidez y proporción; no hay recursos sustituidos ni marcadores temporales.
- Copy: la cabecera y los estados hablan únicamente de PWA 2.0; los valores coinciden con la API publicada.
- Respuesta adaptable: la captura móvil apila anillo, leyenda y responsables sin solapamientos visibles.
- Consola: 0 errores durante la captura.

La diferencia estructural respecto de la referencia es intencional: desaparecen el selector lateral y el conector, y la tarjeta de PWA 2.0 aumenta de tamaño según lo solicitado.

**Focused region comparison**

No fue necesaria una segunda región recortada: la comparación normalizada conserva legibles la tarjeta completa, las cifras, las barras y la cadena de responsables. La captura móvil se revisó por separado para validar el apilamiento.

**Comparison history**

- Iteración 1: sin hallazgos P0/P1/P2 en la tarjeta enfocada.
- Iteración 2: se detectó que el CTA dependía de autenticación y apuntaba a una ruta privada. Se hizo visible para usuarios anónimos y se dirigió a #hallazgos, la lista pública de la misma página. La captura posterior confirma el CTA visible, el salto al destino y 0 errores de consola.

**Implementation Checklist**

- [x] Ocultar PWA 1.0 en el estado público.
- [x] Retirar la columna izquierda de proyectos.
- [x] Ampliar la tarjeta de PWA 2.0.
- [x] Verificar cifras, responsables y estados con la API.
- [x] Comprobar escritorio y móvil.
- [x] Comprobar ausencia de errores de consola.
- [x] Verificar que el CTA sea visible y navegable sin sesión.

**Follow-up Polish**

Sin pendientes.

final result: passed
