const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'file:']);
const CUSTOM_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:$/;

function getProtocol(url) {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*:)/.exec(`${url ?? ''}`.trim());
  return (match?.[1] ?? '').toLowerCase();
}

function openWithAnchor(url, target = '_self') {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = target;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function openTaskExternalAction(action, { allowCustomScheme = false } = {}) {
  const url = `${action?.url ?? ''}`.trim();
  if (!url || typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const protocol = getProtocol(url);
  const protocolAllowed = ALLOWED_PROTOCOLS.has(protocol)
    || (
      allowCustomScheme
      && CUSTOM_PROTOCOL_PATTERN.test(protocol)
      && !BLOCKED_PROTOCOLS.has(protocol)
    );
  if (!protocolAllowed) {
    return false;
  }

  if (protocol === 'http:' || protocol === 'https:') {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (popup) {
      popup.opener = null;
      return true;
    }

    openWithAnchor(url, '_blank');
    return true;
  }

  openWithAnchor(url);
  return true;
}
