import { DialogControlsSection, DialogControlsSectionHeader, Field, Focusable } from "@decky/ui";
import { FC, useContext } from "react";
import { ModifyListButton, RemoveListEntryButton } from "../../shared/indexedlist";
import { ResolutionSelectionDropdown, ToggleField } from "../../shared";
import { CurrentHostSettings } from "../../../hooks";
import { LinkedDisplayList } from "./linkeddisplaylist";
import { ModifyResolutionModal } from "./modifyresolutionmodal";
import { MoonDeckContext } from "../../../contexts";

interface Props {
  hostSettings: CurrentHostSettings;
}

export const ResolutionSection: FC<Props> = ({ hostSettings }) => {
  const { settingsManager } = useContext(MoonDeckContext);

  return (
    <DialogControlsSection>
      <DialogControlsSectionHeader>Screen profiles</DialogControlsSectionHeader>
      <ToggleField
        label="Use SteamDeck's primary resolution as fallback"
        description="If custom resolution is disabled, SteamDeck's primary resolution will be used - that of internal or external display."
        value={hostSettings.resolution.automatic}
        setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.resolution.automatic = value; })}
      />
      <ToggleField
        label="Use selected display profile as fallback"
        description="This setting has no effect if the custom resolution list is empty."
        value={hostSettings.resolution.useCustomDimensions}
        setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.resolution.useCustomDimensions = value; })}
      />
      <Field
        label="Profile to edit / fallback"
        description="Edit this screen's Defaults, Wi-Fi and Ethernet tabs below. A linked screen profile takes priority over the selected fallback."
        childrenContainerWidth="fixed"
        bottomSeparator="none"
      >
        <ResolutionSelectionDropdown
          currentIndex={hostSettings.resolution.selectedDimensionIndex}
          currentList={hostSettings.resolution.dimensions}
          setIndex={(value) => { settingsManager.updateHost((hostSettings) => { hostSettings.resolution.selectedDimensionIndex = value; }); }}
        />
      </Field>
      <Field
        childrenContainerWidth="fixed"
        childrenLayout="below"
      >
        <Focusable style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <ModifyListButton
            modal={ModifyResolutionModal}
            currentList={hostSettings.resolution.dimensions}
            currentIndex={null}
            updateList={(list, index) => {
              settingsManager.updateHost((hostSettings) => {
                hostSettings.resolution.dimensions = list;
                hostSettings.resolution.selectedDimensionIndex = index;
              });
            }}
          />
          <ModifyListButton
            modal={ModifyResolutionModal}
            currentList={hostSettings.resolution.dimensions}
            currentIndex={hostSettings.resolution.selectedDimensionIndex}
            updateList={(list, index) => {
              settingsManager.updateHost((hostSettings) => {
                hostSettings.resolution.dimensions = list;
                hostSettings.resolution.selectedDimensionIndex = index;
              });
            }}
          />
          <RemoveListEntryButton
            currentList={hostSettings.resolution.dimensions}
            currentIndex={hostSettings.resolution.selectedDimensionIndex}
            updateList={(list, index) => {
              settingsManager.updateHost((hostSettings) => {
                hostSettings.resolution.dimensions = list;
                hostSettings.resolution.selectedDimensionIndex = index;
              });
            }}
          />
        </Focusable>
      </Field>
      <LinkedDisplayList hostSettings={hostSettings} />
    </DialogControlsSection>
  );
};
