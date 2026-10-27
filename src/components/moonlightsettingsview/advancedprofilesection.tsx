import { DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { Dimension, HostSettings, StreamingProfile } from "../../lib";
import { FC, useContext, useState } from "react";
import { countProfileOverrides, hostStreamingProfile, resolveProfile, transportLabel } from "../../lib/streamingprofile";
import { MoonDeckContext } from "../../contexts";
import { ProfileLayerTabs } from "./profilelayertabs";
import { ProfileSummary } from "./profilesummary";
import { StreamingProfileFields } from "./streamingprofilefields";

interface Props {
  hostSettings: HostSettings;
  dimension: Dimension | null;
}

const networkTabs = [{ id: "wifi", label: "Wi-Fi" }, { id: "ethernet", label: "Ethernet" }] as const;

export const AdvancedProfileSection: FC<Props> = ({ hostSettings, dimension }) => {
  const { settingsManager } = useContext(MoonDeckContext);
  const [expanded, setExpanded] = useState(false);
  const [transport, setTransport] = useState<"wifi" | "ethernet">("wifi");
  const profile = hostStreamingProfile(hostSettings);
  const setDefaults = (next: StreamingProfile): void => settingsManager.updateHost((host) => {
    for (const key of ["videoCodec", "yuv444", "enableVrr", "smoothVrrFrameTiming", "absorbVrrMicrostutter", "enableVSync", "enableFramePacing"] as const) {
      Object.assign(host, { [key]: next[key] });
    }
    host.resolution.defaultBitrate = next.bitrate;
    host.resolution.defaultFps = next.fps;
    host.resolution.defaultHdr = next.hdr;
  });
  const context = dimension ? `${dimension.label || "Unnamed screen"} (${dimension.width}×${dimension.height})` : "no screen profile";
  return (
    <DialogControlsSection>
      <DialogControlsSectionHeader>Advanced shared settings</DialogControlsSectionHeader>
      <Field label="Shared defaults and network overrides" description={`${countProfileOverrides(profile)} shared defaults · ${countProfileOverrides(hostSettings.networkSettings.wifi)} Wi-Fi overrides · ${countProfileOverrides(hostSettings.networkSettings.ethernet)} Ethernet overrides. Existing values remain in effect while this section is collapsed.`} childrenContainerWidth="fixed">
        <DialogButton onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide advanced" : "Show advanced"}</DialogButton>
      </Field>
      {expanded && (
        <>
          <Field label="Shared defaults for this host" description="Fallback values for every screen and both networks. Blank fields or Use Moonlight setting leave the value to Moonlight. Screen defaults and network overrides can replace these." />
          <StreamingProfileFields value={profile} setValue={setDefaults} inheritLabel="Use Moonlight setting" inherited={resolveProfile(hostSettings, null, "unknown", "host")} allowAutomaticRates={true} />
          <Field label="Shared network overrides — all screens" description="These override screen defaults on the chosen network. A screen's own Wi-Fi or Ethernet override takes priority. Leave fields blank or choose Inherit to keep the preceding value." />
          <ProfileLayerTabs options={networkTabs} value={transport} setValue={setTransport} />
          <Field label={`Editing shared ${transportLabel(transport)} overrides`} description={`Inherited and effective values below are shown for ${context}. They can differ for other screens. This editing tab does not select the active connection.`} />
          <StreamingProfileFields
            key={transport}
            value={hostSettings.networkSettings[transport]}
            setValue={(next) => settingsManager.updateHost((host) => { host.networkSettings[transport] = next; })}
            inherited={resolveProfile(hostSettings, dimension, transport, "host-network")}
            effective={resolveProfile(hostSettings, dimension, transport)}
            editedSource={`shared ${transportLabel(transport)} override`}
          />
          <ProfileSummary label={`Requested ${transportLabel(transport)} settings for ${context}`} resolved={resolveProfile(hostSettings, dimension, transport)} />
        </>
      )}
    </DialogControlsSection>
  );
};
