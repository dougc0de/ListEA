export class AppView {
  constructor({ id, label, icon = '', utility = false }) {
    this.id = id;
    this.label = label;
    this.icon = icon;
    this.utility = Boolean(utility);
  }
}

export class NavigationCatalog {
  constructor() {
    this.legacyViewAliases = Object.freeze({
      backlog: 'calendar',
    });
    this.views = [
      new AppView({ id: 'today', label: 'Hoy', icon: 'today' }),
      new AppView({ id: 'follow-up', label: 'Seguimiento', icon: 'follow-up' }),
      new AppView({ id: 'calendar', label: 'Calendario', icon: 'calendar' }),
      new AppView({ id: 'dashboard', label: 'Panel', icon: 'dashboard', utility: true }),
      new AppView({ id: 'settings', label: 'Ajustes', icon: 'settings', utility: true }),
    ];
  }

  getPrimaryViews() {
    return this.views.filter(view => !view.utility);
  }

  getUtilityViews() {
    return this.views.filter(view => view.utility);
  }

  getMenuViews() {
    return this.views;
  }

  getFallbackView(currentViewId) {
    const normalizedViewId = this.legacyViewAliases[currentViewId] ?? currentViewId;
    return this.views.find(view => view.id === normalizedViewId)?.id ?? 'today';
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
