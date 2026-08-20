# Copilot Usage Action

https://github.com/user-attachments/assets/23bfb179-6e12-4db5-9ec6-be0019a692f8

Get Copilot usage data as:
* Md Job Summary
* CSV
* XML
* JSON

Powered by the [REST API endpoints for GitHub Copilot metrics](https://docs.github.com/en/rest/copilot/copilot-metrics).

> [!IMPORTANT]
> `v6` migrates to GitHub's Copilot metrics **report** endpoints. The endpoints every earlier
> version relied on were sunset and now return `404`, so `v5` and below no longer return data.
> See [Migrating to v6](#migrating-to-v6).

> [!TIP]
> 🚀 Get this running FAST by using the [template](https://github.com/austenstone/copilot-usage-template)

## Usage
Create a workflow (eg: `.github/workflows/copilot-usage.yml`). See [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### PAT(Personal Access Token)

You will need a token that can read Copilot metrics.

| Scope | Classic PAT scope | Fine-grained permission |
| --- | --- | --- |
| `organization` | [`read:org`](https://github.com/settings/tokens/new?scopes=read:org) | *View Organization Copilot Metrics* |
| `enterprise` | [`manage_billing:copilot`](https://github.com/settings/tokens/new?scopes=manage_billing:copilot) or `read:enterprise` | *View Enterprise Copilot Metrics* |

The seat and billing sections of the job summary additionally need `manage_billing:copilot`.

> [!NOTE]
> The default `GITHUB_TOKEN` cannot read Copilot metrics. You must supply your own token.

Add this PAT as a secret so we can use it as input `github-token`, see [Creating encrypted secrets for a repository](https://docs.github.com/en/enterprise-cloud@latest/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository). 

#### Basic Example

The default behavior is to get the usage for the repository owner which is likely the organization.

> [!IMPORTANT]  
> You need to set the secret `TOKEN` in your repository settings.

```yml
name: Copilot Usage
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  run:
    name: Run Action
    runs-on: ubuntu-latest
    steps:
      - uses: austenstone/copilot-usage@v6
        with:
          github-token: ${{ secrets.TOKEN }}
          time-zone: 'EST'
```

#### Example get enterprise usage

```yml
      - uses: austenstone/copilot-usage@v6
        with:
          github-token: ${{ secrets.TOKEN }}
          enterprise: 'enterprise-slug'
```

#### Example get team usage

Team metrics are derived from the user-level report, so the token needs to be able to read
user metrics for the organization.

```yml
      - uses: austenstone/copilot-usage@v6
        with:
          github-token: ${{ secrets.TOKEN }}
          organization: 'org-slug'
          team: 'team-slug'
```

#### Example get CSV

```yml
      - uses: austenstone/copilot-usage@v6
        with:
          github-token: ${{ secrets.TOKEN }}
          csv: true
```

#### Example multiple teams
```yml
    strategy:
      matrix:
        team:
          - 'team-slug1'
          - 'team-slug2'
    steps:
      - uses: actions/checkout@v4
      - uses: austenstone/copilot-usage@v6
        with:
          github-token: ${{ secrets.TOKEN }}
          organization: 'org-slug'
          team: ${{ matrix.team }}
```

#### Example specific timezone

You probably want to specify the timezone to get the usage in your local time. The default is UTC.
EX: `EST`, `PST`, `CST`, [etc](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

```yml
      - uses: austenstone/copilot-usage@v6
        with:
          github-token: ${{ secrets.TOKEN }}
          organization: 'org-slug'
          time-zone: 'EST'
```

#### Example sending email PDF report

> [!IMPORTANT]  
> You must set secrets for `EMAIL` and `PASSWORD` to send the email. You must use an [App Password](https://support.google.com/accounts/answer/185833?visit_id=638496193361004722-1436339969&p=InvalidSecondFactor&rd=1#app-passwords) for Gmail.

```yml
name: Email Copilot Report
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * *'

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: austenstone/copilot-usage@v6
        with:
          github-token: ${{ secrets.TOKEN }}
      - uses: austenstone/job-summary@v2.0
        id: pdf
        with:
          name: copilot-usage
      - uses: dawidd6/action-send-mail@v18
        with:
          server_address: smtp.gmail.com
          server_port: 465
          username: ${{ secrets.EMAIL }}
          password: ${{ secrets.PASSWORD }}
          from: ${{ secrets.EMAIL }}
          to: ${{ secrets.EMAIL }} # Recipient email
          subject: "Copilot Usage Report (${{ steps.usage.outputs.since }} - ${{ steps.usage.outputs.until }})"
          html_body: |
            <!DOCTYPE html>
            <html>
            
            <body>
              <h1>Copilot Usage Report</h1>
              <p>Attached is the Copilot Usage Report for ${{ steps.usage.outputs.since }} - ${{ steps.usage.outputs.until }}!</p>
              <p>
                <a href="https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}#:~:text=Copilot%20Usage%20summary">View the full report on
                  GitHub.com</a>
              </p>

              ${{ steps.pdf.outputs.job-summary-html }}
              
            </body>
            
            </html>
          attachments: ${{ steps.pdf.outputs.pdf-file }}
```

> [!TIP]
> Try using other messaging systems such as [slack](https://github.com/marketplace/actions/slack-send), [teams](https://github.com/marketplace/actions/microsoft-teams-notification), [discord](https://github.com/marketplace/actions/discord-message-notify), etc.

![image](https://github.com/austenstone/copilot-usage/assets/22425467/94c9c913-3924-495a-9d7f-6b79185de219)

## ➡️ Inputs

If no `organization` or `enterprise` input is provided, we default to the repository owner which is
likely the organization.

Various inputs are defined in [`action.yml`](action.yml):

| Name | Description | Default |
| --- | --- | --- |
| github-token | The GitHub token used to create an authenticated client | |
| enterprise | The enterprise slug. Mutually exclusive with `organization` | |
| organization | The organization slug | `${{ github.repository_owner }}` |
| team | The team slug. Requires `organization` | |
| days | The number of days to show usage metrics for. Maximum 28 | |
| since | Show usage metrics since this date, in `YYYY-MM-DD` format. Maximum value is 28 days ago | |
| until | Show usage metrics until this date, in `YYYY-MM-DD` format. Maximum value is 28 days ago | |
| job-summary | Whether to generate a job summary | `true` |
| json | Whether to generate JSON as a workflow artifact | `true` |
| csv | Whether to generate a CSV as a workflow artifact | `false` |
| csv-options | The options for the CSV report | |
| xml | Whether to generate an XML as a workflow artifact | `false` |
| xml-options | The options for the XML report | |
| time-zone | The time zone to use for the report | `UTC` |
| artifact-name | The name of the artifact to create | `copilot-usage` |

## ⬅️ Outputs

| Name | Description |
| --- | --- |
| result | The Copilot usage as a JSON string |
| result-org-details | The Copilot organization details as a JSON string |
| result-seats | The Copilot seat assignments as a JSON string |
| since | The first day included in the report |
| until | The last day included in the report |
| days | The number of days included in the report |

### Endpoints

The endpoints used by this action...

* `GET /orgs/{org}/copilot/metrics/reports/organization-28-day/latest`
* `GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest`
* `GET /orgs/{org}/copilot/metrics/reports/users-28-day/latest` (team only)
* `GET /orgs/{org}/copilot/metrics/reports/user-teams-1-day` (team only)
* `GET /orgs/{org}/copilot/billing`
* `GET /orgs/{org}/copilot/billing/seats`

These report endpoints return signed download links to
[NDJSON](https://github.com/ndjson/ndjson-spec) files, which the action downloads and parses.

## Migrating to v6

GitHub sunset the endpoints that powered every version up to `v5`:

* `GET /orgs/{org}/copilot/usage`
* `GET /orgs/{org}/copilot/metrics`
* `GET /orgs/{org}/team/{team_slug}/copilot/metrics`

They now return `404`, so older versions of this action cannot return data. `v6` moves to the
replacement report endpoints.

What changes for you:

* **Bump to `@v6`.** There is no configuration change for the common organization case.
* **The `result` output shape changed** to follow the new report schema. If you consume `result`,
  `csv`, `xml`, or `json` downstream, the field names are different. Notably `date` is now `day`,
  and `total_suggestions_count` / `total_acceptances_count` are now
  `code_generation_activity_count` / `code_acceptance_activity_count`.
* **`enterprise` now works.** It was previously declared but ignored.
* **`team` needs a token that can read user-level metrics**, because the new API has no team
  endpoint and team figures are derived from the user report.

### Versioning

Pin to a major tag such as `@v6` to pick up fixes automatically, or to a full `@v6.0.0` for exact
reproducibility. The major tag moves to each new release.

There is no `v5` tag. `v5.0` through `v5.2` were released without one, and backfilling it now would
point consumers at code the API sunset already broke. Use `@v6`.

## Example Job Summary

[View latest reports](https://github.com/austenstone/copilot-usage/actions/workflows/usage.yml)

