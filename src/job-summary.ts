import { summary } from "@actions/core";
import { Endpoints } from "@octokit/types";

type CopilotUsageResponse = Endpoints["GET /orgs/{org}/copilot/metrics"]["response"]["data"];

interface BaseMetrics {
  total_engaged_users: number;
  total_code_acceptances: number;
  total_code_suggestions: number;
  total_code_lines_accepted: number;
  total_code_lines_suggested: number;
}

interface ChartConfig {
  width?: number;
  height?: number;
  title?: string;
}

// Core utility functions
const getEmptyBaseMetrics = (): BaseMetrics => ({
  total_engaged_users: 0,
  total_code_acceptances: 0,
  total_code_suggestions: 0,
  total_code_lines_accepted: 0,
  total_code_lines_suggested: 0
});

const dateFormat = (date: string, options: Intl.DateTimeFormatOptions = {
  month: 'numeric', day: 'numeric'
}): string => {
  options.timeZone = process.env.TZ || 'UTC';
  return new Date(date).toLocaleDateString('en-US', options);
};

// Enhanced data aggregation utilities
export const sumNestedValue = <T extends object>(data: T[], path: string[]): number => {
  return data.reduce((sum, obj) => {
    let result = 0;

    // Helper function to recursively traverse the object/array
    const traverse = (current: object | number | null | undefined | unknown[], pathIndex: number) => {
      // Return if we've reached an invalid path
      if (current === undefined || current === null) return;

      if (pathIndex >= path.length) {
        // We've reached the end of the path, add the value if it's a number
        if (typeof current === 'number') {
          result += current;
        }
        return;
      }

      const key = path[pathIndex];

      if (Array.isArray(current)) {
        // If current is an array, traverse each element
        current.forEach(item => traverse(item, pathIndex));
      } else if (typeof current === 'object') {
        // If current has the key, traverse deeper
        if (key in current) {
          traverse(current[key], pathIndex + 1);
        }
      }
    };

    traverse(obj, 0);
    return sum + result;
  }, 0);
};

const aggregateMetricsBy = (data: CopilotUsageResponse, groupFn: (day: CopilotUsageResponse[0]) => Record<string, BaseMetrics>): Record<string, BaseMetrics> => {
  return data.reduce((acc, day) => {
    const dayMetrics = groupFn(day);
    Object.entries(dayMetrics).forEach(([key, metrics]) => {
      acc[key] = acc[key] || getEmptyBaseMetrics();
      Object.entries(metrics).forEach(([metric, value]) => {
        if (metric === 'total_engaged_users') {
          acc[key][metric] = Math.max(acc[key][metric], value);
        } else {
          acc[key][metric] += value;
        }
      });
    });
    return acc;
  }, {} as Record<string, BaseMetrics>);
};

// Chart generation utilities
const createMermaidChart = (type: 'pie' | 'xychart-beta', config: ChartConfig, content: string) => {
  const chartConfig = `---
config:
    ${type === 'xychart-beta' ? `xyChart:
        width: ${config.width || 900}
        height: ${config.height || 500}
        xAxis:
            labelPadding: 20
        yAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"` : ''}
---
${type}
${config.title ? `  title "${config.title}"` : ''}
${content}`;

  return `\n\`\`\`mermaid\n${chartConfig}\n\`\`\`\n`;
};

const createPieChart = (data: Record<string, number>, limit = 20) => {
  const content = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => `"${label}" : ${value}`)
    .join('\n');

  return createMermaidChart('pie', {}, content);
};

export function generateLegend(categories: string[]): string {
  const colors = ["#3498db", "#2ecc71", "#e74c3c", "#f1c40f", "#bdc3c7", "#ffffff", "#34495e", "#9b59b6", "#1abc9c", "#e67e22"];
  return categories.map((category, i) =>
    `![](https://placehold.co/11x11/${colors[i % colors.length].replace('#', '')}/${colors[i % colors.length]
      .replace('#', '')}.png) ${category}`)
    .join('&nbsp;&nbsp;');
}

const createXYChart = (config: ChartConfig & {
  series: {
    type: 'bar' | 'line',
    category?: string,
    values: number[],
  }[],
  xAxis: {
    title?: string,
    categories: string[],
  },
  yAxis: {
    title?: string,
    min?: number,
    max?: number,
  },
  legend?: string[],
}) => {

  const {
    min, max
  } = config.series.reduce((acc, series) => {
    series.values.forEach(value => {
      if (value < acc.min || acc.min === undefined) acc.min = value;
      if (value > acc.max || acc.max === undefined) acc.max = value;
    });
    return acc;
  }, { min: config.yAxis.min || 0, max: config.yAxis.max || 100 });

  return createMermaidChart('xychart-beta', config,
    `  x-axis ${config.xAxis.title ? "\"" + config.xAxis.title + "\"" : ''} [${config.xAxis.categories.join(', ')}]\n` +
    `  y-axis ${config.yAxis.title ? "\"" + config.yAxis.title + "\"" : ''} ${min || 0} --> ${max || 100}\n` +
    config.series.map(series => {
      return `${series.type} ${series.category ? "\"" + series.category + "\"" : ''} [${series.values.join(', ')}]`;
    }).join('\n')) + (config.legend ? `\n${generateLegend(config.legend)}` : '');
};

const groupLanguageMetrics = (day: CopilotUsageResponse[0]): Record<string, BaseMetrics> => {
  const metrics: Record<string, BaseMetrics> = {};

  day.copilot_ide_code_completions?.editors?.forEach(editor => {
    editor.models?.forEach(model => {
      model.languages?.forEach(lang => {
        const language = lang.name || 'unknown';
        metrics[language] = metrics[language] || getEmptyBaseMetrics();
        Object.entries(lang).forEach(([key, value]) => {
          if (key in metrics[language] && typeof value === 'number') {
            metrics[language][key as keyof BaseMetrics] += value;
          }
        });
      });
    });
  });

  return metrics;
};

const groupEditorMetrics = (day: CopilotUsageResponse[0]): Record<string, BaseMetrics> => {
  const metrics: Record<string, BaseMetrics> = {};

  day.copilot_ide_code_completions?.editors?.forEach(editor => {
    const editorName = editor.name || 'unknown';
    metrics[editorName] = metrics[editorName] || getEmptyBaseMetrics();
    metrics[editorName].total_engaged_users = editor.total_engaged_users || 0;

    editor.models?.forEach(model => {
      model.languages?.forEach(lang => {
        Object.entries(lang).forEach(([key, value]) => {
          if (key in metrics[editorName] && typeof value === 'number') {
            metrics[editorName][key as keyof BaseMetrics] += value;
          }
        });
      });
    });
  });

  return metrics;
};

// const groupModelMetrics = (day: CopilotUsageResponse[0]): Record<string, BaseMetrics> => {
//   const metrics: Record<string, BaseMetrics> = {};
//   day.copilot_ide_code_completions?.editors?.forEach(editor => {
//     editor.models?.forEach(model => {
//       const modelName = model.name || 'unknown';
//       metrics[modelName] = metrics[modelName] || getEmptyBaseMetrics();
//       Object.entries(model).forEach(([key, value]) => {
//         if (key in metrics[modelName] && typeof value === 'number') {
//           metrics[modelName][key as keyof BaseMetrics] += value;
//         }
//       });
//     });
//   });
//   return metrics;
// };

const getChatMetrics = (data: CopilotUsageResponse) => ({
  // Update paths to match the actual data structure
  totalChats: sumNestedValue(data, ['copilot_ide_chat', 'total_engaged_users']),
  totalCopyEvents: sumNestedValue(data, ['copilot_ide_chat', 'editors', 'total_engaged_users']),
  totalInsertEvents: sumNestedValue(data, ['copilot_ide_chat', 'editors', 'total_engaged_users'])
});

export const createJobSummaryUsage = (data: CopilotUsageResponse, name: string) => {
  const languageMetrics = aggregateMetricsBy(data, groupLanguageMetrics);
  const editorMetrics = aggregateMetricsBy(data, groupEditorMetrics);
  // const modelMetrics = aggregateMetricsBy(data, groupModelMetrics);
  const chatMetrics = getChatMetrics(data);
  const dailyTotals = data.map(day => ({
    date: day.date,
    total_active_users: day.total_active_users || 0,
    total_engaged_users: day.total_engaged_users || 0,
    total_code_acceptances: sumNestedValue([day], ['copilot_ide_code_completions', 'editors', 'models', 'languages', 'total_code_acceptances']),
    total_code_suggestions: sumNestedValue([day], ['copilot_ide_code_completions', 'editors', 'models', 'languages', 'total_code_suggestions']),
    total_code_lines_accepted: sumNestedValue([day], ['copilot_ide_code_completions', 'editors', 'models', 'languages', 'total_code_lines_accepted']),
    total_code_lines_suggested: sumNestedValue([day], ['copilot_ide_code_completions', 'editors', 'models', 'languages', 'total_code_lines_suggested']),
    total_chats: sumNestedValue([day], ['copilot_ide_chat', 'editors', 'models', 'total_chats']),
    total_chat_copy_events: sumNestedValue([day], ['copilot_ide_chat', 'editors', 'models', 'total_chat_copy_events']),
    total_chat_insert_events: sumNestedValue([day], ['copilot_ide_chat', 'editors', 'models', 'total_chat_insertion_events']),
    total_dotcom_chat_chats: sumNestedValue([day], ['copilot_dotcom_chat', 'models', 'total_chats']),
    total_dotcom_pr_summaries_created: sumNestedValue([day], ['copilot_dotcom_pull_requests', 'repositories', 'models', 'total_pr_summaries_created']),
  }));

  console.log(dailyTotals)

  const topLanguages = Object.entries(languageMetrics)
    .sort((a, b) => b[1].total_code_suggestions - a[1].total_code_suggestions)
    .slice(0, 5)
    .map(([lang]) => lang);

  const totalMetrics = Object.values(languageMetrics).reduce((acc, curr) => ({
    totalCodeAcceptances: acc.totalCodeAcceptances + curr.total_code_acceptances,
    totalCodeSuggestions: acc.totalCodeSuggestions + curr.total_code_suggestions,
    totalLinesAccepted: acc.totalLinesAccepted + curr.total_code_lines_accepted
  }), { totalCodeAcceptances: 0, totalCodeSuggestions: 0, totalLinesAccepted: 0 });

  return summary
    .addHeading(`Copilot Usage for ${name}<br>${dateFormat(data[0].date)} - ${dateFormat(data[data.length - 1].date)}`)
    .addRaw(`Metrics for the last ${data.length} days`)
    .addHeading('Totals', 2)
    .addTable([
      ['Code Suggestions', totalMetrics.totalCodeSuggestions.toLocaleString()],
      ['Code Acceptances', totalMetrics.totalCodeAcceptances.toLocaleString()],
      ['Acceptance Rate', `${((totalMetrics.totalCodeAcceptances / totalMetrics.totalCodeSuggestions) * 100).toFixed(2)}%`],
      ['Lines of Code Accepted', totalMetrics.totalLinesAccepted.toLocaleString()],
      ['Chat Interactions', chatMetrics.totalChats.toLocaleString()],
      ['Chat Copy Events', chatMetrics.totalCopyEvents.toLocaleString()],
      ['Chat Insertion Events', chatMetrics.totalInsertEvents.toLocaleString()]
    ])
    .addHeading('Daily Engaged Users', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
      },
      series: [
        {
          type: 'bar',
          values: data.map(day => day.total_active_users || 0)
        },
        {
          type: 'bar',
          values: data.map(day => day.total_engaged_users || 0)
        },
      ],
      legend: ['Active', 'Engaged']
    }))
    .addHeading('Daily Engaged Users by Product', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
      },
      series: [
        {
          type: 'line',
          values: data.map(day => sumNestedValue([day], ['copilot_ide_code_completions', 'total_engaged_users']))
        },
        {
          type: 'line',
          values: data.map(day => sumNestedValue([day], ['copilot_ide_chat', 'total_engaged_users']))
        },
        {
          type: 'line',
          values: data.map(day => sumNestedValue([day], ['copilot_dotcom_chat', 'total_engaged_users']))
        },
        {
          type: 'line',
          values: data.map(day => sumNestedValue([day], ['copilot_dotcom_pull_requests', 'total_engaged_users']))
        }
      ],
      legend: ['IDE Code Completions', 'IDE Chat', 'Dotcom Chat', 'Dotcom Pull Requests']
    }))
    .addHeading('IDE Completion', 2)
    .addHeading('Suggestions vs. Acceptances', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
      },
      series: [
        {
          type: 'bar',
          values: dailyTotals.map(day => day.total_code_suggestions || 0)
        },
        {
          type: 'bar',
          values: dailyTotals.map(day => day.total_code_acceptances || 0)
        },
      ],
      legend: ['Suggestions', 'Acceptances']
    }))
    .addHeading('Lines Suggested vs. Accepted', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
      },
      series: [
        {
          type: 'bar',
          values: dailyTotals.map(day => day.total_code_lines_suggested || 0)
        },
        {
          type: 'bar',
          values: dailyTotals.map(day => day.total_code_lines_accepted || 0)
        },
      ],
      legend: ['Suggestions', 'Acceptances']
    }))
    .addHeading('Acceptance Rate', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
        min: 0,
        max: 100
      },
      series: [
        {
          type: 'line',
          values: data.map(day => {
            const acceptances = sumNestedValue([day], ['copilot_ide_code_completions', 'editors', 'models', 'languages', 'total_code_acceptances']);
            const suggestions = sumNestedValue([day], ['copilot_ide_code_completions', 'editors', 'models', 'languages', 'total_code_suggestions']);
            return suggestions > 0 ? Math.round((acceptances / suggestions) * 100) : 0;
          })
        }
      ]
    }))
    .addHeading('Acceptance Rate by Language', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
        min: 0,
        max: 100
      },
      series: topLanguages.map(language => ({
        type: 'line',
        values: data.map(day => {
          let acceptances = 0;
          let suggestions = 0;

          day.copilot_ide_code_completions?.editors?.forEach(editor => {
            editor.models?.forEach(model => {
              model.languages?.forEach(lang => {
                if (lang.name === language) {
                  acceptances += lang.total_code_acceptances || 0;
                  suggestions += lang.total_code_suggestions || 0;
                }
              });
            });
          });

          return suggestions > 0 ? Math.round((acceptances / suggestions) * 100) : 0;
        })
      })),
      legend: topLanguages
    }))
    .addHeading('Language Usage by Engaged Users', 3)
    .addRaw(createPieChart(Object.fromEntries(Object.entries(languageMetrics)
      .map(([lang, metrics]) => [lang, metrics.total_engaged_users]))
    ))
    .addHeading('Editor Usage by Engaged Users', 3)
    .addRaw(createPieChart(Object.fromEntries(Object.entries(editorMetrics)
      .map(([editor, metrics]) => [editor, metrics.total_engaged_users]))
    ))
    // .addHeading('Model Usage')
    // .addRaw(createPieChart(Object.fromEntries(Object.entries(modelMetrics)
    //     .map(([model, metrics]) => [model, metrics.total_engaged_users]))
    // ))
    .addHeading('IDE Copilot Chat', 2)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
      },
      series: [
        {
          type: 'bar',
          values: dailyTotals.map(day => day.total_chats || 0)
        },
        {
          type: 'line',
          values: dailyTotals.map(day => day.total_chat_copy_events || 0)
        },
        {
          type: 'line',
          values: dailyTotals.map(day => day.total_chat_insert_events || 0)
        },
      ],
      legend: ['Total Chats', 'Copy Events', 'Insert Events']
    }))
    .addHeading('Copilot .COM Chat', 2)
    .addHeading('Total Chats', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
      },
      series: [
        {
          type: 'bar',
          values: dailyTotals.map(day => day.total_dotcom_chat_chats || 0)
        }
      ],
      legend: ['Total Chats']
    }))
    .addHeading('Copilot .COM Pull Request', 2)
    .addHeading('Summaries Created', 3)
    .addRaw(createXYChart({
      height: 400,
      xAxis: {
        categories: data.map(day => dateFormat(day.date, { day: 'numeric' }))
      },
      yAxis: {
      },
      series: [
        {
          type: 'bar',
          values: dailyTotals.map(day => day.total_dotcom_pr_summaries_created || 0)
        }
      ],
      legend: ['Total PR Summaries Created']
    }))
};

export const setJobSummaryTimeZone = (timeZone: string) => process.env.TZ = timeZone;
