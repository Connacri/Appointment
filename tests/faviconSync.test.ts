import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_DOCUMENT_TITLE,
  DEFAULT_FAVICON_PATH,
  formatAppDocumentTitle,
  inferIconMimeType,
  resolveAppIconHref,
  sanitizeBrandIconUrl,
  syncFaviconLinks,
  type MinimalDocumentLike,
  type MinimalLinkElement,
} from '../src/utils/faviconSync';

function createFakeLink(rel: string, href: string, type = ''): MinimalLinkElement {
  const attrs = new Map<string, string>([
    ['rel', rel],
    ['href', href],
  ]);
  if (type) attrs.set('type', type);

  return {
    get rel() {
      return attrs.get('rel') ?? '';
    },
    set rel(v: string) {
      attrs.set('rel', v);
    },
    get href() {
      return attrs.get('href') ?? '';
    },
    set href(v: string) {
      attrs.set('href', v);
    },
    get type() {
      return attrs.get('type') ?? '';
    },
    set type(v: string) {
      attrs.set('type', v);
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
  };
}

function createFakeDocument(initialLinks: MinimalLinkElement[] = []): MinimalDocumentLike & {
  links: MinimalLinkElement[];
} {
  const links = [...initialLinks];
  return {
    title: '',
    links,
    head: {
      appendChild(node: MinimalLinkElement) {
        links.push(node);
        return node;
      },
    },
    querySelectorAll(selector: string) {
      const relTargets = selector
        .split(',')
        .map((part) => /\[rel="([^"]+)"\]/.exec(part)?.[1])
        .filter((v): v is string => Boolean(v));
      return links.filter((link) => relTargets.includes(link.rel));
    },
    createElement() {
      return createFakeLink('', '');
    },
  };
}

test('sanitizeBrandIconUrl allows safe image URLs and rejects unsafe schemes', () => {
  assert.equal(sanitizeBrandIconUrl(''), null);
  assert.equal(sanitizeBrandIconUrl('   '), null);
  assert.equal(sanitizeBrandIconUrl(undefined), null);
  assert.equal(sanitizeBrandIconUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeBrandIconUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeBrandIconUrl('//evil.example/icon.png'), null);

  assert.equal(sanitizeBrandIconUrl(' /assets/hotel.png '), '/assets/hotel.png');
  assert.equal(sanitizeBrandIconUrl('https://cdn.example.com/logo.webp'), 'https://cdn.example.com/logo.webp');
  assert.equal(
    sanitizeBrandIconUrl('data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E'),
    'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E'
  );
  assert.equal(sanitizeBrandIconUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
});

test('resolveAppIconHref falls back to default hotel favicon for missing or invalid URLs', () => {
  assert.equal(resolveAppIconHref(undefined), DEFAULT_FAVICON_PATH);
  assert.equal(resolveAppIconHref(''), DEFAULT_FAVICON_PATH);
  assert.equal(resolveAppIconHref('javascript:void(0)'), DEFAULT_FAVICON_PATH);
  assert.equal(resolveAppIconHref('data:image/png;base64,XYZ'), 'data:image/png;base64,XYZ');
});

test('inferIconMimeType handles data URLs and file extensions', () => {
  assert.equal(inferIconMimeType('/favicon.svg'), 'image/svg+xml');
  assert.equal(inferIconMimeType('https://hotel.test/brand.PNG?v=2'), 'image/png');
  assert.equal(inferIconMimeType('/logo.jpg'), 'image/jpeg');
  assert.equal(inferIconMimeType('data:image/svg+xml;utf8,%3Csvg/%3E'), 'image/svg+xml');
  assert.equal(inferIconMimeType('data:image/webp;base64,123'), 'image/webp');
  assert.equal(inferIconMimeType('data:image/jpg;base64,123'), 'image/jpeg');
  assert.equal(inferIconMimeType('https://hotel.test/dynamic-logo'), undefined);
});

test('formatAppDocumentTitle includes hotel name when configured', () => {
  assert.equal(formatAppDocumentTitle(''), DEFAULT_DOCUMENT_TITLE);
  assert.equal(formatAppDocumentTitle('   '), DEFAULT_DOCUMENT_TITLE);
  assert.equal(formatAppDocumentTitle('Grand Hôtel Royal'), 'Grand Hôtel Royal — Appointment PMS');
});

test('syncFaviconLinks updates existing icon and apple-touch-icon tags cleanly', () => {
  const iconLink = createFakeLink('icon', '/favicon.svg', 'image/svg+xml');
  const touchLink = createFakeLink('apple-touch-icon', '/favicon.svg');
  const doc = createFakeDocument([iconLink, touchLink]);

  syncFaviconLinks(doc, 'data:image/png;base64,HOTEL_LOGO', 'data:image/png;base64,TOUCH_LOGO');

  assert.equal(iconLink.href, 'data:image/png;base64,HOTEL_LOGO');
  assert.equal(iconLink.type, 'image/png');
  assert.equal(touchLink.href, 'data:image/png;base64,TOUCH_LOGO');
  assert.equal(touchLink.type, 'image/png');

  syncFaviconLinks(doc, '/favicon.svg');
  assert.equal(iconLink.href, '/favicon.svg');
  assert.equal(iconLink.type, 'image/svg+xml');
  assert.equal(touchLink.href, '/favicon.svg');
});

test('syncFaviconLinks creates missing link elements when head has none', () => {
  const doc = createFakeDocument([]);
  syncFaviconLinks(doc, 'https://example.com/hotel-crest');

  assert.equal(doc.links.length, 2);
  assert.equal(doc.links[0].rel, 'icon');
  assert.equal(doc.links[0].href, 'https://example.com/hotel-crest');
  assert.equal(doc.links[0].getAttribute('type'), null);
  assert.equal(doc.links[1].rel, 'apple-touch-icon');
  assert.equal(doc.links[1].href, 'https://example.com/hotel-crest');
});
