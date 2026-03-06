/**
 * GA reporter: per-generation summaries written as JSON and Markdown.
 */

import { join } from 'node:path';
import { writeJson, writeMarkdown } from '../io.ts';
import type { GaGenerationReport, GaSearchResult } from './types.ts';



function float(value: number) {
  return value.toFixed(6);
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Per-generation report
// ---------------------------------------------------------------------------

export function renderGenerationMarkdown(report: GaGenerationReport): string {
  return `## 🧬 Generation ${report.generation}

| Metric | Value |
|--------|-------|
| Population size | ${report.populationSize} |
| Best fitness | ${float(report.stats.bestFitness)} |
| Worst fitness | ${float(report.stats.worstFitness)} |
| Mean fitness | ${float(report.stats.meanFitness)} |
| Median fitness | ${float(report.stats.medianFitness)} |
| Elite preserved | ${report.elitismCount} |
| Best individual | ${report.bestIndividualId} |

**Best genome:**
\`\`\`json
${JSON.stringify(report.bestGenome, null, 2)}
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Full GA run summary
// ---------------------------------------------------------------------------

export function renderGaSummaryMarkdown(result: GaSearchResult): string {
  const generationRows = result.generationReports
    .map((report) => `| ${report.generation} | ${float(report.stats.bestFitness)} | ${float(report.stats.meanFitness)} | ${report.bestIndividualId} |`)
    .join('\n');

  const candidateRows = result.topCandidates
    .map((candidate, index) => `| ${index + 1} | ${candidate.candidateId} | ${candidate.strategy} | ${candidate.patch.note ?? ''} |`)
    .join('\n');

  return `# 🧬 GA Evolutionary Search Report

- Scenario: ${result.scenarioId}
- Generations completed: ${result.generationsCompleted}
- Best fitness achieved: ${float(result.bestFitness)}
- Top candidates promoted: ${result.topCandidates.length}

## Generation Progress

| Gen | Best Fitness | Mean Fitness | Best Individual |
|-----|-------------|-------------|-----------------|
${generationRows}

## Top Candidates Promoted to A/B Validation

| Rank | Candidate ID | Strategy | Note |
|------|-------------|----------|------|
${candidateRows}
`;
}

// ---------------------------------------------------------------------------
// File writers
// ---------------------------------------------------------------------------

export async function writeGenerationReport(outDir: string, report: GaGenerationReport): Promise<void> {
  const filename = `generation_${pad2(report.generation)}`;
  await writeJson(join(outDir, `${filename}.json`), report);
  await writeMarkdown(join(outDir, `${filename}.md`), renderGenerationMarkdown(report));
}

export async function writeGaReport(outDir: string, result: GaSearchResult): Promise<void> {
  await writeJson(join(outDir, 'ga_search_result.json'), result);
  await writeMarkdown(join(outDir, 'ga_search_summary.md'), renderGaSummaryMarkdown(result));
}
