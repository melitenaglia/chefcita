# Chefcita — UX/UI móvil

Referencia actualizada el 12/10/2026. Público: Melisa, Sofi, mamá, tía y abuela; personas con distintas necesidades de lectura y experiencia digital.

## Tareas prioritarias

- Inicio: guardar una receta, ver las últimas añadidas y favoritas.
- Ideas: página propia para elegir qué cocinar.
- Recetas: lista como Inicio (miniatura cuadrada, título, categoría/tipo y tiempo). Acciones en el menú ⋯ de cada fila. Buscar por receta/ingrediente; filtros de estado/categoría/nivel/orden colapsados. Evitar chips de ingredientes, etiquetas y botones de gestión en cada fila.
- Bibliotecas: colecciones tipo playlists; organizar después de guardar y revisar.
- Ficha: abrir fuente original, leer ingredientes/preparación, marcar favorita/probada y guardar notas.

## Navegación y acciones

Barra inferior: Inicio / Ideas / Recetas. Bibliotecas en menú y acceso desde Recetas. El contenido se desplaza dentro de .content; la barra ocupa otra fila. No recalcular posiciones con visualViewport ni superponer herramientas de gestión al contenido.

Eliminar receta está al final de la ficha/revisión y pide confirmación. Aprobar y guardar borrador se desplazan con la revisión. Modales con foco contenido, Escape y retorno de foco.

## Densidad y accesibilidad

Una sola capa final: src/mobile-design.css. Cuatro conjuntos de variables cambian tipografía, márgenes, separaciones, imágenes, iconos, radios y controles juntos. Evitar zoom/transform/escala global. El modo súper compacto usa lista con miniaturas; los demás usan tarjetas.

Áreas táctiles mínimas de 44 CSS px, texto de inputs mínimo de 16 px para evitar zoom iOS. No fijar alturas para texto largo. Grande: cuerpo 18 px y controles 56 px. Respeta safe areas, foco visible, iconos con nombre, estados con texto y reduced-motion.

## Bibliotecas

Una receta puede pertenecer a varias colecciones. Añadir/quitar debe modificar la relación y conservar el original, su autoría, ingredientes, pasos y notas. Guardar desde Instagram no pregunta por biblioteca. Una biblioteca sin invitaciones sirve como colección individual; al invitar se comparte.

La organización de recetas propias usa el RPC existente. libraryActions.js conserva desactivada la colaboración ampliada hasta aprobar/aplicar supabase/migrations/20261012181451_library_playlists.sql. La migración preparada permite a miembros añadir recetas accesibles y revisadas, quitar relaciones, y eliminar/salir de bibliotecas con permisos y confirmación. Nunca concede edición de recetas de otra persona.

## Referencias consultadas

- Apple: https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple: https://developer.apple.com/design/tips/
- Material: https://m3.material.io/styles/typography/applying-type
- Material: https://m3.material.io/foundations/layout/canonical-examples/overview

## Validación

Compilación e integridad. CI de navegador con sesión/API simuladas: scopes, añadir/quitar, bibliotecas, revisión sin barras sticky, cuatro densidades y ausencia de scroll horizontal. Chromium y WebKit. Las barras nativas y el teclado en un iPhone físico siguen requiriendo prueba en dispositivo.

## Aspecto y descanso visual

Preferencia por dispositivo: Según el dispositivo / Claro / Oscuro. Predeterminado automático; sigue cambios del sistema mientras la app está abierta. index.html aplica el aspecto antes de React para evitar destellos claros. Color de acento independiente de los fondos neutros. Ideas no se resalta cuando está inactiva. Conserva contraste, safe areas y objetivos táctiles. src/calm-appearance.css coordina las superficies de autenticación, listas, modales, fichas y configuración.
