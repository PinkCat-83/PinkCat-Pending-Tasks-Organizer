# PinkCat Pending Tasks Organizer

PWA personal para iPhone que recomienda cada día **un proyecto en el que trabajar**: «Continuar este proyecto».
Sin cuentas, sin servidor, sin dependencias. Los datos se guardan solo en el dispositivo (IndexedDB)..

## Qué incluye (versión 1.0.0)

- **Hoy**: la recomendación del día, que es el proyecto prioritario. Botones *Empezar sesión* y *Elegir otra tarea*, y avisos de fechas límite a 7 días o menos (solo informan; nunca cambian la prioridad).
- **Elegir otra tarea**: trabajar hoy en un proyecto aparcado o en una tarea puntual escrita a mano. La prioridad no cambia y la elección queda registrada en el historial.
- **Sesión**: intención opcional, resultado (Avancé / Avancé un poco / No avancé / Ya no tiene sentido), nota y opción de completar o descartar el proyecto. Si cierras la app a mitad de sesión, la sesión se conserva.
- **Proyectos**: crear, editar, completar, descartar y recuperar. Solo puede haber un proyecto prioritario. El cambio de prioridad exige motivo y confirmación, y conserva intactos ambos proyectos.
- **Ideas**: un bloc de notas que no afecta a los proyectos. Desde cualquier idea puedes *Crear proyecto* si quieres.
- **Historial**: sesiones, cambios de prioridad, cambios de tarea y cambios de estado.
- **Datos**: exportar (compartir con la hoja del sistema, con la opción de Mail, o descargar), importar con validación y confirmación, estado del almacenamiento persistente, de la instalación y del modo sin conexión.

## Estructura

```
index.html               Estructura base (sin textos: todos vienen de /locales)
manifest.webmanifest     Manifiesto PWA
sw.js                    Service worker (caché de la app para uso sin conexión)
css/styles.css
js/app.js                Arranque y rutas (#/today, #/projects…)
js/config.js             Ajustes: idioma, días de aviso, versión…
js/i18n.js               Textos y formatos de fecha
js/db.js                 IndexedDB
js/store.js              Reglas de negocio
js/backup.js             Exportar, validar e importar
js/persistence.js        Almacenamiento persistente e instalación
js/sw-status.js          Registro del service worker y aviso de actualización
js/ui.js                 Utilidades de interfaz
js/views/*.js            Pantallas
locales/es.json          Todos los textos en español
icons/                   Iconos (sustitúyelos por los tuyos)
```

## Iconos

Sustituye los iconos provisionales de la carpeta `icons/` por los tuyos. Mantén **exactamente** estos nombres y tamaños:

| Archivo | Tamaño | Uso |
|---|---|---|
| `icons/apple-touch-icon.png` | 180 × 180 px | Icono en la pantalla de inicio del iPhone |
| `icons/icon-192.png` | 192 × 192 px | Manifiesto y favicon |
| `icons/icon-512.png` | 512 × 512 px | Manifiesto (pantalla de carga y Android) |

- Formato PNG, cuadrado.
- **Sin transparencia**, sobre todo en `apple-touch-icon.png`: iOS rellena lo transparente con negro.
- **Sin esquinas redondeadas**: iOS las aplica solo.
- Deja un margen interior de alrededor del 10 % para que el dibujo no quede pegado al borde.

Si cambias los iconos después de publicar, sube `CACHE_VERSION` en `sw.js`.
En el iPhone puede que tengas que eliminar el icono de la pantalla de inicio y volver a añadirlo para ver el nuevo.

## Ejecutar en desarrollo (Windows)

La app necesita servirse por HTTP (no funciona abriendo `index.html` con doble clic, porque usa módulos ES).
Sirve la carpeta del proyecto con cualquier servidor estático:

- Con tu programa habitual, apuntando a esta carpeta.
- O con Python: `python -m http.server 8080` desde la carpeta del proyecto.
- O con Node: `npx serve .`

Después abre `http://localhost:8080` en el navegador.

**Probar en el móvil durante el desarrollo:** se puede abrir `http://IP-de-tu-PC:8080` desde el iPhone en la misma red Wi-Fi y la app funciona.
Sin embargo, sin HTTPS el navegador **no permite el service worker**, así que no hay modo sin conexión, y la instalación no será completa. En *Datos* lo verás indicado.
Para probarlo todo en el iPhone, usa la versión publicada en GitHub Pages, que va por HTTPS.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `pinkcat-tasks`).
2. Sube **el contenido** de esta carpeta a la raíz del repositorio. `index.html` debe quedar en la raíz e incluye `.nojekyll`.
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**. Elige la rama `main` y la carpeta `/ (root)`, y guarda.
4. En uno o dos minutos estará en `https://TU-USUARIO.github.io/pinkcat-tasks/`. GitHub Pages usa HTTPS automáticamente; comprueba que *Enforce HTTPS* esté marcado.

Todas las rutas son relativas y la navegación usa `#/`, así que funciona bajo la ruta del proyecto sin configurar nada más.

### Publicar una versión nueva

1. Haz los cambios.
2. Sube `CACHE_VERSION` en `sw.js` (por ejemplo, `pinkcat-v1.0.1`) y `appVersion` en `js/config.js`.
3. Si añadiste archivos nuevos, inclúyelos en la lista `APP_SHELL` de `sw.js`.
4. Sube los cambios. Al abrir la app aparecerá «Hay una versión nueva de la app» con el botón **Actualizar**.

Tus datos no se ven afectados por las actualizaciones: viven en IndexedDB, no en la caché.

## Instalar en el iPhone

1. Abre la URL de GitHub Pages en **Safari**.
2. Toca **Compartir** (el cuadrado con la flecha).
3. Elige **Añadir a pantalla de inicio** y confirma.

Al abrirla desde el icono, se muestra a pantalla completa, sin la barra de Safari.

**Importante:** en iOS, la app instalada y la página abierta en Safari **no comparten datos**. Úsala siempre desde el icono.
Para pasar datos entre dispositivos o entre Safari y la app, usa *Datos → Exportar* e *Importar*.

## Copias de seguridad

- **Compartir copia** abre la hoja del sistema. Desde ahí puedes elegir Mail para enviarte el archivo o guardarlo en Archivos/iCloud. Solo aparece si el navegador permite compartir archivos.
- **Descargar copia** guarda `pinkcat-copia-AAAA-MM-DD.json`. Puedes adjuntarlo a un correo a mano.
- **Importar** comprueba el archivo (formato, versión, campos y que no haya más de un proyecto prioritario) y pide confirmación antes de **reemplazar** todos los datos.

Nada se envía de forma automática.

## Traducciones (preparado, no activado)

Ningún texto visible está escrito en el código. Todos están en `locales/es.json` y se usan con `t('clave')`.
Las fechas usan `Intl` según el idioma.

Para añadir un idioma, por ejemplo inglés:

1. Copia `locales/es.json` a `locales/en.json` y traduce los valores, sin cambiar las claves.
2. En `js/config.js`, añade `'en'` a `supportedLocales`.
3. En `sw.js`, añade `'./locales/en.json'` a `APP_SHELL` y sube `CACHE_VERSION`.

La app elige el idioma del dispositivo si está disponible y, si no, español.
Los plurales usan objetos `{ "one": "…", "other": "…" }`.

Hay tres excepciones, porque son metadatos que el sistema lee antes de que cargue la app: el nombre de `manifest.webmanifest`, `apple-mobile-web-app-title` en `index.html` y la descripción del manifiesto.

## Privacidad

- Sin cuentas, sin analítica, sin telemetría y sin peticiones a otros dominios.
- Los datos están en IndexedDB del navegador. Si borras los datos de Safari o pierdes el dispositivo, se pierden: haz copias.
- La app solicita almacenamiento persistente cuando guardas tu primer proyecto o idea, y muestra en *Datos* si el navegador lo ha concedido realmente.
