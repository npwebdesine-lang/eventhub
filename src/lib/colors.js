/**
 * Shared color utility functions.
 * Used across: Dating, Photos, Rideshare, Icebreaker, Invite
 */

export const getLuminance = (hex) => {
  if (!hex) return 0;
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

/**
 * Returns a readable text color (dark or white) for a given background hex color.
 * Threshold: 150 luminance (0–255 scale)
 */
export const getTextColor = (bgHex) =>
  getLuminance(bgHex) > 150 ? '#1e293b' : '#ffffff';
