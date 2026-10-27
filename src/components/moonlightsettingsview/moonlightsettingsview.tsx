import { DialogBody, DialogControlsSection, Field } from "@decky/ui";
import { useCurrentDisplayIdentifier, useCurrentHostSettings } from "../../hooks";
import { AdvancedProfileSection } from "./advancedprofilesection";
import { AppResolutionOverrideSection } from "./appresolutionoverride/appresolutionoverridesection";
import { AudioSection } from "./audio/audiosection";
import { FC } from "react";
import { GeneralSection } from "./general/generalsection";
import { HostOff } from "../icons";
import { LabelWithIcon } from "../shared";
import { NetworkProfileSection } from "./networkprofilesection";
import { ResolutionSection } from "./resolution/resolutionsection";
import { selectDisplayProfile } from "../../lib/streamingprofile";

export const MoonlightSettingsView: FC = () => {
  const hostSettings = useCurrentHostSettings();
  const display = useCurrentDisplayIdentifier();
  if (hostSettings === null) {
    return (
      <DialogBody>
        <DialogControlsSection>
          <Field
            label={<LabelWithIcon icon={HostOff} label="HOST IS NOT SELECTED" />}
            description="Go to host selection page to select host"
            bottomSeparator="none"
          />
        </DialogControlsSection>
      </DialogBody>
    );
  }

  return (
    <DialogBody>
      <GeneralSection hostSettings={hostSettings} />
      <NetworkProfileSection hostSettings={hostSettings} display={display} />
      <ResolutionSection hostSettings={hostSettings} />
      <AudioSection hostSettings={hostSettings} />
      <AdvancedProfileSection hostSettings={hostSettings} dimension={selectDisplayProfile(hostSettings, display)} />
      <AppResolutionOverrideSection hostSettings={hostSettings} />
    </DialogBody>
  );
};
