import { useState } from 'react';
import { t, type Locale } from '../i18n/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import { EngravedHeader, TableSurface, TabletopControls, ThemePlate } from './tabletop.tsx';

interface PlayerGuideScreenProps {
    locale: Locale;
    onLocaleChange: (locale: Locale) => void;
    onBackHome: () => void;
}

type GuideSection =
    | 'overview'
    | 'setup'
    | 'phases'
    | 'roles'
    | 'fronts'
    | 'regions'
    | 'resources'
    | 'cards'
    | 'charter'
    | 'winning'
    | 'glossary';

const SECTIONS: Array<{ id: GuideSection; label: string; icon: string }> = [
    { id: 'overview', label: 'Game Overview', icon: 'I' },
    { id: 'setup', label: 'Setting Up', icon: 'II' },
    { id: 'phases', label: 'Round Structure', icon: 'III' },
    { id: 'roles', label: 'Roles & Abilities', icon: 'IV' },
    { id: 'fronts', label: 'The Seven Fronts', icon: 'V' },
    { id: 'regions', label: 'World Map & Regions', icon: 'VI' },
    { id: 'resources', label: 'Resources & Economy', icon: 'VII' },
    { id: 'cards', label: 'Card Decks', icon: 'VIII' },
    { id: 'charter', label: 'The Charter', icon: 'IX' },
    { id: 'winning', label: 'Winning & Losing', icon: 'X' },
    { id: 'glossary', label: 'Glossary', icon: 'XI' },
];

export function PlayerGuideScreen({
    locale,
    onLocaleChange,
    onBackHome,
}: PlayerGuideScreenProps) {
    const [activeSection, setActiveSection] = useState<GuideSection>('overview');

    return (
        <TableSurface className="player-guide-table">
            <div className="player-guide-screen player-guide-booklet">
                <header className="guide-booklet-header shell-panel">
                    <EngravedHeader
                        eyebrow={t('ui.playerGuide.navEyebrow', 'Player Guide')}
                        title={t('ui.playerGuide.navTitle', 'Rulebook')}
                        detail={t('ui.playerGuide.overview.subtitle', 'A cooperative board game about solidarity, truth, and resilience in the face of systemic injustice.')}
                        actions={
                            <div className="header-control-stack">
                                <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
                                <TabletopControls />
                                <ThemePlate label={t('ui.playerGuide.backHome', 'Back to Home')} onClick={onBackHome} />
                            </div>
                        }
                    />
                </header>

                <nav className="guide-nav shell-panel guide-tab-rail" aria-label={t('ui.playerGuide.navTitle', 'Rulebook')}>
                    <ul className="guide-nav-list">
                        {SECTIONS.map((section) => (
                            <li key={section.id}>
                                <button
                                    type="button"
                                    className={`guide-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
                                    onClick={() => setActiveSection(section.id)}
                                >
                                    <span className="guide-nav-icon">{section.icon}</span>
                                    <span>{t(`ui.playerGuide.sections.${section.id}`, section.label)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <main className="guide-content guide-booklet-content">
                    {activeSection === 'overview' && <OverviewSection />}
                    {activeSection === 'setup' && <SetupSection />}
                    {activeSection === 'phases' && <PhasesSection />}
                    {activeSection === 'roles' && <RolesSection />}
                    {activeSection === 'fronts' && <FrontsSection />}
                    {activeSection === 'regions' && <RegionsSection />}
                    {activeSection === 'resources' && <ResourcesSection />}
                    {activeSection === 'cards' && <CardsSection />}
                    {activeSection === 'charter' && <CharterSection />}
                    {activeSection === 'winning' && <WinningSection />}
                    {activeSection === 'glossary' && <GlossarySection />}
                </main>
            </div>
        </TableSurface>
    );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function SectionHeader({ icon, eyebrow, title, subtitle }: { icon: string; eyebrow: string; title: string; subtitle: string }) {
    return (
        <header className="guide-section-header">
            <span className="guide-section-icon">{icon}</span>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="guide-section-subtitle">{subtitle}</p>
        </header>
    );
}

function OverviewSection() {
    return (
        <div className="guide-section">
            <SectionHeader
                icon="🌍"
                eyebrow={t('ui.playerGuide.overview.eyebrow', 'Chapter 1')}
                title={t('ui.playerGuide.overview.title', 'The Stones Are Crying Out')}
                subtitle={t('ui.playerGuide.overview.subtitle', 'A cooperative board game about solidarity, truth, and resilience in the face of systemic injustice.')}
            />

            <div className="guide-callout-ribbon">
                <div className="guide-callout witness">
                    <span className="guide-callout-number">2–4</span>
                    <span className="guide-callout-label">{t('ui.playerGuide.overview.players', 'Players')}</span>
                </div>
                <div className="guide-callout witness">
                    <span className="guide-callout-number">60–120</span>
                    <span className="guide-callout-label">{t('ui.playerGuide.overview.minutes', 'Minutes')}</span>
                </div>
                <div className="guide-callout witness">
                    <span className="guide-callout-number">14+</span>
                    <span className="guide-callout-label">{t('ui.playerGuide.overview.age', 'Age')}</span>
                </div>
            </div>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.overview.whatIsTitle', 'What Is This Game?')}</h3>
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.overview.whatIsBody1', '<strong>Dignity Rising</strong> is a fully cooperative strategy game where you and your fellow players form a coalition of activists, journalists, lawyers, and climate planners working to protect civilians, defend truth, and build lasting institutions — all while a relentless systemic antagonist (the <em>Capture Engine</em>) pushes the world toward collapse.') }} />
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.overview.whatIsBody2', 'You win by <strong>ratifying clauses in the Global Charter</strong> — binding protections for humanitarian corridors, free information, climate reparations, and more. You lose if any of the seven <strong>Fronts</strong> — War, Climate, Human Rights, Speech & Information, Poverty, Energy, or Art & Culture — collapses beyond recovery.') }} />
            </article>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.overview.fantasyTitle', 'The Fantasy')}</h3>
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.overview.fantasyBody1', "Imagine you're sitting in a dimly lit coordination room. Dispatch reports arrive from the field. Your journalist's last investigation exposed the extraction racket — but now censorship locks are closing fast. The Organizer is preparing a mass mobilization, but the coalition is running dangerously hot on burnout. The Lawyer just filed an emergency injunction at the international level. And the climate clock ticks toward a heatwave that will displace thousands.") }} />
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.overview.fantasyBody2', 'Every action matters. Every round, the system tightens. Will you accept a compromised deal to buy time, or refuse and absorb the pressure? The stones are crying out. <em>Can you hear them?</em>') }} />
            </article>

            <div className="guide-principles-grid">
                <article className="shell-card guide-principle">
                    <span className="guide-principle-icon">🤝</span>
                    <h3>{t('ui.playerGuide.overview.pCooperativeTitle', 'Cooperative')}</h3>
                    <p>{t('ui.playerGuide.overview.pCooperativeBody', 'You win or lose together. Discussion, coordination, and shared sacrifice define your coalition.')}</p>
                </article>
                <article className="shell-card guide-principle">
                    <span className="guide-principle-icon">⚡</span>
                    <h3>{t('ui.playerGuide.overview.pSystemicTitle', 'Systemic')}</h3>
                    <p>{t('ui.playerGuide.overview.pSystemicBody', 'No single crisis exists in isolation. War spills into displacement, poverty fuels disinformation, and culture holds it all together.')}</p>
                </article>
                <article className="shell-card guide-principle">
                    <span className="guide-principle-icon">🎭</span>
                    <h3>{t('ui.playerGuide.overview.pNarrativeTitle', 'Narrative')}</h3>
                    <p>{t('ui.playerGuide.overview.pNarrativeBody', 'Every card, every crisis, and every choice is grounded in real-world parallels — from extraction licensing to hospital sieges.')}</p>
                </article>
                <article className="shell-card guide-principle">
                    <span className="guide-principle-icon">⏳</span>
                    <h3>{t('ui.playerGuide.overview.pUrgentTitle', 'Urgent')}</h3>
                    <p>{t('ui.playerGuide.overview.pUrgentBody', 'The round window is finite. The system escalates automatically. Your coalition must choose where to act and what to sacrifice.')}</p>
                </article>
            </div>
        </div>
    );
}

function SetupSection() {
    return (
        <div className="guide-section">
            <SectionHeader
                icon="🎲"
                eyebrow={t('ui.playerGuide.setup.eyebrow', 'Chapter 2')}
                title={t('ui.playerGuide.setup.title', 'Setting Up the Table')}
                subtitle={t('ui.playerGuide.setup.subtitle', 'How to prepare a game of Dignity Rising.')}
            />

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.setup.step1Title', 'Step 1 · Choose a Scenario')}</h3>
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.setup.step1Body1', 'Each scenario frames the crisis differently. <strong>Witness &amp; Dignity</strong> places intense pressure on Palestine and its surrounding corridors with war and displacement, while <strong>Green Resistance</strong> focuses on extraction and ecological collapse across Congo, Sudan, and the Sahel.') }} />
                <p>{t('ui.playerGuide.setup.step1Body2', 'Each scenario defines the starting temperature, civic space, resource pool, regional vulnerabilities, and special rules that alter how the game flows.')}</p>
            </article>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.setup.step2Title', 'Step 2 · Choose Your Mode')}</h3>
                <div className="guide-two-col">
                    <div className="guide-mode-card">
                        <strong>{t('ui.playerGuide.setup.modeCoreTitle', 'Core Mode')}</strong>
                        <p>{t('ui.playerGuide.setup.modeCoreBody', 'Shorter game with 2 actions per turn. Recommended for first-time players or when you have under 90 minutes.')}</p>
                        <span className="rule-chip">{t('ui.playerGuide.setup.coreRounds', '6 Rounds')}</span>
                    </div>
                    <div className="guide-mode-card">
                        <strong>{t('ui.playerGuide.setup.modeFullTitle', 'Full Mode')}</strong>
                        <p>{t('ui.playerGuide.setup.modeFullBody', 'Extended game with 3 actions per turn. The full experience with Spotlight cards and deepened escalation.')}</p>
                        <span className="rule-chip">{t('ui.playerGuide.setup.fullRounds', '8 Rounds')}</span>
                    </div>
                </div>
            </article>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.setup.step3Title', 'Step 3 · Assign Roles')}</h3>
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.setup.step3Body1', 'Each player takes one role. No two players may share the same role. Choose from <strong>Community Organizer</strong>, <strong>Investigative Journalist</strong>, <strong>Human Rights Lawyer</strong>, or <strong>Climate &amp; Energy Planner</strong>.') }} />
                <p>{t('ui.playerGuide.setup.step3Body2', 'Roles determine your unique actions, passive abilities, and the type of institutions you can build. The coalition should discuss which roles are most needed for the chosen scenario.')}</p>
            </article>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.setup.step4Title', 'Step 4 · Read the Starting State')}</h3>
                <p>{t('ui.playerGuide.setup.step4Body1', 'Before you begin, review the scenario dashboard:')}</p>
                <ul className="guide-list">
                    <li><strong>{t('ui.playerGuide.setup.startingTemp', 'Temperature')}:</strong> {t('ui.playerGuide.setup.startingTempBody', 'The global heat level. Rises from crises and the climate clock.')}</li>
                    <li><strong>{t('ui.playerGuide.setup.startingCivic', 'Civic Space')}:</strong> {t('ui.playerGuide.setup.startingCivicBody', 'Ranges from OPEN to CLOSED. Restricts actions as it narrows.')}</li>
                    <li><strong>{t('ui.playerGuide.setup.startingResources', 'Resources')}:</strong> {t('ui.playerGuide.setup.startingResourcesBody', 'Solidarity, Evidence, Capacity — your shared resource pool.')}</li>
                    <li><strong>{t('ui.playerGuide.setup.startingFronts', 'Fronts')}:</strong> {t('ui.playerGuide.setup.startingFrontsBody', 'Each front begins with starting Pressure, Protection, and Impact values.')}</li>
                    <li><strong>{t('ui.playerGuide.setup.startingRegions', 'Regions')}:</strong> {t('ui.playerGuide.setup.startingRegionsBody', 'Check the World Theatre for vulnerability heatmaps and starting tokens.')}</li>
                </ul>
            </article>
        </div>
    );
}

function PhasesSection() {
    return (
        <div className="guide-section">
            <SectionHeader
                icon="🕒"
                eyebrow={t('ui.playerGuide.phases.eyebrow', 'Chapter 3')}
                title={t('ui.playerGuide.phases.title', 'Round Structure')}
                subtitle={t('ui.playerGuide.phases.subtitle', 'Each round consists of four phases. The system and the coalition take turns shaping the world.')}
            />

            <div className="guide-timeline">
                <article className="guide-phase-card shell-card">
                    <div className="phase-marker">1</div>
                    <div className="phase-content">
                        <h4>{t('ui.playerGuide.phases.p1Title', 'World Phase')} <small>{t('ui.playerGuide.phases.p1Subtitle', 'The System Acts')}</small></h4>
                        <p>{t('ui.playerGuide.phases.p1Body1', 'The Capture Engine advances its agenda. A card is drawn from the <strong>Capture Engine deck</strong> that raises pressure, adds locks, and may offer a <em>compromise deal</em> the coalition must vote on.')}</p>
                        <p>{t('ui.playerGuide.phases.p1Body2', 'Then a <strong>Crisis card</strong> is drawn, bringing climate disasters, displacement, or escalation. Deterioration hooks also fire — active locks continue to inflict damage automatically.')}</p>
                        <div className="guide-tip witness" dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.phases.p1Tip', '<strong>⚠️ Tip:</strong> Pay attention to coupling rules. When War pressure is ≥7, displacement tokens appear and Palestine access locks may trigger. When Poverty ≥7, disinformation floods the map through Palestine, Lebanon, and Egypt.') }} />
                    </div>
                </article>

                <article className="guide-phase-card shell-card">
                    <div className="phase-marker">2</div>
                    <div className="phase-content">
                        <h4>{t('ui.playerGuide.phases.p2Title', 'Coalition Phase')} <small>{t('ui.playerGuide.phases.p2Subtitle', 'Players Act')}</small></h4>
                        <p>{t('ui.playerGuide.phases.p2Body1', 'Each player takes their turn in seat order. On your turn, you have <strong>2 actions</strong> (Core) or <strong>3 actions</strong> (Full). Spend them to:')}</p>
                        <ul className="guide-list">
                            <li>{t('ui.playerGuide.phases.p2Action1', 'Use <strong>role-specific actions</strong> that target fronts, regions, or the global state')}</li>
                            <li>{t('ui.playerGuide.phases.p2Action2', 'Play <strong>shared actions</strong> like Rest &amp; Care or Cultural Resonance')}</li>
                            <li>{t('ui.playerGuide.phases.p2Action3', 'Trigger a <strong>breakthrough action</strong> at the cost of heavy burnout')}</li>
                        </ul>
                        <p>{t('ui.playerGuide.phases.p2Body2', 'Actions may consume resources (Solidarity, Evidence, Capacity) and some require targeting a specific region or front.')}</p>
                    </div>
                </article>

                <article className="guide-phase-card shell-card">
                    <div className="phase-marker">3</div>
                    <div className="phase-content">
                        <h4>{t('ui.playerGuide.phases.p3Title', 'End Phase')} <small>{t('ui.playerGuide.phases.p3Subtitle', 'Bookkeeping')}</small></h4>
                        <p>{t('ui.playerGuide.phases.p3Body1', "Coupling rules fire. The temperature may tick up. Front collapse conditions are checked — if any front's Impact reaches 10, or if extreme conditions (Pressure ≥9 and Protection ≤1) are met, the front collapses and the coalition <strong>loses immediately</strong>.")}</p>
                        <p>{t('ui.playerGuide.phases.p3Body2', 'Passive resource generation occurs, round flags reset, and delayed effects from earlier compromise deals may trigger.')}</p>
                    </div>
                </article>

                <article className="guide-phase-card shell-card">
                    <div className="phase-marker">4</div>
                    <div className="phase-content">
                        <h4>{t('ui.playerGuide.phases.p4Title', 'Charter Phase')} <small>{t('ui.playerGuide.phases.p4Subtitle', 'Progress Check')}</small></h4>
                        <p>{t('ui.playerGuide.phases.p4Body1', 'If the coalition has accumulated enough <strong>Charter Progress</strong> and the prerequisites for a Charter Clause are met, the clause is automatically ratified — permanently locking in protections and benefits.')}</p>
                        <p>{t('ui.playerGuide.phases.p4Body2', 'The round counter advances. If the maximum number of rounds has been reached, the game ends and your final tier is determined by the number of ratified clauses and remaining front health.')}</p>
                    </div>
                </article>
            </div>
        </div>
    );
}

function RolesSection() {
    const roles = [
        { id: 'organizer', icon: '📣', color: 'solidarity', desc: t('ui.playerGuide.roles.organizerDesc', 'Builds solidarity and keeps people moving when corridors close.') },
        { id: 'investigative_journalist', icon: '📝', color: 'evidence', desc: t('ui.playerGuide.roles.journalistDesc', 'Turns testimony into evidence and cracks open truth windows.') },
        { id: 'human_rights_lawyer', icon: '⚖️', color: 'evidence', desc: t('ui.playerGuide.roles.lawyerDesc', 'Clears locks, raises remedy pressure, and protects civic remedies.') },
        { id: 'climate_energy_planner', icon: '🌱', color: 'capacity', desc: t('ui.playerGuide.roles.plannerDesc', 'Builds resilient infrastructure that slows climate spillover.') },
    ];

    return (
        <div className="guide-section">
            <SectionHeader
                icon="👥"
                eyebrow={t('ui.playerGuide.roles.eyebrow', 'Chapter 4')}
                title={t('ui.playerGuide.roles.title', 'Roles & Abilities')}
                subtitle={t('ui.playerGuide.roles.subtitle', 'Each role brings a unique perspective and toolkit to the coalition.')}
            />

            <div className="guide-roles-grid">
                {roles.map((r) => (
                    <article key={r.id} className="guide-role-card shell-card">
                        <header className="role-card-header">
                            <span className="role-card-icon">{r.icon}</span>
                            <div>
                                <h4>{t(`content.roles.${r.id}.name`, r.id)}</h4>
                                <p>{r.desc}</p>
                            </div>
                        </header>
                        <div className="role-card-details">
                            <h5>{t('ui.playerGuide.roles.actions', 'Actions')}</h5>
                            <p className="role-passive"><em>Passive: {t(`content.roles.${r.id}.passive`, r.id)}</em></p>
                            <div className="role-meta">
                                <span className="rule-chip witness">{t('ui.playerGuide.roles.breakthrough', 'Breakthrough')}: 2🕯️</span>
                                <span className="rule-chip">{t('ui.playerGuide.roles.maxBurnout', 'Burnout Max: 8', { count: 8 })}</span>
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.roles.sharedTitle', 'Shared Actions')}</h3>
                <p>{t('ui.playerGuide.roles.sharedBody', 'All players have access to these regardless of role:')}</p>
                <div className="guide-two-col">
                    <div className="guide-mode-card">
                        <strong>{t('ui.playerGuide.roles.restCareTitle', 'Rest & Care')}</strong>
                        <p>{t('ui.playerGuide.roles.restCareBody', 'Recover 2 Burnout. Essential for staying in the fight.')}</p>
                    </div>
                    <div className="guide-mode-card">
                        <strong>{t('ui.playerGuide.roles.culturalResonanceTitle', 'Cultural Resonance')}</strong>
                        <p>{t('ui.playerGuide.roles.culturalResonanceBody', 'Spend 1 Solidarity. Draw a Culture card in a region and boost Culture protection.')}</p>
                    </div>
                </div>
            </article>

            <article className="guide-prose shell-card witness-border">
                <h3>{t('ui.playerGuide.roles.burnoutTitle', 'Burnout')}</h3>
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.roles.burnoutBody', 'Every player has a <strong>Burnout gauge</strong>. Breakthrough actions cost 2 Burnout. When Burnout is high, your character becomes <strong>Strained</strong> — certain actions may be locked or penalties applied. At maximum Burnout, you risk a complete incapacitation. Use <em>Rest &amp; Care</em> and Culture cards to recover.') }} />
            </article>
        </div>
    );
}

function FrontsSection() {
    const fronts = ['WAR', 'CLIMATE', 'RIGHTS', 'SPEECH_INFO', 'POVERTY', 'ENERGY', 'CULTURE'];

    return (
        <div className="guide-section">
            <SectionHeader
                icon="🛡️"
                eyebrow={t('ui.playerGuide.fronts.eyebrow', 'Chapter 5')}
                title={t('ui.playerGuide.fronts.title', 'The Seven Fronts')}
                subtitle={t('ui.playerGuide.fronts.subtitle', 'Fronts represent the global battlegrounds your coalition must manage. Each front has three tracks.')}
            />

            <div className="guide-fronts-list">
                {fronts.map((f) => (
                    <div key={f} className="guide-front-item shell-card">
                        <div className="front-identity">
                            <strong>{t(`content.fronts.${f}.name`, f)}</strong>
                            <code>{t(`ui.frontPatterns.${f}`, f)}</code>
                        </div>
                    </div>
                ))}
            </div>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.fronts.anatomy', 'Front Anatomy')}</h3>
                <ul className="guide-list">
                    <li><strong>{t('ui.playerGuide.fronts.pressure', 'Pressure')}:</strong> {t('ui.playerGuide.fronts.pressureBody', 'How aggressively the system is pushing against this front. High pressure drives impact upward and triggers coupling rules.')}</li>
                    <li><strong>{t('ui.playerGuide.fronts.protection', 'Protection')}:</strong> {t('ui.playerGuide.fronts.protectionBody', "Your coalition's accumulated defenses. Protections buffer against damage and are prerequisites for Charter ratification.")}</li>
                    <li><strong>{t('ui.playerGuide.fronts.impact', 'Impact')}:</strong> {t('ui.playerGuide.fronts.impactBody', 'The real-world harm that has occurred. When Impact reaches 10, the front collapses and you lose.')}</li>
                </ul>
            </article>

            <article className="guide-prose shell-card intervention-border">
                <h3>{t('ui.playerGuide.fronts.coupling', 'Coupling')}</h3>
                <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.fronts.systemicTip', '<strong>💡 Key Insight:</strong> Fronts are interconnected. Ignoring one front will cascade into others. War pressure creates displacement, which strains rights. Poverty fuels disinformation, which undermines speech. Culture is both your shield and your last resort for maintaining solidarity. <em>Think systemically.</em>') }} />
            </article>
        </div>
    );
}

function RegionsSection() {
    return (
        <div className="guide-section">
            <SectionHeader
                icon="🗺️"
                eyebrow={t('ui.playerGuide.regions.eyebrow', 'Chapter 6')}
                title={t('ui.playerGuide.regions.title', 'World Map & Regions')}
                subtitle={t('ui.playerGuide.regions.subtitle', 'The world is divided into eight regions, each with distinct vulnerability profiles.')}
            />

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.regions.howTitle', 'How Regions Work')}</h3>
                <p>{t('ui.playerGuide.regions.howBody1', 'Each region has a vulnerability profile that determines how global pressure translates into local harm. When a crisis card or coupling rule fires, vulnerable regions take the brunt of the damage — receiving displacement tokens, locks, or direct pressure increases.')}</p>
                <p>{t('ui.playerGuide.regions.howBody2', 'Regions can accumulate tokens (displacement, disinformation, extraction), locks (Aid Access, Censorship, Surveillance), and institutions (Mutual Aid Hubs, Legal Clinics, etc.).')}</p>
            </article>

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.regions.tokensTitle', 'Tokens & Locks')}</h3>
                <div className="guide-two-col">
                    <div className="guide-token-group">
                        <h5>{t('ui.playerGuide.regions.tokensLabel', 'Tokens (stackable)')}</h5>
                        <ul className="guide-list">
                            <li><strong>{t('ui.playerGuide.regions.displacement', 'Displacement')}:</strong> {t('ui.playerGuide.regions.displacementBody', 'Civilians forced to move. Removed by Organizer actions.')}</li>
                            <li><strong>{t('ui.playerGuide.regions.disinfo', 'Disinformation')}:</strong> {t('ui.playerGuide.regions.disinfoBody', 'Propaganda undermining public trust. Removed by Journalist actions.')}</li>
                            <li><strong>{t('ui.playerGuide.regions.debt', 'Compromise Debt')}:</strong> {t('ui.playerGuide.regions.debtBody', 'The cost of accepting system deals. Triggers delayed effects.')}</li>
                        </ul>
                    </div>
                    <div className="guide-token-group">
                        <h5>{t('ui.playerGuide.regions.locksLabel', 'Locks (binary)')}</h5>
                        <ul className="guide-list">
                            <li><strong>{t('ui.playerGuide.regions.aid', 'Aid Access')}:</strong> {t('ui.playerGuide.regions.aidBody', 'Blocks humanitarian action. Cleared by Lawyer or Organizer.')}</li>
                            <li><strong>{t('ui.playerGuide.regions.censorship', 'Censorship')}:</strong> {t('ui.playerGuide.regions.censorshipBody', 'Restricts journalism and culture actions. Cleared by Truth Windows.')}</li>
                            <li><strong>{t('ui.playerGuide.regions.surveillance', 'Surveillance')}:</strong> {t('ui.playerGuide.regions.surveillanceBody', 'Increases rights pressure every round. Cleared by Lawyer.')}</li>
                        </ul>
                    </div>
                </div>
            </article>
        </div>
    );
}

function ResourcesSection() {
    return (
        <div className="guide-section">
            <SectionHeader
                icon="💎"
                eyebrow={t('ui.playerGuide.resources.eyebrow', 'Chapter 7')}
                title={t('ui.playerGuide.resources.title', 'Resources & Economy')}
                subtitle={t('ui.playerGuide.resources.subtitle', 'The coalition shares a pool of three core resources, plus a fourth gained through deals.')}
            />

            <div className="guide-resource-grid">
                <article className="shell-card guide-resource-card resource-solidarity">
                    <span className="guide-resource-icon">✊</span>
                    <h3>{t('ui.playerGuide.resources.solidarity', 'Solidarity')}</h3>
                    <p>{t('ui.playerGuide.resources.solidarityBody', "The people's will to act together. Spent by the Organizer to build Mutual Aid Networks and by anyone to trigger Cultural Resonance. Generated through Community Mobilization and Culture cards.")}</p>
                    <span className="rule-chip">{t('ui.playerGuide.resources.usedBy', 'Used by: {{roles}}', { roles: 'Organizer, All' })}</span>
                </article>

                <article className="shell-card guide-resource-card resource-evidence">
                    <span className="guide-resource-icon">🔍</span>
                    <h3>{t('ui.playerGuide.resources.evidence', 'Evidence')}</h3>
                    <p>{t('ui.playerGuide.resources.evidenceBody', 'Documented testimony, investigations, and accountability records. The Journalist generates it; the Lawyer spends it on injunctions and dossiers. Also a prerequisite for several Charter clauses.')}</p>
                    <span className="rule-chip">{t('ui.playerGuide.resources.usedBy', 'Used by: {{roles}}', { roles: 'Journalist, Lawyer' })}</span>
                </article>

                <article className="shell-card guide-resource-card resource-capacity">
                    <span className="guide-resource-icon">🔧</span>
                    <h3>{t('ui.playerGuide.resources.capacity', 'Capacity')}</h3>
                    <p>{t('ui.playerGuide.resources.capacityBody', 'Technical expertise and infrastructure. The Planner spends it to build microgrids and resilience retrofits. Generated passively and through system effects.')}</p>
                    <span className="rule-chip">{t('ui.playerGuide.resources.usedBy', 'Used by: {{roles}}', { roles: 'Planner' })}</span>
                </article>

                <article className="shell-card guide-resource-card resource-relief">
                    <span className="guide-resource-icon">📦</span>
                    <h3>{t('ui.playerGuide.resources.relief', 'Relief')}</h3>
                    <p>{t('ui.playerGuide.resources.reliefBody', 'Emergency humanitarian aid. Gained primarily through compromise deals offered by the Capture Engine. Useful in the short term, but often comes with hidden costs (Compromise Debt).')}</p>
                    <span className="rule-chip">{t('ui.playerGuide.resources.gainedFrom', 'Gained from: {{source}}', { source: 'Deals' })}</span>
                </article>
            </div>

            <article className="guide-prose shell-card witness-border">
                <div className="guide-tip" dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.resources.scarcityTip', '<strong>⚠️ Resource Scarcity:</strong> Resources are <em>shared</em> across the entire coalition. In a 4-player game, spending 2 Evidence on an injunction means the Journalist can\'t counter disinfo this round. Coordinate carefully.') }} />
            </article>
        </div>
    );
}

function CardsSection() {
    return (
        <div className="guide-section">
            <SectionHeader
                icon="🃏"
                eyebrow={t('ui.playerGuide.cards.eyebrow', 'Chapter 8')}
                title={t('ui.playerGuide.cards.title', 'Card Decks')}
                subtitle={t('ui.playerGuide.cards.subtitle', "Three decks drive the game's narrative and mechanical pressure.")}
            />

            <div className="guide-deck-grid">
                <article className="shell-card guide-deck-card deck-capture">
                    <div className="guide-deck-header">
                        <span className="guide-deck-icon">⚙️</span>
                        <h3>{t('ui.playerGuide.cards.captureTitle', 'Capture Engine')}</h3>
                    </div>
                    <p>{t('ui.playerGuide.cards.captureBody', 'The systemic antagonist. Each round, a Capture Engine card is drawn that <strong>raises pressure, deploys locks, and spreads disinformation</strong>. Cards are organized by four pillars:')}</p>
                    <div className="guide-pillar-grid">
                        <span className="guide-pillar">⛏️ {t('ui.playerGuide.cards.pillars.extraction', 'Extraction')}</span>
                        <span className="guide-pillar">🎖️ {t('ui.playerGuide.cards.pillars.militarization', 'Militarization')}</span>
                        <span className="guide-pillar">📜 {t('ui.playerGuide.cards.pillars.control', 'Control')}</span>
                        <span className="guide-pillar">📣 {t('ui.playerGuide.cards.pillars.consent', 'Manufactured Consent')}</span>
                    </div>
                    <p className="muted">{t('ui.playerGuide.cards.extraPillars', 'Some Capture cards offer <strong>Compromise Deals</strong> — immediate relief at the cost of future debt. The coalition must vote whether to accept or reject.')}</p>
                </article>

                <article className="shell-card guide-deck-card deck-crisis">
                    <div className="guide-deck-header">
                        <span className="guide-deck-icon">🔥</span>
                        <h3>{t('ui.playerGuide.cards.crisisTitle', 'Crisis')}</h3>
                    </div>
                    <p>{t('ui.playerGuide.cards.crisisBody', 'Natural disasters, escalations, and emergencies that <strong>deal direct Impact damage</strong> and generate displacement. Crisis cards are drawn each round during the World Phase.')}</p>
                    <div className="guide-card-example">
                        <span className="eyebrow">{t('ui.playerGuide.cards.examples', 'Example Cards')}</span>
                        <div className="guide-example-card">
                            <strong>🏔️ {t('ui.playerGuide.cards.example', 'Example Card')}</strong>
                            <p>...</p>
                        </div>
                    </div>
                </article>

                <article className="shell-card guide-deck-card deck-culture">
                    <div className="guide-deck-header">
                        <span className="guide-deck-icon">🎭</span>
                        <h3>{t('ui.playerGuide.cards.cultureTitle', 'Culture')}</h3>
                    </div>
                    <p>{t('ui.playerGuide.cards.cultureBody', "The coalition's creative resistance. Culture cards are drawn through the <strong>Cultural Resonance</strong> action and provide <strong>resources, burnout recovery, truth windows, and front protection</strong>.")}</p>
                </article>
            </div>
        </div>
    );
}

function CharterSection() {
    const clauses = [
        { id: 'corridors', icon: '🕊️' },
        { id: 'info', icon: '📰' },
        { id: 'remedy', icon: '⚖️' },
        { id: 'reparations', icon: '🌿' },
        { id: 'energy', icon: '⚡' },
        { id: 'culture', icon: '🎭' },
    ];

    return (
        <div className="guide-section">
            <SectionHeader
                icon="⚖️"
                eyebrow={t('ui.playerGuide.charter.eyebrow', 'Chapter 9')}
                title={t('ui.playerGuide.charter.title', 'The Global Charter')}
                subtitle={t('ui.playerGuide.charter.subtitle', "Your coalition's ultimate goal: ratify binding clauses that permanently protect people and institutions.")}
            />

            <article className="guide-prose shell-card">
                <h3>{t('ui.playerGuide.charter.howTitle', 'How Ratification Works')}</h3>
                <p>{t('ui.playerGuide.charter.howBody1', 'Each Charter clause has prerequisites — specific thresholds your coalition must reach. When you achieve enough Charter Progress, the first available clause that meets its prerequisites is automatically ratified.')}</p>
                <p>{t('ui.playerGuide.charter.howBody2', 'Ratified clauses provide permanent benefits — locking in protections, resources, and pressure reductions that persist for the rest of the game.')}</p>
            </article>

            <div className="guide-charter-grid">
                {clauses.map((clause) => (
                    <article key={clause.id} className="shell-card guide-charter-card">
                        <div className="guide-charter-header">
                            <span className="guide-charter-icon">{clause.icon}</span>
                            <h3>{t(`ui.playerGuide.charter.clauses.${clause.id}.title`, clause.id)}</h3>
                        </div>
                        <div className="guide-charter-prereq">
                            <span className="eyebrow">{t('ui.playerGuide.charter.prerequisites', 'Prerequisites')}</span>
                            <p>{t(`ui.playerGuide.charter.clauses.${clause.id}.prereq`, '...')}</p>
                        </div>
                        <div className="guide-charter-effect">
                            <span className="eyebrow">{t('ui.playerGuide.charter.onRatification', 'On Ratification')}</span>
                            <p>{t(`ui.playerGuide.charter.clauses.${clause.id}.effect`, '...')}</p>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

function WinningSection() {
    const tiers = ['gold', 'silver', 'bronze', 'survival'];

    return (
        <div className="guide-section">
            <SectionHeader
                icon="🏆"
                eyebrow={t('ui.playerGuide.winning.eyebrow', 'Chapter 10')}
                title={t('ui.playerGuide.winning.title', 'Winning & Losing')}
                subtitle={t('ui.playerGuide.winning.subtitle', "The coalition's fate is determined by their Charter progress and the state of the world.")}
            />

            <div className="guide-two-col">
                <article className="guide-prose shell-card guide-outcome-win">
                    <h3>🏆 {t('ui.playerGuide.winning.victoryTitle', 'Victory Conditions')}</h3>
                    <p>{t('ui.playerGuide.winning.victoryBody', 'The game ends after the final round. Your ending tier is determined by the number of ratified Charter clauses and the overall health of the seven Fronts.')}</p>
                    <div className="guide-tier-list">
                        {tiers.map((tier) => (
                            <div key={tier} className="guide-tier">
                                <span className={`guide-tier-badge tier-${tier}`}>{t(`ui.playerGuide.winning.tiers.${tier}.label`, tier)}</span>
                                <p>{t(`ui.playerGuide.winning.tiers.${tier}.desc`, '...')}</p>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="guide-prose shell-card guide-outcome-loss">
                    <h3>💀 {t('ui.playerGuide.winning.defeatTitle', 'Defeat Conditions')}</h3>
                    <p>{t('ui.playerGuide.winning.defeatBody', 'The coalition loses immediately if any of these occur:')}</p>
                    <ul className="guide-list guide-defeat-list">
                        <li>{t('ui.playerGuide.winning.defeat1', 'Any Front\'s Impact reaches 10 — catastrophic harm.')}</li>
                        <li>{t('ui.playerGuide.winning.defeat2', 'Any Front\'s Pressure reaches 9+ AND Protection reaches 0–1.')}</li>
                        <li>{t('ui.playerGuide.winning.defeat3', 'The Temperature reaches critical levels.')}</li>
                        <li>{t('ui.playerGuide.winning.defeat4', 'Civic Space reaches CLOSED.')}</li>
                    </ul>
                    <div className="guide-tip">
                        <p dangerouslySetInnerHTML={{ __html: t('ui.playerGuide.winning.strategy', '<strong>💡 Strategy:</strong> Watch the coupling rules. A front that looks "fine" can cascade into collapse through interconnected pressure. Prioritize the most vulnerable front while maintaining minimum protection on all others.') }} />
                    </div>
                </article>
            </div>
        </div>
    );
}

function GlossarySection() {
    const terms = [
        'burnout', 'capture', 'charter', 'charterProgress', 'civicSpace',
        'compromise', 'coupling', 'deterioration', 'displacement', 'disinfo',
        'front', 'impact', 'institution', 'lock', 'pressure', 'protection',
        'temperature', 'truth'
    ];

    return (
        <div className="guide-section">
            <SectionHeader
                icon="📖"
                eyebrow={t('ui.playerGuide.glossary.eyebrow', 'Reference')}
                title={t('ui.playerGuide.glossary.title', 'Glossary')}
                subtitle={t('ui.playerGuide.glossary.subtitle', 'Quick reference for key game terms and mechanics.')}
            />

            <div className="guide-glossary-list shell-card">
                {terms.map((term) => (
                    <div key={term} className="guide-glossary-entry">
                        <dt>{t(`ui.playerGuide.glossary.terms.${term}.term`, term)}</dt>
                        <dd>{t(`ui.playerGuide.glossary.terms.${term}.def`, '...')}</dd>
                    </div>
                ))}
            </div>
        </div>
    );
}
