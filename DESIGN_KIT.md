# Inzivo Design Kit — Redesign 2 ("light, glowing, animated")

Reference for porting screens to the new mockups (`design2/project/*.dc.html`, 390x844). Everything below is
exported from `@/theme` and `@/components/ui`. Old token/component names still compile; prefer the names
marked **new**.

## Rules of thumb

- Page bg `#F7F5F2` with drifting orange glows — you get it for free from `<Screen>` / `<ScreenBackground>`.
- Cards are **white, flat, 1px border** `rgba(23,19,15,.12)`, radius 22 (20 for small rows). No shadows.
- The hero is the **dark presence panel** `#2E1B10` + 1px `rgba(239,108,0,.42)`, radius 28, padding 18, gap 16.
- **Primary buttons are FILLED** (orange gradient `#FFA64D -> #EF6C00`, 135deg) with **dark** label `#1A0E05`.
  Never outline a primary action. On the dark hero use `variant="solid"` (flat `#EF6C00`, dark label).
- Headings, timers, stat values: **Space Grotesk** (`typography.h1/h2/section/number/display`). Body: Inter.
- Kickers: 11/600, letterSpacing 1.4, `#B34D05`, UPPERCASE (`<Kicker>` upper-cases for you).
- Links / secondary actions: 13/500 `#B34D05` text (`typography.link`, `colors.accentText`).
- Animate entrances with `<Rise delay={...}>` (stagger ~100ms). All loops honour reduced motion.
- Page gutter in mockups is 20 (`spacing.gutter`); `Screen` pads 16 by default — override via `contentStyle`.

## Tokens (`import { colors, typography, fontFamilies, spacing, radius, gradients, gradientDirection, motion, shadows } from "@/theme"`)

### colors
| token | value | use |
|---|---|---|
| `background` | `#F7F5F2` | page |
| `surface` / `surfaceRaised` | `#FFFFFF` | cards |
| `surfaceMuted` | `#F1EDE8` | inner boxes on white cards, muted chips |
| `textPrimary` / `ink` | `#17130F` | body text |
| `textSecondary` | `#6B635C` | secondary text, inactive tab |
| `textMuted` | `#8C837C` | placeholders |
| `primary` / `lime` / `limeStrong` | `#EF6C00` | brand orange (solid fills, map route) |
| `primaryDark` / `limeDeep` / `accentText` / `kicker` (**new**) | `#B34D05` | accent text, links, active tab, kickers |
| `primaryMuted` | `rgba(239,108,0,.14)` | orange tint (date blocks, icon tiles) |
| `primarySoftText` | `#FFB067` | icon stroke on tiles / text on dark |
| **new** `orangeFrom` / `orangeTo` | `#FFA64D` / `#EF6C00` | gradient stops |
| **new** `onOrange` (= `primaryText`) | `#1A0E05` | text/glyphs ON orange |
| **new** `cardBorder` (= `border`, `hairline`) | `rgba(23,19,15,.12)` | card border |
| `hairlineSoft` | `rgba(23,19,15,.08)` | row dividers |
| `hairlineStrong` | `rgba(23,19,15,.16)` | stronger divider |
| **new** `inputBorder` (= `inkBorder`) | `rgba(23,19,15,.14)` | text field border |
| **new** `iconButtonBg` (= `glassStrong`) | `rgba(23,19,15,.08)` | round icon buttons |
| `success` / `successMuted` | `#1E7A4D` / `rgba(74,222,128,.15)` | Approved, On time |
| `warning` / `warningMuted` | `#8A5A00` / `rgba(255,176,60,.16)` | Pending, Scheduled |
| `danger` / `dangerMuted` / **new** `dangerBorder` | `#B3261E` / `rgba(255,92,92,.14)` / `rgba(255,92,92,.4)` | Declined, Log out |
| `panelHero` / `panelHeroEdge` | `#2E1B10` / `rgba(239,108,0,.42)` | dark hero |
| `panelHeroText` / `panelHeroMuted` | `#F7F3EF` / `rgba(247,243,239,.6)` | text on hero |
| **new** `panelHeroChip` (= `glass`) | `rgba(255,255,255,.08)` | stat boxes / tiles on hero |
| **new** `panelHeroIcon` | `#FFB067` | quick-tile icon stroke |
| `onAccent` | `#F7F3EF` | legacy: light text on dark hero (NOT on orange — use `onOrange`) |
| **new** `pulse` | `#FF8A2B` | unread dots, avatar pulse |
| **new** `glowOrange` / `glowPeach` | `#EF6C00` / `#FFAA5A` | ambient glows |
| **new** `liveDot` / `liveTextOnDark` / `liveBgOnDark` | `#4ADE80` / `#6EE7A0` / `rgba(74,222,128,.14)` | Live chip |
| `overlay` | `rgba(23,19,15,.45)` | modal backdrop |
| `limePale` | `rgba(255,255,255,.96)` | tab bar fill |

### typography (spread into styles: `{ ...typography.h1, color: colors.ink }`)
| key | spec |
|---|---|
| `h1` | Space Grotesk 700, 28, ls -0.4 — screen titles (mockups 26–32: override fontSize) |
| `h2` | Space Grotesk 700, 22 — greeting name, card titles |
| `h3` | Inter 600, 18 |
| `section` | Space Grotesk 700, 17 — "Today · 5h 41m" |
| `display` | Space Grotesk 700, 44, ls -1, tabular — hero timer (add `lineHeight: 48`) |
| `number` | Space Grotesk 700, 17, tabular — stat values |
| `kicker` | Inter 600, 11, ls 1.4 — kickers (color `colors.kicker`) |
| **new** `statLabel` | Inter 600, 10, ls 1.2 — caps label in stat boxes |
| **new** `cardTitle` | Inter 600, 15 — "Leave left this year" |
| **new** `button` | Inter 600, 16 |
| **new** `link` | Inter 500, 13 — accent links |
| **new** `wordmark` | Space Grotesk 700, 15, ls 2 — "INZIVO" |
| `body` / `bodyStrong` / `caption` / `label` | Inter 15/400, 15/600, 13/400, 13/600 |

`fontFamilies` (**new**): `regular`, `medium`, `semiBold`, `bold` (Inter), `display500` (`SpaceGrotesk_500Medium`),
`display700` (`SpaceGrotesk_700Bold`). Legacy `fontFamily` has the same keys. Always set `fontWeight` to match.

### spacing / radius
`spacing`: xs 4, sm 8, md 16, lg 24, xl 32, xxl 48, **gutter 20**.
`radius`: sm 8, md 12, lg 16, xl 28, full/**pill** 999, input 14, **chip 16**, tile 18, card 22, **cardSm 20**,
hero 28, sheet 28, button 27.

### effects
- `gradients.orange` (**new**) `["#FFA64D","#EF6C00"]` + `gradientDirection.diagonal` (135deg). Also
  `gradients.gauge` `["#FFC27A","#EF6C00"]` (use `gradientDirection.horizontal`), `orangeVertical` (bars).
- `motion` (**new**): `riseDuration 800`, `riseDistance 26`, `riseStagger 100`, `riseEasing`,
  `pulseDuration 2400`, `breatheDuration 2400`, `shimmerDuration 2600`, `floatDurations`.
- `shadows`: `card`, `soft`, `hero`, `ink`, `fab`, `tabBar` — the redesign is flat; use sparingly.

```tsx
<LinearGradient colors={gradients.orange} {...gradientDirection.diagonal} style={...} />
```

## Components (`import { … } from "@/components/ui"`)

### Layout & motion
- **`Screen`** `{ scroll?, refreshing?, onRefresh?, contentStyle?, background?: "gradient"|"glow"|"plain", glow?: AmbientGlowPreset, glows?: GlowSpec[], glowIntensity?, edges?, tabBarClearance? }`
  Default background = page colour + glows ("gradient" is the legacy name for the same). `"plain"` = no glows.
  ```tsx
  <Screen scroll glow="topRight" contentStyle={{ paddingHorizontal: spacing.gutter, gap: 12 }}>…</Screen>
  ```
- **`ScreenBackground`** `{ variant?, glow?, glows?, glowIntensity?, style? }` — for custom layouts that don't use Screen.
- **`AmbientGlow`** (**new**) `{ preset?: "default"|"topLeft"|"topRight"|"login"|"corners"|"subtle", glows?: GlowSpec[], intensity?: number, style? }`
  Absolutely fills its parent, pointerEvents none. `GlowSpec = { corner: "topLeft"|"topRight"|"bottomLeft"|"bottomRight", size?=320, color?, opacity?=0.5, duration?=10000, reverse?, x?, y? }`.
  Presets: `default` (Home: top-left orange + bottom-right peach), `topRight` (Profile/Notifications),
  `topLeft` (Requests), `login` (top-right + bottom-left peach), `corners`, `subtle`.
- **`Rise`** (**new**) `{ delay?=0, distance?=26, duration?=800, disabled?, style? }` — fade + slide-up once on mount.
  ```tsx
  <Rise><Header/></Rise>
  <Rise delay={100}><PresenceHero/></Rise>
  <Rise delay={250}><Card>…</Card></Rise>
  ```
- **`useReducedMotion()`** (**new**) → boolean. **`useLoop({ duration, pingPong?, delay?, easing?, enabled?, restValue? })`** (**new**) → looping 0..1 `Animated.Value` (native driver; static under reduced motion). Pass a *stable* easing (`loopEasing.sineInOut | easeOut | linear`).
- **`PulseRing`** (**new**) `{ size, color?=#FF8A2B, variant?: "fill"|"ring", scaleTo?=2.6, opacityFrom?=0.7, duration?=2400, delay?, enabled? }` — put first inside a `position:relative` box of the same size.
- **`GradientFill`** (**new**) `{ colors?, direction?: "diagonal"|"vertical"|"horizontal", style? }` — View with the orange gradient (logo tile, progress fills, custom chips).

### Surfaces
- **`Card`** `{ tone?: "default"|"muted"|"lime"|"success"|"warning"|"danger", size?: "lg"|"sm", elevated?, …ViewProps }` — white, 1px border, radius 22 (sm 20), padding 16. (`flat` accepted, no-op.)
  TODAY-list card: `<Card style={{ paddingVertical: 6 }}>`.
- **`GlowPanel`** `{ rounded?, style? }` — dark hero: flat `#2E1B10` + orange hairline. `rounded` = radius 28, padding 18, gap 16 (Main.dc.html). Without it you set radius/padding yourself.
  ```tsx
  <GlowPanel rounded>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <LivePill /><Text style={{ fontSize: 12, color: colors.panelHeroMuted }}>Next ping in 1:24</Text>
    </View>
    …
    <StatRow><StatBox label="In at" value="09:02"/><StatBox label="Mode" value="Office"/><StatBox label="Range" value="24 m"/></StatRow>
    <Button variant="solid" label="Check out" onPress={…} />
    <QuickActions actions={[{ icon: "pin", label: "Map", onPress }, { icon: "leave", label: "Leave" }, { icon: "pause", label: "Permission" }, { icon: "historyClock", label: "History" }]} />
  </GlowPanel>
  ```
- **`HeroCard`** `{ label?, labelRight?, value?, valueSuffix?, notch?, onNotchPress?, style?, contentStyle?, children }` — GlowPanel(rounded) with caps label + Space Grotesk display value.
- **`BottomSheet`** `{ visible, onClose, kicker?, title, children }` — page-coloured sheet, radius 28, accent kicker, Space Grotesk 20 title.
- **`IssueDialog`** `{ visible, kicker, title, body, primaryLabel, onPrimary, secondaryLabel?, onSecondary? }`.

### Buttons & controls
- **`Button`** `{ label, onPress, variant?, size?: "sm"|"md"|"lg", loading?, disabled?, icon?, trailingIcon?, pulse?, style?, labelStyle?, accessibilityLabel? }`
  - `primary` (default): **gradient fill, dark label**. `solid`: flat `#EF6C00`, dark label (on the hero). `lime`: legacy = solid.
  - `secondary`: white pill + border, ink label. `danger`: red tint + red border/label ("Log out"). `ghost`: accent text only.
  - sizes: `md` 54 (default), `lg` 56 (auth CTAs), `sm` 42. Always a full pill (radius = height/2).
  - `pulse`: white shimmer loop over the fill (mockup `btnpulse`; use on the ONE hero CTA per screen).
  ```tsx
  <Button label="Sign in" size="lg" pulse onPress={submit} loading={busy} />
  <Button label="Log out" variant="danger" onPress={logout} />
  ```
- **`GradientButton`** (**new**) = `Button` forced to `primary`.
- **`IconButton`** `{ icon, onPress, variant?: "soft"|"white"|"ink"|"dark"|"muted"|"hero", size?=44, shape?, badge?, color?, accessibilityLabel?, disabled?, style? }` — default `soft`: 44px circle, `rgba(23,19,15,.08)`, ink glyph; `badge` = orange unread dot with page-coloured ring.
- **`SegmentedControl`** `{ options: {key,label,badge?,disabled?}[], value, onChange, variant?: "white"|"ink"|"gradient"|"subtle", style? }` — white track (radius 16, inset 4), **gradient active segment** with dark label; badge = dark bubble with `#FFB067` text. `subtle` = muted track + raised white active.
- **`Toggle`** `{ value, onValueChange, disabled?, accessibilityLabel? }` — 46x26, gradient when on, animated knob.
- **`TextField`** `{ label?, error?, icon?: IconName, …TextInputProps }` — 48 high, radius 14, white, 1px `rgba(23,19,15,.14)`; label above 12/500; focus = 1.5px `#FF9A3D`; error = red.
- **`Chip`** `{ label, selected?, disabled?, onPress?, style? }` — 36-high filter chip; selected = gradient + dark 600 label.

### Content
- **`SectionHeader`** `{ title, kicker?, onAction?, actionLabel?="View all", right?, titleStyle?: "kicker"|"title", style? }` — without `kicker`, the title renders AS a kicker ("TODAY"); action = accent text link.
  ```tsx
  <Card style={{ paddingVertical: 6 }}>
    <SectionHeader title="Today" actionLabel="History" onAction={openHistory} style={{ marginTop: 4, marginBottom: 0 }} />
    <ListRow title="Checked in" subtitle="Today · 09:02" value="On time" valueTone="success" valueSub="Face + PIN" />
    <ListRow divider muted title="Check out" subtitle="Shift ends 18:00" value="—" valueTone="muted" />
    <ListRow divider title="Timed permission" subtitle="14:30 – 15:30" trailing={<StatusBadge label="Scheduled" tone="warning" />} />
  </Card>
  ```
- **`ListRow`** `{ title, subtitle?, value?, valueTone?: "default"|"accent"|"success"|"warning"|"danger"|"muted", valueSub?, trailing?, icon?, iconTone?, leading?, children?, onPress?, divider?, muted?, style? }` — title 14/600, subtitle 12 secondary, value 13/600 + 11px caption; padding 12/0.
- **`StatBox`** (**new**) `{ label, value, tone?: "hero"|"light"|"muted", flex?, children?, valueStyle?, style? }` — 10px caps label + 17px Space Grotesk value, radius 16, padding 10/12. **`StatRow`** = row with gap 8.
  ```tsx
  <StatRow><StatBox tone="light" label="Casual" value="6 / 8" /><StatBox tone="light" label="Sick" value="5 / 6" /></StatRow>
  ```
- **`ActionTile`** `{ icon, label, onPress?, disabled?, badge?, tone?: "hero"|"light", size? }` — flexible-width tile, icon (`#FFB067`, 20) above 12/500 label; hero tone = translucent on the dark panel (64 high), light = white bordered (68). **`QuickActions`** `{ actions, tone?, style? }` = equal columns, gap 8.
- **`AvatarBadge`** (**new**) `{ initials?, name?, photoUri?, size?=44, pulse?: boolean|"fill"|"ring", badge?, style? }` — gradient circle, dark Inter-700 initials (≈ size × .33).
  ```tsx
  <AvatarBadge name={employee.name} size={44} pulse />              // Home header
  <AvatarBadge name={employee.name} size={68} pulse="ring" badge={<CameraDot/>} />  // Profile
  ```
- **`LivePill`** (**new**) `{ label?="Live", tone?: "dark"|"light"|"glass", dotColor?, pulse?=true, style? }` — green chip with pulsing dot (hero); `glass` = white bordered chip, ink label (login "Sign in" chip, pass `dotColor="#FF9A3D"`).
- **`Pill`** `{ label, variant?, dot?, icon?, trailingIcon?, onPress?, style? }` — variants `success|warning|danger|muted|lime|white|glass|hero|ink|outline|gradient`; 11/600, padding 4/10.
- **`StatusBadge`** `{ label, tone?: "success"|"warning"|"danger"|"neutral"|"primary"|"ink", style? }` — same chip spec as the mockups' `.bd`.
- **`IconTile`** `{ icon?, glyph?, tone?: "ink"|"lime"|"gradient"|"muted"|"white"|"success"|"warning"|"danger", size?=38, radius? }` — `ink`/`lime` = orange tint + accent glyph; radius ≈ .35 × size.
- **`Kicker`** `{ color?=colors.kicker, …TextProps }`, **`ScreenTitle`** (Space Grotesk 28), **`PageHeader`** (**new**) `{ kicker?, title, style? }` = Kicker + ScreenTitle.
  ```tsx
  <Rise><PageHeader kicker="Account" title="Profile" /></Rise>
  ```
- **`EmptyState`** `{ title, message?, icon? }`, **`ErrorView`** `{ message, onRetry? }`, **`LoadingView`** `{ label?, animated?, fullScreen? }`.
- **`Icon`** `{ name, size?=20, color?, strokeWidth?=1.8 }`. **New names**: `doc` (Requests), `pause` (Permission), `historyClock`, `leave` (calendar), `person` (profile), `chevronLeft`. `clock` = the centre-tab glyph.

## Tab bar (`src/navigation/AppTabs.tsx`)
White 96% pill, 68 high, 16 from the sides, `max(22, insetBottom + 6)` from the bottom, labels 10/500
(inactive `#6B635C`, active `#B34D05`), centre = 52px gradient circle with dark clock glyph + breathe halo.
`TAB_BAR_CLEARANCE` = 96 (`useTabBarClearance()` returns it inside tabs). `Screen` adds it automatically.

## Porting checklist
1. Wrap with `<Screen scroll glow="…">`; set `contentStyle={{ paddingHorizontal: spacing.gutter, gap: 12–16 }}`.
2. Header: `<PageHeader kicker title>` or avatar + kicker + `typography.h2` name, `IconButton` (soft, 44) on the right.
3. Cards → `Card` (white/border/22). Hero → `GlowPanel rounded`. Stagger each block in `Rise` (0, 100, 250, 350, 450…).
4. Primary CTA → `Button` (gradient, dark label). Remove any outlined-primary styles you find in the screen.
5. Numbers/titles → Space Grotesk via `typography.display/number/section/h1/h2`.
6. Status chips → `StatusBadge`/`Pill`; filters → `Chip`; tabs → `SegmentedControl`.
