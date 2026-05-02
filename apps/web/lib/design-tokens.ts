/**
 * Design tokens — single source of truth for the visual system.
 * All product screens and the landing page consume these.
 * Never hardcode hex values outside this file.
 */

export const colors = {
  // Backgrounds — layered dark surface system
  bg: {
    base: "#0a0a0a",       // page background
    surface: "#111111",    // elevated cards, panels
    overlay: "#181818",    // modals, dropdowns
    subtle: "#1a1a1a",     // hover states
  },

  // Borders
  border: {
    subtle: "#222222",     // default 1px border
    muted: "#2a2a2a",      // slightly more visible
    focus: "#5eead4",      // teal focus ring
  },

  // Text
  text: {
    primary: "#fafafa",    // headings, important content
    secondary: "#a1a1a1",  // body, descriptions
    muted: "#666666",      // timestamps, metadata
    inverse: "#0a0a0a",    // text on teal bg
  },

  // Accent — use sparingly
  teal: {
    DEFAULT: "#5eead4",
    dim: "#2dd4bf",
    subtle: "rgba(94,234,212,0.1)",
    glow: "rgba(94,234,212,0.15)",
  },

  // Status
  amber: "#fbbf24",
  red: "#ef4444",
  green: "#22c55e",
} as const;

export const typography = {
  display: {
    size: "clamp(64px, 8vw, 120px)",
    weight: "600",
    letterSpacing: "-0.04em",
    lineHeight: "1.0",
  },
  heading: {
    size: "clamp(36px, 5vw, 56px)",
    weight: "600",
    letterSpacing: "-0.03em",
    lineHeight: "1.1",
  },
  body: {
    size: "18px",
    weight: "400",
    lineHeight: "1.6",
  },
  mono: {
    family: "var(--font-mono), 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    size: "16px",
  },
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "48px",
  "2xl": "80px",
  "3xl": "128px",
  "4xl": "200px",
} as const;

export const motion = {
  duration: {
    fast: 0.15,
    base: 0.3,
    slow: 0.6,
    reveal: 0.8,
  },
  ease: {
    out: [0.0, 0.0, 0.2, 1.0] as const,
    spring: [0.34, 1.56, 0.64, 1.0] as const,
    smooth: [0.4, 0, 0.2, 1] as const,
  },
} as const;

// Animation variants for framer-motion
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: motion.duration.reveal, ease: motion.ease.out } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: motion.duration.slow, ease: motion.ease.out } },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
