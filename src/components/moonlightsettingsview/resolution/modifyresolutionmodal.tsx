import { AnyTextInput, ListDropdown, NumericTextInput } from "../../shared";
import { DialogButton, Field, ModalRoot } from "@decky/ui";
import { Dimension, HostResolution, StreamingProfile, emptyStreamingProfile, emptyTransportProfiles } from "../../../lib";
import { IndexedListModal } from "../../shared/indexedlist";
import { StreamingProfileFields } from "../streamingprofilefields";
import { useState } from "react";

const profileLayers = [
  { id: "display", label: "Display defaults" },
  { id: "ethernet", label: "Ethernet overrides" },
  { id: "wifi", label: "Wi-Fi overrides" }
] as const;

type Layer = typeof profileLayers[number]["id"];

export const ModifyResolutionModal: IndexedListModal<HostResolution["dimensions"][number]> = ({ closeModal, currentList, currentIndex, updateList }) => {
  const validIndex = currentIndex !== null && currentIndex >= 0 && currentIndex < currentList.length;
  const initialValue = validIndex ? currentList[currentIndex] : null;
  const [width, setWidth] = useState<number | null>(initialValue?.width ?? null);
  const [height, setHeight] = useState<number | null>(initialValue?.height ?? null);
  const [label, setLabel] = useState(initialValue?.label ?? "");
  const [profile, setProfile] = useState<StreamingProfile>({ ...emptyStreamingProfile(), ...initialValue });
  const [networks, setNetworks] = useState(initialValue?.networkOverrides ?? emptyTransportProfiles());
  const [layer, setLayer] = useState<Layer>("display");
  const [widthValid, setWidthValid] = useState(false);
  const [heightValid, setHeightValid] = useState(false);
  const [profileValidity, setProfileValidity] = useState({ display: true, ethernet: true, wifi: true });

  const handleClick = (): void => {
    if (width === null || height === null) {
      return;
    }
    const dimension: Dimension = {
      ...profile, width, height, label: label.trim(),
      linkedDisplays: [...(initialValue?.linkedDisplays ?? [])],
      networkOverrides: networks
    };
    const list = [...currentList];
    // Profiles with identical resolutions may belong to different screens.
    // Replace by index, retaining display links and the rest of the list.
    const index = validIndex ? currentIndex : list.length;
    list[index] = dimension;
    updateList(list, index);
    closeModal();
  };

  return (
    <ModalRoot closeModal={closeModal}>
      <div style={{ fontWeight: "bolder", marginBottom: "1em" }}>Display streaming profile</div>
      <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "12px" }}>
        <Field label="Profile name (optional)" childrenContainerWidth="fixed">
          <AnyTextInput value={label} setValue={setLabel} />
        </Field>
        <Field label="Width" childrenContainerWidth="fixed">
          <NumericTextInput min={1} max={16384} integer={true} value={width} setValue={setWidth} setIsValid={setWidthValid} />
        </Field>
        <Field label="Height" childrenContainerWidth="fixed">
          <NumericTextInput min={1} max={16384} integer={true} value={height} setValue={setHeight} setIsValid={setHeightValid} />
        </Field>
        <Field label="Edit settings for" description="Inherit keeps the preceding host/display value. Network overrides apply on the next stream; link this profile to a screen after saving." childrenContainerWidth="fixed">
          <ListDropdown optionList={profileLayers} label="Display defaults" value={layer} setValue={setLayer} />
        </Field>
        <StreamingProfileFields
          key={layer}
          value={layer === "display" ? profile : networks[layer]}
          setValue={(value) => {
            if (layer === "display") {
              setProfile(value);
            } else {
              setNetworks({ ...networks, [layer]: value });
            }
          }}
          onValidityChange={(valid) => setProfileValidity((previous) => ({ ...previous, [layer]: valid }))}
        />
      </div>
      <Field childrenLayout="below" childrenContainerWidth="max" bottomSeparator="none">
        <DialogButton disabled={!widthValid || !heightValid || !Object.values(profileValidity).every(Boolean)} onClick={handleClick}>
          Save display profile
        </DialogButton>
      </Field>
    </ModalRoot>
  );
};
