import { DialogControlsSection, DialogControlsSectionHeader, Field, Focusable } from "@decky/ui";
import { FC, useContext } from "react";
import { ModifyListButton, RemoveListEntryButton } from "../../shared/indexedlist";
import { NumericTextInput, OptionalBooleanDropdown, ResolutionSelectionDropdown, ToggleField } from "../../shared";
import { maxBitrate, minBitrate, minFps } from "../../../lib";
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
      <DialogControlsSectionHeader>Display profiles</DialogControlsSectionHeader>
      <Field
        label="Default bitrate in kbps (optional)"
        description="Bitrate when starting a stream, unless a display or network profile overrides it. 1000000 kbps = 1 Gbps; maximum 3000000 kbps."
        childrenContainerWidth="fixed"
      >
        <NumericTextInput
          min={minBitrate}
          max={maxBitrate}
          optional={true}
          value={hostSettings.resolution.defaultBitrate}
          setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.resolution.defaultBitrate = value; })}
        />
      </Field>
      <Field
        label="Default FPS (optional)"
        description="FPS to be applied when starting stream. Will be overridden by the one from custom resolution if provided. Providing FPS without bitrate will trigger Moonlight to automatically calculate the bitrate!"
        childrenContainerWidth="fixed"
      >
        <NumericTextInput
          min={minFps}
          optional={true}
          value={hostSettings.resolution.defaultFps}
          setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.resolution.defaultFps = value; })}
        />
      </Field>
      <Field
        label="Default HDR"
        description="HDR to be applied when starting stream. Will be overridden by the one from custom resolution if provided."
        childrenContainerWidth="fixed"
      >
        <OptionalBooleanDropdown
          value={hostSettings.resolution.defaultHdr}
          optValueLabel="Don't override"
          setValue={(value) => settingsManager.updateHost((hostSettings) => { hostSettings.resolution.defaultHdr = value; })}
        />
      </Field>
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
        label="Selected display profile"
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
