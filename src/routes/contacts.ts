// src/routes/contacts.ts - Contact Management API

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { contactService } from '../services/contactService';
import { validationService } from '../services/validationService';
import { FileService } from '../services/fileService';
import { success, error } from '../utils/response';

const app = new Hono();

// ============================================================================
// Contact Lists
// ============================================================================

app.post('/contacts/lists', async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { name, description } = body;

  if (!name || !name.trim()) {
    return error(c, 'List name is required', 400);
  }

  const list = contactService.createList(user.id, name.trim(), description);
  return success(c, list, 'Contact list created');
});

app.get('/contacts/lists', (c) => {
  const user = requireAuth(c);
  const lists = contactService.getLists(user.id);
  return success(c, { lists });
});

app.put('/contacts/lists/:id', async (c) => {
  const user = requireAuth(c);
  const listId = c.req.param('id');
  const body = await c.req.json();

  const updated = contactService.updateList(user.id, listId, body.name, body.description);
  if (!updated) return error(c, 'List not found', 404);
  return success(c, undefined, 'List updated');
});

app.delete('/contacts/lists/:id', (c) => {
  const user = requireAuth(c);
  const listId = c.req.param('id');

  const deleted = contactService.deleteList(user.id, listId);
  if (!deleted) return error(c, 'List not found', 404);
  return success(c, undefined, 'List deleted');
});

// ============================================================================
// Contacts CRUD
// ============================================================================

app.get('/contacts/:listId', (c) => {
  const user = requireAuth(c);
  const listId = c.req.param('listId');

  // Don't match special routes
  if (['lists', 'search', 'bulk', 'import-history'].includes(listId)) {
    return c.notFound();
  }

  const filters = {
    search: c.req.query('search'),
    status: c.req.query('status'),
    tags: c.req.query('tags')?.split(',').filter(Boolean),
    page: parseInt(c.req.query('page') || '1'),
    limit: parseInt(c.req.query('limit') || '50'),
    sort_by: c.req.query('sort_by'),
    sort_order: c.req.query('sort_order') as 'asc' | 'desc' | undefined,
  };

  const { contacts, total } = contactService.getContacts(user.id, listId, filters);
  const page = filters.page || 1;
  const limit = filters.limit || 50;

  return c.json({
    success: true,
    data: contacts,
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
});

app.post('/contacts/:listId', async (c) => {
  const user = requireAuth(c);
  const listId = c.req.param('listId');

  if (['lists', 'search', 'bulk', 'import-history'].includes(listId)) {
    return c.notFound();
  }

  const body = await c.req.json();

  if (!body.email) {
    return error(c, 'Email is required', 400);
  }

  try {
    const contact = contactService.addContact(user.id, listId, body);
    return success(c, contact, 'Contact added');
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return error(c, 'Contact with this email already exists in this list', 409);
    }
    throw err;
  }
});

app.put('/contacts/item/:id', async (c) => {
  const user = requireAuth(c);
  const contactId = c.req.param('id');
  const body = await c.req.json();

  const updated = contactService.updateContact(user.id, contactId, body);
  if (!updated) return error(c, 'Contact not found', 404);
  return success(c, undefined, 'Contact updated');
});

// ============================================================================
// Bulk Operations
// ============================================================================

app.post('/contacts/bulk/delete', async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return error(c, 'Contact IDs array is required', 400);
  }

  const deleted = contactService.deleteContacts(user.id, ids);
  return success(c, { deleted }, `${deleted} contact(s) deleted`);
});

app.post('/contacts/bulk/tag', async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { ids, tags } = body;

  if (!ids?.length || !tags?.length) {
    return error(c, 'Contact IDs and tags are required', 400);
  }

  const updated = contactService.tagContacts(user.id, ids, tags);
  return success(c, { updated }, `${updated} contact(s) tagged`);
});

app.post('/contacts/bulk/move', async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { ids, target_list_id } = body;

  if (!ids?.length || !target_list_id) {
    return error(c, 'Contact IDs and target list ID are required', 400);
  }

  const moved = contactService.moveContacts(user.id, ids, target_list_id);
  return success(c, { moved }, `${moved} contact(s) moved`);
});

// ============================================================================
// Search
// ============================================================================

app.get('/contacts/search', (c) => {
  const user = requireAuth(c);
  const q = c.req.query('q') || '';

  if (q.length < 2) {
    return success(c, { contacts: [] });
  }

  const contacts = contactService.searchContacts(user.id, q);
  return success(c, { contacts });
});

// ============================================================================
// Import
// ============================================================================

app.post('/contacts/:listId/import', async (c) => {
  const user = requireAuth(c);
  const listId = c.req.param('listId');

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const fieldMappingRaw = formData.get('fieldMapping') as string;
  const skipDuplicates = formData.get('skipDuplicates') !== 'false';

  if (!file || file.size === 0) {
    return error(c, 'File is required', 400);
  }

  // Parse field mapping
  let fieldMapping: Record<string, string>;
  try {
    fieldMapping = fieldMappingRaw ? JSON.parse(fieldMappingRaw) : {};
  } catch {
    return error(c, 'Invalid field mapping JSON', 400);
  }

  // Parse file
  const arrayBuffer = await file.arrayBuffer();
  const filename = `import_${Date.now()}_${file.name}`;
  const filePath = await FileService.saveUploadedFile(new Uint8Array(arrayBuffer), filename);

  let rows: Record<string, string>[];
  const ext = file.name.split('.').pop()?.toLowerCase();
  const format = ext === 'csv' ? 'csv' : 'excel';

  try {
    const contacts = await FileService.parseExcelFile(filePath);
    // Convert Contact[] to Record<string, string>[]
    rows = contacts.map(c => {
      const row: Record<string, string> = {};
      for (const [key, value] of Object.entries(c)) {
        row[key] = String(value ?? '');
      }
      return row;
    });
  } catch (err: any) {
    return error(c, `Failed to parse file: ${err.message}`, 400);
  }

  // Auto-detect field mapping if not provided
  if (Object.keys(fieldMapping).length === 0) {
    fieldMapping = autoDetectFieldMapping(rows[0] || {});
  }

  // Import
  const result = contactService.importContacts(user.id, listId, rows, fieldMapping, {
    skipDuplicates,
    source: `import_${format}`,
  });

  // Record history
  contactService.recordImport(user.id, listId, file.name, format, result, fieldMapping);

  return success(c, result, `Imported ${result.imported} contacts (${result.duplicates} duplicates, ${result.invalid} invalid)`);
});

app.get('/contacts/import-history', (c) => {
  const user = requireAuth(c);
  const history = contactService.getImportHistory(user.id);
  return success(c, { history });
});

// ============================================================================
// Validation
// ============================================================================

app.post('/contacts/validate', async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { emails } = body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return error(c, 'Emails array is required', 400);
  }

  // Limit to 100 at a time
  const batch = emails.slice(0, 100);
  const result = await validationService.validateBulk(batch, user.id);
  return success(c, result);
});

app.post('/contacts/validate-single', async (c) => {
  const user = requireAuth(c);
  const body = await c.req.json();
  const { email } = body;

  if (!email) return error(c, 'Email is required', 400);

  const result = await validationService.validateEmail(email, user.id);
  return success(c, result);
});

// ============================================================================
// Helpers
// ============================================================================

function autoDetectFieldMapping(firstRow: Record<string, string>): Record<string, string> {
  const mapping: Record<string, string> = {};
  const keys = Object.keys(firstRow);

  for (const key of keys) {
    const lower = key.toLowerCase().replace(/[_\-\s]/g, '');
    if (lower.includes('email') || lower === 'emailaddress') {
      mapping[key] = 'email';
    } else if (lower === 'firstname' || lower === 'first') {
      mapping[key] = 'first_name';
    } else if (lower === 'lastname' || lower === 'last' || lower === 'surname') {
      mapping[key] = 'last_name';
    } else if (lower === 'company' || lower === 'organization' || lower === 'org') {
      mapping[key] = 'company';
    } else if (lower === 'phone' || lower === 'telephone' || lower === 'mobile') {
      mapping[key] = 'phone';
    } else if (lower === 'name' || lower === 'fullname') {
      mapping[key] = 'first_name'; // Will be split later if needed
    }
  }

  return mapping;
}

export default app;
