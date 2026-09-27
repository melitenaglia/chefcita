# Chefcita 2.0 — reglas de UX/UI móvil

Estas reglas son la referencia para futuras iteraciones de interfaz. Prioridad: que una persona no técnica pueda entender qué hacer sin explicación previa.

## 1. Jerarquía de contenido
- En una pantalla de receta, el orden mental es: **qué es → fuente → datos útiles → ingredientes → preparación → información personal/secundaria**.
- El contenido principal no debe quedar desplazado por controles de gestión.
- Títulos grandes pueden orientar al entrar, pero no deben permanecer ocupando gran parte de la pantalla durante el scroll.
- Información secundaria y ajustes avanzados deben usar divulgación progresiva (acordeones o secciones colapsables).

## 2. Acciones
- Mantener una sola acción claramente principal por contexto cuando sea posible.
- Distinguir acciones por estilo y prioridad, no haciendo unas arbitrariamente mucho más grandes que otras.
- Acciones frecuentes deben tener texto explícito cuando el icono solo no sea inequívoco.
- Acciones destructivas deben estar visualmente separadas de las acciones normales.
- Objetivo táctil recomendado: **mínimo 44 × 44 CSS px** en móvil.

## 3. Tipografía y escala
- La preferencia **Compacto / Normal / Grande** es una densidad de interfaz por dispositivo y debe escalar de forma coherente tipografía, espacios, iconos, tarjetas y navegación.
- No implementar esta preferencia como “zoom” aislado de un componente.
- Texto de formularios: mínimo 16 px para evitar zoom automático en Safari iOS.
- Título principal móvil: aproximadamente 27–31 px, con line-height compacto.
- Encabezados de sección: aproximadamente 20–22 px.
- Texto corrido: 15–16 px.
- Metadatos/chips: 11–13 px.
- No fijar alturas para bloques de texto que puedan crecer con accesibilidad o contenido largo.

## 4. Espaciado
- Usar una escala consistente: 4 / 8 / 12 / 16 / 24 / 32 px.
- Separación grande solo entre bloques conceptuales distintos.
- Dentro de listas repetitivas, preferir ritmo compacto y escaneable.
- Evitar tarjetas dentro de tarjetas si no aportan una agrupación real.

## 5. Inicio y recetas
- En Inicio, la acción de inspiración **“¿Qué cocinamos hoy?”** tiene mayor jerarquía visual que los accesos secundarios al recetario o a Instagram.
- La jerarquía debe expresarse con posición, tamaño, contraste y espacio; no solo con el orden DOM.
- “Abrir publicación original” debe estar disponible cerca del título, no únicamente al final.
- Ingredientes y preparación son el contenido prioritario.
- Favorita / Probada deben estar disponibles sin ocupar un panel grande.
- Valoración aparece cuando la receta está marcada como probada.
- Notas personales quedan colapsadas por defecto.
- Si no existe imagen, no reservar un gran placeholder vacío en la ficha.

## 6. Formularios
- Una columna en móvil salvo pares muy simples.
- CTA de guardado accesible aunque aparezca el teclado.
- Inputs, selects y textareas: 16 px o más.
- El teclado no debe tapar la acción principal.
- Mantener borradores cuando el flujo exige salir de Chefcita para copiar contenido.

## 7. Navegación y arquitectura
- Debe existir **un único modelo de navegación por breakpoint**: sidebar estable en desktop y menú hamburguesa jerárquico en móvil.
- No duplicar las mismas secciones simultáneamente en drawer, bottom nav y pantallas internas.
- En móvil, el menú principal puede tener como máximo un nivel de submenú. Configuración usa ese único nivel para Pantalla / Mi hogar / IA e importaciones.
- Las pantallas de configuración no deben volver a pedir elegir la misma sección después de haberla elegido en el menú.
- Mantener navegación y acciones separadas. “Añadir receta” es una acción; “Recetas” o “Pendientes” son destinos.
- “¿Qué cocinamos?” / Ideas es la entrada prioritaria de inspiración y debe llevar a Inicio con el hero de ideas visible.
- Respetar safe areas y mantener áreas táctiles de al menos ~44 px aunque la densidad sea Compacta.
- Un modal largo debe comportarse como pantalla completa en móvil.
- Evitar encabezados sticky altos; si se necesita persistencia, dejar solo una barra compacta de navegación/acciones.

## 8. Feedback
- Toda operación que tarde más de un instante debe mostrar estado visible.
- Mensajes orientados a la acción: qué pasó y qué puede hacer la persona.
- No mostrar errores técnicos de Supabase/OpenAI al usuario final.
- Las acciones asíncronas deben deshabilitar controles que puedan duplicar la operación.

## 9. Accesibilidad
- Contraste suficiente y foco visible.
- No depender solo del color para indicar estado.
- Labels reales para formularios y aria-label en botones de solo icono.
- WCAG 2.2 exige al menos 24 × 24 CSS px o espaciado equivalente; Chefcita adopta 44 × 44 como objetivo móvil para mayor comodidad.

## Referencias
- Apple Human Interface Guidelines: Design principles, Layout, Menus, Toolbars, Tab bars.
- Nielsen Norman Group: 10 Usability Heuristics for User Interface Design.
- W3C WCAG 2.2: Success Criterion 2.5.8 Target Size (Minimum).
