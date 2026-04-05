import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import {
  CapacitorVoiceRecorder,
  RecordingError,
} from '@lgicc/capacitor-voice-recorder';
import { QuickCaptureInterpreter } from '../domain/quickCapture';
import { CAPTURE_SOURCES } from '../domain/tasks';
import {
  AppLaunchAgent,
  FollowUpAgent,
  ReminderActionAgent,
  TASK_ASSISTANT_SOURCES,
  TaskAssistantOrchestrator,
  TextStructuringAgent,
  VoiceCaptureAgent,
} from '../domain/taskAssistant';

export const VOICE_CAPTURE_STATES = Object.freeze({
  IDLE: 'idle',
  STARTING: 'starting',
  RECORDING: 'recording',
  STOPPING: 'stopping',
  ERROR: 'error',
});

const DEFAULT_LANGUAGE = 'es-MX';
const DEFAULT_WAVE_POINTS = 18;

function normalizeText(value) {
  return `${value ?? ''}`.replace(/\s+/g, ' ').trim();
}

function decodeBase64(value = '') {
  if (!value) return [];

  if (typeof atob === 'function') {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }

  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }

  return [];
}

function toWaveSamples(bytes = [], points = DEFAULT_WAVE_POINTS) {
  if (!bytes.length) {
    return Array.from({ length: points }, () => 0.12);
  }

  const bucketSize = Math.max(Math.floor(bytes.length / points), 1);
  return Array.from({ length: points }, (_, index) => {
    const slice = bytes.slice(index * bucketSize, (index + 1) * bucketSize);
    if (!slice.length) return 0.12;
    const average = slice.reduce((total, value) => total + value, 0) / slice.length;
    return Number(Math.max(0.12, Math.min(1, average / 255)).toFixed(2));
  });
}

function resolveVoiceErrorMessage(error, fallback = 'No pudimos convertir tu voz en tarea.') {
  if (error instanceof VoiceCaptureError) {
    return error.message;
  }

  const message = normalizeText(error?.message);
  if (!message) return fallback;

  if (/permission|denied|not granted|microphone/i.test(message)) {
    return 'ListEA necesita permiso de microfono para capturar tu tarea por voz.';
  }

  if (/not supported|unsupported|available/i.test(message)) {
    return 'La captura por voz no esta disponible en este dispositivo o navegador.';
  }

  return message;
}

function normalizePermissionState(permission = '') {
  const value = normalizeText(permission).toLowerCase();
  return value || 'unknown';
}

function createEmptyWaveform(points = DEFAULT_WAVE_POINTS) {
  return Array.from({ length: points }, () => 0.12);
}

function normalizeMatches(matches = []) {
  if (!Array.isArray(matches)) return '';
  const [bestMatch = ''] = matches;
  return normalizeText(bestMatch);
}

export class VoiceCaptureError extends Error {
  constructor(message, code = 'voice-capture-failed') {
    super(message);
    this.name = 'VoiceCaptureError';
    this.code = code;
  }
}

export class VoiceCaptureResult {
  constructor({
    transcript = '',
    interpretation = null,
    draft = null,
    durationMs = 0,
    waveform = [],
    appSuggestions = [],
    assistantResult = {},
  } = {}) {
    this.transcript = normalizeText(transcript);
    this.interpretation = interpretation ?? null;
    this.draft = draft ?? null;
    this.durationMs = Number.isFinite(Number(durationMs)) ? Number(durationMs) : 0;
    this.waveform = Array.isArray(waveform) ? waveform : [];
    this.appSuggestions = Array.isArray(appSuggestions) ? appSuggestions : [];
    this.assistantResult = assistantResult && typeof assistantResult === 'object' ? assistantResult : {};
  }
}

export class NativeSpeechRecognitionGateway {
  async isSupported() {
    try {
      const result = await SpeechRecognition.available();
      return Boolean(result?.available);
    } catch {
      return false;
    }
  }

  async ensurePermissions() {
    const permissionStatus = await SpeechRecognition.checkPermissions();
    if (normalizePermissionState(permissionStatus?.speechRecognition) === 'granted') {
      return permissionStatus;
    }

    const requestedPermission = await SpeechRecognition.requestPermissions();
    if (normalizePermissionState(requestedPermission?.speechRecognition) !== 'granted') {
      throw new VoiceCaptureError('ListEA necesita permiso de voz para escuchar tu tarea.', 'speech-permission-denied');
    }

    return requestedPermission;
  }

  async startSession({ language = DEFAULT_LANGUAGE, onTranscript, onStateChange } = {}) {
    const handles = [];

    const attachListener = async (eventName, listener) => {
      const handle = await SpeechRecognition.addListener(eventName, listener);
      handles.push(handle);
      return handle;
    };

    await attachListener('partialResults', data => {
      const transcript = normalizeMatches(data?.matches);
      if (transcript) {
        onTranscript?.({
          text: transcript,
          isFinal: false,
        });
      }
    });

    await attachListener('listeningState', data => {
      onStateChange?.(normalizeText(data?.status).toLowerCase());
    });

    const result = await SpeechRecognition.start({
      language,
      maxResults: 5,
      partialResults: true,
      popup: false,
    });
    const directTranscript = normalizeMatches(result?.matches);
    if (directTranscript) {
      onTranscript?.({
        text: directTranscript,
        isFinal: true,
      });
    }
    onStateChange?.('started');

    return {
      stop: async () => {
        try {
          await SpeechRecognition.stop();
          onStateChange?.('stopped');
        } finally {
          await Promise.all(handles.map(handle => handle?.remove?.()));
        }
      },
      cancel: async () => {
        try {
          await SpeechRecognition.stop();
        } finally {
          await Promise.all(handles.map(handle => handle?.remove?.()));
        }
      },
    };
  }
}

export class BrowserSpeechRecognitionGateway {
  constructor({ win = typeof window !== 'undefined' ? window : undefined } = {}) {
    this.win = win;
  }

  getConstructor() {
    return this.win?.SpeechRecognition ?? this.win?.webkitSpeechRecognition ?? null;
  }

  async isSupported() {
    return Boolean(this.getConstructor());
  }

  async ensurePermissions() {
    return { speechRecognition: 'granted' };
  }

  async startSession({ language = DEFAULT_LANGUAGE, onTranscript, onStateChange } = {}) {
    const RecognitionConstructor = this.getConstructor();
    if (!RecognitionConstructor) {
      throw new VoiceCaptureError('La captura por voz no esta disponible en este navegador.', 'speech-not-supported');
    }

    const recognition = new RecognitionConstructor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let endResolver = () => {};
    let endRejecter = () => {};
    let ended = false;
    const endPromise = new Promise((resolve, reject) => {
      endResolver = resolve;
      endRejecter = reject;
    });

    recognition.onresult = event => {
      let currentTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = normalizeText(result?.[0]?.transcript);
        if (!transcript) continue;
        currentTranscript = transcript;
        onTranscript?.({
          text: transcript,
          isFinal: Boolean(result?.isFinal),
        });
      }

      if (!currentTranscript) return;
      onStateChange?.('started');
    };

    recognition.onerror = event => {
      if (ended) return;
      endRejecter(new VoiceCaptureError(
        resolveVoiceErrorMessage(event, 'No pudimos escuchar tu voz en este navegador.'),
        'speech-browser-error',
      ));
    };

    recognition.onend = () => {
      ended = true;
      onStateChange?.('stopped');
      endResolver();
    };

    await new Promise((resolve, reject) => {
      recognition.onstart = () => {
        onStateChange?.('started');
        resolve();
      };

      try {
        recognition.start();
      } catch (error) {
        reject(new VoiceCaptureError(
          resolveVoiceErrorMessage(error, 'No pudimos iniciar la captura por voz.'),
          'speech-browser-start-failed',
        ));
      }
    });

    return {
      stop: async () => {
        if (!ended) {
          recognition.stop();
        }
        await endPromise;
      },
      cancel: async () => {
        if (!ended) {
          recognition.abort?.();
          recognition.stop?.();
        }
      },
    };
  }
}

export class HybridSpeechRecognitionGateway {
  constructor({
    nativeGateway = new NativeSpeechRecognitionGateway(),
    browserGateway = new BrowserSpeechRecognitionGateway(),
  } = {}) {
    this.nativeGateway = nativeGateway;
    this.browserGateway = browserGateway;
  }

  resolveGateway() {
    return Capacitor.isNativePlatform() ? this.nativeGateway : this.browserGateway;
  }

  async isSupported() {
    return this.resolveGateway().isSupported();
  }

  async ensurePermissions() {
    return this.resolveGateway().ensurePermissions();
  }

  async startSession(options = {}) {
    return this.resolveGateway().startSession(options);
  }
}

export class CapacitorVoiceRecorderGateway {
  async ensurePermissions() {
    const currentStatus = await CapacitorVoiceRecorder.canRecord();
    if (currentStatus?.status === 'GRANTED') {
      return true;
    }

    if (currentStatus?.status === 'DEVICE_NOT_SUPPORTED') {
      return false;
    }

    if (currentStatus?.status === 'DISABLED_BY_USER') {
      return false;
    }

    try {
      await CapacitorVoiceRecorder.requestPermission();
    } catch {
      return false;
    }

    const nextStatus = await CapacitorVoiceRecorder.canRecord();
    return nextStatus?.status === 'GRANTED';
  }

  async startSession({ onFrequency } = {}) {
    const hasPermission = await this.ensurePermissions();
    if (!hasPermission) {
      return null;
    }

    let handle = null;
    try {
      handle = await CapacitorVoiceRecorder.addListener('frequencyData', data => {
        const waveform = toWaveSamples(decodeBase64(data?.base64));
        onFrequency?.(waveform);
      });
      await CapacitorVoiceRecorder.startRecording();
    } catch (error) {
      await handle?.remove?.();
      await CapacitorVoiceRecorder.removeAllListeners?.();
      if (error?.code === RecordingError.MICROPHONE_IN_USE) {
        return null;
      }
      return null;
    }

    return {
      stop: async () => {
        try {
          const result = await CapacitorVoiceRecorder.stopRecording();
          return {
            durationMs: Number(result?.msDuration) || 0,
            size: Number(result?.size) || 0,
          };
        } finally {
          await handle?.remove?.();
          await CapacitorVoiceRecorder.removeAllListeners?.();
        }
      },
      cancel: async () => {
        try {
          const status = await CapacitorVoiceRecorder.getCurrentStatus?.();
          if (status?.status !== 'NOT_RECORDING') {
            await CapacitorVoiceRecorder.stopRecording();
          }
        } catch {
          // Ignore stop failures during cancellation.
        } finally {
          await handle?.remove?.();
          await CapacitorVoiceRecorder.removeAllListeners?.();
        }
      },
    };
  }
}

export class VoiceCaptureSession {
  constructor({
    interpreter = new QuickCaptureInterpreter(),
    speechGateway = new HybridSpeechRecognitionGateway(),
    recorderGateway = new CapacitorVoiceRecorderGateway(),
    orchestrator = new TaskAssistantOrchestrator({
      agents: [
        new VoiceCaptureAgent(),
        new TextStructuringAgent({ interpreter }),
        new AppLaunchAgent(),
        new FollowUpAgent(),
        new ReminderActionAgent(),
      ],
    }),
    language = DEFAULT_LANGUAGE,
    onWaveform,
    onTranscript,
    onStateChange,
  } = {}) {
    this.interpreter = interpreter;
    this.speechGateway = speechGateway;
    this.recorderGateway = recorderGateway;
    this.orchestrator = orchestrator;
    this.language = language;
    this.onWaveform = onWaveform;
    this.onTranscript = onTranscript;
    this.onStateChange = onStateChange;
    this.state = VOICE_CAPTURE_STATES.IDLE;
    this.waveform = createEmptyWaveform();
    this.partialTranscript = '';
    this.finalTranscript = '';
    this.startedAt = 0;
    this.speechSession = null;
    this.recorderSession = null;
  }

  setState(nextState) {
    this.state = nextState;
    this.onStateChange?.(nextState);
  }

  setWaveform(nextWaveform = []) {
    this.waveform = Array.isArray(nextWaveform) && nextWaveform.length
      ? nextWaveform
      : createEmptyWaveform();
    this.onWaveform?.(this.waveform);
  }

  handleTranscript({ text = '', isFinal = false } = {}) {
    const transcript = normalizeText(text);
    if (!transcript) return;
    if (isFinal) {
      this.finalTranscript = transcript;
    } else {
      this.partialTranscript = transcript;
    }
    this.onTranscript?.({
      transcript,
      isFinal,
    });
  }

  async start() {
    const supported = await this.speechGateway.isSupported();
    if (!supported) {
      throw new VoiceCaptureError('La captura por voz no esta disponible en este dispositivo o navegador.', 'speech-not-supported');
    }

    this.setState(VOICE_CAPTURE_STATES.STARTING);
    this.setWaveform(createEmptyWaveform());

    await this.speechGateway.ensurePermissions();
    this.speechSession = await this.speechGateway.startSession({
      language: this.language,
      onTranscript: payload => this.handleTranscript(payload),
      onStateChange: status => {
        if (status === 'started') {
          this.setState(VOICE_CAPTURE_STATES.RECORDING);
        }
      },
    });

    this.recorderSession = await this.recorderGateway.startSession({
      onFrequency: waveform => this.setWaveform(waveform),
    });

    this.startedAt = Date.now();
    this.setState(VOICE_CAPTURE_STATES.RECORDING);
  }

  async buildResult(recorderSummary = {}) {
    const transcript = this.finalTranscript || this.partialTranscript;
    if (!transcript) {
      throw new VoiceCaptureError('No detectamos una tarea clara en tu audio. Intenta hablar una accion concreta.', 'empty-transcript');
    }

    const assistantContext = await this.orchestrator.run({
      sourceType: TASK_ASSISTANT_SOURCES.VOICE,
      rawInput: transcript,
      transcript,
      metadata: {
        capturedAt: new Date().toISOString(),
      },
      capabilities: {
        voice: true,
      },
    });
    const interpretation = assistantContext.interpretation ?? this.interpreter.interpret(transcript);
    const draft = assistantContext.draft;
    if (!normalizeText(draft?.title)) {
      throw new VoiceCaptureError('No detectamos una tarea clara en tu audio. Intenta hablar una accion concreta.', 'missing-title');
    }

    return new VoiceCaptureResult({
      transcript,
      interpretation,
      draft: {
        ...draft,
        source: draft?.source || CAPTURE_SOURCES.VOICE,
      },
      durationMs: recorderSummary?.durationMs || Math.max(Date.now() - this.startedAt, 0),
      waveform: this.waveform,
      appSuggestions: assistantContext.appSuggestions,
      assistantResult: assistantContext.result,
    });
  }

  async stop() {
    if (this.state === VOICE_CAPTURE_STATES.IDLE) {
      throw new VoiceCaptureError('No hay una captura por voz en progreso.', 'not-recording');
    }

    this.setState(VOICE_CAPTURE_STATES.STOPPING);

    let recorderSummary = {
      durationMs: Math.max(Date.now() - this.startedAt, 0),
      size: 0,
    };

    try {
      await this.speechSession?.stop?.();
      recorderSummary = await this.recorderSession?.stop?.() ?? recorderSummary;
      const result = await this.buildResult(recorderSummary);
      this.setState(VOICE_CAPTURE_STATES.IDLE);
      return result;
    } catch (error) {
      this.setState(VOICE_CAPTURE_STATES.ERROR);
      throw new VoiceCaptureError(resolveVoiceErrorMessage(error), error?.code || 'voice-stop-failed');
    } finally {
      this.speechSession = null;
      this.recorderSession = null;
    }
  }

  async cancel() {
    await Promise.allSettled([
      this.speechSession?.cancel?.(),
      this.recorderSession?.cancel?.(),
    ]);
    this.speechSession = null;
    this.recorderSession = null;
    this.partialTranscript = '';
    this.finalTranscript = '';
    this.setWaveform(createEmptyWaveform());
    this.setState(VOICE_CAPTURE_STATES.IDLE);
  }
}

export class VoiceTaskCaptureService {
  constructor({
    interpreter = new QuickCaptureInterpreter(),
    speechGateway = new HybridSpeechRecognitionGateway(),
    recorderGateway = new CapacitorVoiceRecorderGateway(),
    orchestrator = new TaskAssistantOrchestrator({
      agents: [
        new VoiceCaptureAgent(),
        new TextStructuringAgent({ interpreter }),
        new AppLaunchAgent(),
        new FollowUpAgent(),
        new ReminderActionAgent(),
      ],
    }),
  } = {}) {
    this.interpreter = interpreter;
    this.speechGateway = speechGateway;
    this.recorderGateway = recorderGateway;
    this.orchestrator = orchestrator;
  }

  async isSupported() {
    return this.speechGateway.isSupported();
  }

  createSession(options = {}) {
    return new VoiceCaptureSession({
      interpreter: this.interpreter,
      speechGateway: this.speechGateway,
      recorderGateway: this.recorderGateway,
      orchestrator: this.orchestrator,
      ...options,
    });
  }
}
