import { describe, expect, it } from 'vitest';
import { TaskAppLaunchResolver } from '../taskAppLaunch';

describe('TaskAppLaunchResolver', () => {
  it('returns multiple compatible apps in the same task in mention order', () => {
    const resolver = new TaskAppLaunchResolver();
    const suggestions = resolver.resolve({
      title: 'Revisar LinkedIn y luego Instagram para el cliente',
      notes: '',
      project: '',
      area: '',
      tags: [],
    });

    expect(suggestions.map(suggestion => suggestion.id)).toEqual([
      'app-linkedin',
      'app-instagram',
    ]);
  });
});
