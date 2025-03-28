import { summary } from "@actions/core";
const groupLanguageMetrics = (data) => {
    const metrics = new Map();
    data.forEach(day => {
        day.copilot_ide_code_completions?.editors?.forEach(editor => {
            editor.models?.forEach(model => {
                model.languages?.forEach(lang => {
                    const existing = metrics.get(lang.name || 'unknown') || {
                        total_engaged_users: 0,
                        total_code_acceptances: 0,
                        total_code_suggestions: 0,
                        total_code_lines_accepted: 0,
                        total_code_lines_suggested: 0
                    };
                    metrics.set(lang.name || 'unknown', {
                        total_engaged_users: Math.max(existing.total_engaged_users, lang.total_engaged_users || 0),
                        total_code_acceptances: existing.total_code_acceptances + (lang.total_code_acceptances || 0),
                        total_code_suggestions: existing.total_code_suggestions + (lang.total_code_suggestions || 0),
                        total_code_lines_accepted: existing.total_code_lines_accepted + (lang.total_code_lines_accepted || 0),
                        total_code_lines_suggested: existing.total_code_lines_suggested + (lang.total_code_lines_suggested || 0)
                    });
                });
            });
        });
    });
    return Object.fromEntries(Array.from(metrics.entries())
        .sort((a, b) => b[1].total_code_acceptances - a[1].total_code_acceptances));
};
const groupEditorMetrics = (data) => {
    const metrics = new Map();
    data.forEach(day => {
        day.copilot_ide_code_completions?.editors?.forEach(editor => {
            const existing = metrics.get(editor.name || 'unknown') || {
                total_engaged_users: 0,
                total_code_acceptances: 0,
                total_code_suggestions: 0,
                total_code_lines_accepted: 0,
                total_code_lines_suggested: 0
            };
            let dailyAcceptances = 0;
            let dailySuggestions = 0;
            let dailyLinesAccepted = 0;
            let dailyLinesSuggested = 0;
            editor.models?.forEach(model => {
                model.languages?.forEach(lang => {
                    dailyAcceptances += lang.total_code_acceptances || 0;
                    dailySuggestions += lang.total_code_suggestions || 0;
                    dailyLinesAccepted += lang.total_code_lines_accepted || 0;
                    dailyLinesSuggested += lang.total_code_lines_suggested || 0;
                });
            });
            metrics.set(editor.name || 'unknown', {
                total_engaged_users: Math.max(existing.total_engaged_users, editor.total_engaged_users || 0),
                total_code_acceptances: existing.total_code_acceptances + dailyAcceptances,
                total_code_suggestions: existing.total_code_suggestions + dailySuggestions,
                total_code_lines_accepted: existing.total_code_lines_accepted + dailyLinesAccepted,
                total_code_lines_suggested: existing.total_code_lines_suggested + dailyLinesSuggested
            });
        });
    });
    return Object.fromEntries(Array.from(metrics.entries())
        .sort((a, b) => b[1].total_code_acceptances - a[1].total_code_acceptances));
};
const dateFormat = (date, options = {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
}) => {
    options.timeZone = process.env.TZ || 'UTC';
    return new Date(date).toLocaleDateString('en-US', options);
};
const getPieChartLanguageUsage = (languageMetrics) => {
    return `\n\`\`\`mermaid
pie showData
title Language Usage
    ${Object.entries(languageMetrics)
        .sort((a, b) => b[1].total_code_suggestions - a[1].total_code_suggestions)
        .slice(0, 20)
        .map(([language, metrics]) => `"${language}" : ${metrics.total_code_suggestions}`)
        .join('\n')}
\`\`\`\n`;
};
const getPieChartEditorUsage = (editorMetrics) => {
    return `\n\`\`\`mermaid
pie showData
title Editor Usage
    ${Object.entries(editorMetrics)
        .sort((a, b) => b[1].total_code_suggestions - a[1].total_code_suggestions)
        .map(([editor, metrics]) => `"${editor}" : ${metrics.total_code_suggestions}`)
        .join('\n')}
\`\`\`\n`;
};
const getPieChartChatEditorUsage = (data) => {
    const editorMetrics = new Map();
    data.forEach(day => {
        day.copilot_ide_chat?.editors?.forEach(editor => {
            const existingCount = editorMetrics.get(editor.name || 'unknown') || 0;
            const dailyChatCount = editor.models?.reduce((sum, model) => sum + (model.total_chats || 0), 0) || 0;
            editorMetrics.set(editor.name || 'unknown', existingCount + dailyChatCount);
        });
    });
    return `\n\`\`\`mermaid
pie showData
title Chat Usage by Editor
    ${Array.from(editorMetrics.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([editor, chatCount]) => `"${editor}" : ${chatCount}`)
        .join('\n')}
\`\`\`\n`;
};
const getBarChartChatVsCodeUsage = (data) => {
    const totalChatTurns = data.reduce((sum, day) => sum + (day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chats || 0), 0) ?? 0), 0) ?? 0), 0);
    const totalCodeSuggestions = data.reduce((sum, day) => sum + (day.copilot_ide_code_completions?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((mSum, model) => mSum + (model.languages?.reduce((lSum, lang) => lSum + (lang.total_code_suggestions || 0), 0) || 0), 0) || 0), 0) || 0), 0);
    const totalChatCopyEvents = data.reduce((sum, day) => sum + (day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chat_copy_events || 0), 0) ?? 0), 0) ?? 0), 0);
    const totalChatInsertionEvents = data.reduce((sum, day) => sum + (day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chat_insertion_events || 0), 0) ?? 0), 0) ?? 0), 0);
    return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: 500
        height: 400
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Chat vs. Code Completion Usage"
  x-axis ["Chat Turns", "Code Suggestions", "Chat Copy Events", "Chat Insertion Events"]
  y-axis "Count" 0 --> ${Math.max(totalChatTurns, totalCodeSuggestions, totalChatCopyEvents, totalChatInsertionEvents) + 10}
  bar [${totalChatTurns}, ${totalCodeSuggestions}, ${totalChatCopyEvents}, ${totalChatInsertionEvents}]
\`\`\`\n`;
};
const getBarChartChatCopyVsInsert = (data) => {
    const dailyChatMetrics = data.map(day => {
        const copyEvents = day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chat_copy_events || 0), 0) ?? 0), 0) ?? 0;
        const insertEvents = day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chat_insertion_events || 0), 0) ?? 0), 0) ?? 0;
        return { date: day.date, copyEvents, insertEvents };
    });
    const maxValue = Math.max(...dailyChatMetrics.map(d => Math.max(d.copyEvents, d.insertEvents))) + 5;
    return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${dailyChatMetrics.length * 45}
        height: 400
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Chat Copy vs. Insertion Events"
  x-axis [${dailyChatMetrics.map(day => `"${dateFormat(day.date, { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "Events" 0 --> ${maxValue}
  bar [${dailyChatMetrics.map(day => day.copyEvents).join(', ')}]
  line [${dailyChatMetrics.map(day => day.insertEvents).join(', ')}]
\`\`\`\n`;
};
const getXyChartAcceptanceRate = (data) => {
    const dailyRates = data.map(day => {
        const suggestions = day.copilot_ide_code_completions?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((mSum, model) => mSum + (model.languages?.reduce((lSum, lang) => lSum + (lang.total_code_suggestions || 0), 0) || 0), 0) || 0), 0) || 0;
        const acceptances = day.copilot_ide_code_completions?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((mSum, model) => mSum + (model.languages?.reduce((lSum, lang) => lSum + (lang.total_code_acceptances || 0), 0) || 0), 0) || 0), 0) || 0;
        const rate = suggestions > 0 ? (acceptances / suggestions) * 100 : 0;
        return {
            date: day.date,
            rate,
            acceptances,
            suggestions
        };
    });
    const maxAcceptances = Math.max(...dailyRates.map(d => d.acceptances)) + 10;
    const maxSuggestions = Math.max(...dailyRates.map(d => d.suggestions)) + 10;
    const yAxisMax = Math.max(maxAcceptances, maxSuggestions);
    return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${data.length * 45}
        height: 400
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Completion Accepts & Acceptance Rate"
  x-axis [${dailyRates.map(day => `"${dateFormat(day.date, { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "Count" 0 --> ${yAxisMax}
  y-axis2 "Rate (%)" 0 --> 100
  bar [${dailyRates.map(day => day.acceptances).join(', ')}]
  line2 [${dailyRates.map(day => day.rate.toFixed(1)).join(', ')}]
\`\`\`\n`;
};
const getXyChartDailyActiveChatUsers = (data) => {
    const chatUsers = data.map(day => {
        const activeChatUsers = day.copilot_ide_chat?.editors?.reduce((sum, editor) => sum + (editor.total_engaged_users || 0), 0) || 0;
        return { date: day.date, users: activeChatUsers };
    });
    const maxActiveUsers = Math.max(...chatUsers.map(day => day.users)) + 5;
    return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${data.length * 45}
        height: 400
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Daily Active Chat Users"
  x-axis [${chatUsers.map(day => `"${dateFormat(day.date, { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "Chat Users" 0 --> ${maxActiveUsers}
  line [${chatUsers.map(day => day.users).join(', ')}]
\`\`\`\n`;
};
const getTotalEngagedUsers = (day) => {
    const codeUsers = day.copilot_ide_code_completions?.editors?.reduce((sum, editor) => sum + (editor.total_engaged_users ?? 0), 0) || 0;
    const chatUsers = day.copilot_ide_chat?.editors?.reduce((sum, editor) => sum + (editor.total_engaged_users ?? 0), 0) || 0;
    return Math.max(codeUsers, chatUsers, day.total_active_users || 0);
};
const getXyChartDailyActiveUsers = (data) => {
    const activeUsers = data.map(day => {
        return getTotalEngagedUsers(day);
    });
    const maxActiveUsers = Math.max(...activeUsers) + 5;
    return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${data.length * 45}
        height: 400
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Daily Active Users"
  x-axis [${data.map(day => `"${dateFormat(day.date || '', { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "Active Users" 0 --> ${maxActiveUsers}
  line [${activeUsers.join(', ')}]
\`\`\`\n`;
};
const getChatModelDistribution = (data) => {
    const modelMetrics = new Map();
    data.forEach(day => {
        day.copilot_ide_chat?.editors?.forEach(editor => {
            editor.models?.forEach(model => {
                const modelName = model.name || 'unknown';
                const isCustom = model.is_custom_model ? ' (custom)' : '';
                const key = `${modelName}${isCustom}`;
                const existingCount = modelMetrics.get(key) || 0;
                modelMetrics.set(key, existingCount + (model.total_chats || 0));
            });
        });
    });
    return `\n\`\`\`mermaid
pie showData
title Chat Model Distribution
    ${Array.from(modelMetrics.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([model, count]) => `"${model}" : ${count}`)
        .join('\n')}
\`\`\`\n`;
};
export const createJobSummaryUsage = (data, name) => {
    const languageMetrics = groupLanguageMetrics(data);
    const editorMetrics = groupEditorMetrics(data);
    const totalCodeAcceptances = Object.values(languageMetrics)
        .reduce((sum, lang) => sum + lang.total_code_acceptances, 0);
    const totalCodeSuggestions = Object.values(languageMetrics)
        .reduce((sum, lang) => sum + lang.total_code_suggestions, 0);
    const totalLinesAccepted = Object.values(languageMetrics)
        .reduce((sum, lang) => sum + lang.total_code_lines_accepted, 0);
    const totalChatTurns = data.reduce((sum, day) => sum + (day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chats || 0), 0) ?? 0), 0) ?? 0), 0);
    const totalChatCopyEvents = data.reduce((sum, day) => sum + (day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chat_copy_events || 0), 0) ?? 0), 0) ?? 0), 0);
    const totalChatInsertEvents = data.reduce((sum, day) => sum + (day.copilot_ide_chat?.editors?.reduce((edSum, ed) => edSum + (ed.models?.reduce((modSum, mod) => modSum + (mod.total_chat_insertion_events || 0), 0) ?? 0), 0) ?? 0), 0);
    const totalActiveChatUsers = data.reduce((max, day) => {
        const dailyChatUsers = day.copilot_ide_chat?.editors?.reduce((sum, editor) => sum + (editor.total_engaged_users || 0), 0) || 0;
        return Math.max(max, dailyChatUsers);
    }, 0);
    const mostActiveDay = data.reduce((a, b) => getTotalEngagedUsers(a) > getTotalEngagedUsers(b) ? a : b);
    return summary
        .addHeading(`Copilot Usage for ${name}<br>${dateFormat(data[0].date)} - ${dateFormat(data[data.length - 1].date)}`)
        .addHeading('Usage Summary')
        .addList([
        `Total Code Suggestions: ${totalCodeSuggestions.toLocaleString()}`,
        `Total Code Acceptances: ${totalCodeAcceptances.toLocaleString()}`,
        `Acceptance Rate: ${((totalCodeAcceptances / totalCodeSuggestions) * 100).toFixed(2)}%`,
        `Total Lines of Code Accepted: ${totalLinesAccepted.toLocaleString()}`,
        `Total Chat Interactions: ${totalChatTurns.toLocaleString()}`,
        `Total Chat Copy Events: ${totalChatCopyEvents.toLocaleString()}`,
        `Total Chat Insertion Events: ${totalChatInsertEvents.toLocaleString()}`,
        `Max Active Chat Users (single day): ${totalActiveChatUsers}`,
        `Most Active Day: ${dateFormat(mostActiveDay.date)} (${getTotalEngagedUsers(mostActiveDay)} active users)`
    ])
        .addRaw(getXyChartAcceptanceRate(data))
        .addRaw(getXyChartDailyActiveUsers(data))
        .addHeading('Language Usage')
        .addRaw(getPieChartLanguageUsage(languageMetrics))
        .addHeading('Editor Usage')
        .addRaw(getPieChartEditorUsage(editorMetrics))
        .addHeading('Chat Usage')
        .addRaw(getPieChartChatEditorUsage(data))
        .addRaw(getBarChartChatVsCodeUsage(data))
        .addRaw(getBarChartChatCopyVsInsert(data))
        .addRaw(getXyChartDailyActiveChatUsers(data))
        .addRaw(getChatModelDistribution(data));
};
export const setJobSummaryTimeZone = (timeZone) => process.env.TZ = timeZone;
//# sourceMappingURL=job-summary.js.map