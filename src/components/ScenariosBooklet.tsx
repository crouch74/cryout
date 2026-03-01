import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScenarioMetadata } from '../engine/types';

interface ScenariosBookletProps {
    scenarios: ScenarioMetadata[];
}

export const ScenariosBooklet: React.FC<ScenariosBookletProps> = ({ scenarios }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        console.log("📖 [Booklet] Initialized Scenarios Booklet Component");
    }, []);

    if (!scenarios || scenarios.length === 0) return null;

    const currentScenario = scenarios[currentIndex];

    const handleNext = () => {
        if (currentIndex < scenarios.length - 1) setCurrentIndex(currentIndex + 1);
    };

    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    };

    return (
        <div className="booklet-page" style={{
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: '2rem'
        }}>
            <button className="btn-skip" style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 10 }} onClick={() => navigate('/')}>
                ← Return to Landing Page
            </button>

            <div className="booklet-container" style={{
                display: 'flex',
                width: '100%',
                maxWidth: '1200px',
                minHeight: '75vh',
                background: '#f4ebd8',
                borderRadius: '8px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 100px rgba(0,0,0,0.1)',
                color: '#2a2a2a',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Visual binding line in the center */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1))',
                    boxShadow: '1px 0 3px rgba(255,255,255,0.5), -1px 0 5px rgba(0,0,0,0.1)',
                    zIndex: 5
                }} />

                {/* Left Page: Intro & Story */}
                <div className="booklet-left" style={{
                    flex: '1 1 50%',
                    padding: '3rem 4rem',
                    borderRight: '1px solid #d4c5b0',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    position: 'relative'
                }}>
                    <h1 style={{
                        fontSize: '2.5rem',
                        fontFamily: 'Georgia, serif',
                        marginBottom: '1rem',
                        borderBottom: '2px solid #2a2a2a',
                        paddingBottom: '0.5rem',
                        color: '#1a1a1a',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        {currentScenario.name}
                    </h1>
                    <h3 style={{
                        fontStyle: 'italic',
                        marginBottom: '2rem',
                        color: '#555',
                        fontWeight: 'normal',
                        fontSize: '1.2rem'
                    }}>
                        {currentScenario.description}
                    </h3>

                    <h4 style={{ textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #ccc', margin: '1rem 0', color: '#8b0000', fontSize: '0.9rem', paddingBottom: '0.25rem' }}>The Story</h4>
                    <p style={{ fontFamily: 'Georgia, serif', lineHeight: '1.8', fontSize: '1.1rem', marginBottom: '2rem', color: '#333' }}>
                        {currentScenario.story}
                    </p>

                    <h4 style={{ textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #ccc', margin: '1rem 0', color: '#8b0000', fontSize: '0.9rem', paddingBottom: '0.25rem' }}>Introduction</h4>
                    <p style={{ fontFamily: 'Georgia, serif', lineHeight: '1.8', fontSize: '1.1rem', color: '#333' }}>
                        {currentScenario.introduction}
                    </p>
                </div>

                {/* Right Page: Gameplay, Mechanics & Action */}
                <div className="booklet-right" style={{
                    flex: '1 1 50%',
                    padding: '3rem 4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    position: 'relative'
                }}>
                    <div style={{ flexGrow: 1 }}>
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #ccc', margin: '1rem 0', color: '#8b0000', fontSize: '0.9rem', paddingBottom: '0.25rem' }}>Gameplay Dynamics</h4>
                        <p style={{ fontFamily: 'Georgia, serif', lineHeight: '1.8', fontSize: '1.1rem', marginBottom: '2rem', color: '#333' }}>
                            {currentScenario.gameplay || "Standard scenario rules apply. Maintain solidarity networks while balancing systemic pressures across global regions to prevent systemic collapse."}
                        </p>

                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #ccc', margin: '1rem 0', color: '#8b0000', fontSize: '0.9rem', paddingBottom: '0.25rem' }}>Special Mechanics</h4>
                        <p style={{ fontFamily: 'Georgia, serif', lineHeight: '1.8', fontSize: '1.1rem', color: '#333' }}>
                            {currentScenario.mechanics || "No special mechanics for this scenario. Follow core rulebook instructions."}
                        </p>
                    </div>

                    <div style={{ marginTop: '3rem', textAlign: 'center', marginBottom: '3rem' }}>
                        <button
                            className="btn-cta btn-start"
                            style={{
                                padding: '1.2rem 3rem',
                                fontSize: '1.2rem',
                                background: '#2a2a2a',
                                color: '#f4ebd8',
                                border: '2px solid #111',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '2px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = '#111';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = '#2a2a2a';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            onClick={() => navigate(`/game/${currentScenario.id}`)}
                        >
                            Play Scenario
                        </button>
                    </div>

                    {/* Navigation Controls */}
                    <div style={{ position: 'absolute', bottom: '1.5rem', left: '3rem', right: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            style={{
                                background: 'transparent',
                                border: '1px solid #ccc',
                                cursor: currentIndex === 0 ? 'default' : 'pointer',
                                opacity: currentIndex === 0 ? 0.3 : 1,
                                fontWeight: 'bold',
                                color: '#333',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                fontSize: '0.8rem',
                                letterSpacing: '1px'
                            }}
                        >
                            ← Previous
                        </button>
                        <span style={{ fontFamily: 'Georgia, serif', color: '#555', fontStyle: 'italic' }}>
                            Page {currentIndex + 1} of {scenarios.length}
                        </span>
                        <button
                            onClick={handleNext}
                            disabled={currentIndex === scenarios.length - 1}
                            style={{
                                background: 'transparent',
                                border: '1px solid #ccc',
                                cursor: currentIndex === scenarios.length - 1 ? 'default' : 'pointer',
                                opacity: currentIndex === scenarios.length - 1 ? 0.3 : 1,
                                fontWeight: 'bold',
                                color: '#333',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                fontSize: '0.8rem',
                                letterSpacing: '1px'
                            }}
                        >
                            Explore Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
