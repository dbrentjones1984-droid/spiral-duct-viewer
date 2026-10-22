import { useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { installStore, promptInstall } from "@/pwa";

/** Same idea as the NWCC map's install button: shows when the browser offers install, or on iPhone Safari. */
export function InstallButton() {
  const s = useSyncExternalStore(installStore.subscribe, installStore.get, installStore.get);
  if (s.standalone || s.installed || !(s.canPrompt || s.ios)) return null;
  return (
    <div className="flex justify-center pb-3">
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="inline-flex h-11 items-center gap-2 rounded-card bg-accent px-4 text-sm font-medium text-accent-ink"
      >
        <Download className="size-4" aria-hidden="true" />
        {s.canPrompt ? "Install app on this device" : "Add to Home Screen"}
      </button>
    </div>
  );
}
