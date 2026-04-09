import { describe, expect, it } from 'vitest';
import { ThemeCatalog } from '../themes';

describe('ThemeCatalog', () => {
  it('exposes free and premium palettes separately', () => {
    const catalog = new ThemeCatalog();

    expect(catalog.getFreePalettes()).toHaveLength(2);
    expect(catalog.getPremiumPalettes()).toHaveLength(8);
    expect(catalog.getPalette('night').mode).toBe('dark');
  });
});
