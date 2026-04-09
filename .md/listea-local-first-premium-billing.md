# Plan: ListEA Pro mensual como asistente móvil local-first

## Resumen
- `ListEA Pro` pasa a venderse como `asistente privado de seguimiento para profesionales móviles`, no como simple to-do premium.
- La justificación del pago mensual `USD 2.99` se apoya en valor recurrente y visible cada semana: `recordatorios avanzados fuera de la app`, `centro de control premium`, `apertura inteligente de apps compatibles`, `lectura operativa semanal` y `mejoras continuas del flujo profesional`.
- Se mantiene el enfoque `local-first`: tareas, analytics, preferencias, reportes y briefings viven en el dispositivo; no se introduce login obligatorio ni nube propia para datos.
- Superficie premium elegida para v1: `alertas accionables fuera de la app`, no widgets reales de Home Screen. Los widgets nativos reales quedan como fase 2.

## Cambios clave
### 1. Modelo de producto y suscripción
- Cambiar el modelo de monetización objetivo a `suscripción mensual` con un único entitlement principal: `listea_pro_monthly`.
- Mantener `Free` útil, pero dejar en Pro lo que entrega valor continuo:
  - recordatorios avanzados y asistente móvil
  - centro de control premium
  - apertura inteligente de apps
  - lectura operativa semanal
  - calendario premium
  - voz a tarea y screenshot a tarea
  - backup cifrado local
- No usar login obligatorio en v1.
- La compra y restauración viven en App Store / Play Store; el estado premium se cachea localmente para uso offline razonable.

### 2. Recordatorios avanzados y “asistente” fuera de la app
- Evolucionar la capa actual de recordatorios a una arquitectura con:
  - `ReminderPolicyEngine`
  - `ReminderScheduleService`
  - `ReminderActionRouter`
  - `AssistantBriefService`
- Baseline premium fuera de la app:
  - notificación de tarea al momento
  - pre-recordatorio configurable
  - alertas de follow-up vencido
  - aviso de riesgo cuando una tarea importante sigue abierta tras su hora
  - resumen semanal programado
- El contenido de la notificación debe ser mínimo y útil:
  - título de tarea
  - una línea de contexto: proyecto, canal o tipo de compromiso
  - una línea temporal: hoy, ahora, vencida, seguimiento
- Acciones estándar fuera de la app:
  - `Abrir`
  - `Completar`
  - `Posponer 10m`
  - `Mover a mañana`
- Regla de apertura:
  - si la tarea tiene una sola app compatible resuelta y el usuario tiene Pro, `Abrir` delega a `SmartAppLaunchService`
  - si la tarea tiene varias apps compatibles, `Abrir` lleva a la tarea dentro de ListEA para elegir
- En foreground se conserva el globo/snippet actual, pero alineado con la misma política de recordatorios para no duplicar lógica.
- `Free` conserva recordatorio básico a la hora; `Pro` desbloquea políticas avanzadas, follow-up inteligente y briefings.

### 3. Centro de control premium y lectura operativa semanal
- Reenfocar el panel premium como `centro de control`, no solo analytics histórico.
- Módulos principales del centro de control:
  - `Compromisos en riesgo`
  - `Respuestas por enviar`
  - `Bloqueos viejos`
  - `Carga de hoy y esta semana`
  - `Canales y apps más usados`
  - `Seguimientos que ya no deberían esperar`
- Añadir `OperationalReportService` para generar una lectura semanal local con:
  - compromisos críticos de la semana
  - cumplimiento real
  - respuestas pendientes por canal
  - bloqueos viejos
  - tareas sin siguiente paso claro
- La lectura semanal debe existir en dos superficies:
  - vista detallada dentro del panel premium
  - notificación-resumen semanal que abre el panel
- Default recomendado:
  - generación semanal cada lunes a las `08:00` hora local
  - persistencia local de las últimas `8` semanas para comparación ligera
- Las gráficas históricas se mantienen, pero pasan a segunda capa del panel.

### 4. Apertura inteligente de apps y flujo profesional continuo
- Mantener `SmartAppLaunchService` como fachada única y seguir usando catálogo soportado, no acceso arbitrario a todas las apps del teléfono.
- Integrar la lógica de apertura en tres puntos:
  - botones de tarea
  - acción `Abrir` de recordatorios
  - centro de control cuando una tarea está asociada a canal compatible
- Continuidad de flujo profesional:
  - voz a tarea y screenshot a tarea siguen en Pro
  - el orquestador interno de agentes reutiliza la misma tubería para captura, estructuración, seguimiento y recordatorio
  - no duplicar parsing, scheduling ni resolución de apps entre UI y servicios
- Públicamente, esto se vende como:
  - “ListEA te recuerda y te lleva al siguiente contexto correcto”
  - no como “automatización total del teléfono”

### 5. Interfaces y arquitectura
- Extender `ENTITLEMENT_KEYS` con un grupo explícito de valor recurrente:
  - `advancedReminders`
  - `mobileAssistant`
  - `premiumInsights`
  - `weeklyBriefing`
  - `smartAppLaunch`
- Añadir o formalizar contratos:
  - `ReminderPlan`
  - `ReminderLane = basic | advanced | briefing`
  - `ReminderActionContext`
  - `OperationalBrief`
  - `SubscriptionSnapshot`
- Ajustes de preferencias premium:
  - `assistantEnabled`
  - `preReminderOffset`
  - `quietHoursStart`
  - `quietHoursEnd`
  - `weeklyBriefDay`
  - `weeklyBriefTime`
  - `directOpenCompatibleApp`
- Reusar las bases actuales en vez de rehacer:
  - la orquestación de notificaciones vive en la capa de servicios
  - la UI solo edita preferencias, muestra estado y responde a acciones
  - el panel consume agregados del dominio, no calcula por su cuenta

## Test Plan
- **Recordatorios**
  - con permisos concedidos, una tarea programada notifica aunque la app esté en background o cerrada
  - `Free` entrega recordatorio básico
  - `Pro` entrega pre-recordatorio, follow-up vencido y resumen semanal
  - las acciones `Completar`, `Posponer 10m` y `Mover a mañana` actualizan estado local sin romper recurrencias
- **Apertura inteligente**
  - una tarea con una sola app compatible abre esa app desde la acción `Abrir`
  - una tarea con varias apps compatibles abre la tarea en ListEA para elegir
  - si la app no está instalada o no puede abrirse, cae a fallback seguro
- **Centro de control**
  - el panel premium muestra datos locales reales y accionables
  - el resumen semanal abre la vista correcta y refleja el mismo agregado que el panel
- **Suscripción**
  - la compra mensual desbloquea entitlements correctos
  - la restauración funciona por tienda
  - el snapshot local permite uso offline razonable sin perder tareas ni preferencias
- **No regresiones**
  - calendario, voz, screenshot, seguimiento, filtros y backup siguen operando igual o mejor
  - web/Vercel no promete compra ni superficies nativas que solo existen en build móvil

## Supuestos y defaults
- `ListEA Pro` se define como suscripción mensual principal de `USD 2.99`.
- No habrá login obligatorio en v1.
- La superficie premium fuera de la app para v1 será `notificación rica y accionable`, no widget real de Home Screen.
- Los widgets reales de sistema quedan como fase 2:
  - iOS requerirá `WidgetKit` / potencialmente `Live Activities`
  - Android requerirá `App Widgets`
- El nicho se delimita a profesionales individuales orientados a clientes y follow-up:
  - consultores
  - recruiters
  - account managers
  - freelancers client-facing
  - ventas B2B ligeras
- Todo dato de tareas, analytics y reportes permanece local; la suscripción solo valida entitlement con Apple o Google.

## Referencias
- Apple User Notifications: https://developer.apple.com/documentation/usernotifications
- Apple local notifications: https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app
- Apple WidgetKit: https://developer.apple.com/documentation/widgetkit
- Android notifications overview: https://developer.android.com/develop/ui/views/notifications
- Android app widgets overview: https://developer.android.com/develop/ui/views/appwidgets/overview
- Google Play Billing overview: https://developer.android.com/google/play/billing
- Google Play subscriptions: https://developer.android.com/google/play/billing/subs
