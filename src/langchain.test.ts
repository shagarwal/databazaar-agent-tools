// Unit tests for the LangChain.js adapter. fetch is injected — no live calls.
import { describe, it, expect, vi } from 'vitest'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { databazaarLangChainTools } from './langchain.js'
import { DataBazaarClient } from './client.js'
import { selectedToolSpecs } from './tools.js'

describe('databazaarLangChainTools (LangChain.js)', () => {
  it('exposes purchase and bounty posting independently, only when enabled', () => {
    const names = (options = {}) => databazaarLangChainTools(options).map(t => t.name)
    expect(names()).not.toContain('databazaar_buy_now')
    expect(names()).not.toContain('databazaar_log_data_gap')
    expect(names({ allowPurchases: true })).toContain('databazaar_buy_now')
    expect(names({ allowPurchases: true })).not.toContain('databazaar_log_data_gap')
    expect(names({ allowBountyPosting: true })).toContain('databazaar_log_data_gap')
    expect(names({ allowBountyPosting: true })).not.toContain('databazaar_buy_now')
  })
  it('returns one DynamicStructuredTool per spec with matching names', () => {
    const tools = databazaarLangChainTools({ apiKey: 'dbz_live_test' })
    expect(tools).toHaveLength(selectedToolSpecs().length)
    for (const t of tools) {
      expect(t).toBeInstanceOf(DynamicStructuredTool)
      expect(t.description).toBeTruthy()
    }
    expect(tools.map((t) => t.name).sort()).toEqual(selectedToolSpecs().map((s) => s.name).sort())
  })

  it('invoke proxies through the client and returns a JSON string', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [], total: 0, limit: 10, offset: 0 }),
    }))
    const tools = databazaarLangChainTools({
      apiKey: 'dbz_live_test',
      fetch: f as unknown as typeof globalThis.fetch,
    })
    const search = tools.find((t) => t.name === 'databazaar_search_datasets')!
    const result = await search.invoke({ query: 'hn jobs' })
    // LangChain convention: tool output is a string
    expect(JSON.parse(result as string)).toEqual({ data: [], total: 0, limit: 10, offset: 0 })
    const url = new URL(f.mock.calls[0][0] as unknown as string)
    expect(url.pathname).toBe('/datasets')
    expect(url.searchParams.get('query')).toBe('hn jobs')
  })

  it('accepts a pre-configured client instead of options', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ covered: true }) }))
    const client = new DataBazaarClient({
      apiUrl: 'http://localhost:3001',
      fetch: f as unknown as typeof globalThis.fetch,
    })
    const tools = databazaarLangChainTools({ client })
    const coverage = tools.find((t) => t.name === 'databazaar_check_coverage')!
    await coverage.invoke({ source_name: 'census' })
    expect((f.mock.calls[0][0] as unknown as string).startsWith('http://localhost:3001/coverage')).toBe(true)
  })
})
