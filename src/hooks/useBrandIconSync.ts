import { useEffect } from 'react';
import {
  DEFAULT_FAVICON_PATH,
  formatAppDocumentTitle,
  resolveAppIconHref,
  syncFaviconLinks,
} from '../utils/faviconSync';

const TOUCH_ICON_SIZE = 180;

function rasterizeLogoToPng(href: string): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  if (/^data:image\/png;/i.test(href) || href.toLowerCase().endsWith('.png')) {
    return Promise.resolve(href);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = TOUCH_ICON_SIZE;
        canvas.height = TOUCH_ICON_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        const scale = Math.min(
          TOUCH_ICON_SIZE / (img.naturalWidth || TOUCH_ICON_SIZE),
          TOUCH_ICON_SIZE / (img.naturalHeight || TOUCH_ICON_SIZE)
        );
        const drawWidth = (img.naturalWidth || TOUCH_ICON_SIZE) * scale;
        const drawHeight = (img.naturalHeight || TOUCH_ICON_SIZE) * scale;
        const offsetX = (TOUCH_ICON_SIZE - drawWidth) / 2;
        const offsetY = (TOUCH_ICON_SIZE - drawHeight) / 2;
        ctx.clearRect(0, 0, TOUCH_ICON_SIZE, TOUCH_ICON_SIZE);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = href;
  });
}

/**
 * Keeps the browser favicon, apple-touch-icon and tab title synced with the
 * hotel establishment profile logo and name.
 */
export function useBrandIconSync(logoUrl?: string | null, hotelName?: string | null): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = formatAppDocumentTitle(hotelName);
  }, [hotelName]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let cancelled = false;
    const resolvedHref = resolveAppIconHref(logoUrl, DEFAULT_FAVICON_PATH);

    syncFaviconLinks(document, resolvedHref, resolvedHref);

    if (resolvedHref !== DEFAULT_FAVICON_PATH) {
      void rasterizeLogoToPng(resolvedHref).then((pngDataUrl) => {
        if (!cancelled && pngDataUrl) {
          // Use the rasterized PNG for both favicon and touch icon. PNG has broader browser support than SVG/data-URL combinations.
          syncFaviconLinks(document, pngDataUrl, pngDataUrl);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [logoUrl]);
}
