import { AnyTextInput, NumericTextInput } from "../../shared";
import { DialogButton, Field, ModalRoot } from "@decky/ui";
import { Dimension, HostResolution, StreamingProfile, emptyStreamingProfile, emptyTransportProfiles } from "../../../lib";
import { IndexedListModal } from "../../shared/indexedlist";
import { ProfileLayerTabs } from "../profilelayertabs";
import { ProfileSummary } from "../profilesummary";
import { StreamingProfileFields } from "../streamingprofilefields";
import { resolveProfile } from "../../../lib/streamingprofile";
import { useCurrentHostSettings } from "../../../hooks";
import { useState } from "react";

const profileLayers = [
  { id: "display", label: "Defaults" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "ethernet", label: "Ethernet" }
] as const;

type Layer = typeof profileLayers[number]["id"];

export const ModifyResolutionModal: IndexedListModal<HostResolution["dimensions"][number]> = ({ closeModal, currentList, currentIndex, updateList }) => {
  const host = useCurrentHostSettings();
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
  const dimension: Dimension = {
    ...initialValue, ...profile, width: width ?? 0, height: height ?? 0,
    label: label.trim(), linkedDisplays: [...(initialValue?.linkedDisplays ?? [])], networkOverrides: networks
  };
  const editing = profileLayers.find((option) => option.id === layer)?.label ?? "Defaults";
  const inherited = host ? resolveProfile(host, dimension, layer === "display" ? "unknown" : layer, layer === "display" ? "screen" : "screen-network") : undefined;

  const handleClick = (): void => {
    if (width === null || height === null) {
      return;
    }
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
      <div style={{ fontWeight: "bolder", marginBottom: "1em" }}>Screen streaming profile</div>
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
        <ProfileLayerTabs options={profileLayers} value={layer} setValue={setLayer} />
        <Field
          label={`Editing: ${label.trim() || "New screen"} → ${editing}`}
          description={layer === "display" ?
            "Defaults for both networks. These settings apply to Wi-Fi and Ethernet unless a network override is set. Blank fields inherit shared defaults." :
            "Leave a field blank or select Inherit to use its inherited setting shown below. Only enter values you want to override. Editing this tab does not select the active connection."}
        />
        {host && !host.passToMoonlight && <Field label="Streaming profiles are switched off" description="These values will apply when Use Vibedeck streaming profiles is enabled. Moonlight settings are currently used." />}
        <StreamingProfileFields
          key={layer}
          value={layer === "display" ? profile : networks[layer]}
          inherited={inherited}
          setValue={(value) => {
            if (layer === "display") {
              setProfile(value);
            } else {
              setNetworks({ ...networks, [layer]: value });
            }
          }}
          onValidityChange={(valid) => setProfileValidity((previous) => ({ ...previous, [layer]: valid }))}
        />
        {host && (
          <>
            <Field label="Requested settings after saving" description="Includes shared and screen overrides. Values apply on the next stream when profiles are enabled; actual negotiated settings are shown in Moonlight's stats." />
            <ProfileSummary label="Wi-Fi" resolved={resolveProfile(host, dimension, "wifi")} />
            <ProfileSummary label="Ethernet" resolved={resolveProfile(host, dimension, "ethernet")} />
          </>
        )}
      </div>
      <Field childrenLayout="below" childrenContainerWidth="max" bottomSeparator="none">
        <DialogButton disabled={!widthValid || !heightValid || !Object.values(profileValidity).every(Boolean)} onClick={handleClick}>
          Save profile — all tabs
        </DialogButton>
      </Field>
    </ModalRoot>
  );
};
