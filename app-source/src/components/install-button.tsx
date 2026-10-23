import { useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { installStore, promptInstall } from "@/pwa";

/** Same idea as the NWCC map's install button: shows when the browser offers install, or on iPhone Safari.
 *  Sits in the top-left corner of the header, styled like the home tabs (compact on phones). */
export function InstallButton() {
  const s = useSyncExternalStore(installStore.subscribe, installStore.get, installStore.get);
  if (s.standalone || s.installed || !(s.canPrompt || s.ios)) return null;
  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      aria-label={s.canPrompt ? "Install app on this device" : "Add to Home Screen"}
      title={s.canPrompt ? "Install app on this device" : "Add to Home Screen"}
      className="header-btn btn-raised btn-raised-sm"
    >
      <Download className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="font-display text-xs leading-none sm:text-sm">
        <span className="block">{s.canPrompt ? "Install" : "Add to"}</span>
        <span className="block">{s.canPrompt ? "App" : "Home"}</span>
      </span>
    </button>
  );
}
