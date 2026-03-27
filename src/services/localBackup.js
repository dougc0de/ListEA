const BACKUP_TYPE = 'listea-local-backup';
const BACKUP_VERSION = 1;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function ensureSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Este entorno no soporta cifrado local.');
  }
  return subtle;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  return Buffer.from(binary, 'binary').toString('base64');
}

function base64ToUint8Array(value) {
  const binary = typeof atob === 'function'
    ? atob(value)
    : Buffer.from(value, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveEncryptionKey(passphrase, salt) {
  const subtle = ensureSubtleCrypto();
  const baseKey = await subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function validateBackupDocument(document) {
  if (!document || typeof document !== 'object') {
    throw new Error('El respaldo no tiene un formato valido.');
  }

  if (document.type !== BACKUP_TYPE) {
    throw new Error('Este archivo no parece ser un respaldo de ListEA.');
  }

  if (document.version !== BACKUP_VERSION) {
    throw new Error('La version del respaldo no es compatible.');
  }
}

export function buildBackupDocument(snapshot = {}, metadata = {}) {
  return {
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    encrypted: false,
    appName: metadata.appName ?? 'ListEA',
    exportedAt: metadata.exportedAt ?? new Date().toISOString(),
    data: {
      tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks : [],
      analytics: Array.isArray(snapshot.analytics) ? snapshot.analytics : [],
      preferences: snapshot.preferences && typeof snapshot.preferences === 'object'
        ? snapshot.preferences
        : {},
    },
  };
}

export async function serializeBackupDocument(snapshot = {}, options = {}) {
  const document = buildBackupDocument(snapshot, options);
  if (!options.encrypted) {
    return JSON.stringify(document, null, 2);
  }

  const passphrase = `${options.passphrase ?? ''}`;
  if (!passphrase.trim()) {
    throw new Error('Escribe una frase de respaldo para cifrar el archivo.');
  }

  const subtle = ensureSubtleCrypto();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, salt);
  const payload = textEncoder.encode(JSON.stringify(document.data));
  const encryptedPayload = await subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);

  return JSON.stringify({
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    encrypted: true,
    appName: document.appName,
    exportedAt: document.exportedAt,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2',
    iterations: 250000,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    payload: arrayBufferToBase64(encryptedPayload),
  }, null, 2);
}

export async function parseBackupDocument(rawText, options = {}) {
  const parsed = JSON.parse(rawText);
  validateBackupDocument(parsed);

  if (!parsed.encrypted) {
    return parsed.data;
  }

  const passphrase = `${options.passphrase ?? ''}`;
  if (!passphrase.trim()) {
    throw new Error('Este respaldo esta cifrado. Necesitas la frase de respaldo.');
  }

  const subtle = ensureSubtleCrypto();
  const key = await deriveEncryptionKey(
    passphrase,
    base64ToUint8Array(parsed.salt),
  );

  try {
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToUint8Array(parsed.iv) },
      key,
      base64ToUint8Array(parsed.payload),
    );
    return JSON.parse(textDecoder.decode(decrypted));
  } catch {
    throw new Error('No se pudo descifrar el respaldo. Verifica la frase.');
  }
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.onload = () => resolve(`${reader.result ?? ''}`);
    reader.readAsText(file);
  });
}

export async function downloadBackupFile(snapshot = {}, options = {}) {
  const text = await serializeBackupDocument(snapshot, options);
  const fileSuffix = options.encrypted ? 'secure-backup.json' : 'backup.json';
  const safeDate = new Date().toISOString().slice(0, 10);
  const fileName = `${options.fileNamePrefix ?? 'listea'}-${safeDate}-${fileSuffix}`;

  if (typeof document !== 'undefined') {
    const blob = new Blob([text], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return { fileName, text };
}
