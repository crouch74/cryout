import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  BookText,
  Briefcase,
  Check,
  ChevronDown,
  Clock3,
  Cog,
  Contrast,
  Copy,
  Database,
  Eye,
  FastForward,
  FileSearch2,
  FileText,
  Flag,
  Flame,
  Pickaxe,
  Fuel,
  Globe,
  GraduationCap,
  Hammer,
  HandCoins,
  Handshake,
  House,
  Languages,
  Leaf,
  Lock,
  Mail,
  Megaphone,
  MessageSquareQuote,
  MonitorSmartphone,
  Network,
  Newspaper,
  Radio,
  Rocket,
  Save,
  Scale,
  ScrollText,
  Search,
  Settings2,
  Share2,
  ShieldAlert,
  ShieldPlus,
  Sparkles,
  SquareStack,
  Swords,
  Target,
  TriangleAlert,
  User,
  Users,
  Waves,
  Wheat,
  X,
} from 'lucide-react';
import { uiTokens } from '../tokens/index.ts';
import type { GameIconName } from './iconTypes.ts';

const ICON_BY_NAME: Record<GameIconName, LucideIcon> = {
  comrades: Users,
  comrades: Users,
  crisis: TriangleAlert,
  close: X,
  copy: Copy,
  evidence: FileText,
  defense: ShieldPlus,
  extraction: Pickaxe,
  extractionToken: Pickaxe,
  pool: Database,
  globalGaze: Eye,
  warMachine: Cog,
  round: Clock3,
  modeLiberation: Flag,
  mandate: Mail,
  objective: Target,
  organize: Network,
  investigate: Search,
  launchCampaign: Rocket,
  buildSolidarity: Handshake,
  smuggleEvidence: Briefcase,
  internationalOutreach: Globe,
  defend: ShieldPlus,
  playCard: SquareStack,
  advancePhase: FastForward,
  frontWar: Swords,
  frontPlanet: Leaf,
  frontCage: Lock,
  frontTruth: Newspaper,
  frontHunger: Wheat,
  frontFossil: Fuel,
  frontVoice: Megaphone,
  frontWave: Waves,
  frontPatriarchy: ShieldAlert,
  frontJustice: Scale,
  ledger: BookText,
  seat: User,
  home: House,
  save: Save,
  language: Languages,
  goViral: Share2,
  exposeLies: FileSearch2,
  laborStrike: Hammer,
  coordinateDigital: MonitorSmartphone,
  burnVeil: Flame,
  schoolgirlNetwork: GraduationCap,
  composeChant: MessageSquareQuote,
  fundraise: HandCoins,
  mediaBlitz: Radio,
  sanctions: Ban,
  check: Check,
  chevronDown: ChevronDown,
  contrast: Contrast,
  sparkles: Sparkles,
  scrollText: ScrollText,
  settings: Settings2,
  x: X,
};

interface GameIconProps {
  name: GameIconName;
  size?: GameIconSize | number;
  strokeWidth?: number;
  title?: string;
  ariaLabel?: string;
  ariaHidden?: boolean;
  className?: string;
}

export type GameIconSize = keyof typeof uiTokens.layout.icon;

export function GameIcon({
  name,
  size = 'md',
  strokeWidth = 1.8,
  title,
  ariaLabel,
  ariaHidden = false,
  className = '',
}: GameIconProps) {
  const Component = ICON_BY_NAME[name];
  const resolvedSize = typeof size === 'number' ? size : uiTokens.layout.icon[size];

  return (
    <Component
      size={resolvedSize}
      strokeWidth={strokeWidth}
      color="currentColor"
      aria-label={ariaHidden ? undefined : (ariaLabel ?? title ?? name)}
      aria-hidden={ariaHidden}
      role={ariaHidden ? 'presentation' : 'img'}
      className={`ui-icon ui-icon-${name} ${className}`.trim()}
    >
      {title ? <title>{title}</title> : null}
    </Component>
  );
}

export type { GameIconProps };
