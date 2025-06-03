import { Endpoints } from "@octokit/types";
import { dateFormat } from "./utility";

interface ChartConfig {
  width?: number;
  height?: number;
  title?: string;
}

export const createMermaidChart = (type: 'pie' | 'xychart-beta', config: ChartConfig, content: string) => {
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

export const createPieChart = (data: Record<string, number>, limit = 20) => {
  const content = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => `"${label}" : ${value}`)
    .join('\n');

  return createMermaidChart('pie', {}, content);
};

export const createXYChart = (config: ChartConfig & {
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

export function generateLegend(categories: string[]): string {
  const colors = ["#3498db", "#2ecc71", "#e74c3c", "#f1c40f", "#bdc3c7", "#ffffff", "#34495e", "#9b59b6", "#1abc9c", "#e67e22"];
  return categories.map((category, i) =>
    `![](https://placehold.co/11x11/${colors[i % colors.length].replace('#', '')}/${colors[i % colors.length]
      .replace('#', '')}.png) ${category}`)
    .join('&nbsp;&nbsp;');
}

const DEFAULT_CHART_HEIGHT = 400;
export const DEFAULT_CHART_CONFIGS = {
  standardHeight: { height: DEFAULT_CHART_HEIGHT },
  dailyCategories: (data: Endpoints["GET /orgs/{org}/copilot/metrics"]["response"]["data"]) => 
    data.map(day => dateFormat(day.date, { day: 'numeric' })),
} as const;
