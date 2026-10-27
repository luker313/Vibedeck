import { DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { FC, useContext } from "react";
import { HostSettings, networkModeOptions } from "../../lib";
import { ProfileTransport, countProfileOverrides, resolveProfile, selectDisplayProfile, transportLabel } from "../../lib/streamingprofile";
import { ListDropdown } from "../shared";
import { MoonDeckContext } from "../../contexts";
import { ProfileSummary } from "./profilesummary";
import { useNetworkRoute } from "../../hooks/usenetworkroute";

interface Props {
  hostSettings: HostSettings;
  display: string | null;
}
export const NetworkProfileSection: FC<Props> = ({ hostSettings, display }) => {
  const { settingsManager } = useContext(MoonDeckContext);
  const { route, refresh } = useNetworkRoute(hostSettings.address);
  const mode = hostSettings.networkSettings.mode;
  const transport: ProfileTransport = mode === "Ethernet" ? "ethernet" : mode === "WiFi" ? "wifi" : route?.transport ?? "unknown";
  const dimension = selectDisplayProfile(hostSettings, display);
  const sharedWifi = countProfileOverrides(hostSettings.networkSettings.wifi);
  const sharedEthernet = countProfileOverrides(hostSettings.networkSettings.ethernet);
  const linked = hostSettings.resolution.useLinkedDisplays && !!display && dimension?.linkedDisplays.includes(display);
  return (
    <DialogControlsSection>
      <DialogControlsSectionHeader>Connection for the next stream</DialogControlsSectionHeader>
      <Field label="Choose network settings" description="Automatic uses the Deck's route to this host. Force chooses a settings profile; it does not change the network connection. Checked again at stream start and resume." childrenContainerWidth="fixed">
        <ListDropdown optionList={networkModeOptions} label="Automatic" value={mode} setValue={(next) => settingsManager.updateHost((host) => { host.networkSettings.mode = next; })} />
      </Field>
      <Field label={route ? `Detected: ${transportLabel(route.transport)}${route.interface ? ` (${route.interface})` : ""}` : "Checking connection…"} description={route?.reason} childrenContainerWidth="fixed">
        <DialogButton onClick={refresh}>Refresh connection</DialogButton>
      </Field>
      <Field label={`Using: ${mode === "Auto" && !route ? "waiting for detection" : transportLabel(transport)}${mode !== "Auto" ? " (forced)" : ""}`} description={transport === "unknown" ? "Network overrides are skipped when the route cannot be identified. Screen and shared defaults still apply." : "Opening a Wi-Fi or Ethernet editing tab does not change this selection."} />
      <Field
        label="Screen profile for the next stream"
        description={dimension ?
          `${dimension.label || "Unnamed screen"} · ${dimension.width}×${dimension.height} · ${linked ? "linked to the current screen" : "selected fallback profile"}${!display ? ". Screen information is unavailable; preview uses the selected fallback." : ""}` :
          `No linked or selected fallback profile. ${hostSettings.resolution.automatic ? "Uses the current screen resolution when available." : "Uses Moonlight's resolution."}`}
      />
      {!hostSettings.passToMoonlight ?
          <Field label="Using Moonlight settings" description="Vibedeck streaming profiles are switched off. Performance stats can still be forced independently." /> :
          (mode !== "Auto" || route) && <ProfileSummary label="Requested settings — next connection" resolved={resolveProfile(hostSettings, dimension, transport)} />}
      {(sharedWifi > 0 || sharedEthernet > 0) && <Field label="Shared network overrides configured" description={`Wi-Fi: ${sharedWifi} settings · Ethernet: ${sharedEthernet} settings. Manage these under Advanced shared settings below. They override screen defaults; each screen's own network overrides take priority.`} />}
    </DialogControlsSection>
  );
};
