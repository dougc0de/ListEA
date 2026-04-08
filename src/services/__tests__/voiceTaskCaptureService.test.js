import { describe, expect, it, vi } from 'vitest';
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));
vi.mock('@capacitor-community/speech-recognition', () => ({
  SpeechRecognition: {},
}));
vi.mock('@lgicc/capacitor-voice-recorder', () => ({
  CapacitorVoiceRecorder: {},
  RecordingError: {
    NOT_RECORDING: 'NOT_RECORDING',
    DEVICE_NOT_SUPPORTED: 'DEVICE_NOT_SUPPORTED',
    MISSING_MICROPHONE_PERMISSION: 'MISSING_MICROPHONE_PERMISSION',
    MICROPHONE_IN_USE: 'MICROPHONE_IN_USE',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  },
}));
import {
  VOICE_CAPTURE_STATES,
  VoiceCaptureError,
  VoiceTaskCaptureService,
} from '../voiceTaskCaptureService';
import { Capacitor } from '@capacitor/core';

function createSpeechGateway({
  supported = true,
  permissionError = null,
  transcript = 'Llamar a Maria manana',
  final = true,
} = {}) {
  return {
    isSupported: vi.fn().mockResolvedValue(supported),
    ensurePermissions: permissionError
      ? vi.fn().mockRejectedValue(permissionError)
      : vi.fn().mockResolvedValue({ speechRecognition: 'granted' }),
    startSession: vi.fn().mockImplementation(async ({ onTranscript, onStateChange }) => {
      onStateChange?.('started');
      if (transcript) {
        onTranscript?.({
          text: transcript,
          isFinal: final,
        });
      }
      return {
        stop: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
}

function createRecorderGateway({
  durationMs = 1200,
  waveform = [0.2, 0.4, 0.6],
  active = true,
} = {}) {
  return {
    startSession: vi.fn().mockImplementation(async ({ onFrequency }) => {
      if (!active) return null;
      onFrequency?.(waveform);
      return {
        stop: vi.fn().mockResolvedValue({
          durationMs,
          size: 2048,
        }),
        cancel: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
}

describe('VoiceTaskCaptureService', () => {
  it('builds a voice draft from the recognized transcript', async () => {
    const speechGateway = createSpeechGateway({
      transcript: 'Llamar a Maria manana #ventas',
    });
    const recorderGateway = createRecorderGateway();
    const service = new VoiceTaskCaptureService({
      speechGateway,
      recorderGateway,
    });

    const session = service.createSession();
    await session.start();
    const result = await session.stop();

    expect(result.transcript).toBe('Llamar a Maria manana #ventas');
    expect(result.draft.source).toBe('voice');
    expect(result.draft.title).toContain('Llamar a Maria');
    expect(result.draft.tags).toContain('ventas');
    expect(result.durationMs).toBe(1200);
    expect(result.waveform).toEqual([0.2, 0.4, 0.6]);
    expect(session.state).toBe(VOICE_CAPTURE_STATES.IDLE);
  });

  it('works even when the recorder layer is unavailable and still saves from transcript', async () => {
    const speechGateway = createSpeechGateway({
      transcript: 'Preparar propuesta para cliente el viernes',
    });
    const recorderGateway = createRecorderGateway({ active: false });
    const service = new VoiceTaskCaptureService({
      speechGateway,
      recorderGateway,
    });

    const session = service.createSession();
    await session.start();
    const result = await session.stop();

    expect(result.draft.title).toContain('Preparar propuesta');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('surfaces permission errors before recording starts', async () => {
    const speechGateway = createSpeechGateway({
      permissionError: new VoiceCaptureError('Permiso denegado', 'speech-permission-denied'),
    });
    const service = new VoiceTaskCaptureService({
      speechGateway,
      recorderGateway: createRecorderGateway(),
    });

    const session = service.createSession();

    await expect(session.start()).rejects.toThrow('Permiso denegado');
    expect(session.state).toBe(VOICE_CAPTURE_STATES.STARTING);
  });

  it('fails with a clear error when no transcript was captured', async () => {
    const speechGateway = createSpeechGateway({
      transcript: '',
    });
    const service = new VoiceTaskCaptureService({
      speechGateway,
      recorderGateway: createRecorderGateway(),
    });

    const session = service.createSession();
    await session.start();

    await expect(session.stop()).rejects.toThrow('No detectamos una tarea clara en tu audio.');
    expect(session.state).toBe(VOICE_CAPTURE_STATES.ERROR);
  });

  it('falls back cleanly when the speech stop hook hangs and still saves from the last transcript', async () => {
    const speechGateway = {
      isSupported: vi.fn().mockResolvedValue(true),
      ensurePermissions: vi.fn().mockResolvedValue({ speechRecognition: 'granted' }),
      startSession: vi.fn().mockImplementation(async ({ onTranscript, onStateChange }) => {
        onStateChange?.('started');
        onTranscript?.({
          text: 'Mandar mensaje por WhatsApp a Maria',
          isFinal: false,
        });
        return {
          stop: vi.fn(() => new Promise(() => {})),
          cancel: vi.fn().mockResolvedValue(undefined),
        };
      }),
    };
    const service = new VoiceTaskCaptureService({
      speechGateway,
      recorderGateway: createRecorderGateway({ active: false }),
      stopTimeoutMs: 10,
    });

    const session = service.createSession();
    await session.start();
    const result = await session.stop();

    expect(result.draft.title).toContain('Mandar mensaje');
    expect(session.state).toBe(VOICE_CAPTURE_STATES.IDLE);
  });

  it('skips the parallel recorder layer on native platforms to avoid microphone contention', async () => {
    const nativeSpy = vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const recorderGateway = createRecorderGateway();
    const service = new VoiceTaskCaptureService({
      speechGateway: createSpeechGateway(),
      recorderGateway,
    });

    const session = service.createSession();
    await session.start();

    expect(recorderGateway.startSession).not.toHaveBeenCalled();
    await session.cancel();
    nativeSpy.mockRestore();
  });
});
