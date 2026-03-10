// src/routes/plugins.ts - Plugin System Endpoints

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { success, error } from '../utils/response'
import { pluginManager } from '../services/pluginManager'

const app = new Hono()

// List installed plugins
app.get('/plugins', async (c) => {
  const user = requireAuth(c)
  const type = c.req.query('type') || undefined
  const status = c.req.query('status') || undefined
  const plugins = pluginManager.list(user.id, { type, status })
  return success(c, { plugins })
})

// Get available (built-in) providers
app.get('/plugins/providers', async (c) => {
  requireAuth(c)
  const providers = pluginManager.getAvailableProviders()
  return success(c, { providers })
})

// Discover local plugins
app.get('/plugins/discover', async (c) => {
  requireAuth(c)
  const discovered = pluginManager.discoverLocalPlugins()
  return success(c, { plugins: discovered })
})

// Get registered hooks
app.get('/plugins/hooks', async (c) => {
  requireAuth(c)
  const hooks = pluginManager.getRegisteredHooks()
  return success(c, { hooks })
})

// Get single plugin
app.get('/plugins/:id', async (c) => {
  const user = requireAuth(c)
  const pluginId = c.req.param('id')
  const plugin = pluginManager.get(user.id, pluginId)

  if (!plugin) return error(c, 'Plugin not found', 404)
  return success(c, plugin)
})

// Install plugin from manifest
app.post('/plugins', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.manifest || !body.manifest.name || !body.manifest.type) {
    return error(c, 'Valid plugin manifest required (name, type)')
  }

  try {
    const plugin = pluginManager.install(user.id, {
      manifest: body.manifest,
      settings: body.settings,
    })
    return success(c, plugin, 'Plugin installed', 201)
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return error(c, 'Plugin already installed', 409)
    }
    throw err
  }
})

// Install built-in provider plugin
app.post('/plugins/providers/install', async (c) => {
  const user = requireAuth(c)
  const { providerName, settings } = await c.req.json()

  if (!providerName) {
    return error(c, 'providerName required')
  }

  const plugin = pluginManager.installBuiltinProvider(user.id, providerName, settings || {})

  if (!plugin) {
    return error(c, `Provider "${providerName}" not found`, 404)
  }

  return success(c, plugin, 'Provider plugin installed', 201)
})

// Activate plugin
app.post('/plugins/:id/activate', async (c) => {
  const user = requireAuth(c)
  const pluginId = c.req.param('id')

  if (!pluginManager.activate(user.id, pluginId)) {
    return error(c, 'Plugin not found', 404)
  }

  return success(c, null, 'Plugin activated')
})

// Disable plugin
app.post('/plugins/:id/disable', async (c) => {
  const user = requireAuth(c)
  const pluginId = c.req.param('id')

  if (!pluginManager.disable(user.id, pluginId)) {
    return error(c, 'Plugin not found', 404)
  }

  return success(c, null, 'Plugin disabled')
})

// Update plugin settings
app.put('/plugins/:id/settings', async (c) => {
  const user = requireAuth(c)
  const pluginId = c.req.param('id')
  const { settings } = await c.req.json()

  if (!settings) {
    return error(c, 'settings object required')
  }

  if (!pluginManager.updateSettings(user.id, pluginId, settings)) {
    return error(c, 'Plugin not found', 404)
  }

  return success(c, null, 'Plugin settings updated')
})

// Uninstall plugin
app.delete('/plugins/:id', async (c) => {
  const user = requireAuth(c)
  const pluginId = c.req.param('id')

  if (!pluginManager.uninstall(user.id, pluginId)) {
    return error(c, 'Plugin not found', 404)
  }

  return success(c, null, 'Plugin uninstalled')
})

export default app
