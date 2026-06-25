# Automatización de actividades desde Google Drive

Este puente convierte la carpeta de Google Drive en un endpoint JSON/JSONP para `actividades.html`.

## Estructura esperada en Drive

```text
Carpeta raíz
├── Recorridos
│   ├── 2026-06-24
│   │   ├── foto-01.jpg
│   │   ├── foto-02.jpg
│   │   └── resumen.md
├── Reuniones
│   └── 24-06-2026
│       ├── foto.jpg
│       └── resumen.md
└── Escucha vecinal
    └── Junio 2026
        └── foto.jpg
```

Cada subcarpeta de fecha se publica como una actividad. Si agregas una nueva carpeta o subes más archivos, la página podrá reflejarlo en la siguiente carga del endpoint.

## Formato recomendado del `.md`

```markdown
---
titulo: Caminata vecinal por San Borja Norte
tipo: Recorrido
sector: Sector 1
fecha: 24 de junio de 2026
direccion: Av. San Borja Norte con Calle del Lenguaje
resumen: Encuentro casa por casa para recoger preocupaciones de seguridad, limpieza urbana y mantenimiento de espacios públicos.
mapa: avance-campana.html
---

- Reforzar puntos críticos de iluminación.
- Coordinar mantenimiento preventivo de veredas y áreas verdes.
- Crear reportes vecinales simples para seguimiento.
```

Si no existe `.md`, el script crea una actividad básica usando el nombre de la carpeta de tipo, el nombre de la carpeta de fecha y las fotos disponibles.

## Instalación

1. Entra a `https://script.google.com/` y crea un proyecto nuevo.
2. Pega el contenido de `Code.gs`.
3. Confirma que `ROOT_FOLDER_ID` sea:

```js
const ROOT_FOLDER_ID = '1XC-UikBo_iCwnY5wK91vHK5jqY9ogPNG';
```

4. Despliega como Web App:

```text
Deploy > New deployment > Web app
Execute as: Me
Who has access: Anyone
```

5. Copia el URL `/exec` del despliegue.
6. En `actividades.html`, reemplaza:

```js
const ACTIVITIES_ENDPOINT = '';
```

por:

```js
const ACTIVITIES_ENDPOINT = 'URL_DEL_WEB_APP_EXEC';
```

## Permisos de imágenes

El script entrega las fotos como URLs de miniatura de Drive. Para que el navegador pueda mostrarlas en una página pública, las fotos o carpetas deben tener permiso de lectura compatible, por ejemplo “Cualquier persona con el enlace puede ver”.

## Actualización

El endpoint usa una caché corta de 30 segundos (`CACHE_SECONDS`). Además, cuando `ACTIVITIES_ENDPOINT` está configurado, `actividades.html` vuelve a consultar el endpoint cada 60 segundos (`ACTIVITIES_REFRESH_MS`) y repinta las actividades manteniendo el filtro activo.
