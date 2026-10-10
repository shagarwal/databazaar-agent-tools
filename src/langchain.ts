// LangChain.js adapter — exposes the DataBazaar tool set as DynamicStructuredTool[].
//
//   import { databazaarLangChainTools } from 'databazaar-agent-tools/langchain'
//   const tools = databazaarLangChainTools({ apiKey: process.env.DATABAZAAR_API_KEY! })
//
// Requires the optional peer dependency `@langchain/core`. The core client
// entry ('databazaar-agent-tools') works without it.

import { DynamicStructuredTool } from '@langchain/core/tools'
import { DataBazaarClient, type DataBazaarClientOptions } from './client.js'
import { selectedToolSpecs, type AnyExecute } from './tools.js'

export type DatabazaarLangChainToolsOptions =
  (DataBazaarClientOptions
  // Or bring your own pre-configured client.
  | { client: DataBazaarClient }) & { allowPurchases?: boolean; allowBountyPosting?: boolean }

/**
 * Build the DataBazaar tool set for LangChain.js.
 * Returns an array of DynamicStructuredTool, ready to pass to createReactAgent
 * or bindTools. Tool results are JSON-stringified (the LangChain convention).
 */
export function databazaarLangChainTools(
  options: DatabazaarLangChainToolsOptions = {}
): DynamicStructuredTool[] {
  const client = 'client' in options ? options.client : new DataBazaarClient(options)

  return selectedToolSpecs(options).map(
    (spec) =>
      new DynamicStructuredTool({
        name: spec.name,
        description: spec.description,
        schema: spec.schema,
        // Args were validated against spec.schema by LangChain before this runs;
        // the cast widens the union member's execute for the generic loop.
        func: async (args: Record<string, unknown>) =>
          JSON.stringify(await (spec.execute as AnyExecute)(client, args)),
      })
  )
}
