export class AppView {
  constructor({ id, label, premiumOnly = false }) {
    this.id = id;
    this.label = label;
    this.premiumOnly = premiumOnly;
  }
}

export class NavigationCatalog {
  constructor() {
    this.views = [
      new AppView({ id: 'home', label: 'Inicio' }),
      new AppView({ id: 'agenda', label: 'Agenda', premiumOnly: true }),
      new AppView({ id: 'board', label: 'Board', premiumOnly: true }),
      new AppView({ id: 'settings', label: 'Configuraciones' }),
    ];
  }

  getMenuViews(planId) {
    return this.views.filter(view => view.id !== 'home').map(view => ({
      ...view,
      disabled: view.premiumOnly && planId !== 'premium',
    }));
  }

  getFallbackView(currentViewId, planId) {
    const currentView = this.views.find(view => view.id === currentViewId);
    if (!currentView) return 'home';
    if (currentView.premiumOnly && planId !== 'premium') return 'home';
    return currentView.id;
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
