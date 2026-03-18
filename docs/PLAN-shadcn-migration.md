# shadcn-vue Migration Plan

**Goal**: Replace all raw HTML elements with proper shadcn-vue/radix-vue components + Tailwind utility classes only. No custom CSS classes like `btn-primary`, `form-input` — use shadcn components instead.

---

## Current State

| What | Count | Status |
|------|-------|--------|
| Total view files | 40 | Need review |
| Files using raw `<select>` | 14 | Replace with shadcn Select |
| Files using raw `<input type=checkbox>` | 8 | Replace with Switch/Checkbox |
| Files using raw `<table>` | 8 | Replace with shadcn Table |
| Files using `class="btn-"` | 28 | Replace with Button component |
| Custom CSS classes in tailwind.css | 869 lines | Keep design tokens, remove component classes |

## Components to Create (shadcn-vue style)

### Phase 1: Core Primitives (used everywhere)

| Component | Based On | Replaces |
|-----------|----------|----------|
| `ui/button` | Already exists (`Button.vue`) | `class="btn-primary"`, `class="btn-secondary"` etc. |
| `ui/input` | Already exists (`Input.vue`) | `class="form-input"` |
| `ui/label` | New — simple `<label>` wrapper | `class="form-label"` |
| `ui/select` | radix-vue `SelectRoot/Portal/Content` | raw `<select class="form-input">` |
| `ui/switch` | radix-vue `SwitchRoot` | raw `<input type="checkbox">` with toggle styling |
| `ui/checkbox` | radix-vue `CheckboxRoot` | raw `<input type="checkbox" class="form-checkbox">` |
| `ui/textarea` | New — styled `<textarea>` | raw `<textarea class="form-input">` |
| `ui/radio-group` | radix-vue `RadioGroupRoot` | raw `<input type="radio">` |

### Phase 2: Layout & Data Display

| Component | Based On | Replaces |
|-----------|----------|----------|
| `ui/table` | New — `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` | raw `<table>` everywhere |
| `ui/dialog` | Already exists as `Modal.vue` — rename/refactor to shadcn Dialog | `Modal.vue` |
| `ui/sheet` | Already exists as `SlidePanel.vue` — rename/refactor | `SlidePanel.vue` |
| `ui/scroll-area` | radix-vue `ScrollAreaRoot` | raw `overflow-y-auto` |
| `ui/alert` | New — styled alert box | `AlertBanner.vue` |
| `ui/alert-dialog` | Already exists as `ConfirmDialog.vue` — refactor | `ConfirmDialog.vue` |

### Phase 3: Advanced

| Component | Based On | Replaces |
|-----------|----------|----------|
| `ui/command` | Already exists as `CommandPalette.vue` | — |
| `ui/popover` | radix-vue `PopoverRoot/Portal` | any floating content |
| `ui/accordion` | radix-vue `AccordionRoot` | expandable sections |
| `ui/tabs` | Refactor `AppTabs.vue` to use radix-vue `TabsRoot` | `AppTabs.vue` |

## Migration Steps (by file)

### Step 1: Create missing shadcn components
1. `ui/select.ts` — Select with Portal (proper dropdown, no overflow issues)
2. `ui/switch.ts` — Toggle switch
3. `ui/checkbox.ts` — Checkbox
4. `ui/table.ts` — Table primitives
5. `ui/label.ts` — Label
6. `ui/textarea.ts` — Textarea

### Step 2: Migrate views (28 files use btn-, 14 use raw select)
Priority order:
1. Platform pages (PlatformUsers, PlatformOrgs, PlatformDashboard, PlatformSettings) — 4 files
2. Settings pages (DeliveryServers, DomainsSettings, TrackingSettings, ApiKeys, Webhooks) — 5 files
3. Admin pages (OrgSettings, MembersPage, TeamsPage, RolesPage, AuditPage) — 5 files
4. Core pages (Dashboard, ComposeView, CampaignsView, CampaignDetail, ContactsView, TemplatesView) — 6 files
5. Tool pages (Automations, Forms, Pages, Calendar, Analytics, Reports) — 6 files
6. Auth pages (Login, Register, ForgotPassword, ResetPassword) — 4 files

### Step 3: Remove custom CSS component classes
After all views use shadcn components, remove from `tailwind.css`:
- `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- `.form-input`, `.form-select`, `.form-label`, `.form-group`, `.form-checkbox`
- `.badge-sm`, `.badge-*`
- Keep: design tokens (`@theme` block), utility overrides

## Effort Estimate

| Phase | Files | Hours |
|-------|-------|-------|
| Create 6 new components | 6 | 3h |
| Migrate 40 view files | 40 | 12h |
| Remove old CSS | 1 | 1h |
| Testing | — | 2h |
| **Total** | **47** | **18h** |

## Order of Execution

1. Create all new shadcn components first (so views can import them)
2. Migrate one page at a time, test after each
3. Start with platform pages (smallest, newest)
4. End with core pages (largest, most complex)
5. Remove old CSS classes last (after all views migrated)
