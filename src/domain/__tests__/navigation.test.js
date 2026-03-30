import { describe, expect, it } from 'vitest';
import { DrawerGestureController, NavigationCatalog } from '../navigation';

describe('NavigationCatalog', () => {
  it('returns the simplified mobile views aligned with the PRD', () => {
    const views = new NavigationCatalog().getMenuViews();

    expect(views.map(view => view.id)).toEqual(['inbox', 'today', 'follow-up', 'backlog', 'dashboard', 'settings']);
    expect(views.find(view => view.id === 'backlog')?.label).toBe('Agenda');
    expect(views.find(view => view.id === 'follow-up')?.label).toBe('Seguimiento');
    expect(new NavigationCatalog().getFallbackView('unknown')).toBe('today');
  });
});

describe('DrawerGestureController', () => {
  it('opens when swiping from the right edge to the left', () => {
    const controller = new DrawerGestureController();
    controller.begin(390, 400);

    expect(controller.shouldOpen(250)).toBe(true);
    expect(controller.shouldOpen(360)).toBe(false);
  });
});
