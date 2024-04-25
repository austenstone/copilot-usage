import { summary } from "@actions/core";
import { CopilotUsageResponse } from "./types";

interface CustomUsageBreakdown {
  [key: string]: {
    suggestions_count: number;
    acceptances_count: number;
    lines_suggested: number;
    lines_accepted: number;
    active_users: number;
  };
}

export const createJobSummary = async (data: CopilotUsageResponse) => {
  const languageUsage: CustomUsageBreakdown = data.reduce((acc, item) => {
    item.breakdown.forEach((breakdownItem) => {
      if (acc[breakdownItem.language]) {
        acc[breakdownItem.language].suggestions_count += breakdownItem.suggestions_count;
        acc[breakdownItem.language].acceptances_count += breakdownItem.acceptances_count;
        acc[breakdownItem.language].lines_suggested += breakdownItem.lines_suggested;
        acc[breakdownItem.language].lines_accepted += breakdownItem.lines_accepted;
        acc[breakdownItem.language].active_users += breakdownItem.active_users;
      } else {
        acc[breakdownItem.language] = {
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
  const sortedLanguageUsage = Object.fromEntries(
    Object.entries(languageUsage)
      .sort((a, b) => b[1].acceptances_count - a[1].acceptances_count)
  );

  const editorUsage: CustomUsageBreakdown = data.reduce((acc, item) => {
    item.breakdown.forEach((breakdownItem) => {
      if (acc[breakdownItem.editor]) {
        acc[breakdownItem.editor].suggestions_count += breakdownItem.suggestions_count;
        acc[breakdownItem.editor].acceptances_count += breakdownItem.acceptances_count;
        acc[breakdownItem.editor].lines_suggested += breakdownItem.lines_suggested;
        acc[breakdownItem.editor].lines_accepted += breakdownItem.lines_accepted;
        acc[breakdownItem.editor].active_users += breakdownItem.active_users;
      } else {
        acc[breakdownItem.editor] = {
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
  const sortedEditorUsage = Object.fromEntries(
    Object.entries(editorUsage)
      .sort((a, b) => b[1].acceptances_count - a[1].acceptances_count)
  );

  const dayOfWeekUsage: CustomUsageBreakdown = data.reduce((acc, item) => {
    const dayOfWeek = dateFormat(item.day, { weekday: 'long' });
    if (acc[dayOfWeek]) {
      acc[dayOfWeek].suggestions_count += item.total_suggestions_count;
      acc[dayOfWeek].acceptances_count += item.total_acceptances_count;
      acc[dayOfWeek].lines_suggested += item.total_lines_suggested;
      acc[dayOfWeek].lines_accepted += item.total_lines_accepted;
      acc[dayOfWeek].active_users += item.total_active_users;
    } else {
      acc[dayOfWeek] = {
        dayOfWeek,
        suggestions_count: item.total_suggestions_count,
        acceptances_count: item.total_acceptances_count,
        lines_suggested: item.total_lines_suggested,
        lines_accepted: item.total_lines_accepted,
        active_users: item.total_active_users,
      };
    }
    return acc;
  }, {});

  const sortedDayOfWeekUsage = Object.fromEntries(
    Object.entries(dayOfWeekUsage)
      .sort((a, b) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days.indexOf(a[0]) - days.indexOf(b[0]);
      })
  );

  const totalAcceptanceCount = data.reduce((acc, item) => {
    if (typeof item?.total_acceptances_count === 'number' && item?.total_acceptances_count > 0) {
      return acc + item.total_acceptances_count;
    }
    return acc;
  }, 0);
  const totalSuggestionsCount = data.reduce((acc, item) => {
    if (typeof item?.total_suggestions_count === 'number' && item?.total_suggestions_count > 0) {
      return acc + item?.total_suggestions_count;
    }
    return acc;
  }, 0);
  const totalAcceptanceRate = (totalAcceptanceCount / totalSuggestionsCount * 100).toFixed(2);
  const totalLinesOfCodeAccepted = data.reduce((acc, item) => {
    if (typeof item?.total_lines_accepted === 'number' && item?.total_lines_accepted > 0) {
      return acc + item?.total_lines_accepted;
    }
    return acc;
  }, 0);

  const mostActiveDay = data.reduce((acc, item) => {
    return (acc.total_active_users > item.total_active_users) ? acc : item;
  });
  const highestAcceptanceRateDay = data.reduce((acc, item) => {
    return ((acc.total_acceptances_count / acc.total_suggestions_count) > (item.total_acceptances_count / item.total_suggestions_count)) ? acc : item;
  });

  return summary
    .addHeading(`Copilot Usage<br>(${dateFormat(data[0].day)} - ${dateFormat(data[data.length - 1].day)})`)
    .addHeading(`Suggestions: ${totalSuggestionsCount.toLocaleString()}`, 3)
    .addHeading(`Acceptances: ${totalAcceptanceCount.toLocaleString()}`, 3)
    .addHeading(`Acceptance Rate: ${totalAcceptanceRate}%`, 3)
    .addHeading(`Lines of Code Accepted: ${totalLinesOfCodeAccepted.toLocaleString()}`, 3)
    .addRaw(getXyChartAcceptanceRate(data))
    .addRaw(getXyChartDailyActiveUsers(data))
    .addHeading('Language Usage')
    .addRaw(getPieChartLanguageUsage(sortedLanguageUsage))
    .addTable(getTableLanguageData(sortedLanguageUsage))
    .addHeading('Editor Usage')
    .addRaw(getPieChartEditorUsage(sortedEditorUsage))
    .addTable(getTableEditorData(sortedEditorUsage))
    .addHeading('Daily Usage')
    .addHeading(`The most active day was ${dateFormat(mostActiveDay.day)} with ${mostActiveDay.total_active_users} active users.`, 3)
    .addHeading(`The day with the highest acceptance rate was ${dateFormat(highestAcceptanceRateDay.day)} with an acceptance rate of ${(highestAcceptanceRateDay.total_acceptances_count / highestAcceptanceRateDay.total_suggestions_count * 100).toFixed(2)}%.`, 3)
    .addRaw(getPieChartWeekdayUsage(sortedDayOfWeekUsage))
    .addTable(getTableData(data))
    .write();
}

const getTableData = (data: CopilotUsageResponse) => {
  const tableData = [
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
    ]
  ];
  data.forEach(item => {
    let total_acceptance_rate = 0;
    if (item.total_acceptances_count && item.total_suggestions_count) {
      total_acceptance_rate = item.total_acceptances_count / item.total_suggestions_count * 100;
    }
    tableData.push([
      { data: dateFormat(item.day), header: false },
      { data: item.total_suggestions_count?.toString(), header: false },
      { data: item.total_acceptances_count?.toString(), header: false },
      { data: `${total_acceptance_rate.toFixed(2)}%`, header: false },
      { data: item.total_lines_suggested?.toString(), header: false },
      { data: item.total_lines_accepted?.toString(), header: false },
      { data: item.total_active_users?.toString(), header: false },
      { data: item.total_chat_acceptances?.toString(), header: false },
      { data: item.total_chat_turns?.toString(), header: false },
      { data: item.total_active_chat_users?.toString(), header: false }
    ]);
  });
  return tableData;
}

const getPieChartWeekdayUsage = (data: CustomUsageBreakdown) => {
  return `\n\`\`\`mermaid
pie showData
title Suggestions by Day of the Week
${Object.entries(data)
      .map(([language, obj]) => `"${language}" : ${obj.suggestions_count}`)
      .join('\n')}
\`\`\`\n`;
}

const getTableLanguageData = (languageUsage: CustomUsageBreakdown) => {
  const tableData = [
    [
      { data: 'Language', header: true },
      { data: 'Suggestions', header: true },
      { data: 'Acceptances', header: true },
      { data: 'Acceptance Rate', header: true },
      { data: 'Lines Suggested', header: true },
      { data: 'Lines Accepted', header: true },
      { data: 'Active Users', header: true }
    ]
  ];
  Object.entries(languageUsage).forEach(([language, data]) => {
    tableData.push([
      { data: language, header: false },
      { data: data.suggestions_count.toString(), header: false },
      { data: data.acceptances_count.toString(), header: false },
      { data: `${((data.acceptances_count / data.suggestions_count) * 100).toFixed(2)}%`, header: false },
      { data: data.lines_suggested.toString(), header: false },
      { data: data.lines_accepted.toString(), header: false },
      { data: data.active_users.toString(), header: false }
    ]);
  });
  return tableData;
}

const getTableEditorData = (editorUsage: CustomUsageBreakdown) => {
  const tableData = [
    [
      { data: 'Editor', header: true },
      { data: 'Suggestions', header: true },
      { data: 'Acceptances', header: true },
      { data: 'Acceptance Rate', header: true },
      { data: 'Lines Suggested', header: true },
      { data: 'Lines Accepted', header: true },
      { data: 'Active Users', header: true }
    ]
  ];
  Object.entries(editorUsage).forEach(([editor, data]) => {
    tableData.push([
      { data: editor, header: false },
      { data: data.suggestions_count.toString(), header: false },
      { data: data.acceptances_count.toString(), header: false },
      { data: `${((data.acceptances_count / data.suggestions_count) * 100).toFixed(2)}%`, header: false },
      { data: data.lines_suggested.toString(), header: false },
      { data: data.lines_accepted.toString(), header: false },
      { data: data.active_users.toString(), header: false }
    ]);
  });
  return tableData;
}

const getPieChartLanguageUsage = (languageUsage: CustomUsageBreakdown) => {
  return `\n\`\`\`mermaid
pie showData
title Language Usage
    ${Object.entries(languageUsage)
      .sort((a, b) => b[1].suggestions_count - a[1].suggestions_count)
      .slice(0, 20)
      .map(([language, obj]) => `"${language}" : ${obj.suggestions_count}`)
      .join('\n')}
\`\`\`\n`;
}

const getPieChartEditorUsage = (editorUsage: CustomUsageBreakdown) => {
  return `\n\`\`\`mermaid
pie showData
title Editor Usage
    ${Object.entries(editorUsage)
      .sort((a, b) => b[1].suggestions_count - a[1].suggestions_count)
      .map(([editor, obj]) => `"${editor}" : ${obj.suggestions_count}`)
      .join('\n')}
\`\`\`\n`;
}

const getXyChartAcceptanceRate = (data: CopilotUsageResponse) => {
  const maxAcceptances = Math.max(...data.map((item) => item.total_acceptances_count)) + 10;
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
  title "Accepts & Acceptance Rate"
  x-axis [${data.map((item) => `"${dateFormat(item.day, { month: '2-digit', day: '2-digit' })}"`).join(', ')
    }]
  y-axis "Acceptances" 0 --> ${maxAcceptances}
  bar [${data.map((item) => item.total_acceptances_count).join(', ')
    }]
  line [${data.map((item) => (item.total_acceptances_count / item.total_suggestions_count) * maxAcceptances).join(', ')
    }]
\`\`\`\n`;
}

const getXyChartDailyActiveUsers = (data: CopilotUsageResponse) => {
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
  x-axis [${data.map((item) => `"${dateFormat(item.day, { month: '2-digit', day: '2-digit' })}"`).join(', ')
    }]
  y-axis "Active Users" 0 --> ${maxActiveUsers}
  line [${data.map((item) => item.total_active_users).join(', ')
    }]
\`\`\`\n`;
}


const dateFormat = (date: string, format: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', year: 'numeric' }): string => {
  return new Date(date).toLocaleDateString('en-US', format);
}