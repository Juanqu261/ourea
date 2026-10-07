function Svg({ children, className = 'flow-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function AreaIcon() {
  return (
    <Svg>
      <path d="M4 18l5-9 3 5 4-7 4 11H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function ConditionsIcon() {
  return (
    <Svg>
      <path d="M7 15a5 5 0 1 1 9.6-2.2A3.6 3.6 0 1 1 17 19H8.2A3.2 3.2 0 0 1 7 15z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function PrioritiesIcon() {
  return (
    <Svg>
      <path d="M6 18V10h3v8H6zm5 0V6h3v12h-3zm5 0v-5h3v5h-3z" fill="currentColor" />
    </Svg>
  );
}

export function PortfolioIcon() {
  return (
    <Svg>
      <rect x="4" y="7" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7V6a4 4 0 0 1 8 0v1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function ReviewIcon() {
  return (
    <Svg>
      <path d="M12 4l7 3v5c0 4.2-2.8 7.2-7 8.5C7.8 19.2 5 16.2 5 12V7l7-3z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function SafeguardsIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function ExposureIcon() {
  return (
    <Svg>
      <path d="M12 4c4.8 3.2 7 6.4 7 9.2A7 7 0 1 1 5 13.2C5 10.4 7.2 7.2 12 4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function BalancedIcon() {
  return (
    <Svg>
      <path d="M12 4v3M5 10h14M7 10l-2 8h4l1-8M17 10l2 8h-4l-1-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function EquityIcon() {
  return (
    <Svg>
      <circle cx="9" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="9" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 18c.6-3 2.4-4.5 4.5-4.5S13 15 13.5 18M14 18c.3-2 1.4-3.2 3-3.2 1.5 0 2.5 1 2.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function RainIcon() {
  return (
    <Svg>
      <path d="M8 10a4 4 0 0 1 7.5-1.8A3 3 0 1 1 16 14H8.5A2.5 2.5 0 0 1 8 10z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 17v2M12 16.5v2.5M15 17v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function BudgetIcon() {
  return (
    <Svg>
      <rect x="4" y="7" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12h8M12 9.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function RecommendIcon() {
  return (
    <Svg>
      <path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8L12 4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function ManualIcon() {
  return (
    <Svg>
      <path d="M5 19V9l4 2 3-5 3 5 4-2v10H5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function EvidenceIcon() {
  return (
    <Svg>
      <path d="M7 5h7l4 4v10H7V5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 5v4h4M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function CommunityIcon() {
  return (
    <Svg>
      <circle cx="12" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 18c.8-3.2 3-4.8 6-4.8s5.2 1.6 6 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function AlignmentIcon() {
  return (
    <Svg>
      <path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function DownloadIcon() {
  return (
    <Svg>
      <path d="M12 5v10M8 11l4 4 4-4M6 19h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const STEP_ICONS = {
  area: AreaIcon,
  conditions: ConditionsIcon,
  priorities: PrioritiesIcon,
  portfolio: PortfolioIcon,
  review: ReviewIcon,
  safeguards: SafeguardsIcon,
};

const LENS_ICONS = {
  exposure: ExposureIcon,
  balanced: BalancedIcon,
  equity: EquityIcon,
  runoff_stress: ConditionsIcon,
  low_regret_screen: ReviewIcon,
};

const PRIORITY_ICONS = {
  balanced: BalancedIcon,
  equity: EquityIcon,
  access: AreaIcon,
  low_regret: ReviewIcon,
  exposure_first: ExposureIcon,
  runoff_reduction: ConditionsIcon,
};

export function StepIcon({ id }) {
  const Icon = STEP_ICONS[id] ?? AreaIcon;
  return <Icon />;
}

export function LensIcon({ id }) {
  const Icon = LENS_ICONS[id] ?? BalancedIcon;
  return <Icon />;
}

export function PriorityGlyph({ id }) {
  const Icon = PRIORITY_ICONS[id] ?? BalancedIcon;
  return <Icon />;
}
