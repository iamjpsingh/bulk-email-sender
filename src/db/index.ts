import { registerMigration, runMigrations } from './migrate'
import { db, logsDb } from './connection'

// Register migrations (import order matters — each file self-registers)
import './migrations/001_admin_foundation'

export function initDatabase() {
  runMigrations()
}

export { db, logsDb, registerMigration }
