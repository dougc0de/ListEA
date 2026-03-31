# Status completo de ListEA

## Resumen actual
ListEA es una app `local-first` de productividad personal y profesional enfocada en movil.

Estado actual:

- sin backend
- sin cuentas
- sin sync cloud
- sin anuncios
- con base de Capacitor para Android e iOS

## Lo que ya hace
### Flujo principal
- crear tareas
- editar tareas
- completar y reabrir tareas
- subtareas con contexto
- prioridades, estado, energia, impacto y esfuerzo
- recurrencias
- etiquetas, proyecto y area

### Captura y organizacion
- interpretacion de lenguaje natural en captura
- templates para llamada, reunion, propuesta, correo pendiente y cobro/seguimiento
- vista `Hoy`
- vista `Seguimiento`
- vista `Agenda`

### Revision y analitica local
- review profesional local
- deteccion de tareas sin fecha
- deteccion de seguimientos vencidos
- deteccion de duplicados y saturacion de backlog
- dashboard de actividad local

### Recordatorios y avisos
- recordatorios con `@capacitor/local-notifications`
- globo local dentro de la app cuando toca actuar
- acciones desde aviso: abrir, completar, posponer, mover a manana

### Smart Launch
- deteccion de apps compatibles desde titulo, notas, tags y links
- apertura `home-first`
- soporte actual para apps profesionales y utilitarias compatibles
- fallback a enlace o accion externa cuando aplica
- compuerta premium para la apertura inteligente

### Privacidad y persistencia
- almacenamiento local persistente
- exportar respaldo local
- importar respaldo local
- respaldo cifrado como beneficio Pro
- cada dispositivo nuevo empieza desde cero

### Personalizacion
- modo dia y noche
- paletas de color
- configuracion de avisos
- licencia local Free / Pro

## Cambios recientes importantes
- Smart Launch movido a una arquitectura modular separada
- menu movil simplificado en vistas primarias y utilidades
- `Panel` y `Ajustes` pasan a una zona secundaria `Mas`
- acciones principales de tarea quedan visibles y el resto va dentro de `Mas`
- top bar con accesos rapidos por vista
- textos principales mas cortos para mejorar lectura movil

## Estado por modulo
### Disponible
- tareas y subtareas
- capturas
- seguimiento
- agenda
- review local
- dashboard base
- reminders
- backup local
- licencia local
- smart launch base

### Parcial
- smart launch nativo depende de app compatible y plataforma
- experiencia movil nativa existe mejor al correr bajo Capacitor que en navegador
- Pro sigue siendo activacion local; no hay billing real de App Store / Play Store conectado

### Pendiente
- compra nativa real por tienda
- share sheet nativo completo
- app shortcuts nativos completos
- publicacion en stores
- mas apps compatibles en el catalogo

## Estado real web vs movil
### En navegador movil
- se ve la nueva navegacion
- se ven capturas, seguimiento, agenda y review
- funciona la logica local
- funcionan acciones web, mailto, tel y sms

### Bajo Capacitor
- mejora la sensacion de app movil
- se habilita mejor la capa nativa
- recordatorios y apertura de apps compatibles tienen mas sentido real

## Apps compatibles hoy
- WhatsApp
- Telegram
- Slack
- Gmail
- Outlook
- Teams
- Zoom
- Google Meet
- Google Calendar
- Google Maps
- Waze
- Telefono
- SMS

## Riesgos o limites actuales
- iOS limita mas la apertura de apps de terceros
- no todas las apps ofrecen deep links publicos
- browser movil no replica toda la experiencia nativa
- algunos flows premium todavia son locales y no comerciales reales

## Estado de producto
ListEA ya no esta en fase de simple to-do app.

Hoy se comporta como:

- organizador local-first
- herramienta de seguimiento profesional
- capa de accion rapida hacia apps compatibles

El siguiente salto natural es cerrar billing nativo, share sheet y shortcuts para consolidarla como experiencia movil completa.
