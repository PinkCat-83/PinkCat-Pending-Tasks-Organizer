// Configuración general de la aplicación.
// Ningún texto visible para el usuario vive aquí: todos están en /locales.

export const CONFIG = Object.freeze({
  appVersion: '1.0.0',

  // Idiomas. Para añadir uno nuevo: crea locales/<código>.json,
  // añade el código a supportedLocales y al listado del service worker.
  defaultLocale: 'es',
  supportedLocales: ['es'],
  localeStorageKey: 'pinkcat.locale',

  // Días de antelación con los que se avisa de una fecha límite.
  deadlineWarningDays: 7,

  // Número máximo de entradas que se muestran en el historial.
  historyLimit: 200,

  // Base de datos local (IndexedDB).
  dbName: 'pinkcat-pending-tasks',
  dbVersion: 1,

  // Formato de las copias de seguridad.
  exportFormat: 'pinkcat-pending-tasks-backup',
  exportSchemaVersion: 1,

  // Longitudes máximas de los campos de texto.
  maxLength: {
    name: 120,
    shortText: 200,
    longText: 2000,
  },
});
