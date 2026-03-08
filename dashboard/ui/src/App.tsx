import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BookMarked,
  Gauge,
  GitBranch,
  HelpCircle,
  Info,
  Layers,
  PieChart as PieChartIcon,
  Radar,
  Target,
  Workflow,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

type OverviewPayload = {
  summary: any;
  scenarios: any[];
  strategies: any[];
  optimizerStatus: any[];
  parallelRuns: any[];
};

type ScenarioPayload = {
  scenarioId: string;
  summary: any;
  optimizer: any;
  trajectory: any;
};

type ComparisonPayload = {
  scenarioId: string;
  leftRun: any;
  rightRun: any;
  metricDiff: any;
  defeatDiff: any[];
  actionDiff: any[];
  recommendedPatchDiff: any[];
};

type BaselineOverviewPayload = {
  runs: any[];
  latest: any;
};

type BaselineHistoryPayload = {
  scenarioId: string;
  summary: any;
  runs: any[];
};

type RunScope =
  | 'latest_single'
  | 'latest_parallel'
  | 'all_single'
  | 'all_parallel'
  | 'all_runs'
  | 'specific_run';

const RUN_SCOPE_OPTIONS: Array<{ value: RunScope; label: string }> = [
  { value: 'latest_single', label: 'Latest Single Run' },
  { value: 'latest_parallel', label: 'Latest Parallel Run' },
  { value: 'all_single', label: 'All Single Runs' },
  { value: 'all_parallel', label: 'All Parallel Runs' },
  { value: 'all_runs', label: 'All Runs' },
  { value: 'specific_run', label: 'Specific Run' },
];

const LEVELS = [
  { id: 'overview', label: 'Global Overview', icon: Activity },
  { id: 'balance', label: 'Scenario Balance', icon: Target },
  { id: 'optimizer', label: 'Optimizer Progress', icon: GitBranch },
  { id: 'parameters', label: 'Parameter Effects', icon: Gauge },
  { id: 'baselines', label: 'Baselines', icon: Layers },
  { id: 'actions', label: 'Action Diversity', icon: PieChartIcon },
  { id: 'comparison', label: 'Run Comparison', icon: ArrowLeftRight },
  { id: 'trajectories', label: 'Gameplay Trajectories', icon: Workflow },
  { id: 'recommendations', label: 'Recommendations', icon: BookMarked },
] as const;

const CORE_ACTION_KEYS = [
  'organize',
  'investigate',
  'launchCampaign',
  'buildSolidarity',
  'smuggleEvidence',
  'internationalOutreach',
  'defend',
] as const;

const ACTION_LABELS: Record<(typeof CORE_ACTION_KEYS)[number], string> = {
  organize: 'Organize',
  investigate: 'Investigate',
  launchCampaign: 'Launch Campaign',
  buildSolidarity: 'Build Solidarity',
  smuggleEvidence: 'Smuggle Evidence',
  internationalOutreach: 'International Outreach',
  defend: 'Defend',
};

const COLORS = {
  ink: '#0f172a',
  slate: '#475569',
  muted: '#94a3b8',
  line: '#d6dde6',
  surface: '#fffdf8',
  surfaceStrong: '#fff8ed',
  border: '#d9d0bf',
  accent: '#bc5b31',
  accentSoft: '#f1b58a',
  green: '#1b7f5c',
  gold: '#d49a22',
  red: '#b84545',
  blue: '#2f6f97',
  brown: '#7f5b3b',
};

const pct = (value?: number) => `${((value || 0) * 100).toFixed(1)}%`;
const num = (value?: number) => (value || 0).toFixed(2);
const titleCase = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

function compactRunLabel(label?: string): string {
  if (!label) return 'Run';
  const compact = label.replace(/^Parallel /, 'P ').replace(/^Single /, 'S ');
  const matched = compact.match(/^([PS]) (\d{8}T\d{6}Z)_.*?(\d{4,})$/);
  if (matched) {
    return `${matched[1]} ${matched[2]}…${matched[3].slice(-4)}`;
  }
  return compact.length > 22 ? `${compact.slice(0, 14)}…${compact.slice(-6)}` : compact;
}

function compactIdentifier(value?: string): string {
  if (!value) return 'n/a';
  return value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-6)}` : value;
}

function readUrlState(): {
  level?: (typeof LEVELS)[number]['id'];
  scenario?: string;
  scope?: RunScope;
  runKey?: string;
} {
  const params = new URLSearchParams(window.location.search);
  const level = params.get('level');
  const scenario = params.get('scenario');
  const scope = params.get('scope');
  const runKey = params.get('runKey');

  return {
    level: LEVELS.some((item) => item.id === level) ? (level as (typeof LEVELS)[number]['id']) : undefined,
    scenario: scenario || undefined,
    scope: RUN_SCOPE_OPTIONS.some((item) => item.value === scope) ? (scope as RunScope) : undefined,
    runKey: runKey || undefined,
  };
}

function App() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar-EG';
  const initialUrlState = readUrlState();
  const [activeLevel, setActiveLevel] = useState<(typeof LEVELS)[number]['id']>(initialUrlState.level || 'overview');
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedScenario, setSelectedScenario] = useState(initialUrlState.scenario || '');
  const [runScope, setRunScope] = useState<RunScope>(initialUrlState.scope || 'latest_single');
  const [selectedRunKey, setSelectedRunKey] = useState(initialUrlState.runKey || '');
  const [selectedOptimizerIteration, setSelectedOptimizerIteration] = useState<number | 'all'>('all');
  const [trajectoryOutcomeFilter, setTrajectoryOutcomeFilter] = useState<'all' | 'victory' | 'defeat'>('all');
  const [trajectoryPlayerCountFilter, setTrajectoryPlayerCountFilter] = useState<'all' | number>('all');
  const [scenarioData, setScenarioData] = useState<ScenarioPayload | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonPayload | null>(null);
  const [baselineOverview, setBaselineOverview] = useState<BaselineOverviewPayload | null>(null);
  const [baselineHistory, setBaselineHistory] = useState<BaselineHistoryPayload | null>(null);
  const [comparisonLeftRunKey, setComparisonLeftRunKey] = useState('');
  const [comparisonRightRunKey, setComparisonRightRunKey] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const scenarioOptions = overview?.scenarios || [];
  const summary = overview?.summary;
  const currentScenario = scenarioData?.summary;
  const optimizer = scenarioData?.optimizer;
  const trajectory = scenarioData?.trajectory;
  const iterations = optimizer?.iterations || [];
  const runCatalog = optimizer?.selection?.runCatalog || [];
  const runSelectionLabel = optimizer?.selection?.label || 'No run scope selected';
  const recommendedConfig = optimizer?.recommendedConfig || null;
  const recommendedConfigs = optimizer?.recommendedConfigs || [];
  const allRunRecommendations = optimizer?.allRunRecommendations || [];

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const response = await axios.get<OverviewPayload>(`${API_URL}/api/overview`);
        setOverview(response.data);
        if (!selectedScenario && response.data.scenarios.length > 0) {
          setSelectedScenario(response.data.scenarios[0].scenarioId);
        }
      } catch (error) {
        console.error('🚨 Failed to load overview payload', error);
      } finally {
        setLoadingOverview(false);
      }
    };
    void fetchOverview();
  }, []);

  useEffect(() => {
    const fetchBaselineOverview = async () => {
      try {
        const response = await axios.get<BaselineOverviewPayload>(`${API_URL}/api/baselines/overview`);
        setBaselineOverview(response.data);
      } catch (error) {
        console.error('🚨 Failed to load baseline overview payload', error);
      }
    };
    void fetchBaselineOverview();
  }, []);

  useEffect(() => {
    if (!scenarioOptions.length) return;
    const validScenarioIds = new Set(scenarioOptions.map((scenario) => scenario.scenarioId));
    if (!selectedScenario || (!validScenarioIds.has(selectedScenario) && selectedScenario !== 'all')) {
      setSelectedScenario(scenarioOptions[0].scenarioId);
    }
  }, [scenarioOptions, selectedScenario]);

  useEffect(() => {
    if (!selectedScenario) return;
    if (runScope === 'specific_run' && !selectedRunKey) {
      return;
    }
    const fetchScenario = async () => {
      setLoadingScenario(true);
      try {
        const params: Record<string, string> = { scope: runScope };
        if (runScope === 'specific_run' && selectedRunKey) {
          params.runKey = selectedRunKey;
        }
        const response = await axios.get<ScenarioPayload>(`${API_URL}/api/scenarios/${selectedScenario}/analysis`, { params });
        setScenarioData(response.data);
        if (runScope === 'specific_run' && !selectedRunKey) {
          const firstRunKey = response.data.optimizer?.selection?.runCatalog?.[0]?.runKey || '';
          if (firstRunKey) {
            setSelectedRunKey(firstRunKey);
          }
        }
      } catch (error) {
        console.error('🚨 Failed to load scenario analysis payload', error);
      } finally {
        setLoadingScenario(false);
      }
    };
    void fetchScenario();
  }, [selectedScenario, runScope, selectedRunKey]);

  useEffect(() => {
    if (!selectedScenario || selectedScenario === 'all') {
      setBaselineHistory(null);
      return;
    }
    const fetchBaselineHistory = async () => {
      try {
        const response = await axios.get<BaselineHistoryPayload>(`${API_URL}/api/baselines/${selectedScenario}/history`);
        setBaselineHistory(response.data);
      } catch (error) {
        console.error('🚨 Failed to load baseline history payload', error);
      }
    };
    void fetchBaselineHistory();
  }, [selectedScenario]);

  useEffect(() => {
    if (runScope !== 'specific_run') return;
    if (selectedRunKey) return;
    const firstRunKey = runCatalog[0]?.runKey || '';
    if (firstRunKey) {
      setSelectedRunKey(firstRunKey);
    }
  }, [runScope, selectedRunKey, runCatalog]);

  useEffect(() => {
    setSelectedRunKey('');
    setScenarioData(null);
    setSelectedOptimizerIteration('all');
    setTrajectoryOutcomeFilter('all');
    setTrajectoryPlayerCountFilter('all');
    setComparisonData(null);
    setComparisonLeftRunKey('');
    setComparisonRightRunKey('');
  }, [selectedScenario]);

  useEffect(() => {
    const availableIterations = Array.from(
      new Set((optimizer?.iterations || []).map((item: any) => item.iteration).filter(Boolean)),
    ).sort((a: any, b: any) => a - b);

    if (!availableIterations.length) {
      setSelectedOptimizerIteration('all');
      return;
    }

    if (
      selectedOptimizerIteration !== 'all' &&
      !availableIterations.includes(selectedOptimizerIteration)
    ) {
      setSelectedOptimizerIteration(availableIterations[availableIterations.length - 1] as any);
    }

    if (selectedOptimizerIteration === 'all' && availableIterations.length === 1) {
      setSelectedOptimizerIteration(availableIterations[0] as any);
    }
  }, [optimizer, selectedOptimizerIteration]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('level', activeLevel);
    if (selectedScenario) {
      params.set('scenario', selectedScenario);
    } else {
      params.delete('scenario');
    }
    params.set('scope', runScope);
    if (runScope === 'specific_run' && selectedRunKey) {
      params.set('runKey', selectedRunKey);
    } else {
      params.delete('runKey');
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', nextUrl);
  }, [activeLevel, selectedScenario, runScope, selectedRunKey]);

  useEffect(() => {
    if (activeLevel !== 'comparison') return;
    if (runCatalog.length < 2) return;
    if (!comparisonLeftRunKey) {
      setComparisonLeftRunKey(runCatalog[0].runKey);
    }
    if (!comparisonRightRunKey) {
      const fallback = runCatalog.find((run: any) => run.runKey !== runCatalog[0].runKey);
      if (fallback) {
        setComparisonRightRunKey(fallback.runKey);
      }
    }
  }, [activeLevel, runCatalog, comparisonLeftRunKey, comparisonRightRunKey]);

  useEffect(() => {
    if (activeLevel !== 'comparison') return;
    if (!selectedScenario || !comparisonLeftRunKey || !comparisonRightRunKey) return;
    if (comparisonLeftRunKey === comparisonRightRunKey) return;

    const fetchComparison = async () => {
      setLoadingComparison(true);
      try {
        const response = await axios.get<ComparisonPayload>(
          `${API_URL}/api/scenarios/${selectedScenario}/compare`,
          {
            params: {
              leftRunKey: comparisonLeftRunKey,
              rightRunKey: comparisonRightRunKey,
            },
          },
        );
        setComparisonData(response.data);
      } catch (error) {
        console.error('🚨 Failed to load run comparison payload', error);
      } finally {
        setLoadingComparison(false);
      }
    };
    void fetchComparison();
  }, [activeLevel, selectedScenario, comparisonLeftRunKey, comparisonRightRunKey]);

  const globalScenarioRows = useMemo(
    () =>
      scenarioOptions.map((scenario) => ({
        scenario: titleCase(scenario.scenarioId),
        successRate: +(scenario.successRate * 100).toFixed(2),
        campaignSuccessRate: +(scenario.campaignSuccessRate * 100).toFixed(2),
        averageTurns: +num(scenario.averageTurns),
        optimizerSuccessRate: +(
          ((scenario.optimizer?.singleLatest?.successRate || 0) * 100)
        ).toFixed(2),
      })),
    [scenarioOptions],
  );

  const scenarioBalanceRows = useMemo(() => {
    const byPlayerCount = optimizer?.finalMetrics?.metrics?.byPlayerCount || {};
    return Object.values(byPlayerCount).map((item: any) => ({
      playerCount: `${item.playerCount}P`,
      successRate: +(item.successRate * 100).toFixed(2),
      publicVictoryRate: +(item.publicVictoryRate * 100).toFixed(2),
      earlyTerminationRate: +(item.earlyTerminationRate * 100).toFixed(2),
      comrades: +((item.defeatRates?.comrades_exhausted || 0) * 100).toFixed(2),
      extraction: +((item.defeatRates?.extraction_breach || 0) * 100).toFixed(2),
      suddenDeath: +((item.defeatRates?.sudden_death || 0) * 100).toFixed(2),
    }));
  }, [optimizer]);

  const iterationTrendRows = useMemo(
    () =>
      iterations.map((item: any) => ({
        iteration: item.iteration,
        label: `${compactRunLabel(item.runLabel)} · I${item.iteration}`,
        runLabel: item.runLabel,
        baselineSuccessRate: +((item.baselineMetrics?.successRate || 0) * 100).toFixed(2),
        baselinePublicVictoryRate: +(
          (item.baselineMetrics?.publicVictoryRate || 0) * 100
        ).toFixed(2),
        baselineAvgTurns: +(item.baselineMetrics?.turns?.average || 0).toFixed(2),
        selectedSuccessRate: +(((item.selectedCandidate?.successRate || 0) * 100).toFixed(2)),
        selectedAvgTurns: +(item.selectedCandidate?.averageTurns || 0).toFixed(2),
        selectedFitness: +(item.selectedCandidate?.score || 0).toFixed(3),
        noImprovementStreak: item.noImprovementStreak || 0,
      })),
    [iterations],
  );

  const topCandidateRows = useMemo(
    () =>
      iterations.flatMap((item: any) =>
        (item.topCandidates || []).map((candidate: any) => ({
          iteration: item.iteration,
          label: `${compactRunLabel(item.runLabel)} · I${item.iteration}`,
          runLabel: item.runLabel,
          candidateId: compactIdentifier(candidate.candidateId),
          strategy: titleCase(candidate.strategy || 'unknown'),
          fitness: +(candidate.score || 0).toFixed(3),
          successLift: +((candidate.successLift || 0) * 100).toFixed(2),
          publicVictoryLift: +((candidate.publicVictoryLift || 0) * 100).toFixed(2),
          avgTurnsDelta: +(candidate.avgTurnsDelta || 0).toFixed(2),
        })),
      ),
    [iterations],
  );

  const topGenomeCandidate = useMemo(() => {
    if (!iterations.length) return null;
    let best: any = null;
    iterations.forEach((iter: any) => {
      (iter.topCandidates || []).forEach((candidate: any) => {
        if (!best || (candidate.score || 0) > (best.score || 0)) {
          best = {
            ...candidate,
            iteration: iter.iteration,
            runLabel: iter.runLabel,
          };
        }
      });
    });
    return best;
  }, [iterations]);

  const structuralAlerts = useMemo(() => {
    if (!iterations.length) {
      return [];
    }
    const latest = iterations[iterations.length - 1];
    const structural = latest.analysis?.structural || {};
    const pressure = latest.analysis?.defeatPressure || {};
    return [
      {
        label: 'Early Terminations',
        value: pct(structural.earlyTerminationRate),
        tone: structural.earlyTerminationRate > 0.2 ? 'alert' : 'ok',
      },
      {
        label: 'Victory Before Allowed Round',
        value: pct(structural.victoryBeforeAllowedRoundRate),
        tone: structural.victoryBeforeAllowedRoundRate > 0.02 ? 'alert' : 'ok',
      },
      {
        label: 'Comrades Pressure',
        value: pct(pressure.comradesExhaustedRate),
        tone: pressure.comradesExhaustedRate > 0.45 ? 'alert' : 'ok',
      },
      {
        label: 'Impossible Mandates',
        value: `${(structural.impossibleMandates || []).length}`,
        tone: (structural.impossibleMandates || []).length > 0 ? 'alert' : 'ok',
      },
    ];
  }, [iterations]);

  const targetDistanceRows = optimizer?.targetDistances || [];
  const parameterImpactRows = (optimizer?.parameterImpact || []).slice(0, 10);
  const candidateCloudRows = optimizer?.candidateCloud || [];
  const generationRows = optimizer?.generationProgress || [];
  const genomeRows = optimizer?.genomeDrift || [];
  const turnHistogramRows = trajectory?.turnHistogram || [];
  const domainPressureRows = trajectory?.domainPressure || [];
  const trackPressureRows = trajectory?.trackPressure || [];
  const actionMixRows = trajectory?.actionMix || [];
  const actionShareByRoundRows = trajectory?.actionShareByRound || [];
  const actionTimingRows = trajectory?.actionTimingByOutcome || [];
  const actionMixByPlayerCountRows = trajectory?.actionMixByPlayerCount || [];
  const actionOpportunityRows = trajectory?.actionOpportunity || [];
  const actionDiversity = trajectory?.actionDiversity || {};
  const trajectoryTuningRows = trajectory?.trajectoryToTuning || [];
  const frontPressureRows = trajectory?.frontPressure || [];
  const actionRunDiagnostics = optimizer?.actionRunDiagnostics || [];
  const actionMixDeltaRows = optimizer?.actionMixDelta || [];
  const scenarioRecommendations = optimizer?.scenarioRecommendations || [];
  const baselineRows = baselineHistory?.runs || [];

  const baselineTrendRows = useMemo(
    () =>
      baselineRows
        .slice()
        .reverse()
        .map((item: any) => ({
          label: item.compactLabel,
          successRate: +((item.successRate || 0) * 100).toFixed(2),
          publicVictoryRate: +((item.publicVictoryRate || 0) * 100).toFixed(2),
          averageTurns: +(item.averageTurns || 0).toFixed(2),
          earlyTerminationRate: +((item.earlyTerminationRate || 0) * 100).toFixed(2),
          fitness: +(item.fitness || 0).toFixed(3),
        })),
    [baselineRows],
  );

  const baselineComponentRows = useMemo(
    () =>
      baselineRows
        .slice()
        .reverse()
        .map((item: any) => ({
          label: item.compactLabel,
          balanceScore: +(item.components?.balanceScore || 0).toFixed(3),
          pacingScore: +(item.components?.pacingScore || 0).toFixed(3),
          tensionScore: +(item.components?.tensionScore || 0).toFixed(3),
          varianceScore: +(item.components?.varianceScore || 0).toFixed(3),
          actionBalanceScore: +(item.components?.actionBalanceScore || 0).toFixed(3),
          trajectoryPathScore: +(item.components?.trajectoryPathScore || 0).toFixed(3),
        })),
    [baselineRows],
  );

  const baselineLatestScenarioRows = useMemo(
    () =>
      ((baselineOverview?.latest?.scenarios || []) as any[]).map((item: any) => ({
        scenario: titleCase(item.scenarioId),
        successRate: +((item.successRate || 0) * 100).toFixed(2),
        publicVictoryRate: +((item.publicVictoryRate || 0) * 100).toFixed(2),
        averageTurns: +(item.averageTurns || 0).toFixed(2),
        earlyTerminationRate: +((item.earlyTerminationRate || 0) * 100).toFixed(2),
        fitness: +(item.fitness || 0).toFixed(3),
      })),
    [baselineOverview],
  );

  const trajectoryPlayerCountOptions = useMemo(
    () =>
      Array.from(
        new Set((trajectory?.playerCounts || []).map((item: any) => Number(item.playerCount)).filter(Boolean)),
      ).sort((a: any, b: any) => a - b),
    [trajectory],
  );

  const filteredActionShareByRoundRows = useMemo(() => {
    const filtered = actionShareByRoundRows.filter((row: any) => (
      (trajectoryOutcomeFilter === 'all' || row.outcome === trajectoryOutcomeFilter)
      && (trajectoryPlayerCountFilter === 'all' || row.playerCount === trajectoryPlayerCountFilter)
    ));

    const byRound = new Map<number, any[]>();
    filtered.forEach((row: any) => {
      const bucket = byRound.get(row.round) || [];
      bucket.push(row);
      byRound.set(row.round, bucket);
    });

    return Array.from(byRound.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, rows]) => {
        const totalWeight = rows.reduce((sum, row) => sum + (row.sampleCount || 1), 0) || 1;
        const aggregate: Record<string, any> = { round };
        CORE_ACTION_KEYS.forEach((action) => {
          aggregate[action] = rows.reduce(
            (sum, row) => sum + ((row[action] || 0) * (row.sampleCount || 1)),
            0,
          ) / totalWeight;
        });
        return aggregate;
      });
  }, [actionShareByRoundRows, trajectoryOutcomeFilter, trajectoryPlayerCountFilter]);

  const optimizerIterationOptions = useMemo(
    () =>
      Array.from(
        new Set((optimizer?.iterations || []).map((item: any) => item.iteration).filter(Boolean)),
      ).sort((a: any, b: any) => a - b),
    [optimizer],
  );

  const gaRowsForIteration = useMemo(() => {
    const filtered =
      selectedOptimizerIteration === 'all'
        ? generationRows
        : generationRows.filter((row: any) => row.iteration === selectedOptimizerIteration);

    const byGeneration = new Map<number, any[]>();
    filtered.forEach((row: any) => {
      const bucket = byGeneration.get(row.generation) || [];
      bucket.push(row);
      byGeneration.set(row.generation, bucket);
    });

    return Array.from(byGeneration.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([generation, rows]) => ({
        generation,
        bestFitness: rows.reduce((sum, row) => sum + (row.bestFitness || 0), 0) / rows.length,
        meanFitness: rows.reduce((sum, row) => sum + (row.meanFitness || 0), 0) / rows.length,
        medianFitness: rows.reduce((sum, row) => sum + (row.medianFitness || 0), 0) / rows.length,
        worstFitness: rows.reduce((sum, row) => sum + (row.worstFitness || 0), 0) / rows.length,
        sampleCount: rows.length,
      }));
  }, [generationRows, selectedOptimizerIteration]);

  const genomePreview = useMemo(() => {
    const keys = new Set<string>();
    genomeRows.forEach((row: any) => {
      Object.keys(row).forEach((key) => {
        if (
          !['iteration', 'generation', 'label', 'runLabel'].includes(key) &&
          typeof row[key] === 'number'
        ) {
          keys.add(key);
        }
      });
    });
    return Array.from(keys).slice(0, 5);
  }, [genomeRows]);

  const genomeRowsForIteration = useMemo(() => {
    const filtered =
      selectedOptimizerIteration === 'all'
        ? genomeRows
        : genomeRows.filter((row: any) => row.iteration === selectedOptimizerIteration);

    const byGeneration = new Map<number, any[]>();
    filtered.forEach((row: any) => {
      const bucket = byGeneration.get(row.generation) || [];
      bucket.push(row);
      byGeneration.set(row.generation, bucket);
    });

    return Array.from(byGeneration.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([generation, rows]) => {
        const aggregated: Record<string, number> = { generation };
        genomePreview.forEach((key) => {
          aggregated[key] =
            rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / rows.length;
        });
        return aggregated;
      });
  }, [genomeRows, genomePreview, selectedOptimizerIteration]);

  const balanceQuestions = [
    {
      label: 'Why did difficulty move?',
      value: iterations.length && iterations[0]?.selectedCandidate
        ? `${iterations[0].selectedCandidate.parameters?.[0]?.parameter || 'No selected patch'}`
        : 'Needs parameter trace',
    },
    {
      label: 'What dominates defeat?',
      value: currentScenario
        ? titleCase(
            Object.entries(currentScenario.defeatReasons || {}).sort(
              (a: any, b: any) => b[1] - a[1],
            )[0]?.[0] || 'unknown',
          )
        : 'No data',
    },
    {
      label: 'Where is search stagnating?',
      value: iterationTrendRows.length
        ? `${iterationTrendRows[iterationTrendRows.length - 1].label} streak ${iterationTrendRows[iterationTrendRows.length - 1].noImprovementStreak}`
        : 'No optimizer run',
    },
  ];

  const sortedFailures = [...globalScenarioRows].sort((a, b) => a.successRate - b.successRate).filter((r: any) => r.successRate < 25);
  const overviewWarning = sortedFailures.slice(0, 3).map((r: any) => 
    t('insights.global_overview_warning', { scenario: titleCase(r.scenario), rate: r.successRate, defaultValue: `Critical Imbalance: ${titleCase(r.scenario)} is failing at a success rate of ${r.successRate}%. A rate beneath 25% implies an overpowered System. Consider lowering starting War Machine.` })
  );

  const sortedSuccesses = [...globalScenarioRows].sort((a, b) => b.successRate - a.successRate).filter((r: any) => r.successRate > 50);
  const overviewInsight = sortedSuccesses.slice(0, 3).map((r: any) =>
    t('insights.global_overview_insight', { scenario: titleCase(r.scenario), rate: r.successRate, defaultValue: `Safe Convergence: ${titleCase(r.scenario)} reached a stable ${r.successRate}% baseline win rate.` })
  );

  const extCount = summary?.defeatReasons?.extraction || 0;
  const comCount = summary?.defeatReasons?.comrade_exhaustion || 0;
  const totalDefeats = Object.values(summary?.defeatReasons || {}).reduce((a: any, b: any) => a + b, 0) as number || 1;
  const extPct = ((extCount / totalDefeats) * 100).toFixed(1);

  const defeatWarning: string[] = [];
  if (extCount > comCount * 1.5 && extCount > 0) {
    defeatWarning.push(t('insights.defeat_composition_warning', { extCount, extPct, comCount, defaultValue: `Extraction Dominance: ${extCount} simulations (${extPct}%) ended via Extraction Overrun. The board is filling with System tokens too fast.` }));
  }
  if (comCount > extCount * 1.5 && comCount > 0) {
    defeatWarning.push(t('insights.defeat_composition_warning_com', { count: comCount, pct: ((comCount / totalDefeats) * 100).toFixed(1), defaultValue: `Comrade Exhaustion: ${comCount} simulations (${((comCount / totalDefeats) * 100).toFixed(1)}%) ended via depletion. Players cannot recruit fast enough.` }));
  }

  const domAction = actionDiversity?.dominantAction ? titleCase(actionDiversity.dominantAction) : 'n/a';
  const domShare = ((actionDiversity?.concentration || 0) * 100).toFixed(1);
  const actionDiversityWarning: string[] = [];
  if ((actionDiversity?.concentration || 0) > 0.5) {
    actionDiversityWarning.push(t('insights.action_diversity_warning', { dominantAction: domAction, share: domShare, defaultValue: `Action Collapse: The action '${domAction}' accounts for ${domShare}% of all selections. Players rely on this single dominant line.` }));
  }
  if ((actionDiversity?.entropy || 10) < 1.0) {
    actionDiversityWarning.push(t('insights.action_entropy_warning', { defaultValue: `Low Entropy: Overall strategic paths are deeply constrained. Diverse lines of play are failing or ignored.` }));
  }

  const sortedDeltas = [...actionMixDeltaRows].sort((a: any, b: any) => (b.selectedShare / (b.baselineShare || 1)) - (a.selectedShare / (a.baselineShare || 1)));
  const actionMixInsight = sortedDeltas.slice(0, 3)
    .filter((r: any) => r.selectedShare > r.baselineShare * 1.2)
    .map((r: any) =>
      t('insights.action_mix_insight', { action: r.label, baseline: (r.baselineShare * 100).toFixed(1), selected: (r.selectedShare * 100).toFixed(1), defaultValue: `Successful Shift: Usage of '${r.label}' increased from ${ (r.baselineShare * 100).toFixed(1) }% to ${ (r.selectedShare * 100).toFixed(1) }%.` })
    );

  const strategies = overview?.strategies || [];
  const strategyWarning = [...strategies]
    .filter((r: any) => r.successRate < 0.2)
    .sort((a: any, b: any) => a.successRate - b.successRate)
    .slice(0, 3)
    .map((r: any) =>
      t('insights.strategy_warning', { strategy: titleCase(r.strategy), rate: (r.successRate * 100).toFixed(1), defaultValue: `Strategy Imbalance: The '${titleCase(r.strategy)}' auto-player is failing at ${(r.successRate * 100).toFixed(1)}% win rate.` })
    );

  const maxNoImprovement = iterationTrendRows.length > 0 ? Math.max(...iterationTrendRows.map((r: any) => r.noImprovementStreak)) : 0;
  const trendWarning: string[] = [];
  if (maxNoImprovement >= 5) {
    trendWarning.push(t('insights.trend_warning', { streak: maxNoImprovement, defaultValue: `Stagnation Alert: The optimizer has been stuck for ${maxNoImprovement} iterations without discovering a better fitness genome. Consider altering mutation rates or relaxing constraints.` }));
  }

  const editRecommendationInsight = (scenarioRecommendations || []).slice(0, 3).map((recom: any) =>
    t('insights.edit_recommendation_insight', { action: recom.label, lever: recom.lever, defaultValue: `Target Identified: Recommend adjusting '${recom.lever}' to boost '${recom.label}'.` })
  );

  const gaConvergenceInsights: string[] = [];
  if (gaRowsForIteration.length > 5) {
    gaConvergenceInsights.push(`Steady Progress: The 'Best' fitness line (Green) has improved over ${gaRowsForIteration.length} generations. The 'Mean' fitness line (Pink) tracks behind it, proving the population isn't stuck.`);
  }

  const genomeDriftWarnings: string[] = [];
  if (genomeRowsForIteration.length > 0) {
    genomeDriftWarnings.push(`Parameter Volatility: Watch parameters like '${genomePreview[0] || 'Unknown'}' (Green or Pink line). Oscillations instead of flattening out means the optimizer struggles to find an optimal locus.`);
  }

  const actionDiversityRunWarnings: string[] = [];
  const maxUnderusedLiftRun = actionRunDiagnostics.length ? [...actionRunDiagnostics].sort((a,b) => b.underusedActionLift - a.underusedActionLift)[0] : null;
  if (maxUnderusedLiftRun && maxUnderusedLiftRun.underusedActionLift > 0.1) {
    actionDiversityRunWarnings.push(`Varying Optimizer Success: Run '${maxUnderusedLiftRun.compactLabel}' shows huge targeted lift (Pink bar), but if its overall Entropy (Green bar) drops below 1.0, the AI only learned to exploit your buff instead of diversifying.`);
  }

  const actionMixByOutcomeInsights: string[] = [];
  const victoryDriver = [...actionMixRows].sort((a,b) => (b.victory - b.defeat) - (a.victory - a.defeat))[0];
  if (victoryDriver && (victoryDriver.victory - victoryDriver.defeat) > 0.5) {
    actionMixByOutcomeInsights.push(`Victory Engine: '${victoryDriver.label}' is played significantly more in Victories (Green bar) than Defeats (Red bar). This action serves as the core engine for success.`);
  }

  const actionMixByOutcomeWarnings: string[] = [];
  const defeatDriver = [...actionMixRows].sort((a,b) => (b.defeat - b.victory) - (a.defeat - a.victory))[0];
  if (defeatDriver && (defeatDriver.defeat - defeatDriver.victory) > 1.0) {
    actionMixByOutcomeWarnings.push(`Desperation Play: '${defeatDriver.label}' spikes in Defeats (Red bar). Players are forced to spam it defensively to survive rather than advancing their win condition.`);
  }

  const actionShareByRoundInsights: string[] = [`Opening vs Endgame: The thickness and color of lines show action priority shifts. Watch if 'heavy' actions dominate the final 3 rounds instead of early setup.`];
  const terminalTimingWarnings: string[] = [`Panic Threshold: If a low-utility 'Clear' action dominates the 'Before defeat' (Red bar) distribution, the board's pressure scaling is too severe in the final rounds.`];

  const turnHistogramWarnings: string[] = [];
  if (turnHistogramRows.some((r: any) => r.turn < 5 && r.count > 0)) {
     turnHistogramWarnings.push(`Premature Failure: Simulations are ending before round 5. The scenario's starting pressure triggers early defeat before establishing an engine.`);
  }
  const turnHistogramInsights: string[] = [`Expected Game Length: Compare peaks of Victory (Green) and Defeat (Red). An ideal scenario shows both distributions peaking between rounds 8 to 12.`];

  const targetDistanceInsights: string[] = [];
  const closestTarget = [...targetDistanceRows].sort((a: any, b: any) => a.distance - b.distance)[0];
  if (closestTarget) {
     targetDistanceInsights.push(`Closest Metric: '${closestTarget.metric}' (Green dot) is closest to target value. The optimizer found this balance vector easiest to solve.`);
  }
  const targetDistanceWarnings: string[] = [];
  const furthestTarget = [...targetDistanceRows].sort((a: any, b: any) => b.distance - a.distance)[0];
  if (furthestTarget && furthestTarget.distance > 0.2) {
     targetDistanceWarnings.push(`Stubborn Metric: '${furthestTarget.metric}' (Red dot) remains furthest from its target. Review if the scenario rules allow its target to be reached at all.`);
  }

  const parameterImpactInsights: string[] = [];
  if (parameterImpactRows.length > 0) {
     parameterImpactInsights.push(`Highest Leverage: '${parameterImpactRows[0].parameter}' parameter (Green bar) causes the highest variance in success rate. This is your most sensitive balance dial.`);
  }
  const pressureWarnings: string[] = [`Runaway Tracks: If any domain line (e.g. War Machine - Red line) hits the ceiling early (~round 5), players lack efficient push-back mechanics.`];


  if (loadingOverview) {
    return <LoadingState label={t('common.loadingOverview')} />;
  }

  const showScenarioFilter = activeLevel !== 'overview';
  const showRunScopeFilter =
    activeLevel === 'balance'
    || activeLevel === 'optimizer'
    || activeLevel === 'parameters'
    || activeLevel === 'actions'
    || activeLevel === 'trajectories'
    || activeLevel === 'recommendations';
  const showSpecificRunFilter = showRunScopeFilter && runScope === 'specific_run';
  const showIterationFilter = activeLevel === 'parameters' && optimizerIterationOptions.length > 0;
  const showComparisonFilters = activeLevel === 'comparison';
  const showTrajectoryFilters = activeLevel === 'trajectories' || activeLevel === 'actions';


  return (
    <div className="app-shell" dir={isRtl ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Radar size={20} />
          </div>
          <div>
            <p className="eyebrow">{t('common.tagline')}</p>
            <h1>{t('common.brand')}</h1>
          </div>
        </div>

        <div className="sidebar-group">
          {LEVELS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-button ${activeLevel === id ? 'active' : ''}`}
              onClick={() => setActiveLevel(id)}
            >
              <Icon size={16} />
              <span>{t(`nav.${id}`, { defaultValue: label })}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className="nav-button lang-toggle"
            style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '12px' }}
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ar-EG' : 'en')}
          >
            <Layers size={16} />
            <span>{i18n.language === 'en' ? 'العربية' : 'English'}</span>
          </button>
        </div>

        <div className="sidebar-card">
          <p className="eyebrow">{t('common.questions')}</p>
          {balanceQuestions.map((item) => (
            <div key={item.label} className="question-row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <p className="eyebrow">{t('common.simulationSystem')}</p>
            <h2>{t(`nav.${activeLevel}`, { defaultValue: LEVELS.find((item) => item.id === activeLevel)?.label })}</h2>
            <p className="lede">
              Multi-level balance diagnostics for scenarios, optimizer behavior, parameter
              effects, and gameplay trajectories.
            </p>
          </div>
          <div className="header-summary">
            <MetricCard
              label={t('common.globalSuccess')}
              value={pct(summary?.successRate)}
              tone="accent"
            />
            <MetricCard label={t('common.scenarios')} value={`${scenarioOptions.length}`} />
            <MetricCard
              label={t('common.runScope')}
              value={runSelectionLabel}
              tone="soft"
            />
          </div>
        </header>

        {(showScenarioFilter || showRunScopeFilter || showIterationFilter || showComparisonFilters || showTrajectoryFilters) ? (
          <section className="filter-toolbar">
            {showScenarioFilter ? (
              <div className="filter-card">
                <label className="eyebrow" htmlFor="scenario-filter">{t('common.scenario')}</label>
                <select
                  id="scenario-filter"
                  value={selectedScenario}
                  onChange={(event) => {
                    const val = event.target.value;
                    setSelectedScenario(val);
                    if (val !== 'all' && activeLevel === 'overview') {
                      setActiveLevel('balance');
                    }
                  }}
                  className="scenario-select"
                >
                  <option value="all">{t('common.allScenarios', { defaultValue: 'All Scenarios' })}</option>
                  {scenarioOptions.map((scenario) => (
                    <option key={scenario.scenarioId} value={scenario.scenarioId}>
                      {titleCase(scenario.scenarioId)}
                    </option>
                  ))}
                </select>
                <div className="filter-meta">
                  {activeLevel === 'overview' ? (
                    <>
                      <MetricMini label={t('common.runs')} value={`${summary?.totalRuns || 0}`} />
                      <MetricMini label={t('common.success')} value={pct(summary?.successRate)} />
                    </>
                  ) : (
                    <>
                      <MetricMini label={t('common.runs')} value={`${currentScenario?.runs || 0}`} />
                      <MetricMini label={t('common.success')} value={pct(currentScenario?.successRate)} />
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {showRunScopeFilter ? (
              <div className="filter-card">
                <label className="eyebrow" htmlFor="scope-filter">{t('common.runScope')}</label>
                <select
                  id="scope-filter"
                  value={runScope}
                  onChange={(event) => setRunScope(event.target.value as RunScope)}
                  className="scenario-select"
                >
                  {RUN_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(`runScopes.${option.value}`, { defaultValue: option.label })}
                    </option>
                  ))}
                </select>
                <div className="filter-caption">{runSelectionLabel}</div>
              </div>
            ) : null}

            {showSpecificRunFilter ? (
              <div className="filter-card">
                <label className="eyebrow" htmlFor="run-filter">
                  {activeLevel === 'recommendations' ? 'Recommended Run' : 'Specific Run'}
                </label>
                <select
                  id="run-filter"
                  value={selectedRunKey}
                  onChange={(event) => setSelectedRunKey(event.target.value)}
                  className="scenario-select"
                >
                  <option value="">Select a run</option>
                  {runCatalog.map((run: any) => (
                    <option key={run.runKey} value={run.runKey}>
                      {run.label}
                    </option>
                  ))}
                </select>
                <div className="filter-caption">
                  {activeLevel === 'trajectories'
                    ? 'Run selection scopes optimizer-backed diagnostics. Raw trajectory charts still read scenario-wide simulation history.'
                    : activeLevel === 'recommendations'
                      ? 'Pinned run for the recommended config shelf.'
                      : 'Pinned permalink-ready run selection.'}
                </div>
              </div>
            ) : null}

            {showIterationFilter ? (
              <div className="filter-card">
                <label className="eyebrow" htmlFor="iteration-filter">Optimizer Iteration</label>
                <select
                  id="iteration-filter"
                  value={String(selectedOptimizerIteration)}
                  onChange={(event) =>
                    setSelectedOptimizerIteration(
                      event.target.value === 'all' ? 'all' : Number(event.target.value),
                    )
                  }
                  className="scenario-select"
                >
                  {optimizerIterationOptions.length > 1 ? <option value="all">All Iterations</option> : null}
                  {optimizerIterationOptions.map((iteration: any) => (
                    <option key={String(iteration)} value={String(iteration)}>
                      Iteration {iteration}
                    </option>
                  ))}
                </select>
                <div className="filter-caption">
                  {selectedOptimizerIteration === 'all'
                    ? 'Averaging GA diagnostics across iterations.'
                    : `Focused on iteration ${selectedOptimizerIteration}.`}
                </div>
              </div>
            ) : null}

            {showComparisonFilters ? (
              <>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="compare-left-filter">Left Run</label>
                  <select
                    id="compare-left-filter"
                    value={comparisonLeftRunKey}
                    onChange={(event) => setComparisonLeftRunKey(event.target.value)}
                    className="scenario-select"
                  >
                    <option value="">{t('common.selectRun')}</option>
                    {runCatalog.map((run: any) => (
                      <option key={run.runKey} value={run.runKey}>
                        {run.label}
                      </option>
                    ))}
                  </select>
                  <div className="filter-caption">{t('common.baselineRun')}</div>
                </div>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="compare-right-filter">Right Run</label>
                  <select
                    id="compare-right-filter"
                    value={comparisonRightRunKey}
                    onChange={(event) => setComparisonRightRunKey(event.target.value)}
                    className="scenario-select"
                  >
                    <option value="">{t('common.selectRun')}</option>
                    {runCatalog.map((run: any) => (
                      <option key={run.runKey} value={run.runKey}>
                        {run.label}
                      </option>
                    ))}
                  </select>
                  <div className="filter-caption">{t('common.comparisonRun')}</div>
                </div>
              </>
            ) : null}

            {showTrajectoryFilters ? (
              <>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="trajectory-outcome-filter">{t('common.outcomeSlice')}</label>
                  <select
                    id="trajectory-outcome-filter"
                    value={trajectoryOutcomeFilter}
                    onChange={(event) => setTrajectoryOutcomeFilter(event.target.value as 'all' | 'victory' | 'defeat')}
                    className="scenario-select"
                  >
                    <option value="all">{t('common.allOutcomes')}</option>
                    <option value="victory">{t('common.victoryOnly')}</option>
                    <option value="defeat">{t('common.defeatOnly')}</option>
                  </select>
                  <div className="filter-caption">Filters action timing and share-by-round charts.</div>
                </div>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="trajectory-player-filter">{t('common.playerCount')}</label>
                  <select
                    id="trajectory-player-filter"
                    value={String(trajectoryPlayerCountFilter)}
                    onChange={(event) =>
                      setTrajectoryPlayerCountFilter(
                        event.target.value === 'all' ? 'all' : Number(event.target.value),
                      )
                    }
                    className="scenario-select"
                  >
                    <option value="all">{t('common.allPlayers')}</option>
                    {trajectoryPlayerCountOptions.map((playerCount: any) => (
                      <option key={String(playerCount)} value={String(playerCount)}>
                        {playerCount} {t('common.players')}
                      </option>
                    ))}
                  </select>
                  <div className="filter-caption">Use to isolate 2P, 3P, or 4P action lines.</div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {loadingScenario && activeLevel !== 'overview' ? (
          <LoadingState label={t('common.loadingScenario')} compact />
        ) : null}

        {activeLevel === 'overview' ? (
          <section className="content-grid">
            <Card
              title={t('sections.globalOverview.title')}
              subtitle={t('sections.globalOverview.subtitle')}
              className="span-8"
              helpText={t('sections.globalOverview.help')}
              insight={overviewInsight}
              warning={overviewWarning}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={globalScenarioRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="scenario" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successRate" fill={COLORS.green} name="Current success %" />
                  <Bar
                    dataKey="optimizerSuccessRate"
                    fill={COLORS.accent}
                    name="Latest optimizer success %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title={t('sections.defeatComposition.title')}
              subtitle={t('sections.defeatComposition.subtitle')}
              className="span-4"
              helpText={t('sections.defeatComposition.help')}
              warning={defeatWarning}
            >
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={Object.entries(summary?.defeatReasons || {}).map(([reason, count]) => ({
                      name: titleCase(reason),
                      value: count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={104}
                  >
                    {[COLORS.red, COLORS.gold, COLORS.blue, COLORS.brown, COLORS.accent].map(
                      (fill, index) => (
                        <Cell key={fill + index} fill={fill} />
                      ),
                    )}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card
              title={t('sections.parallelIntelligence.title')}
              subtitle={t('sections.parallelIntelligence.subtitle')}
              className="span-12"
              helpText={t('sections.parallelIntelligence.help')}
            >
              <DataTable
                columns={['Run', 'Generated', 'Scenarios', 'Total runs', 'Avg Success', 'Actions']}
                rows={(overview?.parallelRuns || []).map((run: any) => [
                  run.parentRunId,
                  (run.generatedAt ?? '').split('T')[0] as string,
                  `${run.scenarioCount}` as string,
                  `${run.totalRuns}` as string,
                  pct(run.avgSuccessRate) as any,
                  <div key={run.parentRunId} className="scenario-links">
                    {Object.keys(run.childRuns || {}).map((sid: string) => (
                      <button
                        key={sid}
                        className="nav-button compact"
                        style={{
                          color: 'var(--blue)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '2px 6px',
                        }}
                        onClick={() => {
                          const childId = run.childRuns?.[sid];
                          setSelectedScenario(sid);
                          if (childId) {
                            setRunScope('specific_run');
                            setSelectedRunKey(childId);
                          } else {
                            setRunScope('latest_parallel');
                          }
                          setActiveLevel('balance');
                        }}
                      >
                        {sid.split('_').pop()}
                      </button>
                    ))}
                  </div> as any,
                ])}
              />
            </Card>

            <Card
              title={t('sections.historicalTrend.title')}
              subtitle={t('sections.historicalTrend.subtitle')}
              className="span-4"
              helpText={t('sections.historicalTrend.help')}
              warning={trendWarning}
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={globalScenarioRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" />
                  <XAxis dataKey="scenario" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="successRate" stroke={COLORS.green} name="Success Rate" />
                  <Line dataKey="averageTurns" stroke={COLORS.blue} name="Average Turns" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title={t('sections.strategyPerformance.title')}
              subtitle={t('sections.strategyPerformance.subtitle')}
              className="span-6"
              helpText={t('sections.strategyPerformance.help')}
              warning={strategyWarning}
            >
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" />
                  <XAxis
                    type="number"
                    dataKey="averageTurns"
                    name="Average turns"
                    tick={{ fill: COLORS.slate, fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="successRate"
                    name="Success rate"
                    tick={{ fill: COLORS.slate, fontSize: 12 }}
                    tickFormatter={(value) => `${value * 100}%`}
                  />
                  <Tooltip formatter={(value: any, key: string) => key === 'successRate' ? `${(value * 100).toFixed(1)}%` : value} />
                  <Scatter data={overview?.strategies || []} fill={COLORS.blue} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Optimizer Status Board"
              subtitle="Latest single and parallel optimizer runs."
              className="span-6"
              helpText="Summarizes the most recent individual and batch optimization attempts. It shows the scenario, mode (single/parallel), termination reason, and performance metrics."
            >
              <DataTable
                columns={['Scenario', 'Mode', 'Stop reason', 'Success', 'Avg turns']}
                rows={(overview?.optimizerStatus || []).map((item) => [
                  titleCase(item.scenarioId),
                  item.mode,
                  titleCase(item.stopReason || 'none'),
                  pct(item.successRate),
                  num(item.averageTurns),
                ])}
              />
            </Card>
          </section>
        ) : null}

        {activeLevel === 'baselines' ? (
          <section className="content-grid">
            <Card
              title="Latest All-Scenario Baseline"
              subtitle="Current baseline state across the scenario library."
              className="span-7"
            >
              {baselineLatestScenarioRows.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={baselineLatestScenarioRows}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="scenario" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="successRate" fill={COLORS.green} name="Success %" />
                    <Bar dataKey="publicVictoryRate" fill={COLORS.blue} name="Public victory %" />
                    <Bar dataKey="fitness" fill={COLORS.accent} name="Fitness" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No all-scenario baselines" body="Run benchmark mode without a scenario to capture the current state across the full library." />
              )}
            </Card>

            <Card
              title="Baseline Sweep Runs"
              subtitle="Available all-scenarios baseline batches."
              className="span-5"
            >
              {(baselineOverview?.runs || []).length ? (
                <DataTable
                  columns={['Run', 'Generated', 'Scenarios']}
                  rows={(baselineOverview?.runs || []).map((run: any) => [
                    compactRunLabel(run.label),
                    run.generatedAt || 'n/a',
                    `${run.scenarioCount || 0}`,
                  ])}
                />
              ) : (
                <EmptyState title="No baseline sweeps" body="No all-scenarios baseline batches are on disk yet." />
              )}
            </Card>

            <Card
              title="Scenario Baseline History"
              subtitle="How the selected scenario baseline moved over captured runs."
              className="span-8"
            >
              {baselineTrendRows.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={baselineTrendRows}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line dataKey="successRate" stroke={COLORS.green} strokeWidth={3} name="Success %" />
                    <Line dataKey="publicVictoryRate" stroke={COLORS.blue} strokeWidth={2} name="Public victory %" />
                    <Line dataKey="earlyTerminationRate" stroke={COLORS.red} strokeWidth={2} name="Early termination %" />
                    <Line dataKey="fitness" stroke={COLORS.accent} strokeWidth={2} name="Fitness" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No scenario baseline history" body="Run benchmark mode for this scenario to build a baseline history." />
              )}
            </Card>

            <Card
              title="Latest Scenario Baseline"
              subtitle="Current-state snapshot for the selected scenario."
              className="span-4"
            >
              <MetricList
                items={[
                  ['Success rate', pct(baselineRows[0]?.successRate)],
                  ['Public victory', pct(baselineRows[0]?.publicVictoryRate)],
                  ['Average turns', num(baselineRows[0]?.averageTurns)],
                  ['Early termination', pct(baselineRows[0]?.earlyTerminationRate)],
                  ['Campaign success', pct(baselineRows[0]?.campaignSuccessRate)],
                  ['Fitness', num(baselineRows[0]?.fitness)],
                ]}
              />
            </Card>

            <Card
              title="Baseline Score Components"
              subtitle="How balance, pacing, tension, variance, action-balance, and trajectory-path scores evolve across baseline captures."
              className="span-12"
            >
              {baselineComponentRows.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={baselineComponentRows}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} domain={[0, 1]} />
                    <Tooltip />
                    <Legend />
                    <Line dataKey="balanceScore" stroke={COLORS.green} strokeWidth={2} name="Balance" />
                    <Line dataKey="pacingScore" stroke={COLORS.gold} strokeWidth={2} name="Pacing" />
                    <Line dataKey="tensionScore" stroke={COLORS.red} strokeWidth={2} name="Tension" />
                    <Line dataKey="varianceScore" stroke={COLORS.blue} strokeWidth={2} name="Variance" />
                    <Line dataKey="actionBalanceScore" stroke={COLORS.accent} strokeWidth={2} name="Action balance" />
                    <Line dataKey="trajectoryPathScore" stroke={COLORS.brown} strokeWidth={2} name="Trajectory path" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No component history" body="Capture more than one baseline run to track score movement." />
              )}
            </Card>
          </section>
        ) : null}

        {activeLevel === 'balance' ? (
          <section className="content-grid">
            <Card
              title="Player-Count Balance Split"
              subtitle="Success, public victory, and dominant defeat channels by player count."
              className="span-7"
              helpText="Breaks down scenario performance by the number of players. Stacked bars show the primary cause of failure (Comrades vs Extraction), while the line tracks the overall success rate."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={scenarioBalanceRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="playerCount" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="comrades" stackId="defeat" fill={COLORS.red} name="Comrades %" />
                  <Bar dataKey="extraction" stackId="defeat" fill={COLORS.gold} name="Extraction %" />
                  <Bar dataKey="suddenDeath" stackId="defeat" fill={COLORS.blue} name="Sudden death %" />
                  <Line
                    type="monotone"
                    dataKey="successRate"
                    stroke={COLORS.green}
                    strokeWidth={3}
                    name="Success %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Structural Alerts"
              subtitle="Latest iteration structural warnings and pressure markers."
              className="span-5"
              helpText="Flags core mechanical issues detected in the simulation. These include 'Death Spirals' (where players can't recover from initial pressure) or 'Passive Wins' (where the system isn't demanding enough)."
            >
              <div className="alert-grid">
                {structuralAlerts.map((alert) => (
                  <div key={alert.label} className={`alert-pill ${alert.tone}`}>
                    <span>{alert.label}</span>
                    <strong>{alert.value}</strong>
                  </div>
                ))}
              </div>
              <div className="insight-list">
                {(iterations[iterations.length - 1]?.analysis?.insights || []).map((insight: string) => (
                  <div key={insight} className="insight-row">
                    <Layers size={14} />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Turn Distribution"
              subtitle="Victory and defeat pacing from raw trajectory records."
              className="span-7"
              helpText="Shows the distribution of turns for both successful and failed simulations. A healthy distribution indicates balanced pacing, while skewed distributions can highlight issues like 'death spirals' or overly long games."
              insight={turnHistogramInsights}
              warning={turnHistogramWarnings}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={turnHistogramRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="turns" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill={COLORS.accent}>
                    {turnHistogramRows.map((row: any, index: number) => (
                      <Cell
                        key={`${row.turns}-${row.result}-${index}`}
                        fill={row.result === 'victory' ? COLORS.green : COLORS.red}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Trajectory Summary"
              subtitle="Victory-pattern diagnostics taken from optimizer trajectory summaries."
              className="span-5"
              helpText="Key metrics derived from successful simulation trajectories, such as average turns to victory and common first actions. Provides insights into effective player strategies."
            >
              <MetricList
                items={[
                  ['Total trajectories', `${iterations[iterations.length - 1]?.trajectorySummary?.totalTrajectories || 0}`],
                  [
                    'Average turns to victory',
                    num(iterations[iterations.length - 1]?.trajectorySummary?.averageTurnsToVictory),
                  ],
                  [
                    'Most common first action',
                    iterations[iterations.length - 1]?.trajectorySummary?.mostCommonFirstAction?.action || 'n/a',
                  ],
                  [
                    'Average extraction removed',
                    num(
                      iterations[iterations.length - 1]?.trajectorySummary?.progressBeforeVictory
                        ?.averageExtractionRemoved,
                    ),
                  ],
                ]}
              />
            </Card>
          </section>
        ) : null}

        {activeLevel === 'optimizer' ? (
          <section className="content-grid">
            <Card
              title="Iteration Outcome Diff"
              subtitle="Baseline vs selected candidate across optimization iterations."
              className="span-7"
              helpText="Compares the success rate of the baseline configuration against the best candidate found in each optimization iteration. Shows the progression of improvement over time."
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={iterationTrendRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-24} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    dataKey="baselineSuccessRate"
                    stroke={COLORS.red}
                    strokeWidth={2}
                    name="Baseline success %"
                  />
                  <Line
                    dataKey="selectedSuccessRate"
                    stroke={COLORS.green}
                    strokeWidth={3}
                    name="Selected success %"
                  />
                  <Line
                    dataKey="selectedFitness"
                    stroke={COLORS.accent}
                    strokeWidth={2}
                    name="Selected fitness"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Target Distance"
              subtitle="How far each iteration baseline remains from optimizer target bands."
              className="span-5"
              helpText="Measures the deviation of key metrics (like win rate, pacing, early loss) from their desired target ranges across iterations. Helps identify if the optimizer is converging towards the target."
              insight={targetDistanceInsights}
              warning={targetDistanceWarnings}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={targetDistanceRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-24} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="winRateDistance" fill={COLORS.green} name="Win rate distance" />
                  <Bar dataKey="avgRoundsDistance" fill={COLORS.blue} name="Pacing distance" />
                  <Bar dataKey="earlyLossDistance" fill={COLORS.red} name="Early loss distance" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Candidate Leaderboard"
              subtitle="Top candidate outcomes per iteration with fitness and metric lift."
              className="span-7"
              helpText="Lists the best individual genomes discovered by the genetic algorithm. These represent the most balanced parameter sets found during the optimization process."
            >
              <DataTable
                columns={['Iteration', 'Candidate', 'Strategy', 'Fitness', 'Success lift', 'Turns delta']}
                rows={topCandidateRows.slice(0, 12).map((row: any) => [
                  row.label,
                  row.candidateId,
                  row.strategy,
                  `${row.fitness}`,
                  `${row.successLift}%`,
                  `${row.avgTurnsDelta}`,
                ])}
              />
            </Card>

            <Card
              title="Accepted Patch Timeline"
              subtitle="Accepted optimizer interventions. Empty history indicates stagnation."
              className="span-5"
              helpText="A historical record of which parameter 'patches' were actually accepted into the scenario configuration. Useful for tracking the evolution of the scenario balance."
            >
              {(optimizer?.acceptedPatches || []).length ? (
                <MetricList
                  items={(optimizer.acceptedPatches || []).map((item: any) => [
                    item.runKey ? `${item.runKey} · I${item.iteration}` : `Iteration ${item.iteration}`,
                    `${item.strategy} | Δ success ${pct(item.current?.successRate - item.previous?.successRate)}`,
                  ])}
                />
              ) : (
                <EmptyState
                  title="No accepted patches"
                  body="The latest optimizer run did not commit any candidate patch. Use the candidate tables and target-distance charts to inspect stagnation."
                />
              )}
            </Card>

            <Card
              title="Action Mix Delta"
              subtitle="Selected run or run-scope action share versus the earliest available baseline."
              className="span-6"
            >
              {actionMixDeltaRows.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={actionMixDeltaRows.slice(0, 7)}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="baselineShare" fill={COLORS.red} name="Baseline share" />
                    <Bar dataKey="selectedShare" fill={COLORS.green} name="Selected share" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No action delta yet"
                  body="Historical optimizer runs in this scope do not expose action-balance summaries."
                />
              )}
            </Card>

            <Card
              title="Action Diversity by Run"
              subtitle="Run-level entropy, dominant action pressure, and targeted-action lift."
              className="span-6"
            >
              {actionRunDiagnostics.length ? (
                <DataTable
                  columns={['Run', 'Entropy', 'Dominant', 'Targeted', 'Lift']}
                  rows={actionRunDiagnostics.map((row: any) => [
                    row.compactLabel,
                    num(row.actionEntropy),
                    row.dominantLabel,
                    pct(row.targetedShare),
                    pct(row.underusedActionLift),
                  ])}
                />
              ) : (
                <MetricList
                  items={[
                    ['Scenario entropy', num(actionDiversity?.entropy)],
                    ['Dominant action', titleCase(actionDiversity?.dominantAction || 'n/a')],
                    ['Targeted share', pct(actionDiversity?.targetedShare)],
                  ]}
                />
              )}
            </Card>

            <Card
              title="Recommended Config"
              subtitle="Exact run-level recommendation for the current selection."
              className="span-12"
            >
              {recommendedConfig ? (
                <div className="recommendation-grid">
                  <div className="recommendation-block">
                    <p className="eyebrow">Run Summary</p>
                    <MetricList
                      items={[
                        ['Run', recommendedConfig.compactLabel || compactRunLabel(recommendedConfig.label)],
                        ['Generated', recommendedConfig.generatedAt || 'n/a'],
                        ['Stop reason', titleCase(recommendedConfig.stopReason || 'unknown')],
                        ['Success', pct(recommendedConfig.finalMetrics?.successRate)],
                        ['Public victory', pct(recommendedConfig.finalMetrics?.publicVictoryRate)],
                        ['Average turns', num(recommendedConfig.finalMetrics?.averageTurns)],
                      ]}
                    />
                  </div>
                  <div className="recommendation-block">
                    <p className="eyebrow">Recommended Patch</p>
                    {Object.keys(recommendedConfig.flattenedPatch || {}).length ? (
                      <DataTable
                        columns={['Parameter', 'Value']}
                        rows={Object.entries(recommendedConfig.flattenedPatch || {}).map(([key, value]) => [
                          key,
                          String(value),
                        ])}
                      />
                    ) : (
                      <EmptyState title="No patch recommendation" body="This run ended without a recommended patch." />
                    )}
                  </div>
                  <div className="recommendation-block">
                    <p className="eyebrow">Optimizer Settings</p>
                    <DataTable
                      columns={['Field', 'Value']}
                      rows={Object.entries(recommendedConfig.optimizerConfig || {})
                        .filter(([, value]) => value !== null && value !== undefined)
                        .map(([key, value]) => [
                          key,
                          Array.isArray(value) ? value.join(', ') : String(value),
                        ])}
                    />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No single run selected"
                  body="Switch the run scope to a single concrete run to inspect the exact recommended config."
                />
              )}
            </Card>
          </section>
        ) : null}

        {activeLevel === 'parameters' ? (
          <section className="content-grid">
            <Card
              title="Parameter Impact Ranking"
              subtitle="Average fitness and success lift for parameters appearing in candidate patches."
              className="span-6"
              helpText="Ranks scenario parameters by their influence on the outcome. A high 'success lift' means adjusting this parameter had a strong positive effect on the win rate."
              insight={parameterImpactInsights}
              warning={parameterImpactInsights.length === 0 ? "Tracking impactful system levers" : undefined}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={parameterImpactRows} layout="vertical" margin={{ left: 36 }}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis
                    dataKey="parameter"
                    type="category"
                    tick={{ fill: COLORS.slate, fontSize: 12 }}
                    width={180}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgFitnessDelta" fill={COLORS.accent} name="Avg fitness delta" />
                  <Bar dataKey="avgSuccessLift" fill={COLORS.green} name="Avg success lift" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Candidate Tradeoff Cloud"
              subtitle="Success lift vs pacing delta with point size driven by patch complexity."
              className="span-6"
              helpText="A multi-dimensional view of candidates. The X-axis is success improvement, Y-axis is pacing change. The best candidates occupy the top-right quadrant (higher success, faster/slower as desired)."
            >
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" />
                  <XAxis
                    type="number"
                    dataKey="successLift"
                    name="Success lift"
                    tick={{ fill: COLORS.slate, fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="avgTurnsDelta"
                    name="Average turns delta"
                    tick={{ fill: COLORS.slate, fontSize: 12 }}
                  />
                  <Tooltip />
                  <Scatter data={candidateCloudRows} fill={COLORS.blue} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="GA Convergence"
              subtitle={
                selectedOptimizerIteration === 'all'
                  ? 'Average best, mean, and median fitness by generation across the selected run scope.'
                  : `Best, mean, and median fitness across generations for iteration ${selectedOptimizerIteration}.`
              }
              className="span-7"
              helpText="Tracks the effectiveness of the Genetic Algorithm. As generations pass, the 'Best' (green) line should rise and 'Mean' (pink) should follow, indicating the population is successfully evolving toward the solution."
              insight={gaConvergenceInsights}
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={gaRowsForIteration}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="generation" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => Number(value).toFixed(3)} />
                  <Legend />
                  <Line dataKey="bestFitness" stroke={COLORS.green} strokeWidth={3} />
                  <Line dataKey="meanFitness" stroke={COLORS.accent} strokeWidth={2} />
                  <Line dataKey="medianFitness" stroke={COLORS.blue} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Genome Drift"
              subtitle={
                selectedOptimizerIteration === 'all'
                  ? 'Average best-genome parameter values by generation across the selected run scope.'
                  : `Best-genome parameter drift across generations for iteration ${selectedOptimizerIteration}.`
              }
              className="span-5"
              helpText="Shows how the values of key parameters changed over GA generations. Stabilizing lines indicate that the optimizer has 'decided' on the best values for those variables."
              warning={genomeDriftWarnings}
            >
              {genomePreview.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={genomeRowsForIteration}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="generation" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => Number(value).toFixed(2)} />
                    <Legend />
                    {genomePreview.map((key, index) => (
                      <Line
                        key={key}
                        dataKey={key}
                        stroke={[
                          COLORS.accent,
                          COLORS.green,
                          COLORS.blue,
                          COLORS.gold,
                          COLORS.red,
                        ][index % 5]}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No GA drift data"
                  body="This scenario does not have generation reports in the latest optimizer run."
                />
              )}
            </Card>
          </section>
        ) : null}

        {activeLevel === 'actions' ? (
          <section className="content-grid">
            <Card
              title={t('sections.actionDiversity.title')}
              subtitle={t('sections.actionDiversity.subtitle')}
              className="span-4"
              helpText={t('sections.actionDiversity.help')}
              warning={actionDiversityWarning}
            >
              <MetricList
                items={[
                  ['Scenario entropy', num(actionDiversity?.entropy)],
                  ['Dominant action', titleCase(actionDiversity?.dominantAction || 'n/a')],
                  ['Dominant share', pct(actionDiversity?.concentration)],
                  ['Targeted share', pct(actionDiversity?.targetedShare)],
                ]}
              />
            </Card>

            <Card
              title={t('sections.actionDiversityByRun.title')}
              subtitle={t('sections.actionDiversityByRun.subtitle')}
              className="span-8"
              helpText={t('sections.actionDiversityByRun.help')}
              warning={actionDiversityRunWarnings}
            >
              {actionRunDiagnostics.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={actionRunDiagnostics}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="compactLabel" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => Number(value).toFixed(2)} />
                    <Legend />
                    <Bar dataKey="actionEntropy" fill={COLORS.green} name="Entropy" />
                    <Bar dataKey="targetedShare" fill={COLORS.blue} name="Targeted share" />
                    <Bar dataKey="underusedActionLift" fill={COLORS.accent} name="Targeted lift" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No run-level diversity data"
                  body="Choose a scope with optimizer runs to compare action diversity across runs."
                />
              )}
            </Card>

            <Card
              title={t('sections.actionMixDelta.title')}
              subtitle={t('sections.actionMixDelta.subtitle')}
              className="span-6"
              helpText={t('sections.actionMixDelta.help')}
              insight={actionMixInsight}
            >
              {actionMixDeltaRows.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={actionMixDeltaRows.slice(0, 7)}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="baselineShare" fill={COLORS.red} name="Baseline share" />
                    <Bar dataKey="selectedShare" fill={COLORS.green} name="Selected share" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="No action delta yet"
                  body="Historical optimizer runs in this scope do not expose action-balance summaries."
                />
              )}
            </Card>

            <Card
              title={t('sections.actionMixByOutcome.title')}
              subtitle={t('sections.actionMixByOutcome.subtitle')}
              className="span-6"
              helpText={t('sections.actionMixByOutcome.help')}
              insight={actionMixByOutcomeInsights}
              warning={actionMixByOutcomeWarnings}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={actionMixRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="victory" fill={COLORS.green} name="Victory avg" />
                  <Bar dataKey="defeat" fill={COLORS.red} name="Defeat avg" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Action Share by Round"
              subtitle="Normalized action share over time for the selected outcome and player-count slice."
              className="span-8"
              helpText="Shows the temporal usage of actions. Green line is 'Launch Campaign', Pink line is 'Investigate'."
              insight={actionShareByRoundInsights}
              warning={actionShareByRoundInsights.length === 0 ? "Tracking action round progression" : undefined}
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={filteredActionShareByRoundRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="round" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} domain={[0, 'auto']} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  {CORE_ACTION_KEYS.map((action, index) => (
                    <Line
                      key={action}
                      dataKey={action}
                      name={ACTION_LABELS[action]}
                      stroke={[
                        COLORS.green,
                        COLORS.accent,
                        COLORS.red,
                        COLORS.blue,
                        COLORS.gold,
                        COLORS.brown,
                        COLORS.muted,
                      ][index % 7]}
                      strokeWidth={action === 'launchCampaign' || action === 'investigate' ? 3 : 2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Terminal Timing by Outcome"
              subtitle="Action share in the final three rounds before victory versus defeat."
              className="span-4"
              helpText="Compares action share at the end of the game before state termination."
              warning={terminalTimingWarnings}
              insight={terminalTimingWarnings.length === 0 ? "Tracking successful terminal plays" : undefined}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={actionTimingRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="victory" fill={COLORS.green} name="Before victory" />
                  <Bar dataKey="defeat" fill={COLORS.red} name="Before defeat" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Action Mix by Player Count"
              subtitle="Which actions survive or collapse across 2P, 3P, and 4P."
              className="span-6"
              helpText="Analyzes how game scale impacts strategy. Some actions (like International Outreach) may be critical in 4P but marginalized in 2P due to action economy constraints."
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={actionMixByPlayerCountRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  {CORE_ACTION_KEYS.map((action, index) => (
                    <Line
                      key={action}
                      dataKey={action}
                      name={ACTION_LABELS[action]}
                      stroke={[
                        COLORS.green,
                        COLORS.accent,
                        COLORS.red,
                        COLORS.blue,
                        COLORS.gold,
                        COLORS.brown,
                        COLORS.muted,
                      ][index % 7]}
                      strokeWidth={action === 'launchCampaign' || action === 'investigate' ? 3 : 2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Opportunity vs Selection"
              subtitle="Heuristic opportunity windows versus observed action share."
              className="span-6"
              helpText="Measures the 'attractiveness' of actions. The gold bar shows how often an action was available to be played, while the pink bar shows how often it was actually chosen. High opportunity but low selection indicates an underpowered action."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={actionOpportunityRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="opportunityRate" fill={COLORS.gold} name="Opportunity rate" />
                  <Bar dataKey="selectionRate" fill={COLORS.accent} name="Selection rate" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Scenario Edit Recommendations"
              subtitle="Scenario levers to increase targeted-action importance by 20-30%."
              className="span-12"
              helpText="Direct design suggestions based on the action gap analysis. Recommends specific parameter changes ('levers') to balance the strategic depth of the scenario."
            >
              <DataTable
                columns={['Action', 'Current', 'Target', 'Lever', 'Patch hypothesis', 'Risk']}
                rows={scenarioRecommendations.map((item: any) => [
                  item.label,
                  pct(item.currentShare),
                  pct(item.targetShare),
                  item.lever,
                  item.patchHypothesis,
                  item.risk,
                ])}
              />
            </Card>
          </section>
        ) : null}

        {activeLevel === 'trajectories' ? (
          <section className="content-grid">
            <Card
              title="Outcome Flow"
              subtitle="Victory and defeat mix in raw simulation runs."
              className="span-3"
              helpText="A high-level view of the success rate for the current run scope. Helps quickly identify if the scenario is generally leaning towards player victory (green) or systemic defeat (red)."
            >
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={trajectory?.outcomeMix || []}
                    dataKey="count"
                    nameKey="result"
                    innerRadius={56}
                    outerRadius={100}
                  >
                    {(trajectory?.outcomeMix || []).map((row: any, index: number) => (
                      <Cell
                        key={`${row.result}-${index}`}
                        fill={row.result === 'victory' ? COLORS.green : COLORS.red}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Action Diversity"
              subtitle="Overall entropy, dominant action pressure, and targeted-action share."
              className="span-3"
              helpText="Measures how varied the player strategies are. High Entropy indicates a diverse range of actions, while high Concentration suggests a 'one-note' strategy that might need rebalancing."
            >
              <MetricList
                items={[
                  ['Entropy', num(actionDiversity?.entropy)],
                  ['Dominant action', titleCase(actionDiversity?.dominantAction || 'n/a')],
                  ['Dominant share', pct(actionDiversity?.concentration)],
                  ['Targeted share', pct(actionDiversity?.targetedShare)],
                ]}
              />
            </Card>

            <Card
              title="Action Mix by Outcome"
              subtitle="Average action counts in wins versus defeats."
              className="span-6"
              helpText="Reveals causal links between specific actions and victory. If 'Victory avg' (green) for an action is significantly higher than 'Defeat avg' (red), it suggests that action is a key driver of success."
              insight={actionMixByOutcomeInsights}
              warning={actionMixByOutcomeWarnings}
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={actionMixRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="victory" fill={COLORS.green} name="Victory avg" />
                  <Bar dataKey="defeat" fill={COLORS.red} name="Defeat avg" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Action Share by Round"
              subtitle="Normalized action share over time for the selected outcome and player-count slice."
              className="span-8"
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={filteredActionShareByRoundRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="round" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} domain={[0, 'auto']} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  {CORE_ACTION_KEYS.map((action, index) => (
                    <Line
                      key={action}
                      dataKey={action}
                      name={ACTION_LABELS[action]}
                      stroke={[
                        COLORS.green,
                        COLORS.accent,
                        COLORS.red,
                        COLORS.blue,
                        COLORS.gold,
                        COLORS.brown,
                        COLORS.muted,
                      ][index % 7]}
                      strokeWidth={action === 'launchCampaign' || action === 'investigate' ? 3 : 2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Terminal Timing by Outcome"
              subtitle="Action share in the final three rounds before victory versus defeat."
              className="span-4"
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={actionTimingRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="victory" fill={COLORS.green} name="Before victory" />
                  <Bar dataKey="defeat" fill={COLORS.red} name="Before defeat" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Action Mix by Player Count"
              subtitle="Which actions survive or collapse across 2P, 3P, and 4P balance profiles."
              className="span-6"
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={actionMixByPlayerCountRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  {CORE_ACTION_KEYS.map((action, index) => (
                    <Line
                      key={action}
                      dataKey={action}
                      name={ACTION_LABELS[action]}
                      stroke={[
                        COLORS.green,
                        COLORS.accent,
                        COLORS.red,
                        COLORS.blue,
                        COLORS.gold,
                        COLORS.brown,
                        COLORS.muted,
                      ][index % 7]}
                      strokeWidth={action === 'launchCampaign' || action === 'investigate' ? 3 : 2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Action Opportunity vs Selection"
              subtitle="Heuristic opportunity windows versus observed action share."
              className="span-6"
              helpText="Plots the 'potential' for an action (when it was available to play) against how often it was actually chosen. Large gaps indicate actions that are available but unattractive to players."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={actionOpportunityRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="opportunityRate" fill={COLORS.gold} name="Opportunity rate" />
                  <Bar dataKey="selectionRate" fill={COLORS.accent} name="Selection rate" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Domain Pressure by Round"
              subtitle="Round-by-round domain pressure from raw run snapshots."
              className="span-7"
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={domainPressureRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="round" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {Object.keys(domainPressureRows[0] || {})
                    .filter((key) => key !== 'round')
                    .slice(0, 5)
                    .map((key, index) => (
                      <Line
                        key={key}
                        dataKey={key}
                        stroke={[
                          COLORS.red,
                          COLORS.gold,
                          COLORS.blue,
                          COLORS.green,
                          COLORS.accent,
                        ][index % 5]}
                        strokeWidth={2}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Global Tracks"
              subtitle="Average Global Gaze and War Machine movement over time."
              className="span-5"
              helpText="Tracks the systemic pressures of the game: 'Global Gaze' (international media attention) and 'War Machine' (militarization). Reaching the top of either track usually results in a specific defeat channel for players."
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trackPressureRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="round" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="globalGaze" stroke={COLORS.blue} strokeWidth={3} />
                  <Line dataKey="warMachine" stroke={COLORS.red} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Front Pressure"
              subtitle="Average extraction and comrades presence by front across trajectories."
              className="span-6"
              helpText="A spatial analysis of pressure. Extraction (red) represents system control/resource drain, while Comrades (green) represents player presence. Ideally, player presence should correlate with high-pressure fronts."
            >
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={frontPressureRows}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="front" />
                  <PolarRadiusAxis />
                  <Tooltip />
                  <Legend />
                  <RechartsRadar
                    name="Average extraction"
                    dataKey="averageExtraction"
                    stroke={COLORS.red}
                    fill={COLORS.red}
                    fillOpacity={0.2}
                  />
                  <RechartsRadar
                    name="Average comrades"
                    dataKey="averageComrades"
                    stroke={COLORS.green}
                    fill={COLORS.green}
                    fillOpacity={0.12}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Trajectory-to-Tuning Workflow"
              subtitle="Failure-path reading converted into concrete scenario levers."
              className="span-6"
            >
              <DataTable
                columns={['Pattern', 'Missing action', 'Likely lever', 'Candidate patch']}
                rows={trajectoryTuningRows.map((row: any) => [
                  row.pattern,
                  row.missingAction,
                  row.likelyLever,
                  row.candidatePatch,
                ])}
              />
            </Card>
          </section>
        ) : null}

        {activeLevel === 'comparison' ? (
          <section className="content-grid">
            {loadingComparison ? <LoadingState label="Comparing selected runs" compact /> : null}

            <Card
              title="Run Metric Delta"
              subtitle="How the right run changed key outcomes relative to the left run."
              className="span-5"
              helpText="Directly compares the performance delta between two simulation runs. Positive 'Success delta' means the second run (right) performed better than the first (left)."
            >
              {comparisonData ? (
                <MetricList
                  items={[
                    ['Success delta', pct(comparisonData.metricDiff?.successRate)],
                    ['Public victory delta', pct(comparisonData.metricDiff?.publicVictoryRate)],
                    ['Early termination delta', pct(comparisonData.metricDiff?.earlyTerminationRate)],
                    ['Average turns delta', num(comparisonData.metricDiff?.averageTurns)],
                    ['Accepted patches delta', String(comparisonData.metricDiff?.acceptedPatchCount || 0)],
                  ]}
                />
              ) : (
                <EmptyState title="Choose two runs" body="Select a left and right run to compare." />
              )}
            </Card>

            <Card
              title="Target vs Run Comparison"
              subtitle="Selected run metrics vs scenario-level design targets."
              className="span-8"
              helpText="Compares simulation outcomes to the 'Ideal Balance' targets defined for this scenario. If bars are misaligned, the optimizer will attempt to bridge the gap."
            >
              {comparisonData ? (
                <DataTable
                  columns={['Side', 'Run', 'Success', 'Public', 'Avg turns']}
                  rows={[
                    [
                      'Left',
                      comparisonData.leftRun?.compactLabel || compactRunLabel(comparisonData.leftRun?.label),
                      pct(comparisonData.leftRun?.finalMetrics?.successRate),
                      pct(comparisonData.leftRun?.finalMetrics?.publicVictoryRate),
                      num(comparisonData.leftRun?.finalMetrics?.averageTurns),
                    ],
                    [
                      'Right',
                      comparisonData.rightRun?.compactLabel || compactRunLabel(comparisonData.rightRun?.label),
                      pct(comparisonData.rightRun?.finalMetrics?.successRate),
                      pct(comparisonData.rightRun?.finalMetrics?.publicVictoryRate),
                      num(comparisonData.rightRun?.finalMetrics?.averageTurns),
                    ],
                  ]}
                />
              ) : (
                <EmptyState title="No comparison yet" body="Run details appear here once both runs are selected." />
              )}
            </Card>

            <Card
              title="Defeat Channel Shift"
              subtitle="Run-vs-run defeat composition."
              className="span-6"
              helpText="Shows how the 'Why we lose' makeup changed between two runs. Useful for checking if an intervention fixed one issue (e.g. Extraction) only to cause another (e.g. Comrade exhaustion)."
            >
              {comparisonData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData.defeatDiff}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="reason" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="left" fill={COLORS.red} name="Left defeat rate" />
                    <Bar dataKey="right" fill={COLORS.blue} name="Right defeat rate" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No defeat diff" body="Comparison chart appears once both runs load." />
              )}
            </Card>

            <Card
              title="Recommended Patch Diff"
              subtitle="Parameter-level differences between the two selected run recommendations."
              className="span-6"
            >
              {comparisonData ? (
                <DataTable
                  columns={['Parameter', 'Left', 'Right']}
                  rows={comparisonData.recommendedPatchDiff.map((item) => [
                    item.parameter,
                    String(item.left ?? ''),
                    String(item.right ?? ''),
                  ])}
                />
              ) : (
                <EmptyState title="No patch diff" body="Pick two runs with available recommendations." />
              )}
            </Card>

            <Card
              title="Action Share Shift"
              subtitle="Run-vs-run action mix change where action-balance summaries are available."
              className="span-12"
              helpText="Compares the frequency of every action type between two runs. Helps identify why one run succeeded where another failed (e.g. 'Oh, they did 15% more Organizing')."
            >
              {comparisonData?.actionDiff?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData.actionDiff}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={72} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="left" fill={COLORS.red} name="Left share" />
                    <Bar dataKey="right" fill={COLORS.green} name="Right share" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No action diff" body="These runs do not expose run-level action-balance summaries yet." />
              )}
            </Card>
          </section>
        ) : null}

        {activeLevel === 'recommendations' ? (
          <section className="content-grid">
            <Card
              title="Recommended Config Shelf"
              subtitle="Run-specific recommended config, optimizer settings, and accepted patch history."
              className="span-12"
              helpText="The 'Gold Standard' output. Lists the exact changes needed to achieve the target balance, alongside the settings that produced them and the history of improvements."
            >
              {recommendedConfig ? (
                <div className="recommendation-grid">
                  <div className="recommendation-block">
                    <p className="eyebrow">Run Summary</p>
                    <MetricList
                      items={[
                        ['Run', recommendedConfig.compactLabel || compactRunLabel(recommendedConfig.label)],
                        ['Generated', recommendedConfig.generatedAt || 'n/a'],
                        ['Stop reason', titleCase(recommendedConfig.stopReason || 'unknown')],
                        ['Success', pct(recommendedConfig.finalMetrics?.successRate)],
                        ['Public victory', pct(recommendedConfig.finalMetrics?.publicVictoryRate)],
                        ['Early termination', pct(recommendedConfig.finalMetrics?.earlyTerminationRate)],
                        ['Average turns', num(recommendedConfig.finalMetrics?.averageTurns)],
                      ]}
                    />
                  </div>
                  <div className="recommendation-block">
                    <p className="eyebrow">Recommended Patch</p>
                    {Object.keys(recommendedConfig.flattenedPatch || {}).length ? (
                      <DataTable
                        columns={['Parameter', 'Value']}
                        rows={Object.entries(recommendedConfig.flattenedPatch || {}).map(([key, value]) => [
                          key,
                          String(value),
                        ])}
                      />
                    ) : (
                      <EmptyState title="No patch recommendation" body="This run ended without a recommended patch." />
                    )}
                  </div>
                  <div className="recommendation-block">
                    <p className="eyebrow">Accepted Patch History</p>
                    {(recommendedConfig.acceptedPatches || []).length ? (
                      <DataTable
                        columns={['Iteration', 'Strategy', 'Score']}
                        rows={(recommendedConfig.acceptedPatches || []).map((item: any) => [
                          String(item.iteration),
                          item.strategy,
                          String(item.score ?? ''),
                        ])}
                      />
                    ) : (
                      <EmptyState title="No accepted patches" body="This run ended without committing a patch." />
                    )}
                  </div>
                </div>
              ) : topGenomeCandidate ? (
                <div className="recommendation-grid">
                  <div className="recommendation-block recommendation-block-inconclusive">
                    <p className="eyebrow">Top Genome (Draft)</p>
                    <div className="alert-banner warning">
                      <strong>⚠️ Inconclusive Recommendation</strong>
                      <p>
                        The optimizer has not yet identified a patch that meets all stability thresholds. 
                        Showing the highest-fitness genome found as a fallback.
                      </p>
                    </div>
                    <MetricList
                      items={[
                        ['Iteration', String(topGenomeCandidate.iteration)],
                        ['Strategy', titleCase(topGenomeCandidate.strategy || 'unknown')],
                        ['Fitness Score', num(topGenomeCandidate.score)],
                        ['Success Lift', pct(topGenomeCandidate.successLift)],
                        ['Status', 'Unverified'],
                      ]}
                    />
                  </div>
                  <div className="recommendation-block">
                    <p className="eyebrow">Best Candidate Patch</p>
                    {Object.keys(topGenomeCandidate.flattenedPatch || {}).length ? (
                      <DataTable
                        columns={['Parameter', 'Value']}
                        rows={Object.entries(topGenomeCandidate.flattenedPatch || {}).map(([key, value]) => [
                          key,
                          String(value),
                        ])}
                      />
                    ) : (
                      <EmptyState title="No parameter overrides" body="The top genome uses base values." />
                    )}
                  </div>
                  <div className="recommendation-block">
                    <p className="eyebrow">Why inconclusive?</p>
                    <div className="metric-list" style={{ fontSize: '13px', color: 'var(--slate)', lineHeight: '1.6' }}>
                      <p>Confidence is low because:</p>
                      <ul style={{ paddingLeft: '18px', margin: '4px 0' }}>
                        <li>Metric lift may be within statistical noise for this sample size.</li>
                        <li>Success rate variance across iterations remains high.</li>
                        <li>Optimizer terminated before reaching full convergence thresholds.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : allRunRecommendations.length ? (
                <div className="recommendation-grid">
                  <div className="recommendation-block">
                    <p className="eyebrow">Selected Run Status</p>
                    <EmptyState
                      title={t('common.noRecommendation')}
                      body={t('common.noDataBody')}
                    />
                  </div>
                  <div className="recommendation-block recommendation-block-wide">
                    <p className="eyebrow">{t('common.availableRuns')}</p>
                    <DataTable
                      columns={['Run', 'Success', 'Public', 'Avg turns', 'Patch fields']}
                      rows={allRunRecommendations.map((item: any) => [
                        item.compactLabel || compactRunLabel(item.label),
                        pct(item.finalMetrics?.successRate),
                        pct(item.finalMetrics?.publicVictoryRate),
                        num(item.finalMetrics?.averageTurns),
                        String(Object.keys(item.flattenedPatch || {}).length),
                      ])}
                    />
                  </div>
                </div>
              ) : recommendedConfigs.length ? (
                <DataTable
                  columns={['Run', 'Success', 'Public', 'Avg turns', 'Accepted patches']}
                  rows={recommendedConfigs.map((item: any) => [
                    item.compactLabel || compactRunLabel(item.label),
                    pct(item.finalMetrics?.successRate),
                    pct(item.finalMetrics?.publicVictoryRate),
                    num(item.finalMetrics?.averageTurns),
                    String((item.acceptedPatches || []).length),
                  ])}
                />
              ) : (
                <EmptyState title="No recommendation data" body="No available run for this scenario produced a recommended patch." />
              )}
            </Card>

            <Card
              title={t('sections.editRecommendations.title')}
              subtitle={t('sections.editRecommendations.subtitle')}
              className="span-8"
              helpText={t('sections.editRecommendations.help')}
              insight={editRecommendationInsight}
            >
              <DataTable
                columns={['Action', 'Current', 'Target', 'Lever', 'Patch hypothesis']}
                rows={scenarioRecommendations.map((item: any) => [
                  item.label,
                  pct(item.currentShare),
                  pct(item.targetShare),
                  item.lever,
                  item.patchHypothesis,
                ])}
              />
            </Card>

            <Card
              title="Balance Risks"
              subtitle="What could regress while lifting neglected actions."
              className="span-4"
              helpText="Identifies potential side effects of the proposed changes. For example, making 'Investigate' more powerful might accidentally make 'International Outreach' redundant."
            >
              <MetricList
                items={scenarioRecommendations.map((item: any) => [
                  item.label,
                  item.risk,
                ])}
              />
            </Card>

            <Card
              title="Trajectory Guidance"
              subtitle="How to use path analysis to validate that action importance is truly improving."
              className="span-12"
              helpText="Guidance for human designers on how to verify the optimizer's suggestions by looking at specific simulation path patterns."
            >
              <DataTable
                columns={['Pattern', 'Missing action', 'Likely lever', 'Candidate patch']}
                rows={trajectoryTuningRows.map((row: any) => [
                  row.pattern,
                  row.missingAction,
                  row.likelyLever,
                  row.candidatePatch,
                ])}
              />
            </Card>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`loading-state ${compact ? 'compact' : ''}`}>
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = '',
  helpText,
  insight,
  warning,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  helpText?: string;
  insight?: string | string[];
  warning?: string | string[];
}) {
  const { t } = useTranslation();

  const finalHelpText = helpText || `Displays diagnostic visual markers for ${title}.`;
  const finalInsight = insight && (Array.isArray(insight) ? insight.length > 0 : insight) 
    ? insight 
    : [`Tracking visual markers for ${title}. No unusual positive deviations detected.`];
  const finalWarning = warning && (Array.isArray(warning) ? warning.length > 0 : warning)
    ? warning
    : [`System metrics for ${title} are within expected historical boundaries.`];

  const renderTooltipList = (content: string | string[]) => {
    if (Array.isArray(content)) {
      if (content.length === 1) return <p>{content[0]}</p>;
      return (
        <ol style={{ margin: '0', paddingLeft: '16px', fontSize: '13px', lineHeight: '1.5' }}>
          {content.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
    }
    return <p>{content}</p>;
  };

  return (
    <section className={`card-panel ${className}`}>
      <div className="card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="card-icons" style={{ display: 'flex', gap: '8px' }}>
            <div className="tooltip-container">
              <HelpCircle size={18} className="help-icon" />
              <div className="tooltip-content">
                <strong>{title} {t('common.guide', { defaultValue: 'Guide' })}</strong>
                <p>{finalHelpText}</p>
              </div>
            </div>
            <div className="tooltip-container">
              <Info size={18} className="info-icon" />
              <div className="tooltip-content insight">
                <strong>{t('common.insight', { defaultValue: 'Insight' })}</strong>
                {renderTooltipList(finalInsight)}
              </div>
            </div>
            <div className="tooltip-container">
              <AlertTriangle size={18} className="warning-icon" />
              <div className="tooltip-content warning">
                <strong>{t('common.warning', { defaultValue: 'Warning' })}</strong>
                {renderTooltipList(finalWarning)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'soft';
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-mini">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="metric-list">
      {items.map(([label, value]) => (
        <div key={label} className="metric-row">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | number | ReactNode>>;
}) {
  const gridTemplate = `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`;
  return (
    <div className="data-table">
      <div className="data-table-head" style={{ gridTemplateColumns: gridTemplate }}>
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="data-table-row" style={{ gridTemplateColumns: gridTemplate }}>
          {row.map((cell, cellIndex) => (
            <span key={cellIndex} title={typeof cell === 'string' ? cell : undefined}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <ArrowLeftRight size={18} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export default App;
