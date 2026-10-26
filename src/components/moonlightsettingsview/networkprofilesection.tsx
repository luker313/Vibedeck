import { DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { FC, useContext, useState } from "react";
import { HostSettings, networkModeOptions } from "../../lib";
import { ListDropdown } from "../shared";
import { MoonDeckContext } from "../../contexts";
import { StreamingProfileFields } from "./streamingprofilefields";

interface Props {
  hostSettings: HostSettings;
}

const transports = [
  { id: "ethernet", label: "Ethernet" },
  { id: "wifi", label: "Wi-Fi" }
] as const;

export const NetworkProfileSection: FC<Props> = ({ hostSettings }) => {
  const { settingsManager } = useContext(MoonDeckContext);
  const [transport, setTransport] = useState<"ethernet" | "wifi">("ethernet");
  return (
    <DialogControlsSection>
      <DialogControlsSectionHeader>Network profiles</DialogControlsSectionHeader>
      <Field label="Network selection" description="Automatic checks the route to the host at launch and resume. Unknown routes inherit display settings. Changes apply to the next stream." childrenContainerWidth="fixed">
        <ListDropdown optionList={networkModeOptions} label="Automatic" value={hostSettings.networkSettings.mode} setValue={(mode) => settingsManager.updateHost((host) => { host.networkSettings.mode = mode; })} />
      </Field>
      <Field label="Edit network overrides" description="Host defaults → display profile → host network overrides → display network overrides. Inherit keeps the preceding value." childrenContainerWidth="fixed">
        <ListDropdown optionList={transports} label="Ethernet" value={transport} setValue={setTransport} />
      </Field>
      <StreamingProfileFields key={transport} value={hostSettings.networkSettings[transport]} setValue={(profile) => settingsManager.updateHost((host) => { host.networkSettings[transport] = profile; })} />
    </DialogControlsSection>
  );
};
