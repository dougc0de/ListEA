export class AppView {
  constructor({ id, label }) {
    this.id = id;
    this.label = label;
  }
}

export class NavigationCatalog {
  constructor() {
    this.views = [
      new AppView({ id: 'inbox', label: 'Capturas' }),
      new AppView({ id: 'today', label: 'Hoy' }),
      new AppView({ id: 'follow-up', label: 'Seguimiento' }),
      new AppView({ id: 'backlog', label: 'Agenda' }),
      new AppView({ id: 'dashboard', label: 'Panel' }),
      new AppView({ id: 'settings', label: 'Ajustes' }),
    ];
  }

  getMenuViews() {
    return this.views;
  }

  getFallbackView(currentViewId) {
    return this.views.find(view => view.id === currentViewId)?.id ?? 'today';
  }
}

export class DrawerGestureController {
  constructor({ edgeThreshold = 56, minimumTravel = 72 } = {}) {
    this.edgeThreshold = edgeThreshold;
    this.minimumTravel = minimumTravel;
    this.startX = 0;
    this.viewportWidth = 0;
  }

  begin(startX, viewportWidth) {
    this.startX = startX;
    this.viewportWidth = viewportWidth;
  }

  shouldOpen(endX) {
    const startedOnRightEdge = this.startX >= this.viewportWidth - this.edgeThreshold;
    const traveledLeft = this.startX - endX;
    return startedOnRightEdge && traveledLeft >= this.minimumTravel;
  }
}
