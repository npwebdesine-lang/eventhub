import DOMPurify from 'dompurify';

const config = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  KEEP_CONTENT: true,
};

export function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty, config);
}

export function sanitizeAsDOM(dirty: string): string {
  // Returns already-safe HTML string for controlled contexts only
  return DOMPurify.sanitize(dirty, { ...config, RETURN_DOM: false } as any);
}
