import { registerMigration, runMigrations } from './migrate'
import { db, logsDb } from './connection'

// Register migrations (import order matters — each file self-registers)
import './migrations/001_admin_foundation'
import './migrations/002_whatsapp'
import './migrations/003_auth_extended'
import './migrations/004_system_settings'

export function initDatabase() {
  runMigrations()
}

export { db, logsDb, registerMigration }
