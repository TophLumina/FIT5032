export const dailyUserLimit = 20
export const dailySiteLimit = 200
export const cooldownSeconds = 10

// D1 batch is a transaction. The trigger debits the global budget only when
// the conditional reservation succeeds, including concurrent requests.
export async function reserveAiRequest(db, uid, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10)
  const oldestDay = new Date(now - 7 * 86400000).toISOString().slice(0, 10)
  const [, reservation] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO ai_days (day, requests) VALUES (?, 0)').bind(day),
    db
      .prepare(
        `INSERT INTO ai_usage (uid, day, requests, last_request)
      SELECT ?, ?, 1, ? WHERE (SELECT requests FROM ai_days WHERE day = ?) < ?
      ON CONFLICT (uid, day) DO UPDATE SET requests = ai_usage.requests + 1,
        last_request = excluded.last_request
      WHERE ai_usage.requests < ? AND ai_usage.last_request <= ?
      RETURNING requests`,
      )
      .bind(uid, day, now, day, dailySiteLimit, dailyUserLimit, now - cooldownSeconds * 1000),
    db.prepare('DELETE FROM ai_usage WHERE day < ?').bind(oldestDay),
    db.prepare('DELETE FROM ai_days WHERE day < ?').bind(oldestDay),
  ])
  if (!reservation.results?.length) return null
  return {
    remaining: dailyUserLimit - reservation.results[0].requests,
    resetsAt: `${new Date(Date.parse(day) + 86400000).toISOString()}`,
  }
}
