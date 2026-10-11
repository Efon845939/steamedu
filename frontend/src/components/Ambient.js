import React from 'react';

// Ambient light field behind every page: slow drifting colour and faint graph paper,
// so glass layers have something to refract. Pure CSS (no motion library), fixed
// behind the content, decorative only. Lite mode hides the colour fields and reduced
// or off motion stops them (index.css).

const BLOBS = [
  { color: 'var(--amb-1)', pos: { left: '-12%', top: '-22%' }, anim: 'drift-a 26s' },
  { color: 'var(--amb-2)', pos: { right: '-38%', top: '-4%' }, anim: 'drift-b 32s' },
  { color: 'var(--amb-3)', pos: { left: '8%', top: '28%' }, anim: 'drift-c 38s' },
  { color: 'var(--amb-4)', pos: { left: '-20%', top: '-10%' }, anim: 'drift-d 44s' },
];

const Ambient = ({ quiet = false }) => (
  <div className="ambient" aria-hidden="true" data-decor style={quiet ? { '--ambient-a': 0.55 } : undefined}>
    {BLOBS.map((b, i) => (
      <div
        key={i}
        className="ambient-blob"
        style={{ ...b.pos, background: `radial-gradient(circle, ${b.color}, transparent 62%)`, animation: `${b.anim} ease-in-out infinite` }}
      />
    ))}
    {quiet ? null : <div className="ambient-grid" />}
  </div>
);

export default Ambient;
