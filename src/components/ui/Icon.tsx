import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme";

type Shape =
  | { t: "path"; d: string }
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "rect"; x: number; y: number; width: number; height: number; rx?: number };

const p = (d: string): Shape => ({ t: "path", d });
const c = (cx: number, cy: number, r: number): Shape => ({ t: "circle", cx, cy, r });
const r = (x: number, y: number, width: number, height: number, rx?: number): Shape => ({
  t: "rect",
  x,
  y,
  width,
  height,
  rx,
});

// Line icons from the Lime mockup (24x24 grid, stroked, no fill).
const ICONS = {
  home: [p("M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z")],
  check: [c(12, 12, 9), p("M8 12.5l3 3 5-6")],
  checkmark: [p("M5 12.5l4.5 4.5L19 7")],
  requests: [p("M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5")],
  profile: [c(12, 8, 4), p("M4 21c0-4 3.6-7 8-7s8 3 8 7")],
  pin: [p("M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"), c(12, 9, 2.5)],
  arrow: [p("M5 12h14M13 6l6 6-6 6")],
  back: [p("M15 6l-6 6 6 6")],
  chevronRight: [p("M9 6l6 6-6 6")],
  chevronDown: [p("M6 9l6 6 6-6")],
  close: [p("M6 6l12 12M18 6L6 18")],
  camera: [
    p("M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"),
    c(12, 13, 3.5),
  ],
  image: [r(3, 4, 18, 16, 2), c(9, 10, 1.6), p("M21 16l-5-5-8 8")],
  user: [c(12, 9, 4), p("M5 20c1-3.5 4-5 7-5s6 1.5 7 5")],
  lock: [r(5, 11, 14, 9, 2), p("M8 11V8a4 4 0 0 1 8 0v3")],
  id: [r(3, 5, 18, 14, 2), c(9, 11, 2), p("M14 10h4M14 14h4M6 16c.6-1.3 1.7-2 3-2s2.4.7 3 2")],
  calendar: [r(4, 5, 16, 15, 2), p("M8 3v4M16 3v4M4 10h16")],
  clock: [c(12, 12, 9), p("M12 7v5l3 2")],
  bell: [p("M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4")],
  help: [c(12, 12, 9), p("M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 17h.01")],
  history: [p("M4 12a8 8 0 1 0 3-6.2M4 4v4h4M12 8v4l3 2")],
  car: [p("M5 16l1.5-6A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.9 1.5L19 16M4 16h16v3H4zM7 19v1M17 19v1")],
  wallet: [p("M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h14v-4M3 7h16a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4")],
  battery: [r(3, 8, 16, 9, 2), p("M21 11v3M7 11v3")],
  wifi: [p("M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01")],
  speaker: [p("M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6")],
  flag: [p("M5 21V4M5 4h11l-2 4 2 4H5")],
  shield: [p("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), p("M9 12l2 2 4-4")],
  logout: [p("M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9")],
  plus: [p("M12 5v14M5 12h14")],
  navigate: [p("M4 12l16-8-6 16-2-7z")],
  arrowUpRight: [p("M7 17L17 7M9 7h8v8")],
  arrowDownLeft: [p("M17 7L7 17M15 17H7V9")],
  eye: [p("M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"), c(12, 12, 3)],
  dots: [c(5, 12, 1.5), c(12, 12, 1.5), c(19, 12, 1.5)],
  alert: [c(12, 12, 9.5), p("M12 8v5"), p("M12 16.5v.5")],
  refresh: [p("M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5")],
  map: [p("M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"), p("M9 4v14M15 6v14")],
  send: [p("M21 3L10 14M21 3l-7 18-4-7-7-4z")],
  trash: [p("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3")],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  /** One of the mockup's line icons (see ICONS above for the full list). */
  name: IconName;
  /** Width/height in px. Default 20. */
  size?: number;
  /** Stroke colour. Default `colors.textPrimary` (ink). */
  color?: string;
  /** Stroke width on the 24px grid. Default 1.8 (keep within 1.75-2). */
  strokeWidth?: number;
}

/**
 * Shared stroked line icon (react-native-svg). Use everywhere instead of
 * drawing ad-hoc SVG paths, e.g. `<Icon name="pin" color={colors.lime} />`.
 */
export function Icon({ name, size = 20, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  const shapes: Shape[] = ICONS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes.map((s, i) => {
        if (s.t === "path") return <Path key={i} d={s.d} />;
        if (s.t === "circle") return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
        return <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />;
      })}
    </Svg>
  );
}

/** Lets components accept either an icon name or an arbitrary rendered node. */
export type IconSource = IconName | React.ReactElement;

export function renderIcon(icon: IconSource, size: number, color: string, strokeWidth?: number) {
  return typeof icon === "string" ? <Icon name={icon} size={size} color={color} strokeWidth={strokeWidth} /> : icon;
}
