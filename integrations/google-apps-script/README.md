# Google Apps Script Instagram bridge

Este bridge reutiliza el entorno de Google Apps Script que Chefcita 1.0 ya usaba para leer metadatos públicos de Instagram mediante `UrlFetchApp`.

## Despliegue

1. Abrir el proyecto de Apps Script de Chefcita 1.0 o crear uno nuevo.
2. Sustituir/añadir un archivo `Code.gs` con el contenido de este directorio.
3. Implementar > Nueva implementación > Aplicación web.
4. Ejecutar como: yo.
5. Quién tiene acceso: cualquier persona.
6. Copiar la URL `/exec` resultante.
7. Guardar esa URL en Supabase Edge Functions > Secrets con el nombre:
   `INSTAGRAM_EXTRACTOR_URL`

Opcional: para añadir una segunda capa de protección, crear una propiedad de script
`CHEFCITA_TOKEN` y guardar el mismo valor en Supabase como `INSTAGRAM_EXTRACTOR_TOKEN`.

La URL del bridge no se expone en el frontend: solo la usa la Edge Function de Supabase.

## Flujo

Chefcita intenta, en este orden:
1. Google Apps Script bridge (si está configurado).
2. Extracción directa desde Supabase como fallback.
3. Si no hay caption, no llama a OpenAI y deja la importación pendiente.

El bridge solo acepta URLs HTTPS de Instagram `/reel/`, `/p/` o `/tv/`.
