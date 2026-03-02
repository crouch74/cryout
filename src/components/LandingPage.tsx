import React from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n/index.ts';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const assetBase = `${import.meta.env.BASE_URL}assets/`;

    return (
        <div className="landing-page">
            {/* HERO SECTION */}
            <section className="landing-hero">
                <div className="hero-content">
                    <h1>The Stones Are<br />Crying Out</h1>
                    <p className="subtitle">
                        {t('ui.legacyLanding.subtitle', 'The earth refuses to be silent. Lead a global coalition of resistance against exploitation, authoritarianism, and systemic collapse. Your survival depends on the truth and the legacy you leave in the stone.')}
                    </p>
                    <button className="btn-cta" onClick={() => navigate('/scenarios')}>
                        {t('ui.legacyLanding.beginStruggle', 'Begin the Struggle')}
                    </button>
                    <br />
                    <button className="btn-skip" onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}>
                        {t('ui.legacyLanding.learnResistance', 'Learn About the Resistance ↓')}
                    </button>
                </div>
            </section>

            {/* THE MOVEMENTS SECTION */}
            <section className="landing-section">
                <span className="section-label">{t('ui.legacyLanding.coalitionLabel', 'The Coalition')}</span>
                <h2 className="section-title">{t('ui.legacyLanding.coalitionTitle', 'Who Stands With the Earth?')}</h2>
                <div className="movements-grid">
                    <div className="movement-card">
                        <div className="movement-image" style={{ backgroundImage: `url('${assetBase}organizer.png')` }} />
                        <div className="movement-content">
                            <h3>{t('ui.legacyLanding.organizersTitle', 'Community Organizers')}</h3>
                            <p>
                                {t('ui.legacyLanding.organizersBody', 'Grassroots leaders building solidarity networks on the ground. They turn local despair into collective power, establishing mutual aid hubs and mobilizing the sumud.')}
                                <strong>{t('ui.legacyLanding.skillsLabel', ' Skills:')}</strong>
                                {t('ui.legacyLanding.organizersSkills', ' Relief efforts, solidarity building, and direct action.')}
                            </p>
                        </div>
                    </div>
                    <div className="movement-card">
                        <div className="movement-image" style={{ backgroundImage: `url('${assetBase}journalist.png')` }} />
                        <div className="movement-content">
                            <h3>{t('ui.legacyLanding.journalistsTitle', 'Investigative Journalists')}</h3>
                            <p>
                                {t('ui.legacyLanding.journalistsBody', 'The eyes that see what the war machine attempts to hide. They document the truth in real-time, turning raw evidence into a global gaze that protects the vulnerable.')}
                                <strong>{t('ui.legacyLanding.skillsLabel', ' Skills:')}</strong>
                                {t('ui.legacyLanding.journalistsSkills', ' Evidence gathering, truth-seeking, and exposing corruption.')}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* GAMEPLAY SECTION */}
            <section className="landing-section" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <span className="section-label">{t('ui.legacyLanding.coreMechanicsLabel', 'Core Mechanics')}</span>
                <h2 className="section-title">{t('ui.legacyLanding.cycleTitle', 'The Cycle of Resistance')}</h2>
                <div className="gameplay-layout">
                    <div className="step-list">
                        <div className="gameplay-step">
                            <span className="step-number">01</span>
                            <div className="step-content">
                                <h4>{t('ui.legacyLanding.step1Title', 'Global Dynamics')}</h4>
                                <p>{t('ui.legacyLanding.step1Body', "Every round, the global temperature rises and systemic fronts like 'War' and 'Poverty' exert pressure on vulnerable regions.")}</p>
                            </div>
                        </div>
                        <div className="gameplay-step">
                            <span className="step-number">02</span>
                            <div className="step-content">
                                <h4>{t('ui.legacyLanding.step2Title', 'Strategic Intentions')}</h4>
                                <p>{t('ui.legacyLanding.step2Body', 'Coordinate your coalition members to commit actions: build relief hubs, gather evidence, or establish mutual aid networks.')}</p>
                            </div>
                        </div>
                        <div className="gameplay-step">
                            <span className="step-number">03</span>
                            <div className="step-content">
                                <h4>{t('ui.legacyLanding.step3Title', 'Systemic Resolution')}</h4>
                                <p>{t('ui.legacyLanding.step3Body', 'Resolve your actions against the world state. Success builds the Charter of Dignity; failure leads to burnout or displacement.')}</p>
                            </div>
                        </div>
                    </div>
                    <div className="how-to-win">
                        <h3>{t('ui.legacyLanding.victoryTitle', 'Victory: Liberation')}</h3>
                        <p>{t('ui.legacyLanding.victoryBody', 'Establish a critical mass of evidence and solidarity to force a systemic shift and ratify the Global Charter of Dignity.')}</p>
                        <button className="btn-cta" onClick={() => navigate('/scenarios')} style={{ padding: '1rem 2.5rem', fontSize: '1rem' }}>
                            {t('ui.legacyLanding.chooseScenario', 'Choose Your Scenario')}
                        </button>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ padding: '4rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                <p>{t('ui.legacyLanding.footer', '© 2026 The Stones Are Crying Out. A game of resistance and rebirth.')}</p>
                <div style={{ marginTop: '1rem' }}>
                    <button className="btn-skip" onClick={() => navigate('/about')} style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                        {t('ui.legacyLanding.readMechanics', 'Read About the Game & Mechanics')}
                    </button>
                </div>
            </footer>
        </div>
    );
};
