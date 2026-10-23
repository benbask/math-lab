/* MathLab - PWA install prompt and service worker registration. */
(function () {
  'use strict';

  const NS = window.MathLab = window.MathLab || {};
  const DISMISS_KEY = 'mathlab.pwa.installBannerDismissed';
  const listeners = new Set();

  const state = {
    promptEvent: null,
    prompting: false,
    installed: false,
    standalone: isStandalone(),
    ios: isIOS(),
    dismissed: readDismissed()
  };

  function isStandalone() {
    return Boolean(
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true
    );
  }

  function isIOS() {
    const ua = window.navigator.userAgent || '';
    const iPadOS = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || iPadOS;
  }

  function readDismissed() {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function writeDismissed(value) {
    state.dismissed = value;
    try {
      if (value) window.localStorage.setItem(DISMISS_KEY, '1');
      else window.localStorage.removeItem(DISMISS_KEY);
    } catch (_) {
      /* Storage can be unavailable in private or restricted contexts. */
    }
  }

  function snapshot() {
    return {
      canPrompt: Boolean(state.promptEvent) && !state.standalone && !state.installed,
      prompting: state.prompting,
      installed: state.installed,
      standalone: state.standalone,
      ios: state.ios,
      dismissed: state.dismissed,
      isIOS: state.ios,
      isInstalled: state.installed || state.standalone,
      shouldShowBanner: !state.installed
        && !state.standalone
        && !state.dismissed
        && (Boolean(state.promptEvent) || state.ios)
    };
  }

  function notify() {
    const details = snapshot();
    for (const listener of listeners) {
      try {
        listener(details);
      } catch (error) {
        console.warn('MathLab: listener PWA gagal.', error);
      }
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dismissBanner() {
    writeDismissed(true);
    notify();
  }

  function resetBannerDismissal() {
    writeDismissed(false);
    notify();
  }

  async function promptInstall() {
    if (state.prompting) return { outcome: 'busy' };
    if (!state.promptEvent) return { outcome: 'unavailable' };

    const promptEvent = state.promptEvent;
    state.prompting = true;
    notify();

    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      state.promptEvent = null;

      if (choice && choice.outcome === 'accepted') {
        state.installed = true;
        writeDismissed(true);
      }

      return choice || { outcome: 'dismissed' };
    } catch (error) {
      console.warn('MathLab: dialog pemasangan gagal.', error);
      return { outcome: 'error', error };
    } finally {
      state.prompting = false;
      if (state.installed) state.promptEvent = null;
      notify();
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const secureContext = window.location.protocol === 'https:'
      || window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1';
    if (!secureContext) return;

    navigator.serviceWorker.register('sw.js', {
      scope: './',
      updateViaCache: 'none'
    }).catch((error) => {
      console.warn('MathLab: service worker gagal didaftarkan.', error);
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.promptEvent = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    state.installed = true;
    state.promptEvent = null;
    writeDismissed(true);
    notify();
  });

  const standaloneQuery = window.matchMedia
    ? window.matchMedia('(display-mode: standalone)')
    : null;
  if (standaloneQuery) {
    const onDisplayModeChange = () => {
      state.standalone = isStandalone();
      if (state.standalone) state.installed = true;
      notify();
    };
    if (typeof standaloneQuery.addEventListener === 'function') {
      standaloneQuery.addEventListener('change', onDisplayModeChange);
    } else if (typeof standaloneQuery.addListener === 'function') {
      standaloneQuery.addListener(onDisplayModeChange);
    }
  }

  NS.PWA = {
    getState: snapshot,
    subscribe,
    promptInstall,
    dismissBanner,
    resetBannerDismissal,
    isStandalone,
    isIOS
  };

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true });
  }
})();
