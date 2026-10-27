import { DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { FC, useContext } from "react";
import { ListDropdown, ToggleField } from "../../shared";
import { HostSettings } from "../../../lib";
import { MoonDeckContext } from "../../../contexts";
import { MoonlightExecutableSelection } from "./moonlightexecutableselection";

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
        label="Use Vibedeck streaming profiles"
        description="Use this screen's profile and network overrides for video, audio and resolution. Switch off to use Moonlight's own settings. Performance stats remain independent."
        value={hostSettings.passToMoonlight}
        setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.passToMoonlight = value; })}
      />
    </DialogControlsSection>
  );
};
