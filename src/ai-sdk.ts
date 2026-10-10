// Vercel AI SDK adapter — exposes the DataBazaar tool set as `tool()` definitions.
//
//   import { databazaarTools } from 'databazaar-agent-tools/ai-sdk'
//   const tools = databazaarTools({ apiKey: process.env.DATABAZAAR_API_KEY! })
//   await generateText({ model, tools, prompt: '...' })
//
// Requires the optional peer dependency `ai` (v7). The core client entry
// ('databazaar-agent-tools') works without it.

import { tool, type Tool } from 'ai'
import type { z } from 'zod'
import { DataBazaarClient, type DataBazaarClientOptions } from './client.js'
import { selectedToolSpecs, type AnyExecute } from './tools.js'

export type DatabazaarToolsOptions =
  (DataBazaarClientOptions
  // Or bring your own pre-configured client.
  | { client: DataBazaarClient }) & { allowPurchases?: boolean; allowBountyPosting?: boolean }

/**
 * Build the DataBazaar tool set for the Vercel AI SDK.
 * Returns a record keyed by tool name, ready to pass as `tools` to
 * generateText / streamText.
 */
export function databazaarTools(options: DatabazaarToolsOptions = {}): Record<string, Tool> {
  const client = 'client' in options ? options.client : new DataBazaarClient(options)

  return Object.fromEntries(
    selectedToolSpecs(options).map((spec) => [
      spec.name,
      tool({
        description: spec.description,
        // The loop iterates a union of per-tool ZodObject types, which would
        // collapse tool()'s generic to `never` — widen to a generic object
        // schema here. Per-tool arg validation still happens at runtime.
        inputSchema: spec.schema as unknown as z.ZodType<Record<string, unknown>>,
        // Args were validated against spec.schema by the AI SDK before this runs;
        // the cast widens the union member's execute for the generic loop.
        execute: (args: Record<string, unknown>) => (spec.execute as AnyExecute)(client, args),
      }),
    ])
  )
}
