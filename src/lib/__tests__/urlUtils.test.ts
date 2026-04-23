import { describe, it, expect } from 'vitest';
import { normalizeUrl, addIfSameOrigin } from '../urlUtils.js';

describe('normalizeUrl', () => {
  it('supprime le fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });
  it('supprime le slash final', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
  });
  it('supprime les parametres de tracking', () => {
    expect(normalizeUrl('https://example.com/page?utm_source=google&id=1'))
      .toBe('https://example.com/page?id=1');
    expect(normalizeUrl('https://example.com/?fbclid=abc'))
      .toBe('https://example.com');
  });
  it("retourne l'URL brute si invalide", () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('addIfSameOrigin', () => {
  const origin = 'https://example.com';

  it('ajoute une URL du meme origin', () => {
    const set = new Set<string>();
    addIfSameOrigin(set, 'https://example.com/page', origin);
    expect(set.has('https://example.com/page')).toBe(true);
  });

  it("ignore une URL d'un autre origin", () => {
    const set = new Set<string>();
    addIfSameOrigin(set, 'https://other.com/page', origin);
    expect(set.size).toBe(0);
  });

  it('ignore les fichiers binaires', () => {
    const set = new Set<string>();
    addIfSameOrigin(set, 'https://example.com/file.pdf', origin);
    addIfSameOrigin(set, 'https://example.com/image.jpg', origin);
    expect(set.size).toBe(0);
  });

  it('ignore les protocoles non http(s)', () => {
    const set = new Set<string>();
    addIfSameOrigin(set, 'ftp://example.com/page', origin);
    expect(set.size).toBe(0);
  });

  it("normalise l'URL avant ajout (retire utm_)", () => {
    const set = new Set<string>();
    addIfSameOrigin(set, 'https://example.com/p?utm_source=x', origin);
    expect(set.has('https://example.com/p')).toBe(true);
  });
});
