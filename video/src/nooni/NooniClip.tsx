import { loadFont } from "@remotion/fonts";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Farben und Schriften wie auf nooni-cafe-hamburg-f878
const C = {
  tanne: "#2F5230",
  salbei: "#527545",
  creme: "#FBF5EA",
  papier: "#FFFCF5",
  mulde: "#F3EAD8",
  pfirsich: "#F2A88E",
  blau: "#1F2F6B",
};
const DISP = "Caprasimo, Georgia, serif";
const AKZ = "Fraunces, Georgia, serif";
const TEXT = "Figtree, system-ui, sans-serif";

const f = (name: string) => staticFile(`nooni/${name}`);

loadFont({ family: "Caprasimo", url: f("caprasimo-2.woff2") });
loadFont({ family: "Figtree", url: f("figtree-6.woff2"), weight: "400 700" });
loadFont({ family: "Fraunces", url: f("fraunces-10.woff2"), weight: "400 700" });
loadFont({ family: "Fraunces", url: f("fraunces-8.woff2"), style: "italic" });

const T = 15; // Übergangslänge in Frames
const SCENES = [80, 130, 80, 120, 90];
export const NOONI_DURATION = SCENES.reduce((a, b) => a + b, 0) - T * (SCENES.length - 1);

// Hilfen: federndes Einblenden ab einem Frame
const useIn = (delay: number, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

const Rise: React.FC<{ delay: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay,
  children,
  style,
}) => {
  const p = useIn(delay, 16);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px)`, ...style }}>{children}</div>
  );
};

// Sprenkel wie auf den Tellern der Website
const Sprinkles: React.FC<{ color: string; seed: number; count?: number }> = ({ color, seed, count = 40 }) => {
  const frame = useCurrentFrame();
  const dots = Array.from({ length: count }, (_, i) => {
    const r = (n: number) => {
      const x = Math.sin(seed * 97 + i * 13.37 + n * 7.1) * 10000;
      return x - Math.floor(x);
    };
    return { x: r(1) * 1080, y: r(2) * 1920, s: 6 + r(3) * 10, d: r(4) * 30 };
  });
  return (
    <AbsoluteFill>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: d.x,
            top: d.y + Math.sin((frame + d.d * 4) / 25) * 8,
            width: d.s,
            height: d.s,
            borderRadius: "50%",
            background: color,
            opacity: interpolate(frame, [d.d, d.d + 15], [0, 0.55], { extrapolateRight: "clamp" }),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// 1 — Logo
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = useIn(4, 11);
  const cup = useIn(22, 9);
  return (
    <AbsoluteFill style={{ background: C.creme, justifyContent: "center", alignItems: "center" }}>
      <Sprinkles color={C.blau} seed={1} />
      <Img
        src={f("logo-clip.svg")}
        style={{
          width: 920,
          transform: `scale(${0.6 + logo * 0.4}) rotate(${(1 - logo) * -8}deg)`,
          opacity: logo,
        }}
      />
      <div style={{ position: "absolute", top: 1330, textAlign: "center", width: "100%" }}>
        <Rise delay={20}>
          <div style={{ fontFamily: AKZ, fontStyle: "italic", fontSize: 72, color: C.tanne }}>
            Bake &amp; Breakfast
          </div>
        </Rise>
        <Rise delay={28}>
          <div
            style={{
              fontFamily: TEXT,
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: C.salbei,
              marginTop: 16,
            }}
          >
            Hamburg-Altona
          </div>
        </Rise>
      </div>
      <div
        style={{
          position: "absolute",
          top: 300,
          fontFamily: TEXT,
          fontWeight: 700,
          fontSize: 44,
          color: C.tanne,
          opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }) * cup,
        }}
      >
        Jeden Tag 9–17 Uhr
      </div>
    </AbsoluteFill>
  );
};

// Freigestelltes Food-Foto, fliegt mit Drehung ein und schwebt leicht
const Cutout: React.FC<{
  src: string;
  delay: number;
  x: number;
  y: number;
  w: number;
  from: [number, number];
  rot: number;
}> = ({ src, delay, x, y, w, from, rot }) => {
  const frame = useCurrentFrame();
  const p = useIn(delay, 13);
  const bob = Math.sin((frame - delay) / 18) * 10;
  return (
    <Img
      src={f(src)}
      style={{
        position: "absolute",
        left: x + (1 - p) * from[0],
        top: y + (1 - p) * from[1] + bob,
        width: w,
        transform: `rotate(${rot * (1 - p) + rot * 0.15}deg)`,
        filter: "drop-shadow(0 30px 40px rgba(47,82,48,.25))",
      }}
    />
  );
};

// 2 — Frühstück
const Food: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["Frühstück,", "Brot", "& Kaffee"];
  return (
    <AbsoluteFill style={{ background: C.salbei }}>
      <Sprinkles color={C.creme} seed={2} count={30} />
      <div style={{ position: "absolute", top: 170, left: 90, right: 90 }}>
        <Rise delay={2}>
          <div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 40, color: C.mulde, letterSpacing: 4 }}>
            JEDEN TAG
          </div>
        </Rise>
        {words.map((w, i) => (
          <Rise key={w} delay={8 + i * 7}>
            <div
              style={{
                fontFamily: i === 0 ? AKZ : DISP,
                fontStyle: i === 0 ? "italic" : "normal",
                fontSize: 150,
                lineHeight: 1.05,
                color: C.creme,
              }}
            >
              {w}
            </div>
          </Rise>
        ))}
      </div>
      <Cutout src="ki-waffel.webp" delay={20} x={330} y={980} w={720} from={[700, 300]} rot={-25} />
      <Cutout src="ki-cappuccino-gelb.webp" delay={34} x={-60} y={1260} w={560} from={[-600, 200]} rot={30} />
      <Cutout src="ki-wassermelone.webp" delay={48} x={700} y={780} w={300} from={[500, -200]} rot={-40} />
      <div
        style={{
          position: "absolute",
          bottom: 90,
          width: "100%",
          textAlign: "center",
          fontFamily: TEXT,
          fontSize: 38,
          color: C.creme,
          opacity: interpolate(frame, [70, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Brunch den ganzen Tag – auch sonntags
      </div>
    </AbsoluteFill>
  );
};

// 3 — Getränke
const DrinkCard: React.FC<{ src: string; label: string; sub: string; delay: number; x: number; tilt: number }> = ({
  src,
  label,
  sub,
  delay,
  x,
  tilt,
}) => {
  const p = useIn(delay, 13);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 560,
        width: 450,
        background: C.papier,
        borderRadius: 36,
        padding: 22,
        boxShadow: "0 30px 60px rgba(47,82,48,.18)",
        transform: `translateY(${(1 - p) * 900}px) rotate(${tilt * p}deg)`,
      }}
    >
      <Img src={f(src)} style={{ width: "100%", height: 640, objectFit: "cover", borderRadius: 22 }} />
      <div style={{ fontFamily: DISP, fontSize: 52, color: C.tanne, marginTop: 22 }}>{label}</div>
      <div style={{ fontFamily: TEXT, fontSize: 30, color: C.salbei, marginTop: 6 }}>{sub}</div>
    </div>
  );
};

const Drinks: React.FC = () => (
  <AbsoluteFill style={{ background: C.mulde }}>
    <Sprinkles color={C.blau} seed={3} count={25} />
    <div style={{ position: "absolute", top: 200, width: "100%", textAlign: "center" }}>
      <Rise delay={2}>
        <div style={{ fontFamily: DISP, fontSize: 110, color: C.tanne }}>
          In die <span style={{ fontFamily: AKZ, fontStyle: "italic", color: C.blau }}>Tasse</span>
        </div>
      </Rise>
    </div>
    <DrinkCard src="ki-iced-coffee.webp" label="Iced Coffee" sub="Kaffee, Milch, viel Eis" delay={8} x={70} tilt={-4} />
    <DrinkCard src="ki-ingwertee.webp" label="Ingwertee" sub="Mit frischem Ingwer" delay={16} x={560} tilt={3} />
    <Rise delay={30} style={{ position: "absolute", top: 1620, width: "100%", textAlign: "center" }}>
      <div style={{ fontFamily: AKZ, fontStyle: "italic", fontSize: 64, color: C.tanne }}>Alles auch zum Mitnehmen.</div>
    </Rise>
  </AbsoluteFill>
);

// 4 — Website im Handy
const Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = useIn(0, 15);
  // Screenshot: 780 px breit (2x), Bildschirm 620 px breit → Faktor 620/780
  const screenW = 620;
  const screenH = 1250;
  const shotH = 3500 * (screenW / 780);
  const scroll = interpolate(frame, [25, durationInFrames - 15], [0, shotH - screenH], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ background: C.tanne }}>
      <Sprinkles color={C.pfirsich} seed={4} count={25} />
      <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center" }}>
        <Rise delay={4}>
          <div style={{ fontFamily: DISP, fontSize: 96, color: C.creme, lineHeight: 1.05 }}>Tisch reservieren</div>
        </Rise>
        <Rise delay={10}>
          <div style={{ fontFamily: AKZ, fontStyle: "italic", fontSize: 64, color: C.pfirsich, marginTop: 10 }}>
            in drei Klicks
          </div>
        </Rise>
      </div>
      <div
        style={{
          position: "absolute",
          left: (1080 - screenW - 40) / 2,
          top: 450,
          width: screenW + 40,
          height: screenH + 40,
          borderRadius: 90,
          background: "#141a14",
          padding: 20,
          boxShadow: "0 60px 120px rgba(0,0,0,.35)",
          transform: `translateY(${(1 - p) * 1200}px) rotate(${(1 - p) * 8}deg)`,
        }}
      >
        <div style={{ width: screenW, height: screenH, borderRadius: 72, overflow: "hidden", position: "relative" }}>
          <Img src={f("site-top.png")} style={{ width: screenW, transform: `translateY(${-scroll}px)` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 5 — Abschluss
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const star = useIn(10, 8);
  const rows: [string, string][] = [
    ["Geöffnet", "täglich 9–17 Uhr"],
    ["Adresse", "Große Brunnenstraße 55"],
    ["Telefon", "040 41628306"],
  ];
  return (
    <AbsoluteFill style={{ background: C.creme, alignItems: "center" }}>
      <Img
        src={f("logo-clip.svg")}
        style={{ width: 860, marginTop: 470, opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }) }}
      />
      <div
        style={{
          marginTop: 80,
          display: "flex",
          alignItems: "center",
          gap: 22,
          transform: `scale(${star})`,
          fontFamily: TEXT,
          fontWeight: 700,
          fontSize: 52,
          color: C.tanne,
        }}
      >
        <span style={{ color: C.pfirsich, fontSize: 70 }}>★</span>
        <span style={{ fontFamily: AKZ, fontSize: 70 }}>4,8</span>
        <span style={{ fontWeight: 400, fontSize: 40 }}>434 Bewertungen auf Google</span>
      </div>
      <div style={{ width: 860, marginTop: 70 }}>
        {rows.map(([k, v], i) => (
          <Rise key={k} delay={18 + i * 6}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: `3px solid ${C.tanne}`,
                padding: "30px 0",
                fontFamily: TEXT,
                fontSize: 40,
                color: C.tanne,
              }}
            >
              <b>{k}</b>
              <span>{v}</span>
            </div>
          </Rise>
        ))}
      </div>
      <Rise delay={40} style={{ position: "absolute", bottom: 90 }}>
        <div style={{ fontFamily: TEXT, fontSize: 30, color: C.salbei, textAlign: "center" }}>
          Website-Entwurf von Medialyte
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

export const NooniClip: React.FC = () => {
  const t = linearTiming({ durationInFrames: T, easing: Easing.inOut(Easing.cubic) });
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES[0]}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={t} />
      <TransitionSeries.Sequence durationInFrames={SCENES[1]}>
        <Food />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
      <TransitionSeries.Sequence durationInFrames={SCENES[2]}>
        <Drinks />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={springTiming({ durationInFrames: T, config: { damping: 200 } })}
      />
      <TransitionSeries.Sequence durationInFrames={SCENES[3]}>
        <Phone />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={t} />
      <TransitionSeries.Sequence durationInFrames={SCENES[4]}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
