import { describe, expect, it, vi } from 'vitest';
import {
  ScreenshotTaskCaptureService,
} from '../screenshotTaskCaptureService';

function createImageFile(overrides = {}) {
  return {
    name: 'captura.png',
    type: 'image/png',
    size: 1024,
    ...overrides,
  };
}

describe('ScreenshotTaskCaptureService', () => {
  it('converts OCR text into a suggested task draft', async () => {
    const onProgress = vi.fn();
    const ocrGateway = {
      recognize: vi.fn(async (_file, options = {}) => {
        options.onProgress?.({ progress: 0.58, status: 'Reconociendo texto' });
        return 'Mandar mensaje por WhatsApp a Maria manana\nConfirmar presupuesto y siguiente paso';
      }),
    };
    const interpreter = {
      interpret: vi.fn().mockReturnValue({
        title: 'Mandar mensaje por WhatsApp a Maria',
        notes: 'Confirmar presupuesto y siguiente paso',
        dueAt: '2026-03-24T23:59:00.000Z',
        dueAtPrecision: 'date',
        followUpAt: '',
        followUpAtPrecision: '',
        priority: 'medium',
        status: 'active',
        tags: ['cliente'],
        project: '',
        area: '',
        effortMinutes: 10,
        recurrence: { preset: 'none', interval: 1, mode: 'fixed', resetNotes: true },
      }),
    };

    const service = new ScreenshotTaskCaptureService({ ocrGateway, interpreter });
    const result = await service.convert(createImageFile(), { onProgress });

    expect(interpreter.interpret).toHaveBeenCalledWith(
      'Mandar mensaje por WhatsApp a Maria manana\nConfirmar presupuesto y siguiente paso',
    );
    expect(result.rawText).toBe('Mandar mensaje por WhatsApp a Maria manana\nConfirmar presupuesto y siguiente paso');
    expect(result.interpretation.title).toBe('Mandar mensaje por WhatsApp a Maria');
    expect(result.interpretation.notes).toBe('Confirmar presupuesto y siguiente paso');
    expect(onProgress).toHaveBeenCalled();
  });

  it('falls back to the first OCR line when the interpreter returns no title', async () => {
    const ocrGateway = {
      recognize: vi.fn().mockResolvedValue('Revisar tableros de ventas\nSlack y correo'),
    };
    const interpreter = {
      interpret: vi.fn().mockReturnValue({
        title: '',
        notes: '',
        recurrence: { preset: 'none', interval: 1, mode: 'fixed', resetNotes: true },
      }),
    };

    const service = new ScreenshotTaskCaptureService({ ocrGateway, interpreter });
    const result = await service.convert(createImageFile());

    expect(result.interpretation.title).toBe('Revisar tableros de ventas');
  });

  it('rejects non-image files before trying OCR', async () => {
    const service = new ScreenshotTaskCaptureService({
      ocrGateway: { recognize: vi.fn() },
      interpreter: { interpret: vi.fn() },
    });

    await expect(service.convert(createImageFile({
      name: 'captura.txt',
      type: 'text/plain',
    }))).rejects.toEqual(expect.objectContaining({
      name: 'ScreenshotCaptureError',
      code: 'invalid-file-type',
    }));
  });

  it('fails when OCR yields no useful text', async () => {
    const service = new ScreenshotTaskCaptureService({
      ocrGateway: { recognize: vi.fn().mockResolvedValue('   \n  ') },
      interpreter: { interpret: vi.fn() },
    });

    await expect(service.convert(createImageFile())).rejects.toEqual(expect.objectContaining({
      name: 'ScreenshotCaptureError',
      code: 'no-text-detected',
    }));
  });
});
