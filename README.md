# Copilot Usage Action

Get Copilot usage data as a job summary.

Powered by the [REST API endpoints for GitHub Copilot usage metrics](https://docs.github.com/en/rest/copilot/copilot-usage).

## Usage
Create a workflow (eg: `.github/workflows/copilot-usage.yml`). See [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).


### PAT(Personal Access Token)

You will need to [create a PAT(Personal Access Token)](https://github.com/settings/tokens/new?scopes=admin:org) that has the `copilot`, `manage_billing:copilot`, `admin:org`, `admin:enterprise`, or `manage_billing:enterprise` scope to use this endpoint.

Add this PAT as a secret so we can use it as input `github-token`, see [Creating encrypted secrets for a repository](https://docs.github.com/en/enterprise-cloud@latest/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository). 

#### Example
```yml
name: TypeScript Action Workflow
on:
  workflow_dispatch:

jobs:
  run:
    name: Run Action
    runs-on: ubuntu-latest
    steps:
      - uses: austenstone/copilot-usage@main
        with:
          enterprise: github
          job-summary: true
          csv: true
          github-token: ${{ secrets.TOKEN }}
```

## ➡️ Inputs
Various inputs are defined in [`action.yml`](action.yml):

| Name | Description | Default |
| --- | --- | --- |
| github-token | The GitHub token used to create an authenticated client | ${{ github.token }} |
| enterprise | The GitHub enterprise slug | |
| organization | The organization slug | ${{ github.repository_owner }} |
| team | The team slug | |
| days | The number of days to show usage metrics for | |
| since | Show usage metrics since this date. This is a timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ). Maximum value is 28 days ago | |
| until | Show usage metrics until this date. This is a timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ). Maximum value is 28 days ago | |
| job-summary | Whether to generate a report | true |
| csv | Whether to generate a CSV as a workflow artifact | false |



## ⬅️ Outputs
| Name | Description |
| --- | - |
| result | The copilot usage as a JSON string |


## Further help
To get more help on the Actions see [documentation](https://docs.github.com/en/actions).
