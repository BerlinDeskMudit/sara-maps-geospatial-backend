import type { ReactNode } from 'react';

type IconProps = { className?: string };

type SvgProps = IconProps & { children: ReactNode; extraStyle?: React.CSSProperties };

function Svg({ className, children, extraStyle }: SvgProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={extraStyle}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const CoffeeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17 8h1a3 3 0 0 1 0 6h-1" />
    <path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
    <path d="M7 2v2M11 2v2M15 2v2" />
  </Svg>
);

export const FoodIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V10a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v11" />
    <path d="M5 21h6" />
    <path d="M8 2l-2 5M12 2l-2 5M18 21v-8" />
    <path d="M18 13a3 3 0 0 1-3-3V8h6v2a3 3 0 0 1-3 3z" />
  </Svg>
);

export const StayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V8l7-5 7 5v13" />
    <path d="M9 21v-6h6v6" />
  </Svg>
);

export const BookmarkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const DirectionsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2l10 10-10 10L2 12z" />
    <path d="M8 12h8" />
    <path d="M13 9l3 3-3 3" />
  </Svg>
);

export const BubbleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
  </Svg>
);

export const GpsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 12l7-7" />
    <path d="M9 3l10 10-7 1.5L10.5 21z" />
  </Svg>
);

export const LocateIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
);

export const CarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 16l1.5-5a2 2 0 0 1 1.9-1.4h9.2a2 2 0 0 1 1.9 1.4L20 16" />
    <path d="M4 16h16v3H4z" />
    <circle cx="8" cy="19" r="1.2" fill="currentColor" />
    <circle cx="16" cy="19" r="1.2" fill="currentColor" />
  </Svg>
);

export const WalkIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="13" cy="3.5" r="1.5" />
    <path d="M12 6l-2 5 3 2 1 6" />
    <path d="M10 11l-3 3 2 4" />
    <path d="M12 8l3 1" />
  </Svg>
);

export const BikeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="17" r="3" />
    <circle cx="18" cy="17" r="3" />
    <path d="M6 17l4-8h3" />
    <path d="M18 17l-3-6h-4" />
    <path d="M10 9h2" />
  </Svg>
);

export const CrossIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="5" />
    <path d="M12 8.5v7M8.5 12h7" />
  </Svg>
);

export const TreeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21v-5" />
    <path d="M12 16c3 0 5-2 5-5s-2-5-5-5-5 2-5 5 2 5 5 5z" />
    <path d="M12 10c2 0 3-1.5 3-3.5S14 3 12 3 9 4.5 9 6.5 10 10 12 10z" />
  </Svg>
);

const TURN_ROTATE: Record<number, number> = {
  0: 0, 1: 0, 2: 45, 3: -45, 8: 0, 9: 45, 10: 90, 11: 135,
  12: 180, 13: -45, 14: -90, 15: -135, 16: 90, 17: -90,
  19: 0, 20: 0, 21: -45, 22: 0, 23: 90, 24: -90,
};

const isRoundabout = (t: number) => t === 25 || t === 26 || t === 27;
const isArrive = (t: number) => t === 4 || t === 5 || t === 6 || t === 28;

export function TurnIcon({ type, className }: IconProps & { type: number }) {
  if (isRoundabout(type)) {
    return (
      <Svg className={className}>
        <path d="M20 12a8 8 0 1 1-2.4-5.7" />
        <path d="M16 3.5l4 1 1 4" />
      </Svg>
    );
  }
  if (isArrive(type)) {
    return (
      <Svg className={className}>
        <path d="M6 21V4" />
        <path d="M6 4h11l-3 4 3 4H6" />
      </Svg>
    );
  }
  const r = TURN_ROTATE[type] ?? 0;
  return (
    <Svg
      className={className}
      extraStyle={{ transform: `rotate(${r}deg)` }}
    >
      <path d="M12 3v14" />
      <path d="M8 7l4-4 4 4" />
    </Svg>
  );
}


