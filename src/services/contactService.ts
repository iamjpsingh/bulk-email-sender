// src/services/contactService.ts - Contact Management with Local SQLite

import Database from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ContactList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  list_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string | null;
  tags: string; // JSON array
  custom_fields: string; // JSON object
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained';
  engagement_score: number;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactInput {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  tags?: string[];
  custom_fields?: Record<string, string>;
  status?: string;
  source?: string;
}

export interface ContactFilters {
  search?: string;
  status?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: { row: number; email: string; reason: string }[];
}

export interface ImportHistory {
  id: string;
  user_id: string;
  list_id: string;
  filename: string;
  format: string;
  total_rows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  field_mapping: string | null;
  created_at: string;
}

// ============================================================================
// Service
// ============================================================================

class ContactService {
  private db: Database;

  constructor() {
    const dbPath = './data/contacts.db';
    const dbDir = dirname(dbPath);

    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL');
    this.db.exec('PRAGMA busy_timeout=5000');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_lists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        contact_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cl_user ON contact_lists(user_id);

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        list_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        company TEXT,
        phone TEXT,
        tags TEXT DEFAULT '[]',
        custom_fields TEXT DEFAULT '{}',
        status TEXT DEFAULT 'active',
        engagement_score INTEGER DEFAULT 50,
        source TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(list_id, email),
        FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_c_user ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_c_list ON contacts(list_id);
      CREATE INDEX IF NOT EXISTS idx_c_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_c_status ON contacts(status);
      CREATE INDEX IF NOT EXISTS idx_c_score ON contacts(engagement_score);

      CREATE TABLE IF NOT EXISTS import_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        list_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        format TEXT NOT NULL,
        total_rows INTEGER DEFAULT 0,
        imported INTEGER DEFAULT 0,
        duplicates INTEGER DEFAULT 0,
        invalid INTEGER DEFAULT 0,
        field_mapping TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    console.log('✅ Contacts database initialized (data/contacts.db)');
  }

  // --------------------------------------------------------------------------
  // Lists
  // --------------------------------------------------------------------------

  createList(userId: string, name: string, description?: string): ContactList {
    const id = `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.db.prepare(`
      INSERT INTO contact_lists (id, user_id, name, description)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, name, description || null);
    return this.db.prepare('SELECT * FROM contact_lists WHERE id = ?').get(id) as ContactList;
  }

  getLists(userId: string): ContactList[] {
    // Refresh counts
    this.db.exec(`
      UPDATE contact_lists SET contact_count = (
        SELECT COUNT(*) FROM contacts WHERE contacts.list_id = contact_lists.id
      )
    `);
    return this.db.prepare(`
      SELECT * FROM contact_lists WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId) as ContactList[];
  }

  getList(userId: string, listId: string): ContactList | null {
    return this.db.prepare(`
      SELECT * FROM contact_lists WHERE id = ? AND user_id = ?
    `).get(listId, userId) as ContactList | null;
  }

  updateList(userId: string, listId: string, name: string, description?: string): boolean {
    const result = this.db.prepare(`
      UPDATE contact_lists SET name = ?, description = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(name, description || null, listId, userId);
    return result.changes > 0;
  }

  deleteList(userId: string, listId: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM contact_lists WHERE id = ? AND user_id = ?
    `).run(listId, userId);
    return result.changes > 0;
  }

  // --------------------------------------------------------------------------
  // Contacts CRUD
  // --------------------------------------------------------------------------

  addContact(userId: string, listId: string, input: ContactInput): Contact {
    const id = `con_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.db.prepare(`
      INSERT INTO contacts (id, user_id, list_id, email, first_name, last_name, company, phone, tags, custom_fields, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, listId,
      input.email.toLowerCase().trim(),
      input.first_name || null,
      input.last_name || null,
      input.company || null,
      input.phone || null,
      JSON.stringify(input.tags || []),
      JSON.stringify(input.custom_fields || {}),
      input.status || 'active',
      input.source || 'manual'
    );
    return this.db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact;
  }

  updateContact(userId: string, contactId: string, updates: Partial<ContactInput>): boolean {
    const sets: string[] = [];
    const params: any[] = [];

    if (updates.email !== undefined) { sets.push('email = ?'); params.push(updates.email.toLowerCase().trim()); }
    if (updates.first_name !== undefined) { sets.push('first_name = ?'); params.push(updates.first_name); }
    if (updates.last_name !== undefined) { sets.push('last_name = ?'); params.push(updates.last_name); }
    if (updates.company !== undefined) { sets.push('company = ?'); params.push(updates.company); }
    if (updates.phone !== undefined) { sets.push('phone = ?'); params.push(updates.phone); }
    if (updates.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(updates.tags)); }
    if (updates.custom_fields !== undefined) { sets.push('custom_fields = ?'); params.push(JSON.stringify(updates.custom_fields)); }
    if (updates.status !== undefined) { sets.push('status = ?'); params.push(updates.status); }

    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");
    params.push(contactId, userId);

    const result = this.db.prepare(`
      UPDATE contacts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...params);
    return result.changes > 0;
  }

  deleteContacts(userId: string, contactIds: string[]): number {
    const placeholders = contactIds.map(() => '?').join(',');
    const result = this.db.prepare(`
      DELETE FROM contacts WHERE id IN (${placeholders}) AND user_id = ?
    `).run(...contactIds, userId);
    return result.changes;
  }

  getContacts(userId: string, listId: string, filters: ContactFilters = {}): { contacts: Contact[]; total: number } {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 200);
    const offset = (page - 1) * limit;
    const sortBy = filters.sort_by || 'created_at';
    const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['user_id = ?', 'list_id = ?'];
    const params: any[] = [userId, listId];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      conditions.push("(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)");
      const q = `%${filters.search}%`;
      params.push(q, q, q, q);
    }

    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        conditions.push("tags LIKE ?");
        params.push(`%"${tag}"%`);
      }
    }

    const where = conditions.join(' AND ');

    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM contacts WHERE ${where}`).get(...params) as any).count;

    const contacts = this.db.prepare(`
      SELECT * FROM contacts WHERE ${where}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Contact[];

    return { contacts, total };
  }

  getContact(userId: string, contactId: string): Contact | null {
    return this.db.prepare(`
      SELECT * FROM contacts WHERE id = ? AND user_id = ?
    `).get(contactId, userId) as Contact | null;
  }

  searchContacts(userId: string, query: string, limit = 20): Contact[] {
    const q = `%${query}%`;
    return this.db.prepare(`
      SELECT * FROM contacts WHERE user_id = ?
      AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)
      ORDER BY email ASC LIMIT ?
    `).all(userId, q, q, q, q, limit) as Contact[];
  }

  // --------------------------------------------------------------------------
  // Import
  // --------------------------------------------------------------------------

  importContacts(
    userId: string,
    listId: string,
    rows: Record<string, string>[],
    fieldMapping: Record<string, string>,
    options: { skipDuplicates?: boolean; source?: string } = {}
  ): ImportResult {
    const result: ImportResult = { total: rows.length, imported: 0, duplicates: 0, invalid: 0, errors: [] };

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO contacts (id, user_id, list_id, email, first_name, last_name, company, phone, tags, custom_fields, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '{}', ?)
    `);

    const checkStmt = this.db.prepare(`
      SELECT 1 FROM contacts WHERE list_id = ? AND email = ?
    `);

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mapped: Record<string, string> = {};

        // Apply field mapping
        for (const [sourceCol, targetField] of Object.entries(fieldMapping)) {
          if (row[sourceCol] !== undefined) {
            mapped[targetField] = row[sourceCol];
          }
        }

        const email = (mapped.email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) {
          result.invalid++;
          result.errors.push({ row: i + 1, email: email || '(empty)', reason: 'Invalid email format' });
          continue;
        }

        // Check duplicate
        if (options.skipDuplicates !== false) {
          const exists = checkStmt.get(listId, email);
          if (exists) {
            result.duplicates++;
            continue;
          }
        }

        const id = `con_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${i}`;

        try {
          insertStmt.run(
            id, userId, listId, email,
            mapped.first_name || null,
            mapped.last_name || null,
            mapped.company || null,
            mapped.phone || null,
            options.source || 'import'
          );
          result.imported++;
        } catch (err) {
          // Duplicate constraint
          result.duplicates++;
        }
      }
    });

    transaction();
    return result;
  }

  recordImport(userId: string, listId: string, filename: string, format: string, result: ImportResult, fieldMapping: Record<string, string>) {
    const id = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.db.prepare(`
      INSERT INTO import_history (id, user_id, list_id, filename, format, total_rows, imported, duplicates, invalid, field_mapping)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, listId, filename, format, result.total, result.imported, result.duplicates, result.invalid, JSON.stringify(fieldMapping));
  }

  getImportHistory(userId: string, limit = 20): ImportHistory[] {
    return this.db.prepare(`
      SELECT * FROM import_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(userId, limit) as ImportHistory[];
  }

  // --------------------------------------------------------------------------
  // Bulk Operations
  // --------------------------------------------------------------------------

  tagContacts(userId: string, contactIds: string[], tagsToAdd: string[]): number {
    let updated = 0;
    const getStmt = this.db.prepare('SELECT id, tags FROM contacts WHERE id = ? AND user_id = ?');
    const updateStmt = this.db.prepare("UPDATE contacts SET tags = ?, updated_at = datetime('now') WHERE id = ?");

    for (const contactId of contactIds) {
      const contact = getStmt.get(contactId, userId) as { id: string; tags: string } | null;
      if (!contact) continue;

      const existingTags: string[] = JSON.parse(contact.tags || '[]');
      const merged = [...new Set([...existingTags, ...tagsToAdd])];
      updateStmt.run(JSON.stringify(merged), contactId);
      updated++;
    }

    return updated;
  }

  moveContacts(userId: string, contactIds: string[], targetListId: string): number {
    const placeholders = contactIds.map(() => '?').join(',');
    const result = this.db.prepare(`
      UPDATE contacts SET list_id = ?, updated_at = datetime('now')
      WHERE id IN (${placeholders}) AND user_id = ?
    `).run(targetListId, ...contactIds, userId);
    return result.changes;
  }

  /**
   * Get contacts for a list as array (for email sending)
   */
  getContactsForSending(userId: string, listId: string): { Email: string; FirstName?: string; LastName?: string; Company?: string }[] {
    const contacts = this.db.prepare(`
      SELECT email, first_name, last_name, company FROM contacts
      WHERE user_id = ? AND list_id = ? AND status = 'active'
      ORDER BY email ASC
    `).all(userId, listId) as any[];

    return contacts.map(c => ({
      Email: c.email,
      FirstName: c.first_name || undefined,
      LastName: c.last_name || undefined,
      Company: c.company || undefined,
    }));
  }
}

export const contactService = new ContactService();
