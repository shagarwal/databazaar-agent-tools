// Unit tests for DataBazaarClient. fetch is injected via the client options —
// no globals stubbed, no live API calls.
import { describe, it, expect, vi } from 'vitest'
import { DataBazaarClient, DataBazaarError, DEFAULT_API_URL } from './client.js'

// Builds a mock fetch that records calls and returns the given JSON payload.
function mockFetch(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => payload,
  })) as unknown as typeof globalThis.fetch
}

// Convenience: URL + RequestInit of the nth recorded call.
function callAt(fetchFn: unknown, n = 0): { url: string; init: RequestInit } {
  const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[n]
  return { url: call[0] as string, init: call[1] as RequestInit }
}

describe('DataBazaarClient', () => {
  it('retrieves authenticated NDJSON records with a bounded query', async () => {
    const f = vi.fn(async () => new Response('{"problem":"test"}\n{"problem":"second"}\n'))
    const client = new DataBazaarClient({ apiKey: 'dbz_live_test', fetch: f })
    expect(await client.queryDataset('dataset', { select: ['problem'], limit: 2 })).toEqual([{ problem: 'test' }, { problem: 'second' }])
    const { url, init } = callAt(f)
    expect(url).toBe(`${DEFAULT_API_URL}/datasets/dataset/query`)
    expect(JSON.parse(init.body as string)).toEqual({ select: ['problem'], limit: 2 })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer dbz_live_test')
    for (const limit of [0, 1001, 1.5, NaN]) await expect(client.queryDataset('dataset', { limit })).rejects.toThrow('Query limit')
    expect(f).toHaveBeenCalledOnce()
  })

  it('propagates access failures and rejects invalid query records', async () => {
    const unauthorized = new DataBazaarClient({ fetch: vi.fn(async () => new Response('{"error":"Account required"}', { status: 401 })) })
    await expect(unauthorized.queryDataset('dataset')).rejects.toMatchObject({ status: 401 })
    for (const body of ['42\n', '[]\n', '{}\n{}\n', '{truncated']) {
      const client = new DataBazaarClient({ fetch: vi.fn(async () => new Response(body)) })
      await expect(client.queryDataset('dataset', { limit: 1 })).rejects.toThrow()
    }
  })

  it('cancels query responses over the byte limit', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)) },
      cancel,
    })
    const client = new DataBazaarClient({ fetch: vi.fn(async () => new Response(body)) })
    await expect(client.queryDataset('dataset')).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' })
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('defaults to the production API URL and strips trailing slashes', async () => {
    const f = mockFetch({ data: [] })
    await new DataBazaarClient({ fetch: f }).getDataset('abc')
    expect(callAt(f).url).toBe(`${DEFAULT_API_URL}/datasets/abc`)

    const f2 = mockFetch({ data: [] })
    await new DataBazaarClient({ apiUrl: 'http://localhost:3001/', fetch: f2 }).getDataset('abc')
    expect(callAt(f2).url).toBe('http://localhost:3001/datasets/abc')
  })

  it('sends the API key as a Bearer token, and no header without a key', async () => {
    const f = mockFetch({})
    await new DataBazaarClient({ apiKey: 'dbz_live_123', fetch: f }).listPurchases()
    const { init } = callAt(f)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer dbz_live_123')

    const f2 = mockFetch({})
    await new DataBazaarClient({ fetch: f2 }).getDataset('abc')
    expect((callAt(f2).init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('builds the search query string, skipping undefined params', async () => {
    const f = mockFetch({ data: [], total: 0, limit: 5, offset: 0 })
    await new DataBazaarClient({ fetch: f }).searchDatasets({
      query: 'sf rents',
      category: 'pricing',
      max_price: 50,
      pricing_type: 'free',
      tags: ['rent', 'sf'],
      limit: 5,
    })
    const url = new URL(callAt(f).url)
    expect(url.pathname).toBe('/datasets')
    expect(url.searchParams.get('query')).toBe('sf rents')
    expect(url.searchParams.get('category')).toBe('pricing')
    expect(url.searchParams.get('max_price')).toBe('50')
    expect(url.searchParams.get('pricing_type')).toBe('free')
    expect(url.searchParams.get('tags')).toBe('rent,sf')
    expect(url.searchParams.get('limit')).toBe('5')
    expect(url.searchParams.has('min_quality_score')).toBe(false)
    expect(url.searchParams.has('offset')).toBe(false)
  })

  it('throws DataBazaarError with API message, status, and code on non-OK responses', async () => {
    const f = mockFetch({ error: 'Dataset not found', code: 'NOT_FOUND' }, { ok: false, status: 404 })
    const err = await new DataBazaarClient({ fetch: f })
      .getDataset('missing')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DataBazaarError)
    expect((err as DataBazaarError).message).toBe('Dataset not found')
    expect((err as DataBazaarError).status).toBe(404)
    expect((err as DataBazaarError).code).toBe('NOT_FOUND')
  })

  it('falls back to HTTP status when the error body is not JSON', async () => {
    const f = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json') },
    })) as unknown as typeof globalThis.fetch
    await expect(new DataBazaarClient({ fetch: f }).getDataset('x')).rejects.toThrow('HTTP 500')
  })

  it('previewSample passes the optional question as a query param', async () => {
    const f = mockFetch({ sample_url: 'https://signed', schema: {} })
    await new DataBazaarClient({ fetch: f }).previewSample('ds-1', { question: 'average rent?' })
    const url = new URL(callAt(f).url)
    expect(url.pathname).toBe('/datasets/ds-1/sample')
    expect(url.searchParams.get('question')).toBe('average rent?')

    const f2 = mockFetch({ sample_url: 'https://signed', schema: {} })
    await new DataBazaarClient({ fetch: f2 }).previewSample('ds-1')
    expect(callAt(f2).url.endsWith('/datasets/ds-1/sample')).toBe(true)
  })

  it('buyNow POSTs to /datasets/:id/buy with an optional payment method', async () => {
    const f = mockFetch({ purchase_id: 'p-1' })
    await new DataBazaarClient({ apiKey: 'dbz_live_k', fetch: f }).buyNow('ds-1', {
      paymentMethodId: 'pm_123',
    })
    const { url, init } = callAt(f)
    expect(url.endsWith('/datasets/ds-1/buy')).toBe(true)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ payment_method_id: 'pm_123' })

    // Free dataset: empty body, no payment method
    const f2 = mockFetch({ purchase_id: 'p-2' })
    await new DataBazaarClient({ apiKey: 'dbz_live_k', fetch: f2 }).buyNow('ds-free')
    expect(JSON.parse(callAt(f2).init.body as string)).toEqual({})
  })

  it('getDownloadUrl routes by datasetId vs purchaseId and rejects when neither given', async () => {
    const f = mockFetch({ download_url: 'https://signed' })
    const client = new DataBazaarClient({ apiKey: 'dbz_live_k', fetch: f })

    await client.getDownloadUrl({ datasetId: 'ds-1' })
    expect(callAt(f, 0).url.endsWith('/datasets/ds-1/download-url')).toBe(true)

    await client.getDownloadUrl({ purchaseId: 'p-1' })
    expect(callAt(f, 1).url.endsWith('/purchases/p-1/download-url')).toBe(true)

    await expect(client.getDownloadUrl({})).rejects.toThrow(/datasetId.*purchaseId/)
    await expect(client.getDownloadUrl({ datasetId: 'ds-1', purchaseId: 'p-1' })).rejects.toThrow(/exactly one/)
    expect((f as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
  })

  it('browses bounties without a credential and preserves filters and pagination', async () => {
    const f = mockFetch({ data: [], total: 0, limit: 5, offset: 10 })
    await new DataBazaarClient({ fetch: f }).listBounties({ category: 'text', min_amount: 0, limit: 5, offset: 10 })
    const { url, init } = callAt(f)
    expect(new URL(url).pathname).toBe('/bounties')
    expect(new URL(url).searchParams.get('min_amount')).toBe('0')
    expect(new URL(url).searchParams.get('offset')).toBe('10')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(init.redirect).toBe('error')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('listPurchases defaults limit to 20 and forwards status', async () => {
    const f = mockFetch({ data: [], total: 0, limit: 20, offset: 0 })
    await new DataBazaarClient({ apiKey: 'dbz_live_k', fetch: f }).listPurchases({ status: 'released' })
    const url = new URL(callAt(f).url)
    expect(url.pathname).toBe('/purchases')
    expect(url.searchParams.get('status')).toBe('released')
    expect(url.searchParams.get('limit')).toBe('20')
  })

  it('checkCoverage prefers sourceUrl and rejects when neither source given', async () => {
    const f = mockFetch({ covered: true })
    const client = new DataBazaarClient({ fetch: f })
    await client.checkCoverage({ sourceUrl: 'https://noaa.gov', sourceName: 'noaa' })
    expect(new URL(callAt(f).url).searchParams.get('source')).toBe('https://noaa.gov')

    await expect(client.checkCoverage({})).rejects.toThrow(/sourceUrl.*sourceName/)
  })

  it('logDataGap POSTs snake_case body and omits price when not given', async () => {
    const f = mockFetch({ message_for_user: 'bounty created' })
    await new DataBazaarClient({ apiKey: 'dbz_live_k', fetch: f }).logDataGap({
      query: 'ev charger locations',
      description: 'US EV charger locations as CSV',
      suggestedPriceUsd: 30,
    })
    expect(JSON.parse(callAt(f).init.body as string)).toEqual({
      query: 'ev charger locations',
      description: 'US EV charger locations as CSV',
      suggested_price_usd: 30,
    })

    const f2 = mockFetch({})
    await new DataBazaarClient({ apiKey: 'dbz_live_k', fetch: f2 }).logDataGap({
      query: 'q',
      description: 'd',
    })
    expect(JSON.parse(callAt(f2).init.body as string)).toEqual({ query: 'q', description: 'd' })
  })
})
