// databazaar-agent-tools — core entry point.
// Framework adapters live behind subpath exports so their peer deps stay optional:
//   'databazaar-agent-tools/ai-sdk'    → Vercel AI SDK tools (peer: ai)
//   'databazaar-agent-tools/langchain' → LangChain.js tools  (peer: @langchain/core)

export {
  DataBazaarClient,
  DataBazaarError,
  DEFAULT_API_URL,
} from './client.js'

export type {
  DataBazaarClientOptions,
  SearchDatasetsParams,
  DatasetDetail,
  PreviewSampleResponse,
  BuyNowResponse,
  DownloadUrlResponse,
  ListPurchasesResponse,
  CheckCoverageResponse,
  LogDataGapResponse,
  ListBountiesParams,
  ListBountiesResponse,
} from './client.js'

export { toolSpecs, selectedToolSpecs } from './tools.js'
export type { AgentToolSpec } from './tools.js'

// Re-export the shared marketplace types most callers will want alongside the client.
export type {
  PublicDataset,
  SearchDatasetsQuery,
  SearchDatasetsResponse,
  Purchase,
} from '@databazaar/types'
