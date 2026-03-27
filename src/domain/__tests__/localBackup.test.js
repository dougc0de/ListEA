import { describe, expect, it } from 'vitest';
import { buildBackupDocument, parseBackupDocument, serializeBackupDocument } from '../../services/localBackup';

describe('local backup service', () => {
  it('builds and parses a plain backup document', async () => {
    const snapshot = {
      tasks: [{ id: 'task-1', title: 'Preparar propuesta' }],
      analytics: [{ id: 'event-1', type: 'completed' }],
      preferences: { themeMode: 'dark' },
    };

    const document = buildBackupDocument(snapshot, {
      exportedAt: '2026-03-27T02:00:00.000Z',
    });
    const parsed = await parseBackupDocument(JSON.stringify(document));

    expect(parsed.tasks[0].title).toBe('Preparar propuesta');
    expect(parsed.preferences.themeMode).toBe('dark');
  });

  it('encrypts and decrypts a backup document with a passphrase', async () => {
    const snapshot = {
      tasks: [{ id: 'task-1', title: 'Respaldo cifrado' }],
      analytics: [],
      preferences: { themeMode: 'light' },
    };

    const rawText = await serializeBackupDocument(snapshot, {
      encrypted: true,
      passphrase: 'clave-segura',
      exportedAt: '2026-03-27T02:00:00.000Z',
    });
    const parsed = await parseBackupDocument(rawText, {
      passphrase: 'clave-segura',
    });

    expect(parsed.tasks[0].title).toBe('Respaldo cifrado');
  });
});
