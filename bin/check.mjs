#!/usr/bin/env node
import { DataBazaarClient } from '../dist/index.js'

// Public diagnostic only. Keep synthetic checks out of adoption measurements.
const client = new DataBazaarClient({
  fetch: (url, init) => fetch(url, {
    ...init,
    headers: { ...init.headers, 'User-Agent': 'DataBazaar agent-tools synthetic-check' },
  }),
})
try {
  const results = await client.searchDatasets({ query: 'DeepSearchQA', limit: 5 })
  const dataset = results.data.find(d => d.id === '24cf80b3-5f47-4da6-a6a5-0540b3688343')
  if (!dataset) throw new Error('The example benchmark is unavailable; browse https://databazaar.io/browse')
  const sample = await client.previewSample(dataset.id)
  if (!sample.sample_url || !sample.schema) throw new Error('The example sample is unavailable')
  const bounties = await client.listBounties({ status: 'open', limit: 3 })
  console.log(JSON.stringify({
    success: true,
    scope: 'public_discovery',
    dataset: { id: dataset.id, title: dataset.title },
    sample_available: true,
    open_bounties: bounties.total,
    next: {
      retrieve: 'https://databazaar.io/guides/deepsearchqa-csv?utm_source=npm&utm_campaign=agent-tools',
      fulfill_a_bounty: 'https://databazaar.io/bounties?utm_source=npm&utm_campaign=agent-tools',
      sell: 'https://databazaar.io/sell?utm_source=npm&utm_campaign=agent-tools',
    },
    note: 'Public discovery passed. Full data requires an account. No purchase, bounty, or listing was created.',
  }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
