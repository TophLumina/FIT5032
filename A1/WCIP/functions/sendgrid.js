import { HttpsError } from 'firebase-functions/v2/https'

export function senderConfig(env = process.env) {
  const email = env.SENDGRID_FROM_EMAIL?.trim()
  const name = env.SENDGRID_FROM_NAME?.trim()
  const replyTo = env.SENDGRID_REPLY_TO_EMAIL?.trim()
  const validEmail = (value) =>
    typeof value === 'string' && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value)
  if (
    !validEmail(email) ||
    !validEmail(replyTo) ||
    !name ||
    name.length > 80 ||
    /[\r\n]/.test(name)
  )
    throw new HttpsError(
      'failed-precondition',
      'The verified email sender has not been configured.',
    )
  return { email, name, replyTo }
}

export function mailPayload({ sender, email, guide, text, pdf }) {
  return {
    personalizations: [{ to: [{ email }] }],
    from: { email: sender.email, name: sender.name },
    reply_to: { email: sender.replyTo, name: sender.name },
    subject: guide.subject,
    content: [{ type: 'text/plain', value: text }],
    attachments: [
      {
        content: pdf.toString('base64'),
        type: 'application/pdf',
        filename: guide.filename,
        disposition: 'attachment',
      },
    ],
    tracking_settings: {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    },
  }
}

export async function sendgridSend(payload, apiKey, fetcher = fetch) {
  // A timeout may occur after acceptance. Never automatically retry an ambiguous result.
  try {
    const response = await fetcher('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    })
    if (response.status === 202)
      return {
        status: 'accepted',
        message: 'Accepted by SendGrid; delivery is not yet confirmed.',
        providerId: response.headers.get('x-message-id') || null,
      }
    // Do not store or log provider response bodies, credentials or recipient addresses.
    if (response.status >= 400 && response.status < 500)
      return {
        status: 'rejected',
        message:
          response.status === 401 || response.status === 403
            ? 'SendGrid rejected authorization. Check the API key, Mail Send permission and verified sender.'
            : response.status === 429
              ? 'SendGrid rate limit reached. Wait before retrying.'
              : `SendGrid rejected this request (HTTP ${response.status}). Check the provider account.`,
        providerId: null,
      }
    return {
      status: 'unknown',
      message:
        'SendGrid acceptance could not be confirmed. Check Email Activity before taking further action; automatic resending is blocked.',
      providerId: null,
    }
  } catch {
    return {
      status: 'unknown',
      message:
        'The provider connection ended without a confirmed result. Check SendGrid Email Activity; automatic resending is blocked.',
      providerId: null,
    }
  }
}
