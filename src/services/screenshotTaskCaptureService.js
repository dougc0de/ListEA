import { QuickCaptureInterpreter } from '../domain/quickCapture';

const DEFAULT_OCR_LANGUAGES = Object.freeze(['spa', 'eng']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']);
const DEFAULT_MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;

function clampProgress(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numericValue));
}

function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

function normalizeLine(line) {
  return normalizeText(line).replace(/\s+/g, ' ');
}

function extractExtension(fileName = '') {
  const [, extension = ''] = `${fileName}`.toLowerCase().match(/\.([a-z0-9]+)$/i) ?? [];
  return extension;
}

function resolveErrorMessage(error) {
  const message = normalizeText(error?.message);
  if (!message) {
    return 'No pudimos convertir el screenshot en tarea.';
  }

  if (/network|fetch|cors|worker|wasm|language|traineddata|lang/i.test(message)) {
    return 'No pudimos cargar el lector del screenshot ahora mismo.';
  }

  return message;
}

export class ScreenshotCaptureError extends Error {
  constructor(message, code = 'screenshot-capture-failed') {
    super(message);
    this.name = 'ScreenshotCaptureError';
    this.code = code;
  }
}

export class ScreenshotCaptureProgress {
  constructor({ progress = 0, status = '' } = {}) {
    this.progress = clampProgress(progress);
    this.status = normalizeText(status);
  }
}

export class ScreenshotTextSanitizer {
  normalize(rawText = '') {
    const lines = `${rawText ?? ''}`
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .split('\n')
      .map(normalizeLine);

    const compactedLines = [];
    for (const line of lines) {
      if (!line) {
        if (compactedLines[compactedLines.length - 1] !== '') {
          compactedLines.push('');
        }
        continue;
      }

      compactedLines.push(line);
    }

    return compactedLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export class TesseractOcrGateway {
  constructor({
    moduleLoader = () => import('tesseract.js'),
    languages = DEFAULT_OCR_LANGUAGES,
  } = {}) {
    this.moduleLoader = moduleLoader;
    this.languages = Array.isArray(languages) ? [...languages] : [languages];
  }

  async recognize(file, { onProgress } = {}) {
    const createWorker = await this.loadCreateWorker();
    let worker = null;

    try {
      onProgress?.(new ScreenshotCaptureProgress({
        progress: 0.06,
        status: 'Preparando OCR local',
      }));

      worker = await createWorker(this.languages, undefined, {
        logger: message => {
          onProgress?.(new ScreenshotCaptureProgress({
            progress: message?.progress,
            status: message?.status || 'Leyendo screenshot',
          }));
        },
      });

      await worker.setParameters?.({
        preserve_interword_spaces: '1',
      });

      const result = await worker.recognize(file);
      return normalizeText(result?.data?.text);
    } catch (error) {
      throw new ScreenshotCaptureError(resolveErrorMessage(error), 'ocr-failed');
    } finally {
      try {
        await worker?.terminate?.();
      } catch {
        // Ignore worker cleanup failures so the task flow can continue.
      }
    }
  }

  async loadCreateWorker() {
    const loadedModule = await this.moduleLoader();
    const createWorker = loadedModule?.createWorker ?? loadedModule?.default?.createWorker;

    if (typeof createWorker !== 'function') {
      throw new ScreenshotCaptureError('OCR no disponible en este dispositivo.', 'ocr-unavailable');
    }

    return createWorker;
  }
}

export class ScreenshotTaskCaptureService {
  constructor({
    ocrGateway = new TesseractOcrGateway(),
    interpreter = new QuickCaptureInterpreter(),
    sanitizer = new ScreenshotTextSanitizer(),
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
  } = {}) {
    this.ocrGateway = ocrGateway;
    this.interpreter = interpreter;
    this.sanitizer = sanitizer;
    this.maxFileSizeBytes = maxFileSizeBytes;
  }

  async convert(file, { onProgress } = {}) {
    this.validateFile(file);

    onProgress?.(new ScreenshotCaptureProgress({
      progress: 0.02,
      status: 'Preparando screenshot',
    }));

    const rawText = await this.ocrGateway.recognize(file, { onProgress });
    const normalizedText = this.sanitizer.normalize(rawText);

    if (!normalizedText) {
      throw new ScreenshotCaptureError('No se detecto texto util en el screenshot.', 'no-text-detected');
    }

    const interpretation = this.interpreter.interpret(normalizedText);
    const title = interpretation.title || normalizeText(normalizedText.split('\n')[0]);

    onProgress?.(new ScreenshotCaptureProgress({
      progress: 1,
      status: 'Tarea sugerida lista',
    }));

    return {
      rawText: normalizedText,
      interpretation: {
        ...interpretation,
        title,
      },
    };
  }

  validateFile(file) {
    if (!file) {
      throw new ScreenshotCaptureError('Selecciona un screenshot para convertirlo.', 'missing-file');
    }

    const fileType = `${file.type ?? ''}`.toLowerCase();
    const fileExtension = extractExtension(file.name);
    const isImage = fileType.startsWith('image/') || SUPPORTED_IMAGE_EXTENSIONS.has(fileExtension);

    if (!isImage) {
      throw new ScreenshotCaptureError('El archivo debe ser una imagen.', 'invalid-file-type');
    }

    if (Number(file.size) > this.maxFileSizeBytes) {
      throw new ScreenshotCaptureError('El screenshot es demasiado pesado para leerlo ahora.', 'file-too-large');
    }
  }
}
