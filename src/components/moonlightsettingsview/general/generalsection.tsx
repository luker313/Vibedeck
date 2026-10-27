import { DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { FC, useContext } from "react";
import { HostSettings, emptyStreamingProfile } from "../../../lib";
import { ListDropdown, ToggleField } from "../../shared";
import { MoonDeckContext } from "../../../contexts";
import { MoonlightExecutableSelection } from "./moonlightexecutableselection";
import { StreamingProfileFields } from "../streamingprofilefields";

interface Props {
  hostSettings: HostSettings;
}

const performanceStatsOptions = [
  { id: true, label: "Force on" },
  { id: false, label: "Force off" }
] as const;

export const GeneralSection: FC<Props> = ({ hostSettings }) => {
  const { settingsManager } = useContext(MoonDeckContext);

  return (
    <DialogControlsSection>
      <DialogControlsSectionHeader>General</DialogControlsSectionHeader>
      <MoonlightExecutableSelection />
      <Field
        label="Performance stats overlay"
        description="Force on shows Moonlight's performance stats when the next stream starts. Works even when passing other options is off. Reconnect to apply changes."
        childrenContainerWidth="fixed"
      >
        <ListDropdown
          optionList={performanceStatsOptions}
          withOptionalValue={true}
          value={hostSettings.showPerformanceStats}
          label="Use Moonlight setting"
          setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.showPerformanceStats = value; })}
        />
      </Field>
      <ToggleField
        label="Pass audio, resolution and other options to Moonlight to use instead of Moonlight's default ones"
        description="Disable this if you want to use the settings from the Moonlight app itself"
        value={hostSettings.passToMoonlight}
        setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.passToMoonlight = value; })}
      />
      <StreamingProfileFields
        value={{ ...emptyStreamingProfile(), ...hostSettings }}
        includeRateAndHdr={false}
        inheritLabel="Moonlight default"
        setValue={(profile) => settingsManager.updateHost((host) => {
          const { bitrate: _bitrate, fps: _fps, hdr: _hdr, ...options } = profile;
          for (const key of ["videoCodec", "yuv444", "enableVrr", "smoothVrrFrameTiming", "absorbVrrMicrostutter", "enableVSync", "enableFramePacing"] as const) {
            Object.assign(host, { [key]: options[key] });
          }
        })}
      />
    </DialogControlsSection>
  );
};
