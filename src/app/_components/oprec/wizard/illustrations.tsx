import { type ReactNode } from 'react';

/** Ilustrasi kecil bergaya satu warna; mewarisi `currentColor` dari kerangka langkah. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 140"
      role="presentation"
      className="h-auto w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const soft = { fill: 'currentColor', fillOpacity: 0.14, stroke: 'none' };

export const TreeArt = () => (
  <Frame>
    <rect x="76" y="12" width="48" height="20" rx="6" {...soft} />
    <rect x="76" y="12" width="48" height="20" rx="6" />
    <path d="M100 32v14M44 62V46h112v16" />
    {[16, 76, 136].map((x, i) => (
      <g key={x}>
        <rect
          x={x}
          y="62"
          width="48"
          height="20"
          rx="6"
          {...(i === 1 ? soft : {})}
        />
        <rect x={x} y="62" width="48" height="20" rx="6" />
      </g>
    ))}
    <path d="M100 82v10M60 100h80" />
    <path d="m64 112 4 4 8-9" strokeWidth="3" />
    <path d="m124 112 4 4 8-9" strokeWidth="3" />
  </Frame>
);

export const TimelineArt = () => (
  <Frame>
    <path d="M20 70h160" />
    {[44, 100, 156].map((x, i) => (
      <g key={x}>
        <circle cx={x} cy="70" r="7" {...soft} />
        <circle cx={x} cy="70" r="7" />
        <rect x={x - 22} y={i % 2 ? 90 : 36} width="44" height="18" rx="6" />
        <path d={i % 2 ? `M${x} 77v13` : `M${x} 63V54`} />
      </g>
    ))}
  </Frame>
);

export const RulesArt = () => (
  <Frame>
    {[24, 62, 100].map((y) => (
      <g key={y}>
        <rect x="16" y={y} width="52" height="24" rx="8" />
        <rect x="76" y={y} width="32" height="24" rx="8" {...soft} />
        <rect x="76" y={y} width="32" height="24" rx="8" />
        <rect x="116" y={y} width="68" height="24" rx="8" />
      </g>
    ))}
  </Frame>
);

export const ChoicesArt = () => (
  <Frame>
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect
          x="20"
          y={20 + i * 36}
          width="160"
          height="26"
          rx="8"
          {...(i === 0 ? soft : {})}
        />
        <rect x="20" y={20 + i * 36} width="160" height="26" rx="8" />
        <circle cx="38" cy={33 + i * 36} r="7" />
        <path d="M48 33h0" />
        <path d={`M${54} ${33 + i * 36}h${70 - i * 14}`} />
        <path d={`M164 ${29 + i * 36}l-4 4 4 4`} />
      </g>
    ))}
  </Frame>
);

export const MoveArt = () => (
  <Frame>
    <rect x="14" y="26" width="64" height="88" rx="10" />
    <rect x="122" y="26" width="64" height="88" rx="10" {...soft} />
    <rect x="122" y="26" width="64" height="88" rx="10" />
    <rect x="24" y="40" width="44" height="22" rx="6" {...soft} />
    <rect x="24" y="40" width="44" height="22" rx="6" strokeDasharray="4 4" />
    <rect x="132" y="40" width="44" height="22" rx="6" />
    <path d="M78 51h34m-8-8 8 8-8 8" />
  </Frame>
);

export const LinksArt = () => (
  <Frame>
    {[0, 1].map((i) => (
      <g key={i}>
        <rect x="20" y={22 + i * 50} width="160" height="38" rx="10" />
        <rect x="32" y={32 + i * 50} width="18" height="18" rx="5" {...soft} />
        <path
          d={`M40 ${41 + i * 50}m-4 0a4 4 0 0 1 4-4h2M44 ${41 + i * 50}a4 4 0 0 1-4 4h-2`}
        />
        <path d={`M62 ${41 + i * 50}h${70 - i * 20}`} />
      </g>
    ))}
  </Frame>
);

export const SectionsArt = () => (
  <Frame>
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect
          x="20"
          y={14 + i * 40}
          width="160"
          height="32"
          rx="8"
          {...(i === 1 ? soft : {})}
        />
        <rect x="20" y={14 + i * 40} width="160" height="32" rx="8" />
        <path d={`M32 ${30 + i * 40}h${50 + i * 10}`} />
        <path d={`M150 ${24 + i * 40}v12m-6-6h12`} />
      </g>
    ))}
  </Frame>
);

export const ScoreArt = () => (
  <Frame>
    <path d="M24 112V24" />
    <path d="M24 112h152" />
    {[0, 1, 2, 3].map((i) => (
      <rect
        key={i}
        x={40 + i * 34}
        y={100 - [30, 62, 46, 78][i]!}
        width="22"
        height={[30, 62, 46, 78][i]}
        rx="4"
        {...soft}
      />
    ))}
    <path d="M24 56h152" strokeDasharray="5 5" />
    <path d="m150 36 6 6 12-14" strokeWidth="3" />
  </Frame>
);

export const EyeArt = () => (
  <Frame>
    <rect x="14" y="30" width="68" height="80" rx="10" />
    <rect x="118" y="30" width="68" height="80" rx="10" {...soft} />
    <rect x="118" y="30" width="68" height="80" rx="10" />
    <path d="M88 70c10-14 24-14 24 0s-14 14-24 0Z" transform="translate(0 0)" />
    <circle cx="100" cy="70" r="3" fill="currentColor" />
  </Frame>
);

export const InboxArt = () => (
  <Frame>
    <rect x="30" y="30" width="140" height="84" rx="12" />
    <path d="M30 78h44l8 12h36l8-12h44" />
    <path d="m70 50 12 12 24-24" strokeWidth="3" />
  </Frame>
);

export const PeopleArt = () => (
  <Frame>
    {[50, 100, 150].map((x, i) => (
      <g key={x}>
        <circle
          cx={x}
          cy={i === 1 ? 52 : 60}
          r="14"
          {...(i === 1 ? soft : {})}
        />
        <circle cx={x} cy={i === 1 ? 52 : 60} r="14" />
        <path
          d={`M${x - 22} ${i === 1 ? 108 : 112}c0-14 10-22 22-22s22 8 22 22`}
        />
      </g>
    ))}
  </Frame>
);
