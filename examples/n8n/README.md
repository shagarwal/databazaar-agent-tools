# Export DeepSearchQA to CSV with n8n

Import [deepsearchqa-csv.json](./deepsearchqa-csv.json) into n8n to retrieve the
DeepSearchQA benchmark through your DataBazaar account and produce a downloadable
CSV. It uses built-in nodes; no community node, LLM, or model-provider key is needed.

This is an independent DataBazaar example, not an official n8n integration.
The workflow is free to use. DataBazaar requires an account for full retrieval,
including free datasets. Your n8n hosting has its own costs.

## Setup

1. Inspect the [listing and public sample](https://databazaar.io/d/4k) and the
   [original Google dataset card](https://huggingface.co/datasets/google/deepsearchqa).
   The declared dataset license is Apache-2.0.
2. Download the workflow JSON, create a new n8n workflow, and use **Import from File**.
3. [Create a DataBazaar account](https://databazaar.io/signup?returnTo=%2Foperator%2Fkeys&utm_source=github&utm_medium=example&utm_campaign=n8n-retrieval)
   and create an API key at **Account → API Keys** (`/operator/keys`).
4. Open **Retrieve benchmark rows**. Under **Generic Credential Type → Header Auth**,
   create or select an n8n credential with **Name** `Authorization` and **Value**
   `Bearer YOUR_DATABAZAAR_API_KEY`. Store the secret in the credential, not a node
   parameter, exported workflow, or screenshot.
5. Choose **Execute workflow**. Open **Create CSV file**, select its binary output
   `data`, and download `deepsearchqa.csv`.

You can also consume the row items from **Validate NDJSON rows** in another workflow.
The workflow does not upload data anywhere or start on a schedule.

## Behavior

The workflow reads public metadata, checks that this exact listing is active and
free, and requests at most 1,000 actual records from the authenticated query API.
It parses NDJSON, checks the four string fields and the declared row count, then
creates a CSV with `problem`, `problem_category`, `answer`, and `answer_type`.
Redirects are disabled on both HTTP nodes; the account key is sent only to the
fixed DataBazaar API URL. No purchase endpoint is called.

The example is specific to this queryable dataset. Changing only its UUID will not
make it work for arbitrary file-only or federated listings. If the listing changes,
the guard or schema check may stop the run; inspect the source before editing them.
Matching the declared row count does not independently certify source completeness.

HTTP 401 means the credential is missing, invalid or revoked. HTTP 403 means the
account lacks access. A timeout, non-free listing, unexpected schema, empty result
or row-count mismatch stops the export rather than producing a silently partial file.

## Use in an evaluation

Pass only `problem` to the agent being evaluated. Keep reference answers separate
and follow Google's evaluation protocol. This workflow prepares inputs; it does
not run a model or establish an evaluation score. Do not train on the benchmark.
Record the export date and retain the CSV used for each evaluation.

## Verification

See [verification.json](./verification.json) for the tested n8n version, actual row
count and output checksum. Live verification uses a dedicated excluded test account;
it does not count toward marketplace participation.

Run `node examples/n8n/verify-workflow.mjs` from the repository root to check the
workflow's refusal of non-free listings, malformed data and incomplete results.
These local checks do not replace a live n8n run.
