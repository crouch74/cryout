import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  ArrowLeftRight,
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
  { id: 'trajectories', label: 'Gameplay Trajectories', icon: Workflow },
] as const;

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

function App() {
  const [activeLevel, setActiveLevel] = useState<(typeof LEVELS)[number]['id']>('overview');
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [runScope, setRunScope] = useState<RunScope>('latest_single');
  const [selectedRunKey, setSelectedRunKey] = useState('');
  const [scenarioData, setScenarioData] = useState<ScenarioPayload | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const scenarioOptions = overview?.scenarios || [];
  const summary = overview?.summary;
  const currentScenario = scenarioData?.summary;
  const optimizer = scenarioData?.optimizer;
  const trajectory = scenarioData?.trajectory;
  const iterations = optimizer?.iterations || [];
  const runCatalog = optimizer?.selection?.runCatalog || [];
  const runSelectionLabel = optimizer?.selection?.label || 'No run scope selected';

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
      if (runCatalog[0]?.runKey) {
        setSelectedRunKey(runCatalog[0].runKey);
      }
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
  }, [selectedScenario, runScope, selectedRunKey, runCatalog]);

  useEffect(() => {
    setSelectedRunKey('');
    setScenarioData(null);
  }, [selectedScenario]);

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
        label: item.iterationLabel || `I${item.iteration}`,
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
          label: item.iterationLabel || `I${item.iteration}`,
          runLabel: item.runLabel,
          candidateId: candidate.candidateId,
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
  const frontPressureRows = trajectory?.frontPressure || [];

  const genomePreview = useMemo(() => {
    const keys = new Set<string>();
    genomeRows.forEach((row: any) => {
      Object.keys(row).forEach((key) => {
        if (key !== 'iteration' && key !== 'generation') {
          keys.add(key);
        }
      });
    });
    return Array.from(keys).slice(0, 5);
  }, [genomeRows]);

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
          <p className="eyebrow">Scenario</p>
          <select
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

          <div className="sidebar-metrics">
            <MetricMini label="Runs" value={`${currentScenario?.runs || 0}`} />
            <MetricMini label="Success" value={pct(currentScenario?.successRate)} />
            <MetricMini
              label="Optimizer"
              value={optimizer?.selection?.runCount ? `${optimizer.selection.runCount} run(s)` : 'No run'}
            />
          </div>
        </div>

        <div className="sidebar-card">
          <p className="eyebrow">Run Scope</p>
          <select
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
          {runScope === 'specific_run' ? (
            <select
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
          ) : null}
          <div className="question-row">
            <span>Current scope</span>
            <strong>{runSelectionLabel}</strong>
          </div>
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
              subtitle="Best, mean, and median fitness across generations."
              className="span-7"
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={generationRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-24} textAnchor="end" height={72} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="bestFitness" stroke={COLORS.green} strokeWidth={3} />
                  <Line dataKey="meanFitness" stroke={COLORS.accent} strokeWidth={2} />
                  <Line dataKey="medianFitness" stroke={COLORS.blue} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card
              title="Genome Drift"
              subtitle="Best-genome parameter drift across generations."
              className="span-5"
            >
              {genomePreview.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={genomeRows}>
                    <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: COLORS.slate, fontSize: 11 }} interval={0} angle={-24} textAnchor="end" height={72} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                    <Tooltip />
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
              className="span-4"
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
              title="Action Mix by Outcome"
              subtitle="Average action counts in wins versus defeats."
              className="span-8"
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={actionMixRows}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="action" tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <YAxis tick={{ fill: COLORS.slate, fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="victory" fill={COLORS.green} name="Victory avg" />
                  <Bar dataKey="defeat" fill={COLORS.red} name="Defeat avg" />
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
              className="span-12"
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
  return (
    <div className="data-table">
      <div className="data-table-head">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {rows.map((row, index) => (
        <div key={`${row.join('-')}-${index}`} className="data-table-row">
          {row.map((cell, cellIndex) => (
            <span key={`${cell}-${cellIndex}`}>{cell}</span>
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
