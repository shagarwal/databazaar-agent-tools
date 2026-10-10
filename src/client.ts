// Typed HTTP client for the DataBazaar REST API (https://api.databazaar.io).
//
// THIN wrapper — zero business logic, mirroring packages/mcp. Every method
// maps 1:1 onto a REST endpoint; the API owns all validation, pricing, and
// payment rules. Auth is a `dbz_live_*` API key sent as a Bearer token.

import type {
  PublicDataset,
  Purchase,
  SearchDatasetsQuery,
  SearchDatasetsResponse,
} from '@databazaar/types'

// ── Options ───────────────────────────────────────────────────────────────────

export interface DataBazaarClientOptions {
  /** DataBazaar agent API key (`dbz_live_*`). Omit for read-only public endpoints. */
  apiKey?: string
  /** API base URL. Defaults to the production API. */
  apiUrl?: string
  /** Injectable fetch implementation — used by tests; defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch
}

// ── Request/response shapes ───────────────────────────────────────────────────
// Search types are reused from @databazaar/types. The remaining response shapes
// are not exported by the types package, so minimal interfaces are declared here
// with an open index signature (the API may include extra advisory fields such
// as checkout_url or human_pitch).

/** Same as SearchDatasetsQuery, plus the `free` pricing type added in migration 20260404000004. */
export type SearchDatasetsParams = Omit<SearchDatasetsQuery, 'pricing_type'> & {
  pricing_type?: 'buy_it_now' | 'auction' | 'hybrid' | 'free'
}

export type DatasetDetail = PublicDataset & { [key: string]: unknown }

export interface PreviewSampleResponse {
  /** Signed, ~1h URL to download ~50 sample rows. */
  sample_url: string
  schema: unknown
  /** Present when a `question` was asked and matched a simple aggregate pattern. */
  synthesized_answer?: string
  [key: string]: unknown
}

export interface BuyNowResponse {
  purchase_id?: string
  status?: string
  [key: string]: unknown
}

export interface DownloadUrlResponse {
  /** Signed, time-limited (1 hour) download URL. */
  download_url?: string
  /** Federated datasets may return a manifest instead of a single file URL. */
  manifest_url?: string
  /** Account-authenticated API delivery URL, when available. */
  retrieval_url?: string
  expires_at?: string
  [key: string]: unknown
}

export interface ListBountiesParams {
  category?: string
  min_amount?: number
  max_amount?: number
  status?: 'open' | 'closed' | 'expired'
  limit?: number
  offset?: number
}

export interface ListBountiesResponse {
  data: Array<{ id: string; title: string; description: string; bounty_amount: number; status: string; [key: string]: unknown }>
  total: number
  limit: number
  offset: number
}

export interface ListPurchasesResponse {
  data: Array<Purchase & { [key: string]: unknown }>
  total: number
  limit: number
  offset: number
}

export interface CheckCoverageResponse {
  covered: boolean
  datasets?: Array<PublicDataset & { [key: string]: unknown }>
  [key: string]: unknown
}

export interface LogDataGapResponse {
  /** Forwardable summary for the operator, including the bounty URL when one was created. */
  message_for_user?: string
  [key: string]: unknown
}

// ── Errors ────────────────────────────────────────────────────────────────────

/** Thrown for any non-2xx API response. Carries the HTTP status and API error code. */
export class DataBazaarError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'DataBazaarError'
    this.status = status
    this.code = code
  }
}

// ── Client ────────────────────────────────────────────────────────────────────

export const DEFAULT_API_URL = 'https://api.databazaar.io'

export class DataBazaarClient {
  private readonly apiKey?: string
  private readonly apiUrl: string
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(options: DataBazaarClientOptions = {}) {
    this.apiKey = options.apiKey
    // Strip a trailing slash so path concatenation is predictable.
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '')
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  // Single choke point for all HTTP — adds auth header, throws DataBazaarError on non-OK.
  private async request<T>(method: string, path: string, body?: unknown, readResponse: (res: Response) => Promise<T> = res => res.json() as Promise<T>): Promise<T> {
    const res = await this.fetchImpl(`${this.apiUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // Only send Authorization when a key is configured — public reads work without one.
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
      throw new DataBazaarError(err.error ?? `HTTP ${res.status}`, res.status, err.code)
    }
    return readResponse(res)
  }

  // Builds a query string, skipping undefined values and joining arrays with commas.
  private qs(params: Record<string, string | number | string[] | undefined>): string {
    const sp = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue
      sp.set(key, Array.isArray(value) ? value.join(',') : String(value))
    }
    const s = sp.toString()
    return s ? `?${s}` : ''
  }

  /** GET /datasets — full-text + faceted search across the marketplace. */
  searchDatasets(params: SearchDatasetsParams = {}): Promise<SearchDatasetsResponse> {
    return this.request('GET', `/datasets${this.qs({
      query: params.query,
      category: params.category,
      format: params.format,
      max_price: params.max_price,
      min_quality_score: params.min_quality_score,
      geographic_area: params.geographic_area,
      tags: params.tags,
      pricing_type: params.pricing_type,
      limit: params.limit,
      offset: params.offset,
    })}`)
  }

  /** GET /datasets/:id — full metadata for one dataset. */
  getDataset(datasetId: string): Promise<DatasetDetail> {
    return this.request('GET', `/datasets/${datasetId}`)
  }

  /** GET /datasets/:id/sample — signed sample URL + schema; optional question gets a synthesized answer. */
  previewSample(datasetId: string, options: { question?: string } = {}): Promise<PreviewSampleResponse> {
    return this.request('GET', `/datasets/${datasetId}/sample${this.qs({ question: options.question })}`)
  }

  /** POST /datasets/:id/buy — one-time purchase. Free datasets need no payment method. */
  buyNow(datasetId: string, options: { paymentMethodId?: string } = {}): Promise<BuyNowResponse> {
    const body = options.paymentMethodId ? { payment_method_id: options.paymentMethodId } : {}
    return this.request('POST', `/datasets/${datasetId}/buy`, body)
  }

  /**
   * Signed, time-limited download URL. Pass `datasetId` for free ($0) datasets or
   * `purchaseId` (from buyNow) for paid ones — exactly one is required.
   */
  getDownloadUrl(ref: { datasetId?: string; purchaseId?: string }): Promise<DownloadUrlResponse> {
    if (ref.datasetId && ref.purchaseId) {
      return Promise.reject(new DataBazaarError('Provide exactly one of datasetId or purchaseId.', 400, 'BAD_REQUEST'))
    }
    if (ref.datasetId) {
      return this.request('GET', `/datasets/${ref.datasetId}/download-url`)
    }
    if (ref.purchaseId) {
      return this.request('GET', `/purchases/${ref.purchaseId}/download-url`)
    }
    return Promise.reject(
      new DataBazaarError('Provide either datasetId (free datasets) or purchaseId (paid datasets).', 400, 'BAD_REQUEST')
    )
  }

  /** Browse data requests to find work to fulfill. Public; defaults to open bounties. */
  listBounties(params: ListBountiesParams = {}): Promise<ListBountiesResponse> {
    return this.request('GET', `/bounties${this.qs({ ...params })}`)
  }

  /** Read up to 1,000 rows from a queryable dataset. Account required; never buys data. */
  queryDataset(datasetId: string, params: { select?: string[]; limit?: number } = {}): Promise<Record<string, unknown>[]> {
    const limit = params.limit ?? 100
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      return Promise.reject(new DataBazaarError('Query limit must be an integer from 1 to 1000.', 400, 'BAD_REQUEST'))
    }
    return this.request('POST', `/datasets/${encodeURIComponent(datasetId)}/query`, { ...params, limit }, async res => {
      const reader = res.body?.getReader()
      if (!reader) throw new DataBazaarError('Query response has no body.', 502, 'INVALID_RESPONSE')
      let bytes = 0, text = ''
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 8 * 1024 * 1024) {
            await reader.cancel()
            throw new DataBazaarError('Query response exceeds 8 MiB; request fewer rows or columns.', 413, 'RESPONSE_TOO_LARGE')
          }
          text += decoder.decode(value, { stream: true })
        }
        text += decoder.decode()
      } finally { reader.releaseLock() }
      const rows: unknown[] = text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line))
      if (rows.length > limit || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
        throw new DataBazaarError('Invalid dataset query response.', 502, 'INVALID_RESPONSE')
      return rows as Record<string, unknown>[]
    })
  }

  /** GET /purchases — purchase history for this API key. */
  listPurchases(
    params: { status?: 'escrowed' | 'released' | 'disputed' | 'refunded'; limit?: number } = {}
  ): Promise<ListPurchasesResponse> {
    return this.request('GET', `/purchases${this.qs({ status: params.status, limit: params.limit ?? 20 })}`)
  }

  /** GET /coverage — is a known public source (e.g. "noaa") already on DataBazaar? */
  checkCoverage(params: { sourceUrl?: string; sourceName?: string }): Promise<CheckCoverageResponse> {
    const source = params.sourceUrl ?? params.sourceName
    if (!source) {
      return Promise.reject(
        new DataBazaarError('Provide either sourceUrl or sourceName.', 400, 'BAD_REQUEST')
      )
    }
    return this.request('GET', `/coverage${this.qs({ source })}`)
  }

  /** POST /agent/data-gaps — record an unmet data need; may auto-create a bounty. */
  logDataGap(params: {
    query: string
    description: string
    suggestedPriceUsd?: number
  }): Promise<LogDataGapResponse> {
    return this.request('POST', '/agent/data-gaps', {
      query: params.query,
      description: params.description,
      ...(params.suggestedPriceUsd !== undefined ? { suggested_price_usd: params.suggestedPriceUsd } : {}),
    })
  }
}
