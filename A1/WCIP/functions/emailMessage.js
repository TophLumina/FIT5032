import { randomUUID } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'

const validEmail = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)

export function senderConfig(env = process.env) {
  const email = env.MAIL_FROM_EMAIL?.trim()
  const name = env.MAIL_FROM_NAME?.trim()
  const replyTo = env.MAIL_REPLY_TO_EMAIL?.trim()
  if (
    !validEmail(email) ||
    !validEmail(replyTo) ||
    !name ||
    name.length > 80 ||
    /[\r\n]/.test(name)
  )
    throw new HttpsError('failed-precondition', 'The Gmail sender has not been configured.')
  return { email, name, replyTo }
}

// Encode Unicode header values without allowing injected MIME headers.
function encodedHeader(value) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error('Invalid mail header.')
  const chunks = ['']
  for (const character of value) {
    if (Buffer.byteLength(chunks.at(-1) + character) > 42) chunks.push('')
    chunks[chunks.length - 1] += character
  }
  return chunks.map((chunk) => `=?UTF-8?B?${Buffer.from(chunk).toString('base64')}?=`).join('\r\n ')
}
const base64Lines = (value) =>
  Buffer.from(value)
    .toString('base64')
    .match(/.{1,76}/g)
    ?.join('\r\n') || ''

export function mailPayload({ sender, email, guide, text, pdf }) {
  if (
    !validEmail(sender.email) ||
    !validEmail(sender.replyTo) ||
    !validEmail(email) ||
    !/^[a-zA-Z0-9._-]{1,120}\.pdf$/.test(guide.filename) ||
    typeof guide.subject !== 'string' ||
    guide.subject.length > 200 ||
    typeof text !== 'string' ||
    text.length > 100000 ||
    !Buffer.isBuffer(pdf) ||
    pdf.length > 5 * 1024 * 1024 ||
    pdf.subarray(0, 5).toString() !== '%PDF-'
  )
    throw new Error('Invalid planting-guide email.')
  const boundary = `wcip_${randomUUID()}`
  const messageId = `<wcip.${randomUUID()}@${sender.email.split('@')[1]}>`
  const mime = [
    `From: ${encodedHeader(sender.name)} <${sender.email}>`,
    `To: <${email}>`,
    `Reply-To: <${sender.replyTo}>`,
    `Subject: ${encodedHeader(guide.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(text),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${guide.filename}"`,
    `Content-Disposition: attachment; filename="${guide.filename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(pdf),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return { raw: Buffer.from(mime).toString('base64url'), senderEmail: sender.email, messageId }
}
