// Framework-neutral tool specifications shared by every adapter.
//
// Each spec is { name, description, zod schema, execute } where execute just
// delegates to the typed DataBazaarClient — no business logic here. The
// ai-sdk and langchain adapters map over this array, so this file must never
// import from `ai` or `@langchain/core` (they are optional peers).

import { z } from 'zod'
import type { DataBazaarClient } from './client.js'

// Helper that preserves per-tool inference: `execute` receives args typed
// from that tool's own zod schema.
function defineTool<S extends z.ZodObject<z.ZodRawShape>>(spec: {
  name: string
  description: string
  schema: S
  execute: (client: DataBazaarClient, args: z.infer<S>) => Promise<unknown>
}) {
  return spec
}

export const toolSpecs = [
  defineTool({
    name: 'databazaar_search_datasets',
    description:
      'Search the DataBazaar marketplace for datasets matching a natural-language query, ' +
      'with optional filters for category, price, quality score, and pricing type. ' +
      'Returns ranked listings with prices, quality scores, and checkout URLs.',
    schema: z.object({
      query: z.string().describe('Natural language search query describing the data needed'),
      category: z.string().optional().describe(
        'Filter by category: geographic, pricing, sensor, images, text, financial, scientific, social, retail, other'
      ),
      max_price: z.number().optional().describe('Maximum price in USD — omit to include all prices'),
      min_quality_score: z.number().min(0).max(100).optional().describe('Minimum assessed sample structure score (0-100); unassessed listings are excluded. See https://databazaar.io/quality for the rubric and limitations.'),
      pricing_type: z.enum(['buy_it_now', 'auction', 'hybrid', 'free']).optional(),
      limit: z.number().int().min(1).max(50).optional().describe('Max results to return (default 10)'),
    }),
    execute: (client, args) => client.searchDatasets({ ...args, limit: args.limit ?? 10 }),
  }),

  defineTool({
    name: 'databazaar_get_dataset',
    description:
      'Get full metadata for a specific DataBazaar dataset — schema, column counts, quality score, ' +
      'price, and a checkout_url for one-click human purchase.',
    schema: z.object({
      dataset_id: z.string().uuid().describe('The dataset ID to retrieve'),
    }),
    execute: (client, args) => client.getDataset(args.dataset_id),
  }),

  defineTool({
    name: 'databazaar_preview_sample',
    description:
      'Preview sample rows of a dataset to verify columns, format, and quality before buying. ' +
      'Returns a signed download URL for ~50 rows plus the schema. Pass an optional question ' +
      '(e.g. "average price in 2024") to get a synthesized answer from the sample — no purchase required.',
    schema: z.object({
      dataset_id: z.string().uuid().describe('The dataset ID to preview'),
      question: z.string().optional().describe(
        'Optional natural-language question to answer from the sample rows (e.g. "average rent in SF")'
      ),
    }),
    execute: (client, args) => client.previewSample(args.dataset_id, { question: args.question }),
  }),

  defineTool({
    name: 'databazaar_buy_now',
    description:
      'Authorize a one-time purchase of a DataBazaar dataset. Free ($0) datasets need no payment ' +
      'method but still require a verified account. Paid datasets are charged via Stripe against the ' +
      'operator\'s saved card or a payment_method_id. Preview the sample first to verify fit.',
    schema: z.object({
      dataset_id: z.string().uuid().describe('The dataset ID to purchase'),
      payment_method_id: z.string().optional().describe(
        'Stripe payment method ID (pm_...). Not needed for free datasets or when a default card is saved.'
      ),
    }),
    execute: (client, args) => client.buyNow(args.dataset_id, { paymentMethodId: args.payment_method_id }),
  }),

  defineTool({
    name: 'databazaar_get_download_url',
    description:
      'Get a signed, time-limited (1 hour) download URL for a dataset the agent already has access to. ' +
      'Requires an account API key, including for free data. Does not buy data. ' +
      'Pass dataset_id for free datasets, or purchase_id for paid datasets. ' +
      'When available, retrieval_url provides account-authenticated API delivery.',
    schema: z.object({
      dataset_id: z.string().uuid().optional().describe('Dataset ID — use for free ($0) datasets'),
      purchase_id: z.string().uuid().optional().describe('Purchase ID from buy_now — use for paid datasets'),
    }),
    execute: (client, args) =>
      client.getDownloadUrl({ datasetId: args.dataset_id, purchaseId: args.purchase_id }),
  }),

  defineTool({
    name: 'databazaar_list_purchases',
    description:
      'List datasets purchased by this agent with status, prices, and download availability. ' +
      'Useful for spending audits or deduplicating before buy_now.',
    schema: z.object({
      status: z.enum(['escrowed', 'released', 'disputed', 'refunded']).optional().describe(
        'Filter by purchase status — omit to see all'
      ),
      limit: z.number().int().min(1).max(50).optional().describe('Max results to return (default 20)'),
    }),
    execute: (client, args) => client.listPurchases(args),
  }),

  defineTool({
    name: 'databazaar_check_coverage',
    description:
      'Check whether a known public data source (e.g. "noaa", "data.gov", "census.gov") is already ' +
      'on DataBazaar. Returns covered=true with matching datasets when available.',
    schema: z.object({
      source_url: z.string().optional().describe('Full URL of the data source (e.g. "https://noaa.gov")'),
      source_name: z.string().optional().describe('Short name of the data source (e.g. "noaa", "census")'),
    }),
    execute: (client, args) =>
      client.checkCoverage({ sourceUrl: args.source_url, sourceName: args.source_name }),
  }),

  defineTool({
    name: 'databazaar_log_data_gap',
    description:
      'Record an unmet data need on DataBazaar. For an authenticated agent, this also posts ' +
      'an open bounty visible to sellers, defaulting to $25 if no price is provided. ' +
      'Only use with the owner\'s authorization to post that bounty. Returns the bounty URL.',
    schema: z.object({
      query: z.string().describe('The search query or data need that returned no results'),
      description: z.string().describe('Detailed description of the data needed — format, time range, geography, etc.'),
      suggested_price_usd: z.number().min(0).max(50000).optional().describe('Suggested bounty price in USD (default $25)'),
    }),
    execute: (client, args) =>
      client.logDataGap({
        query: args.query,
        description: args.description,
        suggestedPriceUsd: args.suggested_price_usd,
      }),
  }),

  defineTool({
    name: 'databazaar_list_bounties',
    description:
      'Browse public data bounties to find datasets buyers want and work sellers can fulfill. ' +
      'Defaults to open requests. Read the linked bounty requirements before submitting; a listed reward is not a guaranteed payout.',
    schema: z.object({
      category: z.string().optional(),
      min_amount: z.number().min(0).optional(),
      max_amount: z.number().min(0).optional(),
      status: z.enum(['open', 'closed', 'expired']).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    execute: (client, args) => client.listBounties(args),
  }),
  defineTool({
    name: 'databazaar_query_dataset',
    description:
      'Retrieve up to 1000 rows from a queryable dataset as structured records. ' +
      'Requires an account API key, even for free data; paid data must already be purchased. ' +
      'Inspect the dataset schema first, then select needed columns. This tool never buys data. ' +
      'Returns a bounded subset, not necessarily the full dataset.',
    schema: z.object({
      dataset_id: z.string().uuid(),
      select: z.array(z.string()).min(1).max(256).optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }),
    execute: (client, args) => client.queryDataset(args.dataset_id, { select: args.select, limit: args.limit }),
  }),
]

export type AgentToolSpec = (typeof toolSpecs)[number]

/** Discovery and access tools by default; mutations require an explicit opt-in. */
export function selectedToolSpecs(options: { allowPurchases?: boolean; allowBountyPosting?: boolean } = {}) {
  return toolSpecs.filter((spec) =>
    spec.name === 'databazaar_buy_now' ? options.allowPurchases === true :
    spec.name === 'databazaar_log_data_gap' ? options.allowBountyPosting === true : true
  )
}

// Adapters iterate the union type above, so they call execute through this
// widened signature. Validation already happened against the tool's own schema.
export type AnyExecute = (client: DataBazaarClient, args: unknown) => Promise<unknown>
