export const LAUNCH_INTENT_TYPES = Object.freeze({
  NAVIGATE: 'navigate',
  CAPTURE: 'capture',
  FOCUS_TASK: 'focus-task',
});

function getSearchParams(locationLike) {
  if (!locationLike) {
    return new URLSearchParams();
  }

  const search = `${locationLike.search ?? ''}`.trim();
  if (search) {
    return new URLSearchParams(search);
  }

  const hash = `${locationLike.hash ?? ''}`.trim().replace(/^#\??/, '');
  return new URLSearchParams(hash);
}

export function parseLaunchIntentFromLocation(locationLike = typeof window !== 'undefined' ? window.location : null) {
  const params = getSearchParams(locationLike);
  const captureText = params.get('capture') ?? params.get('text');
  const taskId = `${params.get('taskId') ?? ''}`.trim();
  const view = `${params.get('view') ?? ''}`.trim();

  if (captureText) {
    return {
      type: LAUNCH_INTENT_TYPES.CAPTURE,
      view: view || '',
      payload: {
        text: captureText,
        project: `${params.get('project') ?? ''}`.trim(),
        area: `${params.get('area') ?? ''}`.trim(),
        source: `${params.get('source') ?? 'share'}`.trim(),
      },
    };
  }

  if (taskId) {
    return {
      type: LAUNCH_INTENT_TYPES.FOCUS_TASK,
      view: view || '',
      taskId,
      source: `${params.get('source') ?? 'shortcut'}`.trim(),
    };
  }

  if (view) {
    return {
      type: LAUNCH_INTENT_TYPES.NAVIGATE,
      view,
      source: `${params.get('source') ?? 'shortcut'}`.trim(),
    };
  }

  return null;
}

export function dispatchLaunchIntent(intent) {
  if (typeof window === 'undefined' || !intent) return;

  window.dispatchEvent(new CustomEvent('listea:launch-intent', {
    detail: intent,
  }));
}

export function subscribeToLaunchIntents(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleIntent = event => {
    listener(event.detail);
  };

  window.addEventListener('listea:launch-intent', handleIntent);
  return () => {
    window.removeEventListener('listea:launch-intent', handleIntent);
  };
}
