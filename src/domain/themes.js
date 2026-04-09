export class ThemePalette {
  constructor({ id, name, tier, mode, variables }) {
    this.id = id;
    this.name = name;
    this.tier = tier;
    this.mode = mode;
    this.variables = variables;
  }
}

export class ThemeCatalog {
  constructor() {
    this.palettes = [
      new ThemePalette({
        id: 'light',
        name: 'Day',
        tier: 'free',
        mode: 'light',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(255, 201, 125, 0.28), transparent 24%), linear-gradient(180deg, #fff8ef 0%, #fffefb 45%, #fff6f2 100%)',
          '--surface': '#ffffff',
          '--surface-muted': '#fffdf9',
          '--surface-soft': '#f8fafc',
          '--text-main': '#213547',
          '--text-muted': '#5b6471',
          '--accent': '#ffb347',
          '--accent-strong': '#af5c28',
          '--line': 'rgba(48, 66, 85, 0.12)',
          '--hero-shadow': '0 18px 48px rgba(88, 66, 40, 0.08)',
          '--nav-bg': 'rgba(255, 248, 239, 0.92)',
          '--ads-bg': 'linear-gradient(135deg, #17212b 0%, #243647 100%)',
        },
      }),
      new ThemePalette({
        id: 'night',
        name: 'Night',
        tier: 'free',
        mode: 'dark',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(88, 120, 255, 0.18), transparent 24%), linear-gradient(180deg, #0f1724 0%, #111b2b 45%, #17202f 100%)',
          '--surface': '#162132',
          '--surface-muted': '#1a2639',
          '--surface-soft': '#1d2b40',
          '--text-main': '#ecf3ff',
          '--text-muted': '#a8b6cb',
          '--accent': '#8eb8ff',
          '--accent-strong': '#ffd166',
          '--line': 'rgba(174, 198, 255, 0.14)',
          '--hero-shadow': '0 18px 48px rgba(4, 10, 24, 0.42)',
          '--nav-bg': 'rgba(15, 23, 36, 0.9)',
          '--ads-bg': 'linear-gradient(135deg, #08111f 0%, #152741 100%)',
        },
      }),
      new ThemePalette({
        id: 'amber-glow',
        name: 'Amber Glow',
        tier: 'premium',
        mode: 'light',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(255, 173, 96, 0.32), transparent 25%), linear-gradient(180deg, #fff4ea 0%, #fffaf4 50%, #fff1e8 100%)',
          '--surface': '#fffdf9',
          '--surface-muted': '#fff6ef',
          '--surface-soft': '#fff1e7',
          '--text-main': '#2d221b',
          '--text-muted': '#6f5c51',
          '--accent': '#ff9b54',
          '--accent-strong': '#b45e22',
          '--line': 'rgba(111, 92, 81, 0.14)',
          '--hero-shadow': '0 18px 48px rgba(180, 94, 34, 0.12)',
          '--nav-bg': 'rgba(255, 244, 234, 0.92)',
          '--ads-bg': 'linear-gradient(135deg, #61361b 0%, #a35e22 100%)',
        },
      }),
      new ThemePalette({
        id: 'ocean-breeze',
        name: 'Ocean Breeze',
        tier: 'premium',
        mode: 'light',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(91, 192, 235, 0.24), transparent 25%), linear-gradient(180deg, #edf8ff 0%, #f7fcff 50%, #edf7f9 100%)',
          '--surface': '#fdfefe',
          '--surface-muted': '#f1f8fc',
          '--surface-soft': '#e8f4fb',
          '--text-main': '#173449',
          '--text-muted': '#567285',
          '--accent': '#4ea8de',
          '--accent-strong': '#277da1',
          '--line': 'rgba(39, 125, 161, 0.16)',
          '--hero-shadow': '0 18px 48px rgba(78, 168, 222, 0.12)',
          '--nav-bg': 'rgba(237, 248, 255, 0.92)',
          '--ads-bg': 'linear-gradient(135deg, #0f3b50 0%, #277da1 100%)',
        },
      }),
      new ThemePalette({
        id: 'forest-moss',
        name: 'Forest Moss',
        tier: 'premium',
        mode: 'light',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(90, 160, 120, 0.2), transparent 24%), linear-gradient(180deg, #eff8f1 0%, #f8fcf8 48%, #eef8f0 100%)',
          '--surface': '#fcfffc',
          '--surface-muted': '#f1f8f1',
          '--surface-soft': '#e8f3e8',
          '--text-main': '#1e3426',
          '--text-muted': '#5c7462',
          '--accent': '#5aa07a',
          '--accent-strong': '#2f6f4b',
          '--line': 'rgba(47, 111, 75, 0.16)',
          '--hero-shadow': '0 18px 48px rgba(47, 111, 75, 0.12)',
          '--nav-bg': 'rgba(239, 248, 241, 0.92)',
          '--ads-bg': 'linear-gradient(135deg, #173225 0%, #2f6f4b 100%)',
        },
      }),
      new ThemePalette({
        id: 'rose-clay',
        name: 'Rose Clay',
        tier: 'premium',
        mode: 'light',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(221, 152, 152, 0.24), transparent 24%), linear-gradient(180deg, #fff1f1 0%, #fff9f7 46%, #fdf0ec 100%)',
          '--surface': '#fffdfd',
          '--surface-muted': '#fff4f2',
          '--surface-soft': '#fdeceb',
          '--text-main': '#3d2529',
          '--text-muted': '#80646a',
          '--accent': '#d48a8a',
          '--accent-strong': '#a45b67',
          '--line': 'rgba(164, 91, 103, 0.16)',
          '--hero-shadow': '0 18px 48px rgba(164, 91, 103, 0.12)',
          '--nav-bg': 'rgba(255, 241, 241, 0.92)',
          '--ads-bg': 'linear-gradient(135deg, #5b3038 0%, #a45b67 100%)',
        },
      }),
      new ThemePalette({
        id: 'midnight-neon',
        name: 'Midnight Neon',
        tier: 'premium',
        mode: 'dark',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(115, 103, 240, 0.3), transparent 24%), linear-gradient(180deg, #0c1020 0%, #121936 48%, #10192b 100%)',
          '--surface': '#141c31',
          '--surface-muted': '#18233d',
          '--surface-soft': '#1e2c4b',
          '--text-main': '#edf2ff',
          '--text-muted': '#a6b0d1',
          '--accent': '#7c8cff',
          '--accent-strong': '#3dd6d0',
          '--line': 'rgba(124, 140, 255, 0.2)',
          '--hero-shadow': '0 18px 48px rgba(1, 5, 15, 0.5)',
          '--nav-bg': 'rgba(12, 16, 32, 0.9)',
          '--ads-bg': 'linear-gradient(135deg, #090d18 0%, #1a2452 100%)',
        },
      }),
      new ThemePalette({
        id: 'nordic-frost',
        name: 'Nordic Frost',
        tier: 'premium',
        mode: 'light',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(171, 206, 214, 0.28), transparent 24%), linear-gradient(180deg, #f1f8fa 0%, #fbfefe 50%, #edf5f8 100%)',
          '--surface': '#ffffff',
          '--surface-muted': '#f4fafb',
          '--surface-soft': '#eaf4f6',
          '--text-main': '#20343d',
          '--text-muted': '#687f88',
          '--accent': '#78a9b5',
          '--accent-strong': '#476e77',
          '--line': 'rgba(71, 110, 119, 0.14)',
          '--hero-shadow': '0 18px 48px rgba(71, 110, 119, 0.12)',
          '--nav-bg': 'rgba(241, 248, 250, 0.92)',
          '--ads-bg': 'linear-gradient(135deg, #27444b 0%, #476e77 100%)',
        },
      }),
      new ThemePalette({
        id: 'sunset-pop',
        name: 'Sunset Pop',
        tier: 'premium',
        mode: 'dark',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(255, 126, 95, 0.24), transparent 24%), linear-gradient(180deg, #251423 0%, #301626 45%, #1f1e32 100%)',
          '--surface': '#2b1d2e',
          '--surface-muted': '#342239',
          '--surface-soft': '#3c2740',
          '--text-main': '#fff2ef',
          '--text-muted': '#d9b6b0',
          '--accent': '#ff7e5f',
          '--accent-strong': '#feb47b',
          '--line': 'rgba(254, 180, 123, 0.18)',
          '--hero-shadow': '0 18px 48px rgba(0, 0, 0, 0.44)',
          '--nav-bg': 'rgba(37, 20, 35, 0.9)',
          '--ads-bg': 'linear-gradient(135deg, #251423 0%, #5d2f42 100%)',
        },
      }),
      new ThemePalette({
        id: 'graphite-luxe',
        name: 'Graphite Luxe',
        tier: 'premium',
        mode: 'dark',
        variables: {
          '--app-bg':
            'radial-gradient(circle at top, rgba(212, 175, 55, 0.12), transparent 24%), linear-gradient(180deg, #111315 0%, #171a1d 48%, #1b1e23 100%)',
          '--surface': '#1c2025',
          '--surface-muted': '#232930',
          '--surface-soft': '#2a3038',
          '--text-main': '#f5f1e7',
          '--text-muted': '#beb8a8',
          '--accent': '#d4af37',
          '--accent-strong': '#f0d98a',
          '--line': 'rgba(212, 175, 55, 0.18)',
          '--hero-shadow': '0 18px 48px rgba(0, 0, 0, 0.48)',
          '--nav-bg': 'rgba(17, 19, 21, 0.9)',
          '--ads-bg': 'linear-gradient(135deg, #0f1114 0%, #232930 100%)',
        },
      }),
    ];
  }

  getPalette(paletteId) {
    return this.palettes.find(palette => palette.id === paletteId) ?? this.palettes[0];
  }

  getFreePalettes() {
    return this.palettes.filter(palette => palette.tier === 'free');
  }

  getPremiumPalettes() {
    return this.palettes.filter(palette => palette.tier === 'premium');
  }

  applyPalette(paletteId, target = document.documentElement) {
    const palette = this.getPalette(paletteId);
    Object.entries(palette.variables).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });

    const menuRuntime = palette.mode === 'dark'
      ? {
          '--menu-panel-bg': 'rgba(8, 14, 26, 0.96)',
          '--menu-panel-text': '#f5f8ff',
          '--menu-panel-muted': 'rgba(255, 255, 255, 0.72)',
          '--menu-item-bg': 'rgba(255, 255, 255, 0.08)',
          '--menu-item-active': 'rgba(255, 255, 255, 0.18)',
          '--menu-trigger-bg': '#f5f8ff',
          '--menu-trigger-line': '#0d1726',
        }
      : {
          '--menu-panel-bg': '#20364d',
          '--menu-panel-text': '#f9fbff',
          '--menu-panel-muted': 'rgba(249, 251, 255, 0.76)',
          '--menu-item-bg': 'rgba(255, 255, 255, 0.08)',
          '--menu-item-active': 'rgba(255, 255, 255, 0.18)',
          '--menu-trigger-bg': '#20364d',
          '--menu-trigger-line': '#ffffff',
        };

    Object.entries(menuRuntime).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });

    target.dataset.theme = palette.id;
    target.style.setProperty('color-scheme', palette.mode);
    return palette;
  }
}
