# Matriz de testeo movil de ListEA

## Objetivo
Tener una lista clara de que probar en:
- `Vercel`
- `Android Studio`
- `Play Internal Testing`

## Leyenda
- `Si`: debe probarse ahi
- `Parcial`: sirve como aproximacion, pero no es la validacion final
- `No`: no es el lugar correcto para validarlo

| Funcionalidad | Vercel movil | Android Studio + telefono | Play Internal Testing |
|---|---|---:|---:|
| Layout general | Si | Si | Si |
| Responsive telefono/tablet | Si | Si | Si |
| Navegacion | Si | Si | Si |
| Crear/editar tareas | Si | Si | Si |
| Persistencia local | Parcial | Si | Si |
| Limpiar fechas/horas | Si | Si | Si |
| Subtareas y recurrencias | Si | Si | Si |
| Dashboard | Si | Si | Si |
| Calendario premium | Si | Si | Si |
| Screenshot a tarea | Parcial | Si | Si |
| Voz a tarea | No | Si | Si |
| Apertura de apps compatibles | No | Si | Si |
| Notificaciones nativas | No | Si | Si |
| Permisos del telefono | No | Si | Si |
| Backup local | No | Si | Si |
| Comportamiento real de app instalada | No | Si | Si |

## Casos de prueba minimos

### 1. Diseño y responsive
**Canal principal:** `Vercel`  
**Validacion final:** `Android Studio`

Casos:
- abrir `Hoy`
- abrir `Seguimiento`
- abrir `Calendario`
- abrir `Panel`
- revisar bloque `Agregar tarea`
- revisar metricas superiores

Aceptar si:
- no hay cortes
- no hay scroll lateral accidental
- los controles son faciles de tocar

### 2. CRUD de tareas
**Canal principal:** `Android Studio`

Casos:
- crear tarea sin fecha
- editar titulo
- limpiar fecha
- agregar seguimiento
- cerrar y reabrir app

Aceptar si:
- los datos persisten
- no se inventan horas

### 3. Smart App Launch
**Canal principal:** `Android Studio`

Apps minimas para probar:
- WhatsApp
- Instagram
- LinkedIn
- Gmail
- Maps

Casos:
- `mandar mensaje por WhatsApp`
- `postear en Instagram`
- `revisar LinkedIn y luego Instagram`
- `escribir correo en Gmail`
- `ir por Maps`

Aceptar si:
- toca la app correcta
- si no existe la app, cae a fallback razonable

### 4. Voz a tarea
**Canal principal:** `Android Studio`

Casos:
- dar permiso de microfono
- grabar tarea corta
- detener
- revisar tarea guardada
- abrir `Editar detalles`

Aceptar si:
- guarda tarea local
- muestra errores claros si falla

### 5. Screenshot a tarea
**Canal principal:** `Android Studio`

Casos:
- abrir selector de imagen
- elegir screenshot real
- esperar OCR
- revisar campos sugeridos
- guardar

Aceptar si:
- la UI no se bloquea
- extrae datos utiles

### 6. Notificaciones
**Canal principal:** `Android Studio`

Casos:
- habilitar permisos
- crear tarea con fecha cercana
- esperar notificacion
- tocar la notificacion

Aceptar si:
- llega el recordatorio
- abre el contexto correcto

### 7. Backup local
**Canal principal:** `Android Studio`

Casos:
- exportar
- importar
- reabrir app

Aceptar si:
- tareas y preferencias vuelven correctamente

## Rutina sugerida
### Cambio visual
1. probar en Vercel
2. validar en Android Studio

### Cambio con plugins
1. correr `npm run mobile:build`
2. abrir Android Studio
3. instalar en telefono
4. revisar Logcat

### Antes de release
1. correr `npm run mobile:validate`
2. validar checklist en Android Studio
3. subir a `Internal Testing`

## Comandos utiles
```powershell
npm run test
npm run build
npm run mobile:build
npm run mobile:android
npm run mobile:validate
```

## Criterio final
Si una funcion depende del telefono o de Capacitor, la verdad final no es Vercel.

La validacion real es:
- `Android Studio + telefono real`
