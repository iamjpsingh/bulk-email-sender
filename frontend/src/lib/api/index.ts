/**
 * API barrel export
 * Re-exports all domain API modules for centralized access
 */
export {
  api,
  type ApiResponse,
  type User,
  type SMTPConfig,
  type EmailLog,
  type EmailStats,
  type Pagination,
  type BatchStatus,
  type ScheduledJob,
  type ProviderStatus,
  type QueueJobSummary,
  type QueueStats,
  type QueueDashboard,
  type DashboardStats,
} from './client'
export { authApi } from './auth'
export { emailApi, batchApi, scheduledApi, queueApi } from './email'
export {
  contactsApi,
  type ContactList,
  type Contact,
  type ContactInput,
  type ImportResult,
  type ImportHistory,
  type ValidationResult,
  type BulkValidationResult,
} from './contacts'
export { campaignsApi, type Campaign, type CampaignInput, type CampaignType, type CampaignStatus } from './campaigns'
export { configApi, oauthApi, reportApi, dashboardApi } from './config'
export { templatesApi, type Template, type TemplateInput, type TemplateCategory } from './templates'
export {
  analyticsApi,
  segmentsApi,
  webhooksApi,
  apiKeysApi,
  automationsApi,
  routingApi,
  warmupApi,
  pluginsApi,
  type AnalyticsSummary,
  type CampaignReport,
  type LinkClickData,
  type RoutingScore,
  type RoutingDecision,
  type RoutingConfig,
  type WarmupPlan,
  type WarmupInput,
  type TriggerType,
  type AutomationStatus,
  type Automation,
  type PluginInfo,
} from './analytics'
