import { useLayoutEffect, useRef, useState } from "react";

/**
 * The small line under "3D MODEL" in a model header. The header has about 240px for it at 360 wide (292px at 412),
 * so long names would end in an ellipsis. Shows the first form that fits, measured in the line's own font:
 *   1. "{family} · {name}" as before,
 *   2. the same with "Reducing" shortened to "Red.",
 *   3. the name alone, then shortened (the family is on the page behind and in the dialog's label),
 *   4. "{family} · {code}" (the code in the name's brackets; the full name is still in the Type label and caption).
 * Re-measured on resize and when the web font loads. Still truncates as a last resort.
 */
export function ModelSubtitle({ family, name }: { family: string; name: string }) {
  const code = /\(([^()]+)\)\s*$/.exec(name)?.[1];
  const short = name.replace(/\bReducing\b/g, "Red.");
  const forms = [...new Set([`${family} · ${name}`, `${family} · ${short}`, name, short, ...(code ? [`${family} · ${code}`] : [])])];
  const key = forms.join("\n");
  const ref = useRef<HTMLParagraphElement>(null);
  const [pick, setPick] = useState({ key, i: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const list = key.split("\n");
    const ctx = document.createElement("canvas").getContext("2d");
    let alive = true;
    const fit = () => {
      if (!alive || !ctx) return;
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = el.clientWidth;
      let i = list.findIndex((s) => Math.ceil(ctx.measureText(s).width) <= room);
      if (i < 0) i = list.length - 1;
      setPick((p) => (p.key === key && p.i === i ? p : { key, i }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [key]);

  const text = forms[pick.key === key ? pick.i : 0] ?? forms[0];
  return (
    <p ref={ref} className="truncate text-xs text-white/80" data-testid="model-subtitle">
      <span aria-hidden={text !== forms[0] || undefined}>{text}</span>
      {text !== forms[0] && <span className="sr-only">{forms[0]}</span>}
    </p>
  );
}
