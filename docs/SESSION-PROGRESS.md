# Session Progress — UX Improvements + WhatsApp + Flow Builder

**Date:** April 9-10, 2026
**Branch:** `new-framework`

---

## COMPLETED

### 1. UX Improvements (14 Items — All Done)

#### Phase 1: Foundation
- [x] **Toast Polish** — Action buttons (undo), stacking limit (max 5), auto-dismiss progress bar (`useToast.ts`, `ToastContainer.vue`)
- [x] **Keyboard Shortcuts** — `useKeyboardShortcuts.ts` composable with sequence support (`g+d` = dashboard), `KeyboardShortcutsModal.vue` (`?` key), enhanced `CommandPalette.vue` (recent items, actions, fuzzy search)
- [x] **Form Improvements** — `useAutoSave.ts` (localStorage drafts), `useUnsavedChanges.ts` (route guard + beforeunload), Ctrl+S via provide/inject

#### Phase 2: Components
- [x] **Skeleton Loading** — 3 new variants (calendar, chart, timeline) in `Skeleton.vue`
- [x] **PageHeader** — Enhanced with `backTo`, `status`, `statusType`, `icon` props + `#prefix`/`#meta` slots
- [x] **List Views** — New `ListToolbar.vue`, `BatchActionBar.vue`, enhanced `SearchInput.vue` (debounce + clear button)

#### Phase 3: Features
- [x] **Dashboard** — `useDashboardLayout.ts`, `DateRangeSelector.vue`
- [x] **Contact Timeline** — Expandable events, type filter, load-more pagination, skeleton loading
- [x] **Automation Editor** — `useFlowHistory.ts` (undo/redo), toolbar buttons, auto-layout
- [x] **Email Builder** — `sendTestEmail` + `checkSpamScore` API stubs in `email.ts`

#### Phase 4: Mobile
- [x] **BottomNav** — Mobile bottom navigation (Dashboard, Compose, Contacts, More)
- [x] **Modal** — `fullscreenOnMobile` prop
- [x] **SlidePanel** — `full` size (90vw) for template editor

#### Phase 5: Systems
- [x] **Onboarding** — `useOnboarding.ts`, `OnboardingChecklist.vue` (5-step setup checklist)
- [x] **Notifications** — `useNotifications.ts`, `NotificationBell.vue`, `NotificationDropdown.vue`

#### Phase 6: Polish
- [x] **Dark Mode** — Monaco editor theme-reactive (`HtmlCodeEditor.vue`)

### 2. Bug Fixes (9 bugs found and fixed)

- [x] Memory leak: `useAutoSave` interval not cleared → added `onBeforeUnmount`
- [x] `?` shortcut broken: `normalizeKey` added `shift+` prefix → fixed shift handling for printable chars
- [x] Memory leak: `FlowCanvas` keydown listener → added `onBeforeUnmount` + `removeEventListener`
- [x] Notification polling never stops → added usage counter + cleanup
- [x] `BottomNav` "More" toggled collapse not mobile menu → added `mobileOpen` to `useSidebar`, updated `AppSidebar`
- [x] Monaco theme not reactive: watching function not ref → watch `theme` instead of `isDark`
- [x] Dashboard `Set<string>` not reactive → replaced with plain `string[]`
- [x] Invalid Tailwind class `placeholder-text-muted` in CommandPalette → fixed to `placeholder:text-muted-foreground`
- [x] ToastContainer redundant dynamic aria-live binding → static attribute

### 3. OAuth Fixes

- [x] **404 on Google Connect** — Backend redirected to `/configs` (doesn't exist). Changed all redirects to `/settings/delivery-servers`
- [x] **Platform admin OAuth redirect** — Platform admin was sent to `/settings/...` (org route, blocked by guard). Now detects `isPlatformAdmin` and redirects to `/platform/settings/delivery-servers` or `/platform/system-settings`
- [x] **System mailer client secret corruption** — GET endpoint returned `********`, frontend loaded it into form, saved it back overwriting real secret. Fixed: backend preserves existing secret when `********` received, frontend loads empty string instead of masked value

### 4. Template Editor UX Fix

- [x] SlidePanel `xl` was 800px (too narrow) → added `full` size (90vw)
- [x] Removed redundant "Live Preview" panel (40% of space wasted) — Visual editor IS the preview
- [x] Fixed Cancel/Update buttons trapped in broken negative-margin layout

### 5. WhatsApp — Full Business-Level Implementation

- [x] **Frontend API** — Added `createTemplate()` method in `whatsapp.ts`
- [x] **WhatsAppView.vue** — Complete rebuild:
  - Template Creator (name, language, category picker, header/body/footer, buttons up to 3, WhatsApp-style live preview)
  - Template Detail Modal (shows all components parsed from JSON)
  - Improved template cards (category icons, component indicators, status counts)
  - Improved account cards (info grid, webhook URL display)
  - AppTabs, StatCard, SearchInput integration
- [x] **Automation integration** — `send_whatsapp` node added to palette, execution handler in `automationService.ts`

### 6. Platform Admin Parity

- [x] Added `/platform/whatsapp` route in router
- [x] Added WhatsApp to `PlatformLayout.vue` sidebar (Tools section)
- [x] Verified ALL routes match between org and platform (no gaps)
- [x] Saved rule to memory: every new feature MUST exist in both org + platform routes/sidebar

### 7. Flow Builder Rebuild (Mautic + n8n inspired)

- [x] **Research** — Deep analysis of n8n (node structure, NDV panel, handles, expressions) and Mautic (3-type events, connection restrictions, timing system, all actions/decisions/conditions)
- [x] **Node Registry** (`nodes/index.ts`) — Complete rebuild: 30 node types across 5 categories
  - Triggers (1): Entry point
  - Actions - Channels (3): Send Email, Send WhatsApp, Internal Notification
  - Actions - Contact Mgmt (7): Add/Remove Tag, Update Contact, Move to List, Change Score, Add/Remove DNC
  - Actions - Integrations (2): Webhook, HTTP Request
  - Decisions (5): Email Opened, Email Clicked, Form Submitted, WhatsApp Delivered, WhatsApp Read
  - Conditions (6): Contact Field, Has Tag, In List, Score Check, Filter, A/B Split
  - Timing (3): Wait, Wait Until, Send Window
  - End (1)
  - Each node defines: fields[], outputs (handles), connectionRestrictions, category, description
- [x] **BaseNode.vue** — Rebuilt with category badge, multi-handle support, configured/unconfigured state
- [x] **NodeConfigPanel.vue** — Complete rebuild with dynamic form rendering from field definitions (supports text, number, select, textarea, datetime, operator-select, field-picker, tag-picker, list-picker, template-picker, wa-template-picker)
- [x] **FlowCanvas.vue** — Updated palette with descriptions, dynamic node rendering
- [x] **Backend automationService.ts** — Added execution handlers for all new types: `has_tag`, `in_list`, `score_check`, `send_notification`, `add_dnc`, `remove_dnc`, `send_window`, `email_opened`, `email_clicked`, `form_submitted`, `whatsapp_delivered`, `whatsapp_read`

---

## NOT DONE — Continue in Next Session

### Flow Builder — Remaining Work

1. **Data-connected dropdowns** — Template picker should fetch real templates from API, list picker should fetch real lists, tag picker should autocomplete from existing tags. Currently these are text inputs with placeholders.

2. **Connection restriction enforcement** — `isConnectionAllowed()` helper exists but not wired into `onConnect` in FlowCanvas. Need to validate connections and show error toast when restricted (e.g., "Opened Email can only follow Send Email").

3. **Decision node event wiring** — Decision nodes (email_opened, email_clicked, etc.) currently schedule a wait period then take the No path. Need to wire to actual tracking events (via eventBus) so when the real event happens, the enrollment advances to the Yes path immediately.

4. **Node timing config** — Per-node timing settings (Mautic pattern: immediate/delay/date + restricted hours/days). Currently only the Wait node handles timing. Need a "Timing" tab in NodeConfigPanel for any node.

5. **Multi-split node** — Switch/Router node with N outputs (like n8n's Switch). Currently only A/B split with 2 paths.

### Segment Builder (New Feature)

6. **Segment Builder UI** — Dynamic contact groups based on rules (field value, tag, score, activity). No code exists yet. Needed for: targeted campaigns, automation triggers, analytics.

7. **Segment API** — Backend CRUD + real-time membership evaluation.

### Other Remaining

8. **SMS integration** — Node type exists conceptually but no Twilio/Vonage service.

9. **Campaign → Automation link** — After a campaign sends, enroll contacts into an automation based on behavior (opened, clicked, bounced). No code exists.

10. **Tag management page** — Dedicated page to list all tags, merge duplicates, bulk apply. Currently tags are just strings.

11. **Real data pickers** — Replace text input placeholders in NodeConfigPanel with actual API-connected Select components that fetch templates, lists, tags, WhatsApp accounts/templates in real-time.

---

## Files Created This Session

### New Composables (7)
- `frontend/src/composables/useKeyboardShortcuts.ts`
- `frontend/src/composables/useAutoSave.ts`
- `frontend/src/composables/useUnsavedChanges.ts`
- `frontend/src/composables/useDashboardLayout.ts`
- `frontend/src/composables/useFlowHistory.ts`
- `frontend/src/composables/useOnboarding.ts`
- `frontend/src/composables/useNotifications.ts`

### New Components (8)
- `frontend/src/components/ui/KeyboardShortcutsModal.vue`
- `frontend/src/components/ui/ListToolbar.vue`
- `frontend/src/components/ui/BatchActionBar.vue`
- `frontend/src/components/ui/DateRangeSelector.vue`
- `frontend/src/components/ui/OnboardingChecklist.vue`
- `frontend/src/components/layout/BottomNav.vue`
- `frontend/src/components/layout/NotificationBell.vue`
- `frontend/src/components/layout/NotificationDropdown.vue`

## Files Modified This Session

### Frontend
- `frontend/src/composables/useToast.ts` — action buttons, undo, stacking limit
- `frontend/src/composables/useSidebar.ts` — mobileOpen shared state
- `frontend/src/components/ui/ToastContainer.vue` — progress bar, action button, aria fixes
- `frontend/src/components/ui/Skeleton.vue` — 3 new variants
- `frontend/src/components/ui/PageHeader.vue` — backTo, status, icon, slots
- `frontend/src/components/ui/SearchInput.vue` — debounce, clear button
- `frontend/src/components/ui/Modal.vue` — fullscreenOnMobile
- `frontend/src/components/ui/SlidePanel.vue` — full size (90vw)
- `frontend/src/components/layout/MainLayout.vue` — keyboard shortcuts, notifications, bottom nav, Ctrl+S
- `frontend/src/components/layout/AppSidebar.vue` — WhatsApp nav, mobileOpen shared state
- `frontend/src/components/command/CommandPalette.vue` — recent items, actions, fuzzy search
- `frontend/src/components/contacts/ContactTimeline.vue` — expandable, filterable, paginated
- `frontend/src/components/automation/FlowCanvas.vue` — new node system, palette, undo/redo
- `frontend/src/components/automation/NodeConfigPanel.vue` — dynamic field rendering
- `frontend/src/components/automation/nodes/index.ts` — 30 node types, 5 categories
- `frontend/src/components/automation/nodes/BaseNode.vue` — multi-handle, category badge
- `frontend/src/components/compose/HtmlCodeEditor.vue` — reactive Monaco theme
- `frontend/src/views/WhatsAppView.vue` — complete rebuild with template creator
- `frontend/src/views/TemplatesView.vue` — full-width editor, removed live preview panel
- `frontend/src/views/settings/DeliveryServers.vue` — OAuth callback handler
- `frontend/src/views/admin/PlatformSettingsPage.vue` — OAuth secret fix
- `frontend/src/views/platform/PlatformLayout.vue` — WhatsApp in sidebar
- `frontend/src/router/index.ts` — platform WhatsApp route
- `frontend/src/lib/api/whatsapp.ts` — createTemplate method
- `frontend/src/lib/api/email.ts` — sendTestEmail, checkSpamScore stubs

### Backend
- `src/utils/oauth.ts` — fixed all redirects, platform admin detection
- `src/routes/admin.ts` — OAuth secret preservation
- `src/services/automationService.ts` — 12 new step execution handlers, WhatsApp integration

---

## Architecture Rules (Never Forget)

1. **Platform admin = GOD MODE** — sees everything org users see + platform section. Never create a feature platform admin can't access.
2. **Every org route must have a platform mirror** — `/whatsapp` → `/platform/whatsapp`
3. **Every AppSidebar nav item must exist in PlatformLayout sidebar**
4. **Two separate layouts** — org users use MainLayout + AppSidebar, platform admin uses PlatformLayout (own sidebar)
5. **Always use `bun`/`bunx`** — never npm/npx
6. **Build full pages with SaaS-level UX** — not small tacked-on components
