/**
 * Reusable skeleton loader for various card shapes.
 * Uses Tailwind's animate-pulse for a smooth shimmer effect.
 */

/** Generic rectangular skeleton block */
export const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-200 rounded-2xl ${className}`} />
);

/** 2-column grid of photo skeletons for the Photos page */
export const PhotoGridSkeleton = ({ count = 6 }) => (
  <div className="columns-2 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse bg-slate-200 rounded-2xl mb-3 break-inside-avoid"
        style={{ height: `${[140, 180, 120, 160, 200, 150][i % 6]}px` }}
      />
    ))}
  </div>
);

/** Row of profile card skeletons for the Dating page */
export const ProfileCardSkeleton = ({ count = 2 }) => (
  <div className="flex gap-3 overflow-hidden">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse bg-slate-200 rounded-[2rem] flex-shrink-0 w-64 h-80"
      />
    ))}
  </div>
);

/** Module card skeletons for the Home page */
export const ModuleGridSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-2 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="animate-pulse bg-slate-200 rounded-[2rem] h-36" />
    ))}
  </div>
);

export default SkeletonBlock;
