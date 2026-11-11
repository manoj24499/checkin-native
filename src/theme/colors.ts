// "Inzivo Redesign 2" — light, glowing, animated. Warm off-white page (#F7F5F2), white bordered cards, dark
// ink text, a flat dark-brown "presence" hero panel, and an orange gradient (#FFA64D -> #EF6C00) with DARK
// text on it for primary buttons, avatars and the centre tab. See DESIGN_KIT.md at the repo root.
//
// Every token name from the earlier themes is kept (re-valued) so un-ported screens still compile. Note the
// historical names: `ink` = dark text, `lime*` = brand orange, `limeDeep`/`primaryDark` = accent TEXT orange.
export const colors = {
  background: "#F7F5F2",
  surface: "#FFFFFF",
  /** Muted fill (inner stat chips on white cards, unselected chips, tracks). */
  surfaceMuted: "#F1EDE8",
  /** Raised element on a muted track (active segment). */
  surfaceRaised: "#FFFFFF",
  border: "rgba(23,19,15,0.12)",

  primary: "#EF6C00",
  primaryDark: "#B34D05", // accent text on light (links, active tab, kickers)
  primaryMuted: "rgba(239,108,0,0.14)", // orange tint behind active chips/badges/date blocks
  /** Text/glyphs ON an orange fill: dark (the redesign puts dark text on orange). */
  primaryText: "#1A0E05",
  primarySoftText: "#FFB067",

  success: "#1E7A4D",
  successMuted: "rgba(74,222,128,0.15)",
  warning: "#8A5A00",
  warningMuted: "rgba(255,176,60,0.16)",
  danger: "#B3261E",
  dangerMuted: "rgba(255,92,92,0.14)",
  dangerBorder: "rgba(255,92,92,0.40)",

  textPrimary: "#17130F",
  textSecondary: "#6B635C",
  textMuted: "#8C837C",
  textInverse: "#FFFFFF",

  // Panels that were already dark (live map, navigation) go a shade deeper than the page.
  panelDark: "#050505",
  panelDarker: "#000000",
  textOnDark: "#F5F5F5",
  textOnDarkMuted: "rgba(245,245,245,0.65)",

  /** Flat dark "presence" panel (hero cards, sign-in header) with an orange hairline. */
  panelHero: "#2E1B10",
  panelHeroEdge: "rgba(239,108,0,0.42)",
  panelHeroText: "#F7F3EF",
  panelHeroMuted: "rgba(247,243,239,0.6)",
  panelHeroLine: "rgba(247,243,239,0.10)",
  /** Translucent chip/tile on the hero panel (stat boxes, quick tiles). */
  panelHeroChip: "rgba(255,255,255,0.08)",
  /** Icon stroke on hero/quick tiles. */
  panelHeroIcon: "#FFB067",

  /** Hairline borders / dividers / faint tracks on light surfaces. */
  hairline: "rgba(23,19,15,0.12)",
  hairlineSoft: "rgba(23,19,15,0.08)",
  hairlineStrong: "rgba(23,19,15,0.16)",
  hairlineBold: "rgba(23,19,15,0.28)",

  overlay: "rgba(23,19,15,0.45)",

  // ---- Accent / ink tokens (names kept from the lime theme) ----
  /** Dark body text (the "ink"). */
  ink: "#17130F",
  inkMuted: "rgba(23,19,15,0.65)",
  inkBorder: "rgba(23,19,15,0.14)",
  /**
   * Text/glyphs drawn on the DARK hero panel or on a saturated fill where light text is still used (legacy).
   * For text on the orange gradient/solid use `onOrange`.
   */
  onAccent: "#F7F3EF",
  onAccentMuted: "rgba(247,243,239,0.75)",
  /** Brand orange: glyphs/labels, the "you" marker, map route lines. */
  lime: "#EF6C00",
  limeStrong: "#EF6C00",
  limeMid: "#FF8A2B",
  /** Accent text orange (on light). */
  limeDeep: "#B34D05",
  /** Tab bar fill. */
  limePale: "rgba(255,255,255,0.96)",
  tabInactive: "#6B635C",
  /** Secondary text on orange surfaces. */
  onLimeSecondary: "rgba(26,14,5,0.72)",
  /** Translucent white chips on top of the dark hero. */
  glass: "rgba(255,255,255,0.08)",
  /** Faint ink fill (round icon buttons, inactive toggles). */
  glassStrong: "rgba(23,19,15,0.08)",
  warningText: "#8A5A00",

  // ---- Redesign 2 additions ----
  /** Orange gradient stops (135deg, top-left -> bottom-right). Use with `gradients.orange`. */
  orangeFrom: "#FFA64D",
  orangeTo: "#EF6C00",
  /** Dark text/glyphs on the orange gradient or solid orange. */
  onOrange: "#1A0E05",
  /** 1px card border. */
  cardBorder: "rgba(23,19,15,0.12)",
  /** Input border. */
  inputBorder: "rgba(23,19,15,0.14)",
  /** Kicker / small-caps label colour and accent links. */
  kicker: "#B34D05",
  accentText: "#B34D05",
  /** Round icon-button fill on the page. */
  iconButtonBg: "rgba(23,19,15,0.08)",
  /** Notification dots, avatar pulse ring. */
  pulse: "#FF8A2B",
  /** Ambient glows (centre colour; they fade to transparent). */
  glowOrange: "#EF6C00",
  glowPeach: "#FFAA5A",
  /** "Live" indicator. */
  liveDot: "#4ADE80",
  liveTextOnDark: "#6EE7A0",
  liveBgOnDark: "rgba(74,222,128,0.14)",
} as const;

export type ColorToken = keyof typeof colors;
