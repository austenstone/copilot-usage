import { summary } from "@actions/core";
const groupBreakdown = (key, data, sort) => {
    const breakdown = data.reduce((acc, item) => {
        item.breakdown.forEach((breakdownItem) => {
            if (acc[breakdownItem[key]]) {
                acc[breakdownItem[key]].suggestions_count += breakdownItem.suggestions_count;
                acc[breakdownItem[key]].acceptances_count += breakdownItem.acceptances_count;
                acc[breakdownItem[key]].lines_suggested += breakdownItem.lines_suggested;
                acc[breakdownItem[key]].lines_accepted += breakdownItem.lines_accepted;
                acc[breakdownItem[key]].active_users += breakdownItem.active_users;
            }
            else {
                acc[breakdownItem[key]] = {
                    language: breakdownItem.language.replace(/-/g, '&#8209;'),
                    editor: breakdownItem.editor,
                    suggestions_count: breakdownItem.suggestions_count,
                    acceptances_count: breakdownItem.acceptances_count,
                    lines_suggested: breakdownItem.lines_suggested,
                    lines_accepted: breakdownItem.lines_accepted,
                    active_users: breakdownItem.active_users,
                };
            }
        });
        return acc;
    }, {});
    return Object.fromEntries(Object.entries(breakdown).sort(sort ? sort : (a, b) => b[1].acceptances_count - a[1].acceptances_count));
};
export const createJobSummaryUsage = (data) => {
    const languageUsage = groupBreakdown('language', data);
    const editorUsage = groupBreakdown('editor', data);
    const totalAcceptanceCount = data.reduce((acc, item) => acc + item.total_acceptances_count, 0);
    const totalSuggestionsCount = data.reduce((acc, item) => acc + item?.total_suggestions_count, 0);
    const totalAcceptanceRate = (totalAcceptanceCount / totalSuggestionsCount * 100).toFixed(2);
    const totalLinesOfCodeAccepted = data.reduce((acc, item) => acc + item?.total_lines_accepted, 0);
    const mostActiveDay = data.reduce((acc, item) => (acc.total_active_users > item.total_active_users) ? acc : item);
    const highestAcceptanceRateDay = data.reduce((acc, item) => ((acc.total_acceptances_count / acc.total_suggestions_count) > (item.total_acceptances_count / item.total_suggestions_count)) ? acc : item);
    const totalChatAcceptanceCount = data.reduce((acc, item) => acc + item.total_chat_acceptances, 0);
    const totalChatTurns = data.reduce((acc, item) => acc + item.total_chat_turns, 0);
    const totalChatAcceptanceRate = (totalChatAcceptanceCount / totalChatTurns * 100).toFixed(2);
    const totalAvgChatUsers = data.reduce((acc, item) => acc + item.total_active_chat_users, 0) / data.length;
    return summary
        .addHeading(`Copilot Usage<br>${dateFormat(data[0].day)} - ${dateFormat(data[data.length - 1].day)}`)
        .addHeading(`Copilot Chat`, 3)
        .addHeading(`Acceptances: ${totalChatAcceptanceCount.toLocaleString()}`, 4)
        .addHeading(`Turns: ${totalChatTurns.toLocaleString()}`, 4)
        .addHeading(`Acceptance Rate: ${totalChatAcceptanceRate}%`, 4)
        .addHeading(`Average Daily Users: ${totalAvgChatUsers.toFixed(2)}`, 4)
        .addRaw(getXyChartChatAcceptanceRate(data))
        .addHeading(`Copilot Completions`, 3)
        .addHeading(`Suggestions: ${totalSuggestionsCount.toLocaleString()}`, 4)
        .addHeading(`Acceptances: ${totalAcceptanceCount.toLocaleString()}`, 4)
        .addHeading(`Acceptance Rate: ${totalAcceptanceRate}%`, 4)
        .addHeading(`Lines of Code Accepted: ${totalLinesOfCodeAccepted.toLocaleString()}`, 4)
        .addRaw(getXyChartAcceptanceRate(data))
        .addRaw(getXyChartDailyActiveUsers(data))
        .addHeading('Language Usage')
        .addRaw(getPieChartLanguageUsage(languageUsage))
        .addTable(getTableLanguageData(languageUsage))
        .addHeading('Editor Usage')
        .addRaw(getPieChartEditorUsage(editorUsage))
        .addTable(getTableEditorData(editorUsage))
        .addHeading('Daily Usage')
        .addHeading(`The most active day was ${dateFormat(mostActiveDay.day)} with ${mostActiveDay.total_active_users} active users.`, 3)
        .addHeading(`The day with the highest acceptance rate was ${dateFormat(highestAcceptanceRateDay.day)} with an acceptance rate of ${(highestAcceptanceRateDay.total_acceptances_count / highestAcceptanceRateDay.total_suggestions_count * 100).toFixed(2)}%.`, 3)
        .addTable(getTableData(data));
    return summary;
};
export const createJobSummarySeatInfo = (data) => {
    return summary
        .addHeading('Seat Info')
        .addHeading(`Seat Management Setting: ${data.seat_management_setting}`, 3)
        .addHeading(`Public Code Suggestions Enabled: ${data.public_code_suggestions}`, 3)
        .addHeading(`IDE Chat Enabled: ${data.ide_chat}`, 3)
        .addHeading(`Platform IDE Enabled: ${data.platform_ide}`, 3)
        .addHeading(`Platform Chat Enabled: ${data.platform_chat}`, 3)
        .addHeading(`CLI Enabled: ${data.cli}`, 3)
        .addHeading(`Total Seats: ${data.seat_breakdown.total}`, 3)
        .addHeading(`Added this cycle: ${data.seat_breakdown.added_this_cycle}`, 3)
        .addHeading(`Pending invites: ${data.seat_breakdown.pending_invitation}`, 3)
        .addHeading(`Pending cancellations: ${data.seat_breakdown.pending_cancellation}`, 3)
        .addHeading(`Active this cycle: ${data.seat_breakdown.active_this_cycle}`, 3)
        .addHeading(`Inactive this cycle: ${data.seat_breakdown.inactive_this_cycle}`, 3);
};
export const createJobSummarySeatAssignments = (data) => {
    if (!data)
        data = [];
    return summary
        .addHeading('Seat Assignments')
        .addTable([
        [
            { data: 'Avatar', header: true },
            { data: 'Login', header: true },
            { data: 'Last Activity', header: true },
            { data: 'Last Editor Used', header: true },
            { data: 'Created At', header: true },
            { data: 'Updated At', header: true },
            { data: 'Pending Cancellation Date', header: true },
            { data: 'Team', header: true },
        ],
        ...data.map(seat => [
            `<img src="${seat.assignee?.avatar_url}" width="33" />`,
            seat.assignee?.login,
            seat.last_activity_at ? dateFormat(seat.last_activity_at) : 'No Activity',
            seat.last_activity_editor,
            dateFormat(seat.created_at),
            dateFormat(seat.updated_at),
            dateFormat(seat.pending_cancellation_date) || ' ',
            String(seat.assigning_team?.name || ' '),
        ])
    ]);
};
export const createJobSummaryFooter = async (organization) => {
    summary
        .addLink(`Manage Access for ${organization}`, `https://github.com/organizations/${organization}/settings/copilot/seat_management`)
        .write();
};
const getTableData = (data) => {
    return [
        [
            { data: 'Day', header: true },
            { data: 'Suggestions', header: true },
            { data: 'Acceptances', header: true },
            { data: 'Acceptance Rate', header: true },
            { data: 'Lines Suggested', header: true },
            { data: 'Lines Accepted', header: true },
            { data: 'Active Users', header: true },
            { data: 'Chat Acceptances', header: true },
            { data: 'Chat Turns', header: true },
            { data: 'Active Chat Users', header: true }
        ],
        ...data.map(item => [
            dateFormat(item.day),
            item.total_suggestions_count?.toLocaleString(),
            item.total_acceptances_count?.toLocaleString(),
            `${(item.total_acceptances_count / item.total_suggestions_count * 100).toFixed(2)}%`,
            item.total_lines_suggested?.toLocaleString(),
            item.total_lines_accepted?.toLocaleString(),
            item.total_active_users?.toLocaleString(),
            item.total_chat_acceptances?.toLocaleString(),
            item.total_chat_turns?.toLocaleString(),
            item.total_active_chat_users?.toLocaleString()
        ])
    ];
};
const getTableLanguageData = (languageUsage) => {
    return [
        [
            { data: 'Language', header: true },
            { data: 'Suggestions', header: true },
            { data: 'Acceptances', header: true },
            { data: 'Acceptance Rate', header: true },
            { data: 'Lines Suggested', header: true },
            { data: 'Lines Accepted', header: true },
            { data: 'Active Users', header: true }
        ],
        ...Object.entries(languageUsage).map(([language, data]) => [
            language,
            data.suggestions_count.toLocaleString(),
            data.acceptances_count.toLocaleString(),
            `${((data.acceptances_count / data.suggestions_count) * 100).toFixed(2)}%`,
            data.lines_suggested.toLocaleString(),
            data.lines_accepted.toLocaleString(),
            data.active_users.toLocaleString()
        ])
    ];
};
const getTableEditorData = (editorUsage) => {
    return [
        [
            { data: 'Editor', header: true },
            { data: 'Suggestions', header: true },
            { data: 'Acceptances', header: true },
            { data: 'Acceptance Rate', header: true },
            { data: 'Lines Suggested', header: true },
            { data: 'Lines Accepted', header: true },
            { data: 'Active Users', header: true }
        ],
        ...Object.entries(editorUsage).map(([editor, data]) => [
            editor,
            data.suggestions_count.toLocaleString(),
            data.acceptances_count.toLocaleString(),
            `${((data.acceptances_count / data.suggestions_count) * 100).toFixed(2)}%`,
            data.lines_suggested.toLocaleString(),
            data.lines_accepted.toLocaleString(),
            data.active_users.toLocaleString()
        ])
    ];
};
const getPieChartLanguageUsage = (languageUsage) => {
    return `\n\`\`\`mermaid
pie showData
title Language Usage
    ${Object.entries(languageUsage)
        .sort((a, b) => b[1].suggestions_count - a[1].suggestions_count)
        .slice(0, 20)
        .map(([language, obj]) => `"${language}" : ${obj.suggestions_count}`)
        .join('\n')}
\`\`\`\n`;
};
const getPieChartEditorUsage = (editorUsage) => {
    return `\n\`\`\`mermaid
pie showData
title Editor Usage
    ${Object.entries(editorUsage)
        .sort((a, b) => b[1].suggestions_count - a[1].suggestions_count)
        .map(([editor, obj]) => `"${editor}" : ${obj.suggestions_count}`)
        .join('\n')}
\`\`\`\n`;
};
const generateXyChart = (data, title, yAxisTitle, dataForBar, dataForLine, maxData) => {
    return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${data.length * 45}
        height: 500
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "${title}"
  x-axis [${data.map((item) => `"${dateFormat(item.day, { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "${yAxisTitle}" 0 --> ${maxData}
  bar [${data.map(dataForBar).join(', ')}]
  line [${data.map(dataForLine).join(', ')}]
\`\`\`\n`;
};
const getXyChartAcceptanceRate = (data) => {
    const maxAcceptances = Math.max(...data.map((item) => item.total_acceptances_count)) + 10;
    return generateXyChart(data, "Accepts & Acceptance Rate", "Acceptances", (item) => item.total_acceptances_count, (item) => ((item.total_acceptances_count / item.total_suggestions_count) * maxAcceptances) || 0, maxAcceptances);
};
const getXyChartChatAcceptanceRate = (data) => {
    const maxChatAcceptances = Math.max(...data.map((item) => item.total_chat_acceptances)) + 10;
    return generateXyChart(data, "Chat Accepts & Acceptance Rate", "Chat Acceptances", (item) => item.total_chat_acceptances, (item) => ((item.total_chat_acceptances / item.total_chat_turns) * maxChatAcceptances) || 0, maxChatAcceptances);
};
const getXyChartDailyActiveUsers = (data) => {
    const maxActiveUsers = Math.max(...data.map((item) => item.total_active_users)) + 10;
    return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${data.length * 45}
        height: 500
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Daily Active Users"
  x-axis [${data.map((item) => `"${dateFormat(item.day, { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "Active Users" 0 --> ${maxActiveUsers}
  line [${data.map((item) => item.total_active_users).join(', ')}]
\`\`\`\n`;
};
const dateFormat = (date, format = { month: 'numeric', day: 'numeric', year: 'numeric' }) => {
    if (!date)
        return 'undefined';
    return new Date(date).toLocaleDateString('en-US', format);
};
//# sourceMappingURL=job-summary.js.map