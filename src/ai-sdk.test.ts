// Unit tests for the Vercel AI SDK adapter. fetch is injected — no live calls.
import { describe, it, expect, vi } from 'vitest'
import { databazaarTools } from './ai-sdk.js'
import { DataBazaarClient } from './client.js'
import { selectedToolSpecs } from './tools.js'
import { generateText } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

it('executes a validated tool call through the current AI SDK model loop', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [], total: 0 })))
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'tool-call', toolCallId: 'find-data', toolName: 'databazaar_search_datasets', input: JSON.stringify({ query: 'DeepSearchQA', limit: 1 }) }],
      finishReason: { unified: 'tool-calls', raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    }),
  })
  const result = await generateText({ model, tools: databazaarTools({ fetch: fetchImpl }), prompt: 'Find the DeepSearchQA dataset' })
  expect(result.toolResults[0].output).toEqual({ data: [], total: 0 })
  expect(fetchImpl).toHaveBeenCalledOnce()
  expect(model.doGenerateCalls[0].tools?.find(t => t.name === 'databazaar_search_datasets')).toBeDefined()
})

describe('databazaarTools (Vercel AI SDK)', () => {
  it('exposes purchase and bounty posting independently, only when enabled', () => {
    const defaults = databazaarTools()
    expect(defaults.databazaar_buy_now).toBeUndefined()
    expect(defaults.databazaar_log_data_gap).toBeUndefined()
    expect(defaults.databazaar_list_bounties).toBeDefined()
    expect(databazaarTools({ allowPurchases: true }).databazaar_buy_now).toBeDefined()
    expect(databazaarTools({ allowPurchases: true }).databazaar_log_data_gap).toBeUndefined()
    expect(databazaarTools({ allowBountyPosting: true }).databazaar_log_data_gap).toBeDefined()
    expect(databazaarTools({ allowBountyPosting: true }).databazaar_buy_now).toBeUndefined()
  })
  it('returns one AI SDK tool per spec, keyed by tool name', () => {
    const tools = databazaarTools({ apiKey: 'dbz_live_test' })
    expect(Object.keys(tools).sort()).toEqual(selectedToolSpecs().map((s) => s.name).sort())
    for (const t of Object.values(tools)) {
      expect(t.description).toBeTruthy()
      expect(t.inputSchema).toBeDefined()
      expect(typeof t.execute).toBe('function')
    }
  })

  it('execute proxies through the client to the REST API', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ covered: false }),
    }))
    const tools = databazaarTools({ apiKey: 'dbz_live_test', fetch: f as unknown as typeof globalThis.fetch })
    const result = await tools.databazaar_check_coverage.execute!(
      { source_name: 'noaa' },
      { toolCallId: 't1', messages: [] }
    )
    expect(result).toEqual({ covered: false })
    const url = new URL(f.mock.calls[0][0] as unknown as string)
    expect(url.pathname).toBe('/coverage')
    expect(url.searchParams.get('source')).toBe('noaa')
    // Auth header comes from the constructor apiKey
    const init = f.mock.calls[0][1] as unknown as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer dbz_live_test')
  })

  it('accepts a pre-configured client instead of options', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'ds-1' }) }))
    const client = new DataBazaarClient({
      apiKey: 'dbz_live_test',
      apiUrl: 'http://localhost:3001',
      fetch: f as unknown as typeof globalThis.fetch,
    })
    const tools = databazaarTools({ client })
    await tools.databazaar_get_dataset.execute!(
      { dataset_id: '123e4567-e89b-42d3-a456-426614174000' },
      { toolCallId: 't1', messages: [] }
    )
    expect(f.mock.calls[0][0]).toBe(
      'http://localhost:3001/datasets/123e4567-e89b-42d3-a456-426614174000'
    )
  })
})
