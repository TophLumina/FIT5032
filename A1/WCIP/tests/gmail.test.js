import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { mailPayload } from '../functions/emailMessage.js'
import { createGmailSender, gmailSendScope } from '../functions/gmail.js'
import {
  desktopClient,
  authorizationRequest,
  callbackCode,
  exchangeAuthorization,
} from '../scripts/gmail-oauth.mjs'

const email = 'sender@gmail.com'
const credentials = {
  email,
  clientId: 'test.apps.googleusercontent.com',
  clientSecret: 'secret-for-tests',
  refreshToken: 'refresh-for-tests',
  scopes: [gmailSendScope],
}
const response = (status, value) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => value,
})
const authorized = () =>
  vi
    .fn()
    .mockResolvedValueOnce(
      response(200, { access_token: 'access-for-tests', expires_in: 3600, scope: gmailSendScope }),
    )
    .mockResolvedValueOnce(response(200, { email, email_verified: true }))
const payload = () =>
  mailPayload({
    sender: { email, name: 'WCIP 植物', replyTo: 'reply@example.test' },
    email: 'subscriber@example.test',
    guide: { subject: 'October 植物 guide', filename: 'guide.pdf' },
    text: 'Hello 植物\nTo unsubscribe, open My account.',
    pdf: Buffer.from('%PDF-1.7\nexample binary\x00\xff', 'latin1'),
  })

describe('Gmail message and transport', () => {
  it('encodes one recipient, Unicode text and the exact PDF in a MIME message', () => {
    const message = payload()
    const mime = Buffer.from(message.raw, 'base64url').toString()
    expect(mime).toContain('To: <subscriber@example.test>\r\n')
    expect(mime).toContain('Reply-To: <reply@example.test>\r\n')
    expect(mime).not.toMatch(/^(Cc|Bcc):/im)
    expect(mime).not.toMatch(/(?<!\r)\n/)
    const text = mime.match(/Content-Type: text\/plain;[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/)[1]
    expect(Buffer.from(text, 'base64').toString()).toContain('Hello 植物\nTo unsubscribe')
    const attachment = mime.match(
      /Content-Type: application\/pdf;[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/,
    )[1]
    expect(Buffer.from(attachment, 'base64')).toEqual(
      Buffer.from('%PDF-1.7\nexample binary\x00\xff', 'latin1'),
    )
    expect(message.messageId).not.toBe(payload().messageId)
    expect(() =>
      mailPayload({
        sender: { email, replyTo: email, name: 'X\r\nBcc: victim@example.test' },
        email,
        guide: { filename: 'guide.pdf', subject: 'x' },
        text: 'x',
        pdf: Buffer.from('%PDF-'),
      }),
    ).toThrow()
  })
  it('only calls Gmail send after verifying the configured sender and reuses a short-lived access token', async () => {
    const fetcher = authorized().mockResolvedValue(response(200, { id: 'gmail123' }))
    const send = createGmailSender({ getCredentials: () => JSON.stringify(credentials), fetcher })
    expect((await send(payload())).status).toBe('accepted')
    expect((await send(payload())).provider).toBe('gmail')
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(fetcher.mock.calls[2][0]).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    )
    expect(Object.keys(JSON.parse(fetcher.mock.calls[2][1].body))).toEqual(['raw'])
  })
  it('does not submit mail for a mismatched sender, missing scope, revoked token or wrong Google identity', async () => {
    for (const scenario of ['sender', 'scope', 'revoked', 'identity']) {
      const configured = {
        ...credentials,
        ...(scenario === 'sender' ? { email: 'other@gmail.com' } : {}),
        ...(scenario === 'scope' ? { scopes: [] } : {}),
      }
      const fetcher =
        scenario === 'revoked'
          ? vi.fn().mockResolvedValue(response(400, { error: 'invalid_grant' }))
          : vi
              .fn()
              .mockResolvedValueOnce(response(200, { access_token: 'test', scope: gmailSendScope }))
              .mockResolvedValueOnce(
                response(200, { email: 'other@gmail.com', email_verified: true }),
              )
      const send = createGmailSender({ getCredentials: () => JSON.stringify(configured), fetcher })
      expect((await send(payload())).status).toBe('rejected')
      expect(fetcher.mock.calls.some(([url]) => url.includes('/messages/send'))).toBe(false)
    }
  })
  it('distinguishes acceptance, explicit rejection and ambiguous outcomes without retrying a send', async () => {
    for (const [status, body, expected] of [
      [200, { id: 'id123' }, 'accepted'],
      [200, {}, 'unknown'],
      [202, {}, 'unknown'],
      [401, {}, 'rejected'],
      [403, {}, 'rejected'],
      [429, {}, 'rejected'],
      [500, {}, 'unknown'],
    ]) {
      const fetcher = authorized().mockResolvedValue(response(status, body))
      const send = createGmailSender({ getCredentials: () => JSON.stringify(credentials), fetcher })
      const result = await send(payload())
      expect(result.status).toBe(expected)
      expect(fetcher).toHaveBeenCalledTimes(3)
      expect(JSON.stringify(result)).not.toContain('for-tests')
    }
    const fetcher = authorized().mockRejectedValue(
      new Error('network lost with credentials in message'),
    )
    expect(
      (
        await createGmailSender({ getCredentials: () => JSON.stringify(credentials), fetcher })(
          payload(),
        )
      ).status,
    ).toBe('unknown')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})

describe('sender OAuth setup', () => {
  it('uses a project-matched desktop client, loopback callback, PKCE and narrow scopes', () => {
    const document = {
      installed: {
        project_id: 'demo',
        client_id: credentials.clientId,
        client_secret: 'test',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      },
    }
    const client = desktopClient(document, 'demo')
    expect(() => desktopClient(document, 'wrong-project')).toThrow()
    expect(() =>
      desktopClient(
        { installed: { ...document.installed, token_uri: 'https://evil.test' } },
        'demo',
      ),
    ).toThrow()
    const request = authorizationRequest(client, email, 12345)
    const url = new URL(request.url)
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:12345/oauth2/callback')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toBe(`openid email ${gmailSendScope}`)
    expect(url.searchParams.has('client_secret')).toBe(false)
    const callback = new URL(request.redirect)
    callback.search = new URLSearchParams({
      state: request.state,
      code: 'authorization-code',
    }).toString()
    expect(callbackCode(callback, request)).toBe('authorization-code')
    callback.searchParams.set('state', 'wrong')
    expect(() => callbackCode(callback, request)).toThrow('Invalid OAuth state')
    callback.searchParams.set('state', request.state)
    callback.searchParams.append('code', 'duplicate')
    expect(() => callbackCode(callback, request)).toThrow()
  })
  it('rejects partial consent and a different mailbox before credentials can be saved', async () => {
    const request = authorizationRequest(credentials, email, 12345)
    const denied = vi
      .fn()
      .mockResolvedValue(
        response(200, { access_token: 'test', refresh_token: 'test', scope: 'openid email' }),
      )
    await expect(
      exchangeAuthorization(credentials, request, 'code', email, denied),
    ).rejects.toThrow('Grant Gmail')
    const other = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { access_token: 'test', refresh_token: 'test', scope: gmailSendScope }),
      )
      .mockResolvedValueOnce(response(200, { email: 'other@gmail.com', email_verified: true }))
    await expect(exchangeAuthorization(credentials, request, 'code', email, other)).rejects.toThrow(
      'different account',
    )
    const valid = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { access_token: 'test', refresh_token: 'refresh', scope: gmailSendScope }),
      )
      .mockResolvedValueOnce(response(200, { email, email_verified: true }))
    expect((await exchangeAuthorization(credentials, request, 'code', email, valid)).email).toBe(
      email,
    )
    expect(new URLSearchParams(valid.mock.calls[0][1].body).get('code_verifier')).toBe(
      request.verifier,
    )
  })
})
