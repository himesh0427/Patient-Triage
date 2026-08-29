import React from 'react';

export default function EsiSquareBadge({ level, size = 'md' }) {
  const esiLevel = Math.max(1, Math.min(5, parseInt(level, 10) || 5));
  const dimensions = size === 'lg' ? { width: '32px', height: '32px', fontSize: '1rem' } : { width: '24px', height: '24px', fontSize: '0.8rem' };

  return (
    <div
      className={`esi-square-badge esi-${esiLevel}`}
      style={{ ...dimensions }}
      title={`ESI Level ${esiLevel}`}
    >
      {esiLevel}
    </div>
  );
}
