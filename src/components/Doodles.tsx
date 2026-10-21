/**
 * Hand-drawn bits. Lines are deliberately a little uneven and use round caps,
 * so they read as pen on paper rather than icon-library vectors. Everything
 * strokes with `currentColor` and inherits the colour of where it sits.
 */

type SvgProps = { className?: string };

/** The logo: a thread that loops into a loose knot. */
export function KnotLogo({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" fill="none">
      <path
        d="M3 29c6 1 10-2 13-6 3-5 2-11 7-12 4-1 7 3 5 7-2 5-9 6-11 2-2-5 4-9 9-7 5 1 7 7 11 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="3.5" cy="29" r="2.2" fill="currentColor" />
    </svg>
  );
}

/** A loose underline, for the date in the masthead. */
export function Squiggle({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 200 12" preserveAspectRatio="none" className={className} aria-hidden="true" fill="none">
      <path
        d="M2 8c18-5 30 3 48-1s28-5 46-1 30 4 48 0 30-5 54-2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A little morning sun. */
export function SunDoodle({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="16" cy="16" r="5.5" />
      <path d="M16 3.5v3.2M16 25.3v3.2M3.5 16h3.2M25.3 16h3.2M7.2 7.2l2.2 2.2M22.6 22.6l2.2 2.2M7.2 24.8l2.2-2.2M22.6 9.4l2.2-2.2" />
    </svg>
  );
}

/**
 * A sewn-on button: the beads on a thread. Filled once the item is done,
 * an open ring while it's still waiting for you.
 */
export function SewnButton({ done, className }: SvgProps & { done: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill={done ? "var(--h)" : "var(--card)"} stroke="var(--h)" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.3" fill={done ? "var(--card)" : "var(--h)"} />
      <circle cx="15" cy="10" r="1.3" fill={done ? "var(--card)" : "var(--h)"} />
      <circle cx="9" cy="14.5" r="1.3" fill={done ? "var(--card)" : "var(--h)"} />
      <circle cx="15" cy="14.5" r="1.3" fill={done ? "var(--card)" : "var(--h)"} />
    </svg>
  );
}

/** The tick-box on the daily list: a wobbly circle and a check that draws in. */
export function CheckDoodle({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path className="check-circle origin-center" strokeWidth="1.8" d="M12 2.8c5.3-.2 9.3 3.6 9.2 9.1-.1 5.2-4 9.3-9.3 9.2-5.1-.1-9-4-9-9.2.1-5.4 3.9-8.9 9.1-9.1z" />
      <path className="check-mark" strokeWidth="2.4" d="M7.5 12.5l3 3 6-7" />
    </svg>
  );
}
