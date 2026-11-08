import { Maximize2 } from "lucide-react";

/**
 * סרטון בתוך גריד: מושתק, עם פקדים מובנים, ובלי להוריד את הקובץ עד לניגון.
 * הלחיצה נעצרת כאן כי כרטיס הגריד פותח את התצוגה המוגדלת, וזה היה חוטף כל
 * לחיצה על הפקדים. במקום זה יש כפתור הגדלה נפרד. האלמנט שעוטף חייב להיות
 * relative.
 */
const VideoTile = ({ src, className, style, onExpand }) => (
  <>
    {/* #t: בלעדיו iOS Safari לא מצייר את הפריים הראשון עם preload="metadata". */}
    <video
      src={`${src}#t=0.1`}
      className={className}
      style={style}
      muted
      controls
      playsInline
      preload="metadata"
      onClick={(e) => e.stopPropagation()}
    />
    {onExpand && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        aria-label="הגדלת הסרטון"
        className="absolute top-3 left-3 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-white"
      >
        <Maximize2 size={18} />
      </button>
    )}
  </>
);

export default VideoTile;
