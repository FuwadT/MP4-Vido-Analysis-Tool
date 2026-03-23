const SAFE_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function sanitizeStudioId(value, label = 'identifier') {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  if (!SAFE_ID_PATTERN.test(normalized)) {
    throw new Error(`${label} contains unsupported characters.`);
  }

  return normalized;
}

export function sanitizeOptionalStudioId(value, label = 'identifier') {
  if (value == null || value === '') {
    return '';
  }

  return sanitizeStudioId(value, label);
}
