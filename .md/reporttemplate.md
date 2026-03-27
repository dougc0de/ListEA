# ListEA — Template de reporte PDF premium

Este template está pensado para una app **local first**. La idea es que el PDF conserve la misma lógica visual de la web: tarjetas suaves, azul principal, bordes redondeados, bloques de estadísticas y lista de tareas completadas.

## Qué debe reflejar el PDF

* **Resumen superior**: Abiertas, Para hoy, Vencidas.
* **Bloque Activa / Hoy**: Hoy, Esta semana, Vencidas, Sin fecha.
* **Bloque de productividad**: estadísticas tal cual se representan en la web.
* **Completadas recientes**: tareas cerradas con fecha/hora.
* **Insights premium**: lectura breve y humana.

## Estructura de datos

```ts
export type CompletedTask = {
  title: string;
  tag: string;
  completedAtLabel: string;
};

export type WeeklyBar = {
  label: string;
  completed: number;
  created: number;
};

export type ListeaReportData = {
  appName: string;
  periodLabel: string;
  summary: {
    open: number;
    today: number;
    overdue: number;
  };
  activeWindow: {
    title: string;
    totalTasksLabel: string;
    today: number;
    thisWeek: number;
    overdue: number;
    noDate: number;
  };
  productivity: {
    completionRate: number;
    bestHourRange: string;
    mostPostponedCategory: string;
    weeklyBars: WeeklyBar[];
  };
  completed: {
    totalLabel: string;
    items: CompletedTask[];
  };
};
```

## HTML del reporte

```ts
export function buildListeaReportHTML(data: ListeaReportData) {
  const weeklyBars = data.productivity.weeklyBars
    .map((bar) => {
      const max = Math.max(
        ...data.productivity.weeklyBars.map((x) => Math.max(x.completed, x.created)),
        1
      );

      const completedHeight = Math.max(10, (bar.completed / max) * 92);
      const createdHeight = Math.max(10, (bar.created / max) * 92);

      return `
        <div class="bar-group">
          <div class="bar-pair">
            <div class="bar bar-completed" style="height:${completedHeight}px"></div>
            <div class="bar bar-created" style="height:${createdHeight}px"></div>
          </div>
          <span class="bar-label">${bar.label}</span>
        </div>
      `;
    })
    .join('');

  const completedRows = data.completed.items
    .map(
      (item) => `
        <div class="task-row">
          <span class="tag-pill">${item.tag}</span>
          <div class="task-main">${item.title}</div>
          <div class="task-time">${item.completedAtLabel}</div>
        </div>
      `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>ListEA Premium Report</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: #eaf4fb; color: #173d5b; }
      .page { width: 1123px; min-height: 1587px; padding: 42px; background: #eaf4fb; }
      .panel { background: #f7fbfe; border: 2px solid #a8c5db; border-radius: 32px; }
      .header { display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; margin-bottom: 28px; }
      .brand-wrap { display: flex; flex-direction: column; gap: 6px; }
      .brand-line { display: flex; align-items: baseline; gap: 8px; }
      .brand { font-size: 28px; font-weight: 800; color: #ff5a4f; }
      .report-title { font-size: 28px; font-weight: 800; color: #0a4e82; }
      .subtle { color: #607d96; font-size: 16px; }
      .period-pill { background: #dcebf6; color: #0a4e82; border-radius: 999px; padding: 14px 20px; font-weight: 700; }
      .hero { display: grid; grid-template-columns: 1.4fr 1fr; gap: 22px; padding: 28px; margin-bottom: 24px; }
      .hero-title { font-size: 24px; font-weight: 800; color: #0a4e82; margin-bottom: 14px; }
      .hero-copy { font-size: 16px; color: #607d96; line-height: 1.5; }
      .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .summary-card, .mini-card, .insight-box { background: #dcebf6; border-radius: 22px; }
      .summary-card { padding: 18px 18px 16px; }
      .summary-number { font-size: 44px; line-height: 1; font-weight: 800; color: #0a4e82; margin-bottom: 6px; }
      .summary-label { font-size: 15px; color: #173d5b; }
      .section-kicker { margin: 4px 0; color: #0a4e82; font-size: 15px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      .section-title { font-size: 22px; font-weight: 800; color: #173d5b; margin-bottom: 18px; }
      .active-head, .completed-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
      .head-actions { display: flex; gap: 12px; align-items: center; }
      .outline-pill, .count-pill, .tag-pill { border-radius: 999px; }
      .outline-pill { border: 2px solid #a8c5db; color: #0a4e82; padding: 12px 18px; font-weight: 700; background: transparent; }
      .count-pill, .tag-pill { background: #dcebf6; color: #0a4e82; font-weight: 700; }
      .count-pill { padding: 12px 18px; }
      .mini-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
      .mini-card { border: 2px solid #a8c5db; padding: 16px 18px; }
      .mini-label { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
      .mini-number { font-size: 24px; font-weight: 800; color: #0a4e82; }
      .productivity-panel { padding: 26px; margin-bottom: 26px; }
      .productivity-layout { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 22px; align-items: stretch; }
      .chart-title { font-size: 16px; font-weight: 700; margin-bottom: 18px; color: #607d96; }
      .bars-wrap { height: 170px; display: flex; align-items: end; gap: 18px; padding: 12px 10px 0; border-bottom: 2px solid #a8c5db; }
      .bar-group { display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .bar-pair { display: flex; align-items: end; gap: 8px; height: 110px; }
      .bar { width: 24px; border-radius: 10px 10px 4px 4px; }
      .bar-completed { background: #1e73a8; }
      .bar-created { background: #9fc4de; }
      .bar-label { font-size: 14px; color: #607d96; font-weight: 700; }
      .legend { display: flex; gap: 18px; margin-top: 16px; color: #607d96; font-size: 14px; font-weight: 600; }
      .legend span::before { content: ''; display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 8px; vertical-align: middle; }
      .legend .done::before { background: #1e73a8; }
      .legend .created::before { background: #9fc4de; }
      .insight-box { padding: 18px 20px; }
      .insight-title { color: #0a4e82; font-size: 16px; font-weight: 800; margin-bottom: 12px; }
      .insight-list { margin: 0; padding-left: 18px; display: grid; gap: 12px; color: #173d5b; line-height: 1.45; }
      .task-list { border: 2px solid #a8c5db; border-radius: 28px; overflow: hidden; background: #f7fbfe; }
      .task-row { display: grid; grid-template-columns: 120px 1fr 160px; gap: 18px; align-items: center; padding: 18px 22px; border-bottom: 1px solid #d6e5f0; }
      .task-row:last-child { border-bottom: 0; }
      .tag-pill { display: inline-flex; justify-content: center; padding: 10px 14px; }
      .task-main { font-size: 16px; font-weight: 800; color: #173d5b; }
      .task-time { text-align: right; color: #607d96; font-size: 15px; }
      .footer-note { margin-top: 22px; color: #607d96; font-size: 13px; }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="panel header">
        <div class="brand-wrap">
          <div class="brand-line">
            <span class="brand">${data.appName}</span>
            <span class="report-title">Reporte Premium de actividad</span>
          </div>
          <span class="subtle">Tus estadísticas privadas, generadas localmente.</span>
        </div>
        <div class="period-pill">Período: ${data.periodLabel}</div>
      </section>
      <section class="panel hero">
        <div>
          <div class="hero-title">TODO EMPIEZA CON LO QUE ANOTAS.</div>
          <div class="hero-copy">Este reporte refleja tus tareas, progreso y ritmo tal como lo ves en la app.</div>
        </div>
        <div class="summary-grid">
          <div class="summary-card"><div class="summary-number">${data.summary.open}</div><div class="summary-label">Abiertas</div></div>
          <div class="summary-card"><div class="summary-number">${data.summary.today}</div><div class="summary-label">Para hoy</div></div>
          <div class="summary-card"><div class="summary-number">${data.summary.overdue}</div><div class="summary-label">Vencidas</div></div>
        </div>
      </section>
      <section>
        <div class="section-kicker">Activa</div>
        <div class="active-head">
          <div class="section-title">${data.activeWindow.title}</div>
          <div class="head-actions"><div class="outline-pill">Limpiar campo</div><div class="count-pill">${data.activeWindow.totalTasksLabel}</div></div>
        </div>
        <div class="mini-grid">
          <div class="mini-card"><div class="mini-label">Hoy</div><div class="mini-number">${data.activeWindow.today}</div></div>
          <div class="mini-card"><div class="mini-label">Esta semana</div><div class="mini-number">${data.activeWindow.thisWeek}</div></div>
          <div class="mini-card"><div class="mini-label">Vencidas</div><div class="mini-number">${data.activeWindow.overdue}</div></div>
          <div class="mini-card"><div class="mini-label">Sin fecha</div><div class="mini-number">${data.activeWindow.noDate}</div></div>
        </div>
      </section>
      <section class="panel productivity-panel">
        <div class="section-title" style="margin-bottom: 6px;">Resumen semanal</div>
        <div class="chart-title">Completadas vs creadas</div>
        <div class="productivity-layout">
          <div>
            <div class="bars-wrap">${weeklyBars}</div>
            <div class="legend"><span class="done">Completadas</span><span class="created">Creadas</span></div>
          </div>
          <aside class="insight-box">
            <div class="insight-title">Lectura rápida</div>
            <ul class="insight-list">
              <li>Cerraste el ${data.productivity.completionRate}% de lo que abriste en el período.</li>
              <li>Tu mejor franja de productividad fue ${data.productivity.bestHourRange}.</li>
              <li>La categoría más reprogramada fue ${data.productivity.mostPostponedCategory}.</li>
            </ul>
          </aside>
        </div>
      </section>
      <section>
        <div class="section-kicker">Completadas</div>
        <div class="completed-head">
          <div class="section-title">Completadas recientes</div>
          <div class="head-actions"><div class="outline-pill">Exportado local</div><div class="count-pill">${data.completed.totalLabel}</div></div>
        </div>
        <div class="task-list">${completedRows}</div>
      </section>
      <div class="footer-note">Reporte generado en el dispositivo • Sincronía visual con la interfaz ListEA</div>
    </main>
  </body>
  </html>
  `;
}
```

## Exportación a PDF en cliente

```ts
import html2pdf from 'html2pdf.js';
import { buildListeaReportHTML } from './buildListeaReportHTML';

export async function exportListeaPremiumPdf(data: ListeaReportData) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildListeaReportHTML(data);

  const reportRoot = wrapper.querySelector('.page') as HTMLElement;
  if (!reportRoot) throw new Error('No se pudo construir el reporte');

  reportRoot.style.position = 'fixed';
  reportRoot.style.left = '-99999px';
  reportRoot.style.top = '0';
  document.body.appendChild(reportRoot);

  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `listea-premium-report-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#eaf4fb' },
        jsPDF: { unit: 'px', format: [1123, 1587], orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(reportRoot)
      .save();
  } finally {
    reportRoot.remove();
  }
}
```

## Qué estadísticas meter tal cual se ven en la web

```ts
const reportData = {
  summary: {
    open: dashboard.openTasks,
    today: dashboard.todayTasks,
    overdue: dashboard.overdueTasks
  },
  activeWindow: {
    title: activeFilterLabel,
    totalTasksLabel: `${activeTasks.length} tareas`,
    today: counters.today,
    thisWeek: counters.thisWeek,
    overdue: counters.overdue,
    noDate: counters.noDate
  }
};
```

La regla es esta: el PDF debe heredar la misma lectura del dashboard, no inventar otra, y ademas ajusta el numero de hojas segun las que se necesitan
