// Attribute escaping does not block javascript: URLs. Only HTTPS credit links are supported.
export function safeExternalUrl(value) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}
