# databazaar-agent-tools

Find datasets and data bounties from JavaScript agents. Includes a typed REST
client and adapters for **AI SDK 7** and **LangChain core 1**. Requires Node.js 22+.

Search, metadata, bounded samples, and bounty browsing work without an account.
Full data requires an account API key, even for free datasets. Paid datasets also
require a purchase. Adapters expose discovery and access tools by default;
purchasing and bounty posting each require an explicit opt-in.

## Try public discovery

```bash
npx -y databazaar-agent-tools
```

This checks the live DeepSearchQA listing, sample availability, and open bounties,
then prints links to retrieve data, fulfill requests, or sell your own data.
It needs no model key, makes no purchases, and is excluded from adoption metrics.
A successful check is public discovery, not an authenticated retrieval.

## Install

```bash
npm install databazaar-agent-tools
# Install only the adapter's optional peer that you use:
npm install ai@7
# or:
npm install @langchain/core@1
```

The package includes its TypeScript declarations. No repository clone, workspace
package, or framework is needed for the core client.

## AI SDK

```js
import { generateText, gateway, isStepCount } from 'ai'
import { databazaarTools } from 'databazaar-agent-tools/ai-sdk'

// Set AI_GATEWAY_API_KEY for the model provider. Public data search needs no
// DataBazaar credential. Model calls use your provider's normal billing.
const { text } = await generateText({
  model: gateway('openai/gpt-5-mini'),
  tools: databazaarTools(),
  stopWhen: isStepCount(3),
  prompt: 'Find DeepSearchQA on DataBazaar, inspect its sample schema, and link to the dataset. Do not claim to have retrieved the full dataset.',
})
console.log(text)
```

To invoke a tool without a model provider:

```js
const tools = databazaarTools()
const result = await tools.databazaar_search_datasets.execute(
  { query: 'DeepSearchQA', limit: 5 },
  { toolCallId: 'search-1', messages: [] },
)
console.log(result)
```

## LangChain.js

```js
import { databazaarLangChainTools } from 'databazaar-agent-tools/langchain'

const tools = databazaarLangChainTools()
// Supply tools to your agent, or invoke directly without a model key:
const search = tools.find(t => t.name === 'databazaar_search_datasets')
console.log(await search.invoke({ query: 'DeepSearchQA', limit: 5 }))
```

## Plain client and authenticated access

```js
import { DataBazaarClient } from 'databazaar-agent-tools'

const db = new DataBazaarClient({ apiKey: process.env.DATABAZAAR_API_KEY })
const { data } = await db.searchDatasets({ query: 'DeepSearchQA', pricing_type: 'free', limit: 5 })
if (!data.length) throw new Error('No matching dataset')
console.log(await db.previewSample(data[0].id))

// Requires an account key; returns actual records without making a purchase.
// DeepSearchQA is queryable. Other listings may only offer file downloads.
const rows = await db.queryDataset(data[0].id, {
  select: ['problem', 'problem_category', 'answer', 'answer_type'],
  limit: 10,
})
console.log(rows) // A bounded subset, not the full benchmark.
```

[Create an account and API key](https://databazaar.io/signup?returnTo=%2Foperator%2Fkeys&utm_source=github&utm_campaign=agent-tools-source).
For bounded, authenticated exports, follow the
[DeepSearchQA CSV walkthrough](https://databazaar.io/guides/deepsearchqa-csv?utm_source=github&utm_campaign=agent-tools-source).
Where present, `retrieval_url` is an account-authenticated API delivery URL;
Signed storage URLs carry temporary access; API file and manifest URLs need account authentication.
`getDownloadUrl` may return `manifest_url` instead of `download_url` for federated data.
Use a dataset ID for free data and a purchase ID for paid data. Keep access URLs private.

## Find work for seller agents

```js
const requests = await db.listBounties({ status: 'open', min_amount: 5, limit: 10 })
for (const request of requests.data) {
  console.log(request.title, `https://databazaar.io/bounties/${request.id}`)
}
```

Read each request's requirements and review terms before preparing a submission.
An advertised reward is not a guaranteed payout. To publish a dataset, use the
[seller flow](https://databazaar.io/sell?utm_source=github&utm_campaign=agent-tools-source)
or the full REST/MCP API; this package does not implement uploads.

## Tool set

| Tool | Default | Purpose |
| --- | --- | --- |
| `databazaar_search_datasets` | Yes | Find datasets with price/category/quality filters |
| `databazaar_get_dataset` | Yes | Read listing metadata |
| `databazaar_preview_sample` | Yes | Request a public bounded sample and schema |
| `databazaar_get_download_url` | Yes | Request account-authenticated access to free or purchased data |
| `databazaar_list_purchases` | Yes | Read the account's purchases |
| `databazaar_check_coverage` | Yes | Search for an existing source |
| `databazaar_query_dataset` | Yes | Retrieve up to 1,000 rows from a queryable dataset; account required |
| `databazaar_list_bounties` | Yes | Browse data requests |
| `databazaar_buy_now` | Opt-in | Purchase a dataset; can charge the configured payment method |
| `databazaar_log_data_gap` | Opt-in | Record demand and, for an authenticated agent, post an open bounty |

```js
const tools = databazaarTools({
  apiKey: process.env.DATABAZAAR_API_KEY,
  allowPurchases: true,       // Exposes buy_now; only enable for authorized purchases.
  allowBountyPosting: true,  // Exposes log_data_gap; can post a public bounty.
})
```

The same switches work for `databazaarLangChainTools`. They control which tools
are exposed to a model; the core client's explicit methods remain available.
Configure spending limits on the API key. Bounty posting through `logDataGap`
defaults to a $25 request when no price is supplied; do not use it as a harmless
search fallback.

## Options and errors

`DataBazaarClient`, `databazaarTools`, and `databazaarLangChainTools` accept
`{ apiKey?, apiUrl?, fetch? }`. Adapters also accept `{ client }` to reuse a
configured client. `apiUrl` defaults to `https://api.databazaar.io`; only override
it with a service you trust to receive your key. Requests time out after 30 seconds
and reject redirects. `DataBazaarError` includes HTTP `status` and API `code`.

Core exports include `toolSpecs`, `selectedToolSpecs`, and response types. Use
`selectedToolSpecs()` for the default non-mutating set when building another
adapter; raw `toolSpecs` also includes purchase and bounty-posting definitions.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Tests exercise schema validation and tool execution, including an AI SDK mock
model call. The release check installs the packed artifact into an isolated
project, compiles consumer types, and invokes both adapters against public data.
These checks do not establish that every autonomous model will choose good data.

Documentation: [DataBazaar integrations](https://databazaar.io/integrations).
For MCP clients, use [databazaar-mcp](https://www.npmjs.com/package/databazaar-mcp).

## Public source

This repository contains the client source for `databazaar-agent-tools@0.1.1`, with implementation recovered from its published source maps, entry-point exports and tests from the corresponding release commit, and the same public response types bundled in that release. The standalone build needs no private workspace packages. The marketplace API is developed separately.

The npm package links to [this public repository](https://github.com/shagarwal/databazaar-agent-tools) for client source and [issues](https://github.com/shagarwal/databazaar-agent-tools/issues). Installing the package from npm remains the supported consumer path.

CI compares every generated JavaScript file, source map, and declaration against
the published 0.1.1 tarball. To run the same check locally after building:

```bash
npm pack databazaar-agent-tools@0.1.1 --ignore-scripts
python3 scripts/verify-published.py databazaar-agent-tools-0.1.1.tgz
```
