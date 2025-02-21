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
        `Most Active Day: ${dateFormat(mostActiveDay.date)} (${getTotalEngagedUsers(mostActiveDay)} active users)`
    ])
        .addRaw(getPieChartLanguageUsage(languageMetrics))
        .addHeading('Language Usage')
        .addRaw(getPieChartEditorUsage(editorMetrics))
        .addHeading('Editor Usage');
};
const getTotalEngagedUsers = (day) => {
    return day.copilot_ide_code_completions?.editors?.reduce((sum, editor) => sum + (editor.total_engaged_users ?? 0), 0) || 0;
};
export const setJobSummaryTimeZone = (timeZone) => process.env.TZ = timeZone;
//# sourceMappingURL=job-summary.js.map