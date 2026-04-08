# ListEA en Android Studio: paso a paso

## Objetivo
Usar `Android Studio + tu telefono Android real` para probar `ListEA` como app instalada de verdad antes de subirla a Play Store.

Este flujo es el correcto para validar:
- apertura de apps compatibles
- voz a tarea
- screenshot a tarea
- notificaciones
- permisos del telefono
- persistencia local
- responsive real fuera del navegador

## Requisitos
- Android Studio instalado
- telefono Android
- cable `USB-C de datos`
- proyecto ListEA funcionando localmente
- Node y npm instalados

## Scripts utiles del proyecto
- `npm run mobile:build`
  - hace `build` web + `cap sync`
- `npm run mobile:android`
  - hace `mobile:build` y luego abre `android/` en Android Studio
- `npm run mobile:validate`
  - corre tests y build antes de entrar al flujo movil

## Paso 1. Preparar el telefono
1. Abre `Ajustes`.
2. Entra a `Acerca del telefono`.
3. Toca varias veces `Numero de compilacion`.
4. Vuelve atras y entra a `Opciones de desarrollador`.
5. Activa `Depuracion por USB`.
6. Conecta el telefono con el cable `USB-C`.
7. Si el telefono lo pide, elige `Transferencia de archivos`.
8. Acepta la huella RSA cuando Android pregunte si confias en este equipo.

## Paso 2. Preparar la app para Android
En la terminal del proyecto, corre:

```powershell
npm run mobile:build
```

Esto:
- genera `dist/`
- sincroniza Capacitor con `android/`

Si quieres abrir Android Studio en el mismo paso:

```powershell
npm run mobile:android
```

## Paso 3. Abrir Android Studio
1. Abre Android Studio.
2. Pulsa `Open`.
3. Selecciona esta carpeta:

```text
c:\Users\User 1\Desktop\Dev section\Projects and classes\Proyects\ListEA\ListEA\android
```

4. Espera a que termine `Gradle Sync`.

## Paso 4. Confirmar que el telefono aparece
Arriba, junto al boton `Run`, debe aparecer tu telefono como destino.

Si no aparece:
- desconecta y vuelve a conectar el cable
- confirma el popup RSA en el telefono
- cambia el modo USB a `Transferencia de archivos`
- prueba otro puerto o cable

Si aun no aparece, en terminal puedes revisar:

```powershell
adb devices
```

Si no tienes `adb` en PATH, usa la terminal integrada de Android Studio o busca `platform-tools`.

## Paso 5. Ejecutar ListEA
1. Arriba, confirma que la configuracion elegida sea `app`.
2. Selecciona tu telefono como destino.
3. Pulsa `Run`.
4. Espera a que Android Studio compile e instale.
5. Verifica que `ListEA` se abra en el telefono.

## Paso 6. Que mirar dentro de Android Studio
### `Project`
Para navegar el modulo Android y confirmar que abriste el proyecto correcto.

### `Build`
Para ver errores de compilacion o de Gradle.

### `Run`
Para ver si la app se instaló y arrancó correctamente.

### `Logcat`
Usalo para revisar errores reales de:
- `Capacitor`
- permisos
- voz
- notificaciones
- apertura de apps

Filtros sugeridos:
- `listea`
- `Capacitor`
- `MainActivity`
- `AppLauncher`
- `SpeechRecognition`
- `LocalNotifications`

## Paso 7. Flujo diario de prueba
Cada vez que cambies algo en Vue/CSS/logica web:

1. Guarda cambios.
2. Corre:

```powershell
npm run mobile:build
```

3. Vuelve a Android Studio.
4. Pulsa `Run`.
5. Prueba de nuevo en el telefono.

## Orden recomendado de prueba
### 1. Vercel
Primero prueba en Vercel desde el telefono:
- layout
- responsive
- textos
- espaciados
- navegacion general

### 2. Android Studio con telefono real
Despues valida lo nativo:
- apps externas
- voz
- OCR
- notificaciones
- persistencia real

### 3. Internal Testing
Cuando todo este estable:
- generar `.aab`
- subir a `Play Console Internal Testing`
- instalar desde enlace privado

## Checklist rapido por funcionalidad
### Diseño
- menu usable
- sin scroll horizontal raro
- tarjetas bien espaciadas
- botones comodos para dedo

### Tareas
- crear
- editar
- limpiar fecha
- subtareas
- persistencia al reabrir

### Smart App Launch
- WhatsApp
- Instagram
- LinkedIn
- Gmail
- Maps

### Voz a tarea
- permiso de microfono
- hablar
- detener
- guardar tarea
- editar detalles

### Screenshot a tarea
- elegir imagen
- OCR
- revisar titulo/notas
- guardar

### Notificaciones
- pedir permisos
- programar recordatorio
- recibir notificacion
- tocarla

### Calendario premium
- navegar de mes
- abrir un dia
- crear tarea desde dia
- revisar carga del dia

### Backup
- exportar
- importar
- reabrir app

## Problemas comunes
### La app no aparece en el telefono
- revisa que el destino sea tu dispositivo
- mira `Build` y `Run`
- confirma que `app` sea la configuracion activa

### El telefono no aparece en Android Studio
- revisa cable de datos
- revisa RSA
- activa `Depuracion por USB`
- usa `Transferencia de archivos`

### La web se ve bien en Vercel pero la app no
Eso es normal a veces.

La fuente de verdad para features nativas es:
- `Android Studio + app instalada`

## Regla practica
- Si es visual: prueba primero en `Vercel`
- Si toca plugins o telefono: prueba en `Android Studio`
- Si ya esta casi listo para publicar: prueba en `Internal Testing`
