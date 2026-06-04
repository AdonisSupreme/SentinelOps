const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/,
    ),
);

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state !== 'installed') {
            return;
          }

          if (navigator.serviceWorker.controller) {
            config?.onUpdate?.(registration);
          } else {
            config?.onSuccess?.(registration);
          }
        };
      };
    })
    .catch((error) => {
      console.error('Service worker registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');

      if (
        response.status === 404 ||
        (contentType != null && !contentType.includes('javascript'))
      ) {
        navigator.serviceWorker.ready
          .then((registration) => registration.unregister())
          .then(() => {
            window.location.reload();
          });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.info('SentinelOps is running without network connectivity. Offline shell mode is active.');
    });
}

export function register(config?: Config) {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    unregister();
    return;
  }

  const publicUrl = new URL(process.env.PUBLIC_URL || '', window.location.href);
  if (publicUrl.origin !== window.location.origin) {
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);

      navigator.serviceWorker.ready.then(() => {
        console.info('SentinelOps PWA shell is ready on localhost.');
      });
    } else {
      registerValidSW(swUrl, config);
    }
  });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => {
        console.error(error.message);
      });
  }
}
