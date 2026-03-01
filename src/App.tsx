import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { ScenariosBooklet } from './components/ScenariosBooklet';
import { GameDashboard } from './components/GameDashboard';
import type { ScenarioMetadata } from './engine/types';
import './index.css';

const MOCK_SCENARIOS: ScenarioMetadata[] = [
    {
        id: 'mvp_witness_dignity',
        name: "Witness & Dignity",
        description: "High pressure in MENA. Global solidarity is our only shield.",
        introduction: "In a world where the stones themselves seem to cry out against injustice, you lead a coalition of truth-seekers and community organizers. The 'Witness & Dignity' scenario focuses on the intense pressures within the MENA region, where global solidarity is the only shield against escalating conflict and climate collapse.",
        story: "The dust never settles here. In the ruins of what was once a vibrant neighborhood, the silence is deafening. But then, a rhythmic tapping. A child, hit by the debris of a fallen world, is using a stone to pulse a signal into the night. They are not just rubble. They are witnesses.",
        gameplay: "Players must balance managing regional pressures while trying to uncover hidden truths. Gathering evidence is key, but maintaining relief efforts is vital to prevent total collapse.",
        mechanics: "Requires careful utilization of 'Investigative Journalist' actions. Watch out for 'Disinformation' tokens which can sever communication lines between regions."
    },
    {
        id: 'green_resistance',
        name: "Green Resistance",
        description: "Protecting indigenous land rights and stopping illegal extraction.",
        introduction: "Beyond the cities, a different kind of war is being fought. The 'Green Resistance' explores the struggle for land and life in the Amazon and Sub-Saharan Africa. Can you protect the last lungs of the Earth against corporate-driven extraction?",
        story: "They come at night, with machines that sound like thunder. The jungle, once alive with a thousand voices, is becoming a graveyard of ancient giants. But the roots hold deep. And they are whispering to us. We will stand with the green.",
        gameplay: "Focus heavily on the 'Climate' front. Actions revolve around establishing blockades, legal battles against corporate entities, and mobilizing worldwide protests.",
        mechanics: "Introduces 'Legal Injunctions' and 'Land Defense' actions. You win by dropping the 'Climate' front pressure below a specific threshold for three consecutive rounds."
    }
];

function AboutPage() {
    const navigate = useNavigate();
    return (
        <div className="landing-page" style={{ overflowY: 'auto' }}>
            <button className="btn-skip" style={{ position: 'absolute', top: '2rem', left: '2rem' }} onClick={() => navigate('/')}>
                ← Back
            </button>
            <div className="landing-section" style={{ maxWidth: '800px', margin: '4rem auto', textAlign: 'left' }}>
                <span className="section-label">THE GAME</span>
                <h2 className="section-title">About Where the Stones Cry Out</h2>
                <div style={{ color: '#cbd5e1', lineHeight: '1.8', fontSize: '1.2rem' }}>
                    <p>
                        "Where the Stones Cry Out" is a cooperative board game built around the themes of global resistance, solidarity, and systemic shifts. Players take on the roles of various movements, and must work together to protect civil society, uncover truth, and ultimately, ratify a new Global Charter of Dignity.
                    </p>
                    <p style={{ marginTop: '1rem' }}>
                        This game is currently in development (MVP). We are experimenting with mechanics that simulate how local actions echo globally, forming networks of resilience against collapse.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/scenarios" element={<ScenariosBooklet scenarios={MOCK_SCENARIOS} />} />
                <Route path="/game/:id" element={<GameDashboard />} />
            </Routes>
        </BrowserRouter>
    );
}
