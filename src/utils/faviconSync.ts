/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure helpers to keep the browser favicon, touch icon, document title and
 * in-app brand icon synchronized with the configured hotel logo.
 */

export const DEFAULT_FAVICON_PATH = '/favicon.svg';
export const DEFAULT_DOCUMENT_TITLE = 'Appointment PMS — Hotel & Resort Management';

const SAFE_DATA_IMAGE_RE =
  /^data:image\/(png|jpeg|jpg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon|gif)(?:;(?:utf8|charset=[^;,]+))?(?:;base64)?,/i;

export interface MinimalLinkElement {
  rel: string;
  href: string;
  type: string;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
}

export interface MinimalHeadLike {
  appendChild(node: never): unknown;
}

export interface MinimalDocumentLike {
  title: string;
  head: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appendChild(node: any): unknown;
  } | null;
  querySelectorAll(selector: string): ArrayLike<MinimalLinkElement>;
  createElement(tagName: string): MinimalLinkElement;
}

/**
 * Validates that a candidate hotel logo URL uses a safe image scheme or local asset path.
 */
export function sanitizeBrandIconUrl(rawUrl?: string | null): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  if (SAFE_DATA_IMAGE_RE.test(trimmed)) {
    return trimmed;
  }

  if (/^blob:/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Resolves the active app icon href from the configured hotel logo or default crest.
 */
export function resolveAppIconHref(
  logoUrl?: string | null,
  fallbackHref: string = DEFAULT_FAVICON_PATH
): string {
  return sanitizeBrandIconUrl(logoUrl) ?? fallbackHref;
}

/**
 * Infers the icon MIME type for `<link rel="icon" type="...">`.
 */
export function inferIconMimeType(href: string): string | undefined {
  const clean = href.trim();
  const dataMatch = /^data:(image\/[a-z0-9.+-]+)[;,]/i.exec(clean);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    return mime === 'image/jpg' ? 'image/jpeg' : mime;
  }

  const pathname = clean.split(/[?#]/, 1)[0].toLowerCase();
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.ico')) return 'image/x-icon';
  if (pathname.endsWith('.gif')) return 'image/gif';
  return undefined;
}

/**
 * Formats the browser tab title with the configured hotel name when available.
 */
export function formatAppDocumentTitle(hotelName?: string | null): string {
  const trimmed = typeof hotelName === 'string' ? hotelName.trim() : '';
  return trimmed ? `${trimmed} — Appointment PMS` : DEFAULT_DOCUMENT_TITLE;
}

function updateOrCreateIconLink(
  doc: MinimalDocumentLike,
  selector: string,
  rel: string,
  href: string
): void {
  const existing = Array.from(doc.querySelectorAll(selector));
  const mime = inferIconMimeType(href);

  if (existing.length > 0) {
    for (const link of existing) {
      link.setAttribute('href', href);
      if (mime) {
        link.setAttribute('type', mime);
      } else {
        link.removeAttribute('type');
      }
    }
    return;
  }

  if (!doc.head) return;
  const link = doc.createElement('link');
  link.setAttribute('rel', rel);
  if (mime) {
    link.setAttribute('type', mime);
  }
  link.setAttribute('href', href);
  doc.head.appendChild(link);
}

/**
 * Synchronizes `<link rel="icon">` and `<link rel="apple-touch-icon">` in `document.head`.
 */
export function syncFaviconLinks(
  doc: MinimalDocumentLike,
  iconHref: string,
  appleTouchHref?: string
): void {
  const safeIcon = resolveAppIconHref(iconHref);
  const safeTouch = resolveAppIconHref(appleTouchHref ?? safeIcon, safeIcon);

  updateOrCreateIconLink(doc, 'link[rel="icon"], link[rel="shortcut icon"]', 'icon', safeIcon);
  updateOrCreateIconLink(doc, 'link[rel="apple-touch-icon"]', 'apple-touch-icon', safeTouch);
}
