// Unit tests for the framework-neutral tool specs.
import { describe, it, expect, vi } from 'vitest'
import { toolSpecs } from './tools.js'
import { DataBazaarClient } from './client.js'

const EXPECTED_TOOLS = [
  'databazaar_search_datasets',
  'databazaar_get_dataset',
  'databazaar_preview_sample',
  'databazaar_buy_now',
  'databazaar_get_download_url',
  'databazaar_list_purchases',
  'databazaar_check_coverage',
  'databazaar_log_data_gap',
  'databazaar_list_bounties',
  'databazaar_query_dataset',
]

function clientWithMockFetch(payload: unknown = {}) {
  const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }))
  const client = new DataBazaarClient({
    apiKey: 'dbz_live_test',
    fetch: f as unknown as typeof globalThis.fetch,
  })
  return { client, f }
}

describe('toolSpecs', () => {
  it('exposes exactly the v1 tool set, each with a description and object schema', () => {
    expect(toolSpecs.map((s) => s.name)).toEqual(EXPECTED_TOOLS)
    for (const spec of toolSpecs) {
      expect(spec.description.length).toBeGreaterThan(20)
      // Every schema must be a zod object so adapters can map it to JSON schema
      expect(spec.schema._def.typeName).toBe('ZodObject')
    }
  })

  it('search schema validates and rejects out-of-range values', () => {
    const search = toolSpecs.find((s) => s.name === 'databazaar_search_datasets')!
    expect(search.schema.safeParse({ query: 'weather data', limit: 10 }).success).toBe(true)
    expect(search.schema.safeParse({ query: 'x', min_quality_score: 101 }).success).toBe(false)
    expect(search.schema.safeParse({ query: 'x', pricing_type: 'crypto' }).success).toBe(false)
  })

  it('uuid-taking schemas reject non-uuid ids', () => {
    const getDataset = toolSpecs.find((s) => s.name === 'databazaar_get_dataset')!
    expect(getDataset.schema.safeParse({ dataset_id: 'not-a-uuid' }).success).toBe(false)
    expect(
      getDataset.schema.safeParse({ dataset_id: '123e4567-e89b-42d3-a456-426614174000' }).success
    ).toBe(true)
  })

  it('execute delegates to the client (search hits GET /datasets)', async () => {
    const { client, f } = clientWithMockFetch({ data: [], total: 0, limit: 10, offset: 0 })
    const search = toolSpecs.find((s) => s.name === 'databazaar_search_datasets')!
    await search.execute(client, { query: 'hn jobs' })
    const url = new URL(f.mock.calls[0][0] as unknown as string)
    expect(url.pathname).toBe('/datasets')
    expect(url.searchParams.get('query')).toBe('hn jobs')
    expect(url.searchParams.get('limit')).toBe('10') // default applied
  })

  it('execute delegates to the client (buy_now POSTs to /datasets/:id/buy)', async () => {
    const { client, f } = clientWithMockFetch({ purchase_id: 'p-1' })
    const buy = toolSpecs.find((s) => s.name === 'databazaar_buy_now')!
    await buy.execute(client, {
      dataset_id: '123e4567-e89b-42d3-a456-426614174000',
      payment_method_id: 'pm_1',
    })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url.endsWith('/datasets/123e4567-e89b-42d3-a456-426614174000/buy')).toBe(true)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ payment_method_id: 'pm_1' })
  })
})
