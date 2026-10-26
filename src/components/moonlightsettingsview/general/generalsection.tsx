import { DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { FC, useContext } from "react";
import { HostSettings, emptyStreamingProfile } from "../../../lib";
import { OptionalBooleanDropdown, ToggleField } from "../../shared";
import { MoonDeckContext } from "../../../contexts";
import { MoonlightExecutableSelection } from "./moonlightexecutableselection";
import { StreamingProfileFields } from "../streamingprofilefields";

interface Props {
  hostSettings: HostSettings;
}

export const GeneralSection: FC<Props> = ({ hostSettings }) => {
  const { settingsManager } = useContext(MoonDeckContext);

  return (
    <DialogControlsSection>
      <DialogControlsSectionHeader>General</DialogControlsSectionHeader>
      <MoonlightExecutableSelection />
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
      <Field
        label="Toggle performance stats"
        description="Show or hide performance stats when streaming. Current Moonlight setting will be used unless overriden."
        childrenContainerWidth="fixed"
      >
        <OptionalBooleanDropdown
          value={hostSettings.showPerformanceStats}
          optValueLabel="Don't override"
          setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.showPerformanceStats = value; })}
        />
      </Field>
    </DialogControlsSection>
  );
};
