import { CopilotUsageResponse } from "../../src/run";
import { writeFileSync } from "fs";
import { createJobSummarySeatAssignments, createJobSummarySeatInfo, createJobSummaryUsage } from "../../src/job-summary";
import { summary } from "@actions/core";
import { RestEndpointMethodTypes } from "@octokit/action";

const getSummaryBuffer = (_summary: typeof summary): string => {
  return (_summary as unknown as {
    _buffer: string,
    _filePath?: string;
  })._buffer
}
export const createMockData = async () => {
  let summary;
  summary = await createJobSummaryUsage(exampleResponseEnterprise);
  writeFileSync('./__tests__/mock/enterprise-usage-summary.md', getSummaryBuffer(summary));
  summary.emptyBuffer();

  summary = await createJobSummaryUsage(exampleResponseOrg);
  writeFileSync('./__tests__/mock/org-usage-summary.md', getSummaryBuffer(summary));
  summary.emptyBuffer();

  summary = await createJobSummaryUsage(exampleResponseTeam);
  writeFileSync('./__tests__/mock/team-usage-summary.md', getSummaryBuffer(summary));
  summary.emptyBuffer();

  summary = await createJobSummarySeatInfo(exampleSeatInfoResponse);
  writeFileSync('./__tests__/mock/org-seat-info-summary.md', getSummaryBuffer(summary));
  summary.emptyBuffer();

  summary = await createJobSummarySeatAssignments(exampleSeatAssignmentResponse);
  writeFileSync('./__tests__/mock/org-seat-assignments-summary.md', getSummaryBuffer(summary));
  summary.emptyBuffer();
}

export const exampleResponseEnterprise: CopilotUsageResponse = [
  {
    "day": "2023-10-15",
    "total_suggestions_count": 5000,
    "total_acceptances_count": 3000,
    "total_lines_suggested": 7000,
    "total_lines_accepted": 3500,
    "total_active_users": 15,
    "total_chat_acceptances": 45,
    "total_chat_turns": 350,
    "total_active_chat_users": 8,
    "breakdown": [
      {
        "language": "python",
        "editor": "vscode",
        "suggestions_count": 3000,
        "acceptances_count": 2000,
        "lines_suggested": 3000,
        "lines_accepted": 1500,
        "active_users": 5
      },
      {
        "language": "python",
        "editor": "jetbrains",
        "suggestions_count": 1000,
        "acceptances_count": 500,
        "lines_suggested": 2000,
        "lines_accepted": 1000,
        "active_users": 5
      },
      {
        "language": "javascript",
        "editor": "vscode",
        "suggestions_count": 1000,
        "acceptances_count": 500,
        "lines_suggested": 2000,
        "lines_accepted": 1000,
        "active_users": 5
      }
    ]
  },
  {
    "day": "2023-10-16",
    "total_suggestions_count": 5200,
    "total_acceptances_count": 5100,
    "total_lines_suggested": 5300,
    "total_lines_accepted": 5000,
    "total_active_users": 15,
    "total_chat_acceptances": 57,
    "total_chat_turns": 455,
    "total_active_chat_users": 12,
    "breakdown": [
      {
        "language": "python",
        "editor": "vscode",
        "suggestions_count": 3100,
        "acceptances_count": 3000,
        "lines_suggested": 3200,
        "lines_accepted": 3100,
        "active_users": 5
      },
      {
        "language": "python",
        "editor": "jetbrains",
        "suggestions_count": 1100,
        "acceptances_count": 1000,
        "lines_suggested": 1200,
        "lines_accepted": 1100,
        "active_users": 5
      },
      {
        "language": "javascript",
        "editor": "vscode",
        "suggestions_count": 1000,
        "acceptances_count": 900,
        "lines_suggested": 1100,
        "lines_accepted": 1000,
        "active_users": 5
      }
    ]
  }
];

export const exampleResponseOrg: CopilotUsageResponse = [
  {
    "day": "2023-10-15",
    "total_suggestions_count": 1000,
    "total_acceptances_count": 800,
    "total_lines_suggested": 1800,
    "total_lines_accepted": 1200,
    "total_active_users": 10,
    "total_chat_acceptances": 32,
    "total_chat_turns": 200,
    "total_active_chat_users": 4,
    "breakdown": [
      {
        "language": "python",
        "editor": "vscode",
        "suggestions_count": 300,
        "acceptances_count": 250,
        "lines_suggested": 900,
        "lines_accepted": 700,
        "active_users": 5
      },
      {
        "language": "python",
        "editor": "jetbrains",
        "suggestions_count": 300,
        "acceptances_count": 200,
        "lines_suggested": 400,
        "lines_accepted": 300,
        "active_users": 2
      },
      {
        "language": "ruby",
        "editor": "vscode",
        "suggestions_count": 400,
        "acceptances_count": 350,
        "lines_suggested": 500,
        "lines_accepted": 200,
        "active_users": 3
      }
    ]
  },
  {
    "day": "2023-10-16",
    "total_suggestions_count": 800,
    "total_acceptances_count": 600,
    "total_lines_suggested": 1100,
    "total_lines_accepted": 700,
    "total_active_users": 12,
    "total_chat_acceptances": 57,
    "total_chat_turns": 426,
    "total_active_chat_users": 8,
    "breakdown": [
      {
        "language": "python",
        "editor": "vscode",
        "suggestions_count": 300,
        "acceptances_count": 200,
        "lines_suggested": 600,
        "lines_accepted": 300,
        "active_users": 2
      },
      {
        "language": "python",
        "editor": "jetbrains",
        "suggestions_count": 300,
        "acceptances_count": 150,
        "lines_suggested": 300,
        "lines_accepted": 250,
        "active_users": 6
      },
      {
        "language": "ruby",
        "editor": "vscode",
        "suggestions_count": 200,
        "acceptances_count": 150,
        "lines_suggested": 200,
        "lines_accepted": 150,
        "active_users": 3
      }
    ]
  }
];

export const exampleResponseTeam: CopilotUsageResponse = [
  {
    "day": "2023-10-15",
    "total_suggestions_count": 1000,
    "total_acceptances_count": 800,
    "total_lines_suggested": 1800,
    "total_lines_accepted": 1200,
    "total_active_users": 10,
    "total_chat_acceptances": 32,
    "total_chat_turns": 200,
    "total_active_chat_users": 4,
    "breakdown": [
      {
        "language": "python",
        "editor": "vscode",
        "suggestions_count": 300,
        "acceptances_count": 250,
        "lines_suggested": 900,
        "lines_accepted": 700,
        "active_users": 5
      },
      {
        "language": "python",
        "editor": "jetbrains",
        "suggestions_count": 300,
        "acceptances_count": 200,
        "lines_suggested": 400,
        "lines_accepted": 300,
        "active_users": 2
      },
      {
        "language": "ruby",
        "editor": "vscode",
        "suggestions_count": 400,
        "acceptances_count": 350,
        "lines_suggested": 500,
        "lines_accepted": 200,
        "active_users": 3
      }
    ]
  },
  {
    "day": "2023-10-16",
    "total_suggestions_count": 800,
    "total_acceptances_count": 600,
    "total_lines_suggested": 1100,
    "total_lines_accepted": 700,
    "total_active_users": 12,
    "total_chat_acceptances": 57,
    "total_chat_turns": 426,
    "total_active_chat_users": 8,
    "breakdown": [
      {
        "language": "python",
        "editor": "vscode",
        "suggestions_count": 300,
        "acceptances_count": 200,
        "lines_suggested": 600,
        "lines_accepted": 300,
        "active_users": 2
      },
      {
        "language": "python",
        "editor": "jetbrains",
        "suggestions_count": 300,
        "acceptances_count": 150,
        "lines_suggested": 300,
        "lines_accepted": 250,
        "active_users": 6
      },
      {
        "language": "ruby",
        "editor": "vscode",
        "suggestions_count": 200,
        "acceptances_count": 150,
        "lines_suggested": 200,
        "lines_accepted": 150,
        "active_users": 3
      }
    ]
  }
];

export const exampleSeatInfoResponse: RestEndpointMethodTypes["copilot"]["getCopilotOrganizationDetails"]["response"]["data"] = {
  "seat_breakdown": {
    "total": 12,
    "added_this_cycle": 9,
    "pending_invitation": 0,
    "pending_cancellation": 0,
    "active_this_cycle": 12,
    "inactive_this_cycle": 11
  },
  "seat_management_setting": "assign_selected",
  "public_code_suggestions": "block"
};

export const exampleSeatAssignmentResponse: RestEndpointMethodTypes["copilot"]["listCopilotSeats"]["response"]["data"]["seats"] = [
  {
    "created_at": "2021-08-03T18:00:00-06:00",
    "updated_at": "2021-09-23T15:00:00-06:00",
    "pending_cancellation_date": null,
    "last_activity_at": "2021-10-14T00:53:32-06:00",
    "last_activity_editor": "vscode/1.77.3/copilot/1.86.82",
    "assignee": {
      "login": "octocat",
      "id": 1,
      "node_id": "MDQ6VXNlcjE=",
      "avatar_url": "https://github.com/images/error/octocat_happy.gif",
      "gravatar_id": "",
      "url": "https://api.github.com/users/octocat",
      "html_url": "https://github.com/octocat",
      "followers_url": "https://api.github.com/users/octocat/followers",
      "following_url": "https://api.github.com/users/octocat/following{/other_user}",
      "gists_url": "https://api.github.com/users/octocat/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/octocat/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/octocat/subscriptions",
      "organizations_url": "https://api.github.com/users/octocat/orgs",
      "repos_url": "https://api.github.com/users/octocat/repos",
      "events_url": "https://api.github.com/users/octocat/events{/privacy}",
      "received_events_url": "https://api.github.com/users/octocat/received_events",
      "type": "User",
      "site_admin": false
    },
    "assigning_team": {
      "id": 1,
      "node_id": "MDQ6VGVhbTE=",
      "url": "https://api.github.com/teams/1",
      "html_url": "https://github.com/orgs/github/teams/justice-league",
      "name": "Justice League",
      "slug": "justice-league",
      "description": "A great team.",
      "privacy": "closed",
      "notification_setting": "notifications_enabled",
      "permission": "admin",
      "members_url": "https://api.github.com/teams/1/members{/member}",
      "repositories_url": "https://api.github.com/teams/1/repos",
      "parent": null
    }
  },
  {
    "created_at": "2021-09-23T18:00:00-06:00",
    "updated_at": "2021-09-23T15:00:00-06:00",
    "pending_cancellation_date": "2021-11-01",
    "last_activity_at": "2021-10-13T00:53:32-06:00",
    "last_activity_editor": "vscode/1.77.3/copilot/1.86.82",
    "assignee": {
      "login": "octokitten",
      "id": 1,
      "node_id": "MDQ76VNlcjE=",
      "avatar_url": "https://github.com/images/error/octokitten_happy.gif",
      "gravatar_id": "",
      "url": "https://api.github.com/users/octokitten",
      "html_url": "https://github.com/octokitten",
      "followers_url": "https://api.github.com/users/octokitten/followers",
      "following_url": "https://api.github.com/users/octokitten/following{/other_user}",
      "gists_url": "https://api.github.com/users/octokitten/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/octokitten/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/octokitten/subscriptions",
      "organizations_url": "https://api.github.com/users/octokitten/orgs",
      "repos_url": "https://api.github.com/users/octokitten/repos",
      "events_url": "https://api.github.com/users/octokitten/events{/privacy}",
      "received_events_url": "https://api.github.com/users/octokitten/received_events",
      "type": "User",
      "site_admin": false
    }
  }
];

createMockData();