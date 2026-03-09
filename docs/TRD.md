# Dispatch v3.0 — Technical Requirements Document

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Frontend (Vue 3 + Vite)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Dashboard │ │Campaigns │ │Contacts  │ │Templates │ │Automation │  │
│  │  (SSE)   │ │(Wizard)  │ │(CRM-lite)│ │(Builder) │ │(Flowchart)│  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └─────────────┴────────────┴─────────────┴─────────────┘        │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ HTTP / SSE
┌──────────────────────────────┴────────────────────────────────────────┐
│                        Backend (Bun + Hono)                           │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ │
│  │API Routes│ │Auth Layer│ │Event Bus │ │Automation │ │  Plugin   │ │
│  │          │ │(Session/ │ │(Pub/Sub) │ │  Engine   │ │ Manager   │ │
│  │          │ │ API Key) │ │          │ │           │ │           │ │
│  └────┬─────┘ └──────────┘ └────┬─────┘ └─────┬─────┘ └─────┬─────┘ │
│       │                         │              │              │       │
│  ┌────┴─────────────────────────┴──────────────┴──────────────┴─────┐ │
│  │                        Service Layer                              │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐ │ │
│  │  │Email Sender│ │Queue Engine│ │ Contact    │ │ Template       │ │ │
│  │  │(Nodemailer)│ │(SQLite Job)│ │ Service    │ │ Service        │ │ │
│  │  ├────────────┤ ├────────────┤ ├────────────┤ ├────────────────┤ │ │
│  │  │Validator   │ │Retry Eng.  │ │ Scoring    │ │ Campaign       │ │ │
│  │  │(MX/Syntax) │ │(Exp.Backof)│ │ Engine     │ │ Service        │ │ │
│  │  ├────────────┤ ├────────────┤ ├────────────┤ ├────────────────┤ │ │
│  │  │Suppression │ │Webhook     │ │ Segment    │ │ Automation     │ │ │
│  │  │Service     │ │Dispatch    │ │ Engine     │ │ Runner         │ │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    Local SQLite Databases                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐  │ │
│  │  │Job Queue │ │Suppress  │ │Automation  │ │Template Cache    │  │ │
│  │  │(queue.db)│ │(suppress)│ │(automate.db│ │(templates.db)    │  │ │
│  │  └──────────┘ └──────────┘ └────────────┘ └──────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
┌──────────────────────────────┴────────────────────────────────────────┐
│                    Cloudflare Workers + D1                             │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────────────────┐  │
│  │ Tracking     │ │ Unsubscribe   │ │       D1 Database            │  │
│  │ Worker       │ │ Worker        │ │  campaigns, emails, events,  │  │
│  │ (open/click) │ │ (landing pg)  │ │  contacts, templates,        │  │
│  └──────────────┘ └───────────────┘ │  automations, scores         │  │
│                                      └──────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 1. Contact Management & Import

### D1 Schema

```sql
-- Contact Lists
CREATE TABLE IF NOT EXISTS contact_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  contact_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_contact_lists_user ON contact_lists(user_id);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  phone TEXT,
  tags TEXT DEFAULT '[]',           -- JSON array: ["vip", "customer"]
  custom_fields TEXT DEFAULT '{}',  -- JSON object: {"industry": "tech", "plan": "pro"}
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
  engagement_score INTEGER DEFAULT 50,
  last_engaged_at TEXT,
  language TEXT DEFAULT 'en',
  source TEXT,                      -- 'import_csv', 'import_excel', 'manual', 'api'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(list_id, email),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE
);

CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_list ON contacts(list_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_score ON contacts(engagement_score);
CREATE INDEX idx_contacts_tags ON contacts(tags);

-- Import History
CREATE TABLE IF NOT EXISTS import_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'excel', 'json', 'paste')),
  total_rows INTEGER DEFAULT 0,
  imported INTEGER DEFAULT 0,
  duplicates INTEGER DEFAULT 0,
  invalid INTEGER DEFAULT 0,
  field_mapping TEXT,  -- JSON: {"Column A": "email", "Column B": "first_name"}
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Service: `src/services/contactService.ts`

```typescript
interface ContactService {
  // Lists
  createList(userId: string, name: string, description?: string): Promise<ContactList>;
  getLists(userId: string): Promise<ContactList[]>;
  deleteList(userId: string, listId: string): Promise<void>;

  // Contacts CRUD
  addContact(userId: string, listId: string, contact: ContactInput): Promise<Contact>;
  updateContact(userId: string, contactId: string, updates: Partial<ContactInput>): Promise<Contact>;
  deleteContacts(userId: string, contactIds: string[]): Promise<number>;
  getContacts(userId: string, listId: string, filters: ContactFilters): Promise<PaginatedResult<Contact>>;
  searchContacts(userId: string, query: string): Promise<Contact[]>;

  // Import
  importContacts(userId: string, listId: string, data: ImportData): Promise<ImportResult>;
  getImportHistory(userId: string): Promise<ImportHistory[]>;

  // Bulk operations
  tagContacts(userId: string, contactIds: string[], tags: string[]): Promise<number>;
  moveContacts(userId: string, contactIds: string[], targetListId: string): Promise<number>;
  exportContacts(userId: string, listId: string, format: 'csv' | 'json' | 'excel'): Promise<Buffer>;

  // Deduplication
  findDuplicates(userId: string, listId: string): Promise<DuplicateGroup[]>;
  mergeDuplicates(userId: string, mergeInstructions: MergeInstruction[]): Promise<number>;
}

interface ImportData {
  format: 'csv' | 'excel' | 'json' | 'paste';
  content: Buffer | string;
  fieldMapping: Record<string, string>;  // source column → contact field
  skipDuplicates: boolean;
  validateEmails: boolean;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: { row: number; email: string; reason: string }[];
}
```

### API Endpoints

```
POST   /contacts/lists                    Create list
GET    /contacts/lists                    Get all lists
PUT    /contacts/lists/:id               Update list
DELETE /contacts/lists/:id               Delete list

GET    /contacts/:listId                  Get contacts (paginated, filterable)
POST   /contacts/:listId                  Add contact
PUT    /contacts/:id                      Update contact
DELETE /contacts/bulk                     Bulk delete

POST   /contacts/:listId/import           Import contacts (multipart file upload)
GET    /contacts/import-history           Import history
POST   /contacts/:listId/export           Export contacts

POST   /contacts/bulk/tag                 Bulk tag
POST   /contacts/bulk/move               Bulk move
GET    /contacts/:listId/duplicates       Find duplicates
POST   /contacts/:listId/merge            Merge duplicates
GET    /contacts/search?q=               Global search
```

---

## 2. Email Validation & Contact Scoring

### Service: `src/services/validationService.ts`

```typescript
interface ValidationService {
  validateEmail(email: string): Promise<ValidationResult>;
  validateContacts(contacts: Contact[]): Promise<BulkValidationResult>;
  checkSyntax(email: string): boolean;
  checkMX(domain: string): Promise<boolean>;
  checkDisposable(domain: string): boolean;
  checkSuppressed(userId: string, email: string): Promise<boolean>;
}

interface ValidationResult {
  email: string;
  valid: boolean;
  score: number;  // 0-100 health score
  checks: {
    syntax: { pass: boolean; weight: 20 };
    mx: { pass: boolean; weight: 20 };
    disposable: { pass: boolean; weight: 15 };
    suppressed: { pass: boolean; weight: 15 };
    engagement: { pass: boolean; weight: 30; detail: string };
  };
  reason?: string;
}
```

### Scoring Engine: `src/services/scoringEngine.ts`

```typescript
interface ScoringEngine {
  // Calculate score from engagement data
  calculateScore(contactId: string): Promise<number>;

  // Bulk recalculate (cron job)
  recalculateAllScores(userId: string): Promise<void>;

  // Score events
  onEmailOpened(contactId: string): Promise<void>;   // +5 (max +20)
  onLinkClicked(contactId: string): Promise<void>;   // +10 (max +30)
  onEmailBounced(contactId: string): Promise<void>;  // set to 0, status=bounced
  onUnsubscribed(contactId: string): Promise<void>;  // set to 0, status=unsubscribed

  // Decay (run daily)
  applyScoreDecay(): Promise<number>;  // Returns contacts affected

  // Segments
  getContactsByScoreRange(userId: string, min: number, max: number): Promise<Contact[]>;
}

// Score calculation
const SCORE_RULES = {
  email_opened:     { points: 5,   max: 20,  decay_days: 30 },
  link_clicked:     { points: 10,  max: 30,  decay_days: 30 },
  replied:          { points: 20,  max: 20,  decay_days: 60 },
  no_engage_30d:    { points: -10 },
  no_engage_90d:    { points: -30 },
  bounced:          { points: -100 },
  unsubscribed:     { points: -100 },
};

// Score ranges for segmentation
const SCORE_SEGMENTS = {
  hot:  { min: 80, max: 100, label: 'Hot',  color: '#ef4444' },
  warm: { min: 50, max: 79,  label: 'Warm', color: '#f59e0b' },
  cold: { min: 20, max: 49,  label: 'Cold', color: '#3b82f6' },
  dead: { min: 0,  max: 19,  label: 'Dead', color: '#6b7280' },
};
```

### D1 Schema Addition

```sql
-- Engagement events for scoring
CREATE TABLE IF NOT EXISTS engagement_events (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  campaign_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'complained')),
  points INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE INDEX idx_engagement_contact ON engagement_events(contact_id);
CREATE INDEX idx_engagement_type ON engagement_events(event_type);
CREATE INDEX idx_engagement_date ON engagement_events(created_at);
```

---

## 3. HTML Template Management

### D1 Schema

```sql
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'newsletter', 'promotional', 'transactional', 'welcome',
    'follow_up', 'announcement', 'general'
  )),
  subject TEXT,                    -- Default subject line
  html_content TEXT NOT NULL,      -- Full HTML
  text_content TEXT,               -- Plain text fallback
  variables TEXT DEFAULT '[]',     -- JSON array: ["FirstName", "Company", "UnsubscribeLink"]
  thumbnail_url TEXT,              -- Auto-generated preview
  is_starter INTEGER DEFAULT 0,   -- Built-in starter template
  version INTEGER DEFAULT 1,
  parent_id TEXT,                  -- For versioning (points to original)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_templates_user ON templates(user_id);
CREATE INDEX idx_templates_category ON templates(category);
```

### Service: `src/services/templateService.ts`

```typescript
interface TemplateService {
  // CRUD
  create(userId: string, template: TemplateInput): Promise<Template>;
  update(userId: string, templateId: string, updates: Partial<TemplateInput>): Promise<Template>;
  delete(userId: string, templateId: string): Promise<void>;
  get(userId: string, templateId: string): Promise<Template>;
  list(userId: string, filters?: TemplateFilters): Promise<Template[]>;

  // Operations
  duplicate(userId: string, templateId: string, newName: string): Promise<Template>;
  renderPreview(template: Template, sampleData: Record<string, string>): string;
  extractVariables(html: string): string[];  // Parse {{var}} from HTML

  // Import/Export
  importHTML(userId: string, file: Buffer, name: string): Promise<Template>;
  exportHTML(userId: string, templateId: string): Promise<Buffer>;
  exportJSON(userId: string, templateId: string): Promise<string>;

  // Starters
  getStarterTemplates(): Template[];
}
```

### API Endpoints

```
GET    /templates                         List templates (filterable by category)
POST   /templates                         Create template
GET    /templates/:id                     Get template
PUT    /templates/:id                     Update template
DELETE /templates/:id                     Delete template
POST   /templates/:id/duplicate           Duplicate template
POST   /templates/:id/preview             Render preview with sample data
POST   /templates/import                  Import HTML file
GET    /templates/:id/export              Export as HTML/JSON
GET    /templates/starters                List starter templates
GET    /templates/starters                List built-in starter templates
```

---

## 4. Campaign Management

### D1 Schema Updates

```sql
-- Extend existing campaigns table
ALTER TABLE campaigns ADD COLUMN template_id TEXT REFERENCES templates(id);
ALTER TABLE campaigns ADD COLUMN list_id TEXT REFERENCES contact_lists(id);
ALTER TABLE campaigns ADD COLUMN segment_id TEXT;
ALTER TABLE campaigns ADD COLUMN reply_to TEXT;
ALTER TABLE campaigns ADD COLUMN campaign_type TEXT DEFAULT 'one_time'
  CHECK (campaign_type IN ('one_time', 'recurring', 'ab_test', 'automation'));
ALTER TABLE campaigns ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN folder TEXT;
ALTER TABLE campaigns ADD COLUMN draft_data TEXT;       -- JSON: saved wizard state
ALTER TABLE campaigns ADD COLUMN ab_config TEXT;         -- JSON: A/B test config
ALTER TABLE campaigns ADD COLUMN recurring_config TEXT;   -- JSON: recurring schedule
ALTER TABLE campaigns ADD COLUMN test_sent INTEGER DEFAULT 0;

-- A/B Test Variants
CREATE TABLE IF NOT EXISTS ab_variants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  variant_label TEXT NOT NULL,   -- 'A', 'B', 'C', etc.
  subject TEXT,
  template_id TEXT,
  sender_name TEXT,
  sender_email TEXT,
  percentage INTEGER NOT NULL,   -- % of test pool
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  is_winner INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);
```

### Service: `src/services/campaignService.ts`

```typescript
interface CampaignService {
  // CRUD
  create(userId: string, campaign: CampaignInput): Promise<Campaign>;
  update(userId: string, campaignId: string, updates: Partial<CampaignInput>): Promise<Campaign>;
  delete(userId: string, campaignId: string): Promise<void>;
  get(userId: string, campaignId: string): Promise<CampaignDetail>;
  list(userId: string, filters?: CampaignFilters): Promise<PaginatedResult<Campaign>>;

  // Lifecycle
  saveDraft(userId: string, campaignId: string, draftData: any): Promise<void>;
  sendTest(userId: string, campaignId: string, testEmail: string): Promise<void>;
  schedule(userId: string, campaignId: string, scheduledAt: string): Promise<void>;
  launch(userId: string, campaignId: string): Promise<string>;  // Returns job ID
  pause(userId: string, campaignId: string): Promise<void>;
  cancel(userId: string, campaignId: string): Promise<void>;
  clone(userId: string, campaignId: string): Promise<Campaign>;
  archive(userId: string, campaignId: string): Promise<void>;

  // A/B Testing
  createABTest(userId: string, config: ABTestConfig): Promise<Campaign>;
  declareWinner(userId: string, campaignId: string, variantId: string): Promise<void>;
  autoSelectWinner(campaignId: string): Promise<string>;  // Called by scheduler

  // Analytics
  getStats(userId: string, campaignId: string): Promise<CampaignStats>;
  compare(userId: string, campaignIds: string[]): Promise<ComparisonReport>;
}

interface CampaignInput {
  name: string;
  type: 'one_time' | 'recurring' | 'ab_test';
  templateId: string;
  listId?: string;
  segmentId?: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  scheduledAt?: string;
  tags?: string[];
  folder?: string;
  batchConfig?: BatchConfig;
}

interface ABTestConfig {
  campaignName: string;
  listId: string;
  testPercentage: number;        // e.g., 20
  winnerCriteria: 'open_rate' | 'click_rate' | 'click_to_open';
  testDurationHours: number;     // e.g., 24
  variants: {
    label: string;
    subject: string;
    templateId: string;
    senderName?: string;
    percentage: number;
  }[];
}
```

### API Endpoints

```
GET    /campaigns                         List campaigns (filterable, paginated)
POST   /campaigns                         Create campaign
GET    /campaigns/:id                     Get campaign detail
PUT    /campaigns/:id                     Update campaign
DELETE /campaigns/:id                     Delete campaign

POST   /campaigns/:id/draft               Save draft state
POST   /campaigns/:id/test                Send test email
POST   /campaigns/:id/schedule            Schedule campaign
POST   /campaigns/:id/launch              Launch campaign
POST   /campaigns/:id/pause               Pause campaign
POST   /campaigns/:id/cancel              Cancel campaign
POST   /campaigns/:id/clone               Clone campaign
POST   /campaigns/:id/archive             Archive campaign

GET    /campaigns/:id/stats               Get campaign stats
POST   /campaigns/compare                 Compare multiple campaigns

POST   /campaigns/ab-test                 Create A/B test campaign
POST   /campaigns/:id/ab/winner           Declare A/B winner
```

---

## 5. Email Marketing Automation

### D1 Schema

```sql
-- Automation Workflows
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'list_join', 'tag_added', 'score_change', 'date_field', 'manual', 'api'
  )),
  trigger_config TEXT NOT NULL,   -- JSON: trigger-specific config
  entry_list_id TEXT,             -- Which list triggers this
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  enrolled_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  flow_json TEXT NOT NULL,        -- JSON: full flowchart definition
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_automations_user ON automations(user_id);
CREATE INDEX idx_automations_status ON automations(status);

-- Automation Steps (denormalized from flow_json for execution)
CREATE TABLE IF NOT EXISTS automation_steps (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN (
    'send_email', 'wait', 'condition', 'update_contact', 'add_tag',
    'remove_tag', 'move_to_list', 'webhook', 'end'
  )),
  config_json TEXT NOT NULL,  -- Step-specific config
  next_step_id TEXT,          -- Next step (null = end)
  true_step_id TEXT,          -- For conditions: if true
  false_step_id TEXT,         -- For conditions: if false
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
);

-- Automation Enrollments (contacts currently in an automation)
CREATE TABLE IF NOT EXISTS automation_enrollments (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  current_step_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'exited')),
  enrolled_at TEXT DEFAULT (datetime('now')),
  next_action_at TEXT,          -- When to execute next step
  completed_at TEXT,
  exit_reason TEXT,             -- 'completed', 'unsubscribed', 'manual', 'condition_met'
  FOREIGN KEY (automation_id) REFERENCES automations(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  UNIQUE(automation_id, contact_id)
);

CREATE INDEX idx_enrollments_automation ON automation_enrollments(automation_id);
CREATE INDEX idx_enrollments_next ON automation_enrollments(next_action_at) WHERE status = 'active';
CREATE INDEX idx_enrollments_contact ON automation_enrollments(contact_id);
```

### Service: `src/services/automationService.ts`

```typescript
interface AutomationService {
  // CRUD
  create(userId: string, automation: AutomationInput): Promise<Automation>;
  update(userId: string, automationId: string, updates: Partial<AutomationInput>): Promise<Automation>;
  delete(userId: string, automationId: string): Promise<void>;
  get(userId: string, automationId: string): Promise<AutomationDetail>;
  list(userId: string): Promise<Automation[]>;

  // Lifecycle
  activate(userId: string, automationId: string): Promise<void>;
  pause(userId: string, automationId: string): Promise<void>;
  deactivate(userId: string, automationId: string): Promise<void>;

  // Enrollment
  enrollContact(automationId: string, contactId: string): Promise<void>;
  exitContact(automationId: string, contactId: string, reason: string): Promise<void>;
  getEnrollments(automationId: string): Promise<Enrollment[]>;

  // Execution (called by automation worker)
  processNextActions(): Promise<number>;  // Returns count processed
  executeStep(enrollmentId: string, step: AutomationStep): Promise<void>;

  // Analytics
  getStats(automationId: string): Promise<AutomationStats>;
  getFunnelReport(automationId: string): Promise<FunnelStep[]>;
}

// Automation flow definition (stored as JSON)
interface AutomationFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

type FlowNode =
  | { id: string; type: 'send_email'; templateId: string; subject: string }
  | { id: string; type: 'wait'; duration: number; unit: 'hours' | 'days' | 'weeks' }
  | { id: string; type: 'condition'; field: string; operator: string; value: string }
  | { id: string; type: 'update_contact'; field: string; value: string }
  | { id: string; type: 'add_tag'; tag: string }
  | { id: string; type: 'webhook'; url: string; method: 'GET' | 'POST' }
  | { id: string; type: 'end' };

interface FlowEdge {
  from: string;
  to: string;
  label?: 'true' | 'false' | 'default';
}
```

### Automation Worker

```typescript
// Runs on interval (every 60 seconds)
async function automationWorker() {
  // Find enrollments where next_action_at <= now AND status = 'active'
  const due = await db.query(`
    SELECT e.*, s.step_type, s.config_json, s.next_step_id, s.true_step_id, s.false_step_id
    FROM automation_enrollments e
    JOIN automation_steps s ON e.current_step_id = s.id
    WHERE e.status = 'active' AND e.next_action_at <= datetime('now')
    ORDER BY e.next_action_at
    LIMIT 100
  `);

  for (const enrollment of due) {
    await executeStep(enrollment);
  }
}
```

### API Endpoints

```
GET    /automations                       List automations
POST   /automations                       Create automation
GET    /automations/:id                   Get automation detail
PUT    /automations/:id                   Update automation
DELETE /automations/:id                   Delete automation

POST   /automations/:id/activate          Activate
POST   /automations/:id/pause             Pause
POST   /automations/:id/deactivate        Stop

GET    /automations/:id/enrollments       List enrolled contacts
POST   /automations/:id/enroll            Manually enroll contact
DELETE /automations/:id/enrollments/:cid  Remove contact from automation

GET    /automations/:id/stats             Automation stats
GET    /automations/:id/funnel            Funnel report
```

---

## 6. Contact Segmentation

### D1 Schema

```sql
CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'dynamic' CHECK (type IN ('static', 'dynamic')),
  rules_json TEXT,                 -- JSON: for dynamic segments
  contact_count INTEGER DEFAULT 0,
  last_calculated_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Static segment membership
CREATE TABLE IF NOT EXISTS segment_contacts (
  segment_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (segment_id, contact_id),
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);
```

### Segment Rules Engine

```typescript
// Dynamic segment rule format
interface SegmentRules {
  operator: 'AND' | 'OR';
  conditions: SegmentCondition[];
}

type SegmentCondition =
  | { field: 'tag'; operator: 'contains' | 'not_contains'; value: string }
  | { field: 'score'; operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'; value: number }
  | { field: 'status'; operator: 'eq' | 'neq'; value: string }
  | { field: 'list'; operator: 'in' | 'not_in'; value: string }  // list_id
  | { field: 'campaign_opened'; operator: 'eq'; value: string }   // campaign_id
  | { field: 'campaign_clicked'; operator: 'eq'; value: string }
  | { field: 'created_after'; operator: 'gt'; value: string }     // ISO date
  | { field: 'custom_field'; key: string; operator: 'eq' | 'contains'; value: string }
  | { field: 'last_engaged'; operator: 'gt' | 'lt'; value: string };

// Translate rules to SQL WHERE clause
function rulesToSQL(rules: SegmentRules): { sql: string; params: any[] } {
  const clauses = rules.conditions.map(c => conditionToSQL(c));
  const joiner = rules.operator === 'AND' ? ' AND ' : ' OR ';
  return {
    sql: clauses.map(c => c.sql).join(joiner),
    params: clauses.flatMap(c => c.params),
  };
}
```

---

## 7. Persistent Job Queue (SQLite)

*Unchanged from previous TRD — SQLite-backed queue with checkpoint/recovery.*

### Schema: `data/queue.db`

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('direct', 'batch', 'scheduled', 'automation')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5,
  config_json TEXT NOT NULL,
  contacts_json TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_processed_index INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER DEFAULT 20,
  email_delay_sec INTEGER DEFAULT 45,
  batch_delay_min INTEGER DEFAULT 60,
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_jobs_priority ON jobs(priority, created_at) WHERE status = 'pending';

CREATE TABLE dead_letters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  error_message TEXT,
  error_code TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_attempt_at TEXT
);

CREATE TABLE suppression_list (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('bounce_hard', 'bounce_soft', 'unsubscribe', 'complaint', 'manual')),
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, email)
);
```

---

## 8. Retry Engine, Bounce Detection, Compliance

*Same as previous TRD — exponential backoff, SMTP code parsing, List-Unsubscribe headers.*

### Error Classification

```typescript
type ErrorType = 'rate_limit' | 'temporary' | 'permanent' | 'network';

// rate_limit  → Wait + retry
// temporary   → Exponential backoff, max 3 retries
// permanent   → Dead letter queue + suppress email
// network     → Retry with delays, max 5 retries
```

### Compliance Headers (added to every email)

```
List-Unsubscribe: <https://worker.dev/unsubscribe/{trackingId}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
Precedence: bulk
Feedback-ID: {campaignId}:{userId}:dispatch
```

---

## 9. Real-Time Updates (SSE) + Event Bus

### Event Bus: `src/services/eventBus.ts`

```typescript
type EventType =
  | 'email_sent' | 'email_failed' | 'email_opened' | 'email_clicked'
  | 'email_bounced' | 'email_unsubscribed'
  | 'batch_completed' | 'job_completed' | 'job_paused'
  | 'contact_imported' | 'contact_scored'
  | 'automation_step_completed' | 'automation_enrolled'
  | 'stats_update';
```

SSE endpoint streams events per campaign or globally per user.

---

## 10. Webhook System + API Keys

*Same as previous TRD — HMAC-signed webhooks, scoped API keys with Argon2 hashing.*

---

## 11. New File Summary

### New Files (All Phases)

| File | Phase | Purpose |
|------|-------|---------|
| `src/services/queueEngine.ts` | 1 | SQLite persistent job queue |
| `src/services/retryEngine.ts` | 1 | Exponential backoff + error classification |
| `src/services/suppressionService.ts` | 1 | Bounce/unsubscribe suppression |
| `src/services/validationService.ts` | 1 | Email validation (MX, syntax, disposable) |
| `src/services/contactService.ts` | 1 | Contact list CRUD + import/export |
| `src/services/eventBus.ts` | 1 | In-memory pub/sub for SSE |
| `src/routes/events.ts` | 1 | SSE streaming endpoint |
| `src/routes/contacts.ts` | 1 | Contact management API |
| `src/data/disposable-domains.json` | 1 | ~3000 known disposable domains |
| `src/services/scoringEngine.ts` | 2 | Engagement scoring (0-100) |
| `src/services/templateService.ts` | 2 | Template CRUD + MJML compilation |
| `src/services/campaignService.ts` | 2 | Campaign lifecycle management |
| `src/services/automationService.ts` | 2 | Automation workflows + execution |
| `src/services/segmentService.ts` | 2 | Static/dynamic contact segments |
| `src/services/webhookService.ts` | 2 | Outgoing webhook dispatch |
| `src/routes/templates.ts` | 2 | Template API |
| `src/routes/campaigns.ts` | 2 | Campaign API |
| `src/routes/automations.ts` | 2 | Automation API |
| `src/routes/segments.ts` | 2 | Segment API |
| `src/routes/webhooks.ts` | 2 | Webhook API |
| `src/routes/apikeys.ts` | 2 | API key management |
| `src/services/routingEngine.ts` | 3 | Smart provider selection |
| `src/services/pluginManager.ts` | 3 | Plugin lifecycle |
| `frontend/src/views/ContactsView.vue` | 1 | Contact management page |
| `frontend/src/views/TemplatesView.vue` | 2 | Template library + editor |
| `frontend/src/views/CampaignsView.vue` | 2 | Campaign list + wizard |
| `frontend/src/views/AutomationsView.vue` | 2 | Automation builder |
| `frontend/src/views/SegmentsView.vue` | 2 | Segment management |
| `frontend/src/lib/sse.ts` | 1 | SSE client composable |
| `frontend/src/components/contacts/ImportWizard.vue` | 1 | Import with field mapping |
| `frontend/src/components/templates/TemplateEditor.vue` | 2 | HTML + MJML editor |
| `frontend/src/components/campaigns/CampaignWizard.vue` | 2 | Step-by-step campaign builder |
| `frontend/src/components/automations/FlowBuilder.vue` | 2 | Visual automation editor |
| `frontend/src/components/dashboard/LiveStats.vue` | 1 | SSE-powered real-time stats |

### Modified Files

| File | Changes |
|------|---------|
| `src/app.ts` | Queue worker startup, automation worker, new routes |
| `src/services/emailService.ts` | Compliance headers, validation, suppression check, event emission, scoring trigger |
| `src/services/batchService.ts` | Refactor to use queueEngine |
| `src/middleware/auth.ts` | API key support |
| `src/routes/send.ts` | Route through queue, validation step |
| `src/types/index.ts` | All new interfaces |
| `tracking-worker/src/index.ts` | Unsubscribe endpoint, bounce webhook, scoring webhook |
| `tracking-worker/schema.sql` | New tables (contacts, templates, automations, segments, etc.) |
| `frontend/src/router/index.ts` | New routes |
| `frontend/src/components/layout/AppLayout.vue` | New nav items |
| `frontend/src/views/DashboardView.vue` | SSE real-time + scoring overview |
| `frontend/src/views/ComposeView.vue` | Contact list selector, template picker |

---

## 12. Dependencies

### Phase 1 — Zero new external dependencies

| Need | Solution |
|------|----------|
| Job queue DB | `bun:sqlite` (built-in) |
| MX lookup | `dns/promises` (built-in) |
| SSE streaming | `hono/streaming` (built-in) |

### Phase 2 — No new dependencies

Templates use raw HTML + Quill editor (already installed).

### Design Principle

Use built-ins first. Bun has SQLite, DNS, and fast HTTP. Hono has SSE. Only add a dependency when there's no reasonable built-in alternative.

---

## 13. Background Workers

Three worker loops running on the backend:

| Worker | Interval | Purpose |
|--------|----------|---------|
| **Queue Worker** | 5s poll | Process pending email jobs |
| **Automation Worker** | 60s poll | Execute due automation steps |
| **Score Decay Worker** | 24h cron | Apply engagement score decay |

All workers are started in `src/app.ts` on server boot and use SQLite/D1 for state (survive restarts).

---

## 14. Implementation Order

```
Phase 1 — Foundation (P0):
  1.  Queue Engine (queueEngine.ts)              ← Foundation
  2.  Retry Engine (retryEngine.ts)              ← Used by queue
  3.  Suppression Service                        ← Used by queue
  4.  Refactor batchService → use queue          ← Integrate
  5.  Contact Service + Import                   ← Contact management
  6.  Contact Import Wizard (frontend)           ← Field mapping UI
  7.  Email Validation Service                   ← Pre-send check
  8.  Compliance Headers                         ← emailService update
  9.  Bounce Detection + Unsubscribe Endpoint    ← Worker update
  10. Event Bus + SSE                            ← Real-time
  11. Frontend: Contacts page + Live dashboard   ← UI

Phase 2 — Marketing Features (P1):
  12. Scoring Engine                             ← Engagement scores
  13. Template Service + Template Editor          ← Template library
  14. Campaign Service + Campaign Wizard          ← Full campaign lifecycle
  15. Segmentation Engine                        ← Dynamic/static segments
  16. Automation Service + Flow Builder           ← Drip sequences
  17. Automation Worker                           ← Background execution
  18. A/B Testing                                ← Campaign variants
  19. Webhook System                             ← Outgoing events
  20. API Key Auth                               ← Programmatic access

Phase 3 — Intelligence & Scale (P2):
  21. Smart Provider Routing                     ← Score-based selection
  22. Email Warmup                               ← Volume ramp
  23. Campaign Calendar                          ← Visual scheduling
  24. Advanced Analytics + Reports               ← Deep insights
  25. Plugin System                              ← Extensibility
  26. CLI Tool                                   ← Terminal access
  27. Multi-Language Templates                   ← i18n
```
