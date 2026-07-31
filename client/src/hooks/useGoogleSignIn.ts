import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    google?: any;
  }
}

export const GOOGLE_CLIENT_ID: string = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? '';

/**
 * Renders an official Google Identity Services button into the returned ref.
 * No-ops when VITE_GOOGLE_CLIENT_ID is not configured (button stays hidden).
 */
export function useGoogleSignIn(onCredential: (credential: string) => void, enabled = true) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!enabled || !GOOGLE_CLIENT_ID || !buttonRef.current) return;

    let cancelled = false;

    function init() {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: { credential: string }) => callbackRef.current(resp.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        width: 320,
        text: 'continue_with',
      });
    }

    if (window.google?.accounts?.id) {
      init();
    } else {
      const existing = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
      const script = existing ?? document.createElement('script');
      if (!existing) {
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', init);
      return () => {
        cancelled = true;
        script.removeEventListener('load', init);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { buttonRef, googleEnabled: Boolean(GOOGLE_CLIENT_ID) };
}
