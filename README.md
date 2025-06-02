# Copilot Usage Action

Get Copilot usage data as:
* Md Job Summary
* CSV
* XML
* JSON

Powered by the [REST API endpoints for GitHub Copilot usage metrics](https://docs.github.com/en/rest/copilot/copilot-usage).

> [!TIP]
> 🚀 Get this running FAST by using the [template](https://github.com/austenstone/copilot-usage-template)

## Usage
Create a workflow (eg: `.github/workflows/copilot-usage.yml`). See [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### PAT(Personal Access Token)

You will need to [create a PAT(Personal Access Token)](https://github.com/settings/tokens/new?scopes=manage_billing:copilot) that has the `manage_billing:copilot`, `read:org`, or `read:enterprise` scopes to use this endpoint.

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
      - uses: austenstone/copilot-usage@v5.0
        with:
          github-token: ${{ secrets.TOKEN }}
          time-zone: 'EST'
```

#### Example get team usage

```yml
      - uses: austenstone/copilot-usage@v5.0
        with:
          github-token: ${{ secrets.TOKEN }}
          organization: 'org-slug'
          team: 'team-slug'
```

#### Example get CSV

```yml
      - uses: austenstone/copilot-usage@v5.0
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
      - uses: austenstone/copilot-usage@v5.0
        with:
          github-token: ${{ secrets.TOKEN }}
          organization: 'org-slug'
          team: ${{ matrix.team }}
```

#### Example specific timezone

You probably want to specify the timezone to get the usage in your local time. The default is UTC.
EX: `EST`, `PST`, `CST`, [etc](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

```yml
      - uses: austenstone/copilot-usage@v5.0
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
      - uses: austenstone/copilot-usage@v5.0
        with:
          github-token: ${{ secrets.TOKEN }}
      - uses: austenstone/job-summary@v2.0
        id: pdf
        with:
          name: copilot-usage
      - uses: dawidd6/action-send-mail@v4
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

If no `organization` or `team` input are provided, we default to the repository owner which is likely the organization.

Various inputs are defined in [`action.yml`](action.yml):

| Name | Description | Default |
| --- | --- | --- |
| github-token | The GitHub token used to create an authenticated client | |
| organization | The organization slug | ${{ github.repository_owner }} |
| job-summary | Whether to generate a report | true |
| csv | Whether to generate a CSV as a workflow artifact | false |
| csv-options | The options for the CSV report | |
| xml | Whether to generate an XML as a workflow artifact | false |
| xml-options | The options for the XML report | |
| team | The team slug | |
| days | The number of days to show usage metrics for | |
| since | Show usage metrics since this date. This is a timestamp, in `YYYY-MM-DD` format. Maximum value is 28 days ago | |
| until | Show usage metrics until this date. This is a timestamp, in `YYYY-MM-DD` format. Maximum value is 28 days ago | |
| time-zone | The time zone to use for the report | UTC |

## ⬅️ Outputs
| Name | Description |
| --- | - |
| result | The copilot usage as a JSON string |
| since | The date since which the usage metrics are shown |
| until | The date until which the usage metrics are shown |

### Endpoints

The endpoints used by this action...

* GET /orgs/{org}/team/{team}/copilot/usage
* GET /orgs/{org}/copilot/usage
* GET /orgs/{org}/copilot/billing
* GET /orgs/{org}/copilot/billing/seats

## Example Job Summary

[View latest reports](https://github.com/austenstone/copilot-usage/actions/workflows/usage.yml)

