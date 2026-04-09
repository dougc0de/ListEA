import { describe, expect, it } from 'vitest';
import { DrawerGestureController, NavigationCatalog } from '../navigation';

describe('NavigationCatalog', () => {
  it('disables premium menu views for free plan', () => {
    const views = new NavigationCatalog().getMenuViews('free');

    expect(views.find(view => view.id === 'agenda')?.disabled).toBe(true);
    expect(views.find(view => view.id === 'settings')?.disabled).toBe(false);
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
