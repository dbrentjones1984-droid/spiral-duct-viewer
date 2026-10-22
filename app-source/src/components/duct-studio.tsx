import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PIECE_MENUS, shellFinishById, type PieceId } from "@/lib/piece-menus";

const DuctStage = lazy(() => import("@/components/duct-stage"));

/** True when this browser can create a WebGL context (some phones / in-app viewers can't). */
function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

/** Keeps a 3D failure (WebGL lost, chunk failed to download, driver error) inside the stage instead of blanking the app. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D view failed", error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <p className="text-sm text-muted">The 3D view could not start on this device.</p>
            <button
              type="button"
              onClick={() => this.setState({ failed: false })}
              className="mt-3 h-11 rounded-card border border-line bg-surface px-4 text-sm font-medium text-ink"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DuctStudio({ embedded = false }: { embedded?: boolean }) {
  const [exploded, setExploded] = useState(false);
  const [apart, setApart] = useState(0);
  const [spread, setSpread] = useState<"one" | "both">("both");
  const [section, setSection] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [flangeInfo, setFlangeInfo] = useState(false);
  const [shellFinish, setShellFinish] = useState("galvanized");
  const [linerMode, setLinerMode] = useState<"solid" | "perforated">("solid");
  const [linerFinish, setLinerFinish] = useState("galvanized");
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState<{ piece: PieceId; x: number; y: number } | null>({
    piece: "shell",
    x: 32,
    y: 180,
  });
  const [focus, setFocus] = useState<{ x: number; y: number; z: number; n: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const justOpened = useRef(false);

  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    setWebgl(webglAvailable());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("canvas")) return;
      if (justOpened.current) return;
      setMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menu]);

  const openPieceMenu = (piece: PieceId, x: number, y: number, point: { x: number; y: number; z: number }) => {
    justOpened.current = true;
    window.setTimeout(() => {
      justOpened.current = false;
    }, 450);
    setMenu({ piece, x, y });
    setFocus((current) => ({ x: point.x, y: point.y, z: point.z, n: (current?.n ?? 0) + 1 }));
  };

  const pickPieceOption = (id: string) => {
    if (id === "accuflange") setFlangeInfo(true);
    else if (id === "perforated") {
      setLinerMode("perforated");
      setLinerFinish("galvanized");
    } else if (id.startsWith("solid:")) {
      setLinerMode("solid");
      setLinerFinish(id.slice("solid:".length));
    } else if (shellFinishById(id).id === id) setShellFinish(id);
    setMenu(null);
  };

  return (
    <main className={embedded ? "flex h-full min-h-0 flex-col overflow-auto bg-paper text-ink" : "flex min-h-svh flex-col bg-paper text-ink"}>
      {embedded ? null : (
        <header className="flex justify-center border-b border-line bg-paper px-4 py-3 sm:px-6">
          <BrandLogo className="h-auto w-44 max-w-full" />
        </header>
      )}

      <div
        className={
          flangeInfo
            ? "grid min-w-0 lg:min-h-0 lg:flex-1 lg:grid-cols-[20rem_minmax(0,1fr)_24rem] lg:grid-rows-1"
            : "grid lg:min-h-0 lg:flex-1 lg:grid-cols-[20rem_1fr] lg:grid-rows-1"
        }
      >
        <section ref={stageRef} className="relative order-1 h-[46svh] min-w-0 touch-none overflow-hidden bg-paper lg:order-2 lg:h-full">
          {ready && !webgl ? (
            <StageNote label="3D needs WebGL, which this browser has turned off. Try opening the page in Chrome." />
          ) : ready ? (
            <StageBoundary>
            <Suspense fallback={<StageNote label="Loading the piece…" />}>
              <DuctStage
                exploded={exploded}
                spinning={spinning}
                resetKey={resetKey}
                section={section}
                flangeSelected={flangeInfo}
                activePiece={menu?.piece ?? null}
                shellFinish={shellFinishById(shellFinish)}
                linerFinish={shellFinishById(linerMode === "perforated" ? "galvanized" : linerFinish)}
                linerPerforated={linerMode === "perforated"}
                apart={apart}
                spread={spread}
                onPickPiece={openPieceMenu}
                onCloseMenu={() => {
                  if (justOpened.current) return;
                  setMenu(null);
                }}
                focus={focus}
              />
            </Suspense>
            </StageBoundary>
          ) : (
            <StageNote label="Loading the piece…" />
          )}
          {menu ? (
            <PieceMenu
              menuRef={menuRef}
              stageRef={stageRef}
              piece={menu.piece}
              x={menu.x}
              y={menu.y}
              onPick={pickPieceOption}
              selectedId={
                menu.piece === "shell"
                  ? shellFinish
                  : menu.piece === "liner"
                    ? linerMode === "perforated"
                      ? "perforated"
                      : `solid:${linerFinish}`
                    : flangeInfo
                      ? "accuflange"
                      : ""
              }
            />
          ) : null}
        </section>

        {flangeInfo ? <FlangeSheet onClose={() => setFlangeInfo(false)} /> : null}

        <aside className="order-3 flex flex-col gap-6 border-line px-4 py-5 sm:px-6 lg:order-1 lg:border-r lg:py-8">
          <div>
            <p className="text-xs font-medium tracking-widest text-accent uppercase">Straight section</p>
            <h1 className="mt-1 font-display text-4xl leading-none text-ink">Double-wall spiral</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Galvanized spiral shell, 1 in fiberglass, solid inner liner, and one flange on both ends. Show all the pieces to take it apart.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-pressed={section}
              onClick={() => setSection((v) => !v)}
              className={
                section
                  ? "h-11 rounded-card bg-accent px-4 text-sm font-medium text-accent-ink"
                  : "h-11 rounded-card border border-line bg-surface px-4 text-sm font-medium text-ink"
              }
            >
              {section ? "Close the section" : "Open a section"}
            </button>
            <button
              type="button"
              aria-pressed={apart > 0}
              onClick={() => {
                if (apart === 0) {
                  setApart(100);
                  setExploded(true);
                } else {
                  setApart(0);
                  setExploded(false);
                }
              }}
              className={
                apart > 0
                  ? "h-11 rounded-card bg-accent px-4 text-sm font-medium text-accent-ink"
                  : "h-11 rounded-card border border-line bg-surface px-4 text-sm font-medium text-ink"
              }
            >
              {apart === 0 ? "Show all the pieces" : "Put it together"}
            </button>
            <div className="rounded-card border border-line bg-surface px-3 py-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>0% together</span>
                <span>{apart}%</span>
                <span>100% apart</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={apart}
                aria-label="How far apart, 0 percent together and 100 percent apart"
                onChange={(event) => setApart(Number(event.target.value))}
                className="mt-2 h-2 w-full accent-accent"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={spread === "one"}
                  onClick={() => setSpread("one")}
                  className={
                    spread === "one"
                      ? "h-11 rounded-card bg-accent px-3 text-sm font-medium text-accent-ink"
                      : "h-11 rounded-card border border-line bg-paper px-3 text-sm font-medium text-ink"
                  }
                >
                  One side
                </button>
                <button
                  type="button"
                  aria-pressed={spread === "both"}
                  onClick={() => setSpread("both")}
                  className={
                    spread === "both"
                      ? "h-11 rounded-card bg-accent px-3 text-sm font-medium text-accent-ink"
                      : "h-11 rounded-card border border-line bg-paper px-3 text-sm font-medium text-ink"
                  }
                >
                  Both sides
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={spinning}
                onClick={() => setSpinning((v) => !v)}
                className={
                  spinning
                    ? "h-11 rounded-card bg-ink px-4 text-sm font-medium text-paper"
                    : "h-11 rounded-card border border-line bg-surface px-4 text-sm font-medium text-ink"
                }
              >
                {spinning ? "Stop spin" : "Spin"}
              </button>
              <button
                type="button"
                onClick={() => setResetKey((n) => n + 1)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-card border border-line bg-surface px-4 text-sm font-medium text-ink"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function PieceMenu({
  menuRef,
  stageRef,
  piece,
  x,
  y,
  selectedId,
  onPick,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  piece: PieceId;
  x: number;
  y: number;
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const menu = PIECE_MENUS[piece];
  const stage = stageRef.current?.getBoundingClientRect();
  const pad = 8;
  const stageWidth = (stage?.width ?? 320) - pad * 2;
  const narrow = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const width = narrow ? Math.max(120, stageWidth * 0.5) : Math.min(144, stageWidth);
  const localX = stage ? x - stage.left : x;
  const localY = stage ? y - stage.top : y;
  const left = narrow ? pad : Math.min(Math.max(pad, localX), Math.max(pad, (stage?.width ?? width) - width - pad));
  const roomBelow = (stage?.height ?? 320) - localY - pad;
  const top = narrow ? pad : roomBelow < 100 ? pad : Math.max(pad, localY + 8);
  const maxHeight = Math.max(88, ((stage?.height ?? 320) - top - pad) * 0.5);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setLive(true), 420);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div
      ref={menuRef}
      className={
        live
          ? "absolute z-20 overflow-auto rounded-card border border-line/60 bg-surface/60"
          : "pointer-events-none absolute z-20 overflow-auto rounded-card border border-line/60 bg-surface/60"
      }
      style={{ left, top, width, maxHeight }}
    >
      <p className="border-b border-line px-2 py-1 text-[10px] font-medium tracking-widest text-accent uppercase">
        {menu.label}
      </p>
      {menu.items.length > 0 ? (
        <ul>
          {menu.items.map((item, index) => {
            const showGroup = item.group && item.group !== menu.items[index - 1]?.group;
            return (
              <li key={item.id}>
                {showGroup ? (
                  <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium tracking-widest text-muted uppercase">{item.group}</p>
                ) : null}
                <button
                  type="button"
                  aria-pressed={item.id === selectedId}
                  onClick={() => onPick(item.id)}
                  className={
                    item.id === selectedId
                      ? "flex w-full items-center gap-1.5 bg-paper/60 px-2 py-1 text-left text-xs font-medium text-ink"
                      : "flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs text-ink hover:bg-paper/60"
                  }
                >
                  {item.swatch ? (
                    <span className="size-2 shrink-0 rounded-full border border-line" style={{ background: item.swatch }} />
                  ) : null}
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-2 py-1 text-xs text-muted">Options coming</p>
      )}
    </div>
  );
}

function FlangeSheet({ onClose }: { onClose: () => void }) {
  return (
    <aside className="order-2 flex h-[70svh] min-h-0 min-w-0 flex-col overflow-hidden border-t border-line bg-paper lg:order-3 lg:h-full lg:border-t-0 lg:border-l">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-accent uppercase">Flange</p>
          <p className="font-display text-2xl leading-none text-ink">AccuFlange</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-11 shrink-0 rounded-card border border-line bg-surface px-4 text-sm font-medium text-ink"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <img src={`${import.meta.env.BASE_URL}accuflange.png`} alt="AccuFlange product sheet" className="block w-full max-w-full" />
      </div>
      <a
        href={`${import.meta.env.BASE_URL}accuflange.pdf`}
        target="_blank"
        rel="noreferrer"
        className="border-t border-line px-4 py-3 text-sm font-medium text-ink"
      >
        Open PDF
      </a>
    </aside>
  );
}

function StageNote({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
