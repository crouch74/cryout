import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  ArrowLeftRight,
  BookMarked,
  Gauge,
  GitBranch,
  Layers,
  Radar,
  Target,
  Workflow,
} from 'lucide-react';
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type OverviewPayload = {
  summary: any;
  scenarios: any[];
  strategies: any[];
  optimizerStatus: any[];
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
    ).sort((a, b) => a - b);

    if (!availableIterations.length) {
      setSelectedOptimizerIteration('all');
      return;
    }

    if (
      selectedOptimizerIteration !== 'all' &&
      !availableIterations.includes(selectedOptimizerIteration)
    ) {
      setSelectedOptimizerIteration(availableIterations[availableIterations.length - 1]);
    }

    if (selectedOptimizerIteration === 'all' && availableIterations.length === 1) {
      setSelectedOptimizerIteration(availableIterations[0]);
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

  const trajectoryPlayerCountOptions = useMemo(
    () =>
      Array.from(
        new Set((trajectory?.playerCounts || []).map((item: any) => Number(item.playerCount)).filter(Boolean)),
      ).sort((a, b) => a - b),
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
      ).sort((a, b) => a - b),
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

  if (loadingOverview) {
    return <LoadingState label="Reading simulation intelligence" />;
  }

  const showScenarioFilter = activeLevel !== 'overview';
  const showRunScopeFilter =
    activeLevel === 'balance' || activeLevel === 'optimizer' || activeLevel === 'parameters';
  const showSpecificRunFilter = showRunScopeFilter && runScope === 'specific_run';
  const showIterationFilter = activeLevel === 'parameters' && optimizerIterationOptions.length > 0;
  const showComparisonFilters = activeLevel === 'comparison';
  const showRecommendationFilter = activeLevel === 'recommendations';
  const showTrajectoryFilters = activeLevel === 'trajectories';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Radar size={20} />
          </div>
          <div>
            <p className="eyebrow">Scenario Balance Lab</p>
            <h1>Stones Analytics</h1>
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
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-card">
          <p className="eyebrow">Questions</p>
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
            <p className="eyebrow">Simulation analytics system</p>
            <h2>{LEVELS.find((item) => item.id === activeLevel)?.label}</h2>
            <p className="lede">
              Multi-level balance diagnostics for scenarios, optimizer behavior, parameter
              effects, and gameplay trajectories.
            </p>
          </div>
          <div className="header-summary">
            <MetricCard
              label="Global Success Rate"
              value={pct(summary?.successRate)}
              tone="accent"
            />
            <MetricCard label="Scenarios" value={`${scenarioOptions.length}`} />
            <MetricCard
              label="Run Scope"
              value={runSelectionLabel}
              tone="soft"
            />
          </div>
        </header>

        {(showScenarioFilter || showRunScopeFilter || showIterationFilter || showComparisonFilters || showRecommendationFilter || showTrajectoryFilters) ? (
          <section className="filter-toolbar">
            {showScenarioFilter ? (
              <div className="filter-card">
                <label className="eyebrow" htmlFor="scenario-filter">Scenario</label>
                <select
                  id="scenario-filter"
                  value={selectedScenario}
                  onChange={(event) => setSelectedScenario(event.target.value)}
                  className="scenario-select"
                >
                  {scenarioOptions.map((scenario) => (
                    <option key={scenario.scenarioId} value={scenario.scenarioId}>
                      {titleCase(scenario.scenarioId)}
                    </option>
                  ))}
                </select>
                <div className="filter-meta">
                  <MetricMini label="Runs" value={`${currentScenario?.runs || 0}`} />
                  <MetricMini label="Success" value={pct(currentScenario?.successRate)} />
                </div>
              </div>
            ) : null}

            {showRunScopeFilter ? (
              <div className="filter-card">
                <label className="eyebrow" htmlFor="scope-filter">Run Scope</label>
                <select
                  id="scope-filter"
                  value={runScope}
                  onChange={(event) => setRunScope(event.target.value as RunScope)}
                  className="scenario-select"
                >
                  {RUN_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="filter-caption">{runSelectionLabel}</div>
              </div>
            ) : null}

            {showSpecificRunFilter ? (
              <div className="filter-card">
                <label className="eyebrow" htmlFor="run-filter">Specific Run</label>
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
                <div className="filter-caption">Pinned permalink-ready run selection.</div>
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
                  {optimizerIterationOptions.map((iteration) => (
                    <option key={iteration} value={iteration}>
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
                    <option value="">Select a run</option>
                    {runCatalog.map((run: any) => (
                      <option key={run.runKey} value={run.runKey}>
                        {run.label}
                      </option>
                    ))}
                  </select>
                  <div className="filter-caption">Baseline run.</div>
                </div>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="compare-right-filter">Right Run</label>
                  <select
                    id="compare-right-filter"
                    value={comparisonRightRunKey}
                    onChange={(event) => setComparisonRightRunKey(event.target.value)}
                    className="scenario-select"
                  >
                    <option value="">Select a run</option>
                    {runCatalog.map((run: any) => (
                      <option key={run.runKey} value={run.runKey}>
                        {run.label}
                      </option>
                    ))}
                  </select>
                  <div className="filter-caption">Comparison run.</div>
                </div>
              </>
            ) : null}

            {showRecommendationFilter ? (
              <>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="recommendation-scope-filter">Recommendation Source</label>
                  <select
                    id="recommendation-scope-filter"
                    value={runScope}
                    onChange={(event) => setRunScope(event.target.value as RunScope)}
                    className="scenario-select"
                  >
                    <option value="specific_run">Specific Run</option>
                    <option value="latest_single">Latest Single Run</option>
                    <option value="latest_parallel">Latest Parallel Run</option>
                  </select>
                  <div className="filter-caption">Recommendation must come from one concrete run.</div>
                </div>
                {runScope === 'specific_run' ? (
                  <div className="filter-card">
                    <label className="eyebrow" htmlFor="recommendation-run-filter">Recommended Run</label>
                    <select
                      id="recommendation-run-filter"
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
                    <div className="filter-caption">Pinned run for the recommended config shelf.</div>
                  </div>
                ) : null}
              </>
            ) : null}

            {showTrajectoryFilters ? (
              <>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="trajectory-outcome-filter">Outcome Slice</label>
                  <select
                    id="trajectory-outcome-filter"
                    value={trajectoryOutcomeFilter}
                    onChange={(event) => setTrajectoryOutcomeFilter(event.target.value as 'all' | 'victory' | 'defeat')}
                    className="scenario-select"
                  >
                    <option value="all">All Outcomes</option>
                    <option value="victory">Victories Only</option>
                    <option value="defeat">Defeats Only</option>
                  </select>
                  <div className="filter-caption">Filters action timing and share-by-round charts.</div>
                </div>
                <div className="filter-card">
                  <label className="eyebrow" htmlFor="trajectory-player-filter">Player Count</label>
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
                    <option value="all">All Player Counts</option>
                    {trajectoryPlayerCountOptions.map((playerCount) => (
                      <option key={playerCount} value={playerCount}>
                        {playerCount} Players
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
          <LoadingState label="Compiling scenario-level diagnostics" compact />
        ) : null}

        {activeLevel === 'overview' ? (
          <section className="content-grid">
            <Card
              title="Scenario Balance Matrix"
              subtitle="Library-wide comparison of win rate, campaign rate, pacing, and latest optimizer outcome."
              className="span-8"
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
              title="Global Defeat Composition"
              subtitle="Aggregate defeat channels from the global summary."
              className="span-4"
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
              title="Strategy Performance"
              subtitle="Average success and pacing by autoplayer strategy."
              className="span-6"
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

        {activeLevel === 'balance' ? (
          <section className="content-grid">
            <Card
              title="Player-Count Balance Split"
              subtitle="Success, public victory, and dominant defeat channels by player count."
              className="span-7"
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
            >
              <DataTable
                columns={['Iteration', 'Candidate', 'Strategy', 'Fitness', 'Success lift', 'Turns delta']}
                rows={topCandidateRows.slice(0, 12).map((row) => [
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

        {activeLevel === 'trajectories' ? (
          <section className="content-grid">
            <Card
              title="Outcome Flow"
              subtitle="Victory and defeat mix in raw simulation runs."
              className="span-3"
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
              title="Selected Run Summaries"
              subtitle="Snapshot of the two runs being compared."
              className="span-7"
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
              ) : allRunRecommendations.length ? (
                <div className="recommendation-grid">
                  <div className="recommendation-block">
                    <p className="eyebrow">Selected Run Status</p>
                    <EmptyState
                      title="No recommendation in selected run"
                      body="This run finished without a recommended patch. Other runs for this scenario did produce recommendations."
                    />
                  </div>
                  <div className="recommendation-block recommendation-block-wide">
                    <p className="eyebrow">Available Recommended Runs</p>
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
              title="Scenario Edit Plan"
              subtitle="Scenario-specific changes intended to raise underused action importance by 20-30%."
              className="span-8"
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
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-panel ${className}`}>
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
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
  rows: string[][];
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
        <div key={`${row.join('-')}-${index}`} className="data-table-row" style={{ gridTemplateColumns: gridTemplate }}>
          {row.map((cell, cellIndex) => (
            <span key={`${cell}-${cellIndex}`} title={cell}>
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
