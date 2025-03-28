import { summary } from "@actions/core";
const getEmptyBaseMetrics = () => ({
    total_engaged_users: 0,
    total_code_acceptances: 0,
    total_code_suggestions: 0,
    total_code_lines_accepted: 0,
    total_code_lines_suggested: 0
});
const dateFormat = (date, options = {
    month: 'numeric', day: 'numeric', year: 'numeric'
}) => {
    options.timeZone = process.env.TZ || 'UTC';
    return new Date(date).toLocaleDateString('en-US', options);
};
const sumNestedValue = (data, path) => {
    return data.reduce((sum, obj) => {
        let current = obj;
        for (const key of path) {
            if (!current?.[key])
                return sum;
            current = current[key];
        }
        return sum + (typeof current === 'number' ? current : 0);
    }, 0);
};
const aggregateMetricsBy = (data, groupFn) => {
    return data.reduce((acc, day) => {
        const dayMetrics = groupFn(day);
        Object.entries(dayMetrics).forEach(([key, metrics]) => {
            acc[key] = acc[key] || getEmptyBaseMetrics();
            Object.entries(metrics).forEach(([metric, value]) => {
                if (metric === 'total_engaged_users') {
                    acc[key][metric] = Math.max(acc[key][metric], value);
                }
                else {
                    acc[key][metric] += value;
                }
            });
        });
        return acc;
    }, {});
};
const createMermaidChart = (type, config, content) => {
    const chartConfig = `---
config:
    ${type === 'xychart-beta' ? `xyChart:
        width: ${config.width || 500}
        height: ${config.height || 400}
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"` : ''}
---
${type}
  title "${config.title}"
${content}`;
    return `\n\`\`\`mermaid\n${chartConfig}\n\`\`\`\n`;
};
const createPieChart = (title, data, limit = 20) => {
    const content = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, value]) => `"${label}" : ${value}`)
        .join('\n');
    return createMermaidChart('pie', { title }, content);
};
const createTimeSeriesChart = (config) => {
    const dates = config.data.map(d => `"${dateFormat(d.date, { month: '2-digit', day: '2-digit' })}"`);
    const maxValue = Math.max(...config.data.flatMap(d => d.values)) + 10;
    const series = config.data[0].values.map((_, i) => {
        const type = config.types?.[i] || 'line';
        const values = config.data.map(d => d.values[i]);
        return `${type} [${values.join(', ')}]`;
    });
    return createMermaidChart('xychart-beta', config, `  x-axis [${dates.join(', ')}]\n` +
        `  y-axis "${config.labels[0]}" 0 --> ${maxValue}\n` +
        series.join('\n'));
};
const groupLanguageMetrics = (day) => {
    const metrics = {};
    day.copilot_ide_code_completions?.editors?.forEach(editor => {
        editor.models?.forEach(model => {
            model.languages?.forEach(lang => {
                const language = lang.name || 'unknown';
                metrics[language] = metrics[language] || getEmptyBaseMetrics();
                Object.entries(lang).forEach(([key, value]) => {
                    if (key in metrics[language] && typeof value === 'number') {
                        metrics[language][key] += value;
                    }
                });
            });
        });
    });
    return metrics;
};
const groupEditorMetrics = (day) => {
    const metrics = {};
    day.copilot_ide_code_completions?.editors?.forEach(editor => {
        const editorName = editor.name || 'unknown';
        metrics[editorName] = metrics[editorName] || getEmptyBaseMetrics();
        metrics[editorName].total_engaged_users = editor.total_engaged_users || 0;
        editor.models?.forEach(model => {
            model.languages?.forEach(lang => {
                Object.entries(lang).forEach(([key, value]) => {
                    if (key in metrics[editorName] && typeof value === 'number') {
                        metrics[editorName][key] += value;
                    }
                });
            });
        });
    });
    return metrics;
};
const getChatMetrics = (data) => ({
    totalChats: sumNestedValue(data, ['copilot_ide_chat', 'editors', 'models', 'total_chats']),
    totalCopyEvents: sumNestedValue(data, ['copilot_ide_chat', 'editors', 'models', 'total_chat_copy_events']),
    totalInsertEvents: sumNestedValue(data, ['copilot_ide_chat', 'editors', 'models', 'total_chat_insertion_events'])
});
const getDailyChatMetrics = (data) => data.map(day => ({
    date: day.date,
    copyEvents: sumNestedValue([day], ['copilot_ide_chat', 'editors', 'models', 'total_chat_copy_events']),
    insertEvents: sumNestedValue([day], ['copilot_ide_chat', 'editors', 'models', 'total_chat_insertion_events'])
}));
export const createJobSummaryUsage = (data, name) => {
    const languageMetrics = aggregateMetricsBy(data, groupLanguageMetrics);
    const editorMetrics = aggregateMetricsBy(data, groupEditorMetrics);
    const chatMetrics = getChatMetrics(data);
    const totalMetrics = Object.values(languageMetrics).reduce((acc, curr) => ({
        totalCodeAcceptances: acc.totalCodeAcceptances + curr.total_code_acceptances,
        totalCodeSuggestions: acc.totalCodeSuggestions + curr.total_code_suggestions,
        totalLinesAccepted: acc.totalLinesAccepted + curr.total_code_lines_accepted
    }), { totalCodeAcceptances: 0, totalCodeSuggestions: 0, totalLinesAccepted: 0 });
    const dailyMetrics = data.map(day => ({
        date: day.date,
        values: [
            sumNestedValue([day], ['copilot_ide_code_completions', 'editors', 'models', 'languages', 'total_code_acceptances']),
            sumNestedValue([day], ['copilot_ide_chat', 'editors', 'total_engaged_users'])
        ]
    }));
    return summary
        .addHeading(`Copilot Usage for ${name}<br>${dateFormat(data[0].date)} - ${dateFormat(data[data.length - 1].date)}`)
        .addHeading('Usage Summary')
        .addList([
        `Total Code Suggestions: ${totalMetrics.totalCodeSuggestions.toLocaleString()}`,
        `Total Code Acceptances: ${totalMetrics.totalCodeAcceptances.toLocaleString()}`,
        `Acceptance Rate: ${((totalMetrics.totalCodeAcceptances / totalMetrics.totalCodeSuggestions) * 100).toFixed(2)}%`,
        `Total Lines of Code Accepted: ${totalMetrics.totalLinesAccepted.toLocaleString()}`,
        `Total Chat Interactions: ${chatMetrics.totalChats.toLocaleString()}`,
        `Total Chat Copy Events: ${chatMetrics.totalCopyEvents.toLocaleString()}`,
        `Total Chat Insertion Events: ${chatMetrics.totalInsertEvents.toLocaleString()}`
    ])
        .addRaw(createTimeSeriesChart({
        title: 'Daily Activity',
        height: 400,
        data: dailyMetrics,
        labels: ['Count'],
        types: ['bar', 'line']
    }))
        .addHeading('Language Usage')
        .addRaw(createPieChart('Language Usage', Object.fromEntries(Object.entries(languageMetrics)
        .map(([lang, metrics]) => [lang, metrics.total_code_suggestions]))))
        .addHeading('Editor Usage')
        .addRaw(createPieChart('Editor Usage', Object.fromEntries(Object.entries(editorMetrics)
        .map(([editor, metrics]) => [editor, metrics.total_code_suggestions]))))
        .addHeading('Chat Activity')
        .addRaw(createTimeSeriesChart({
        title: 'Chat Copy vs Insertion Events',
        height: 400,
        data: getDailyChatMetrics(data).map(m => ({
            date: m.date,
            values: [m.copyEvents, m.insertEvents]
        })),
        labels: ['Events'],
        types: ['bar', 'line']
    }));
};
export const setJobSummaryTimeZone = (timeZone) => process.env.TZ = timeZone;
//# sourceMappingURL=job-summary.js.map