import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

export function aiDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(
    readFileSync(new URL('../worker/migrations/0001_ai_usage.sql', import.meta.url), 'utf8'),
  )
  return {
    sqlite,
    prepare: (sql) => ({ bind: (...values) => ({ sql, values }) }),
    async batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const result = statements.map(({ sql, values }) => ({
          results: sqlite.prepare(sql).all(...values),
        }))
        sqlite.exec('COMMIT')
        return result
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
}
