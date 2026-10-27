import { FC, useState } from "react";
import { ListDropdown, NumericTextInput, OptionalBooleanDropdown } from "../shared";
import { ResolvedProfile, formatProfileValue, inheritedDescription } from "../../lib/streamingprofile";
import { StreamingProfile, maxBitrate, videoCodecOptions } from "../../lib";
import { Field } from "@decky/ui";

interface Props {
  value: StreamingProfile;
  setValue: (value: StreamingProfile) => void;
  inheritLabel?: string;
  includeRateAndHdr?: boolean;
  onValidityChange?: (valid: boolean) => void;
  inherited?: ResolvedProfile;
  effective?: ResolvedProfile;
  editedSource?: string;
  allowAutomaticRates?: boolean;
}

const chromaOptions = [
  { id: false, label: "4:2:0" },
  { id: true, label: "4:4:4 (if supported)" }
] as const;

const toggleFields = [
  { key: "enableVrr", label: "VRR pacing", description: "Requires Nonary's VRR Moonlight and a compatible client display/presentation path." },
  { key: "smoothVrrFrameTiming", label: "VRR frame timing smoothing", description: "Smooth uneven presentation timing." },
  { key: "absorbVrrMicrostutter", label: "VRR microstutter absorption", description: "Adds latency to absorb brief timing variations." },
  { key: "enableVSync", label: "V-sync", description: "Choose independently for this display or network." },
  { key: "enableFramePacing", label: "Frame pacing", description: "Moonlight's regular frame pacing setting." }
] as const;

export const StreamingProfileFields: FC<Props> = ({ value, setValue, inheritLabel = "Inherit", includeRateAndHdr = true, onValidityChange, inherited, effective, editedSource, allowAutomaticRates = false }) => {
  const [rateValid, setRateValid] = useState(true);
  const [fpsValid, setFpsValid] = useState(true);
  const label = (key: keyof StreamingProfile): string => inherited?.values[key] != null ? `Inherit — ${formatProfileValue(key, inherited.values[key])}` : inheritLabel;
  const description = (key: keyof StreamingProfile, help?: string) => (
    <>
      {help && <div>{help}</div>}
      {value[key] == null && inherited && <div style={{ marginTop: "4px", color: "#b8dfff" }}>{inheritedDescription(inherited, key)}</div>}
      {value[key] != null && effective && editedSource && effective.sources[key] !== editedSource && (
        <div style={{ marginTop: "4px", color: "#f4ce85" }}>
          Overridden for this screen:
          {formatProfileValue(key, effective.values[key])}
          {" "}
          —
          {effective.sources[key]}
        </div>
      )}
    </>
  );
  return (
    <>
      <Field label="Video codec" description={description("videoCodec", "PyroWave requires Nonary's client, Vibepollo and substantial LAN bandwidth.")} childrenContainerWidth="fixed">
        <ListDropdown optionList={videoCodecOptions} stringifySimpleLabels={false} label={label("videoCodec")} withOptionalValue={true} value={value.videoCodec} setValue={(videoCodec) => setValue({ ...value, videoCodec })} />
      </Field>
      {includeRateAndHdr && (
        <>
          <Field label="Bitrate (kbps)" description={description("bitrate", "Blank inherits. 1000000 kbps = 1 Gbps; maximum 3000000 kbps. For PyroWave, use Moonlight's calibrated bitrate for this link.")} childrenContainerWidth="fixed">
            <NumericTextInput min={allowAutomaticRates ? 0 : 500} max={maxBitrate} integer={true} optional={true} value={value.bitrate} setValue={(bitrate) => setValue({ ...value, bitrate })} setIsValid={(valid) => { setRateValid(valid); onValidityChange?.(valid && fpsValid); }} />
          </Field>
          <Field label="FPS" description={description("fps", "Blank inherits; this is the stream frame rate target.")} childrenContainerWidth="fixed">
            <NumericTextInput min={allowAutomaticRates ? 0 : 10} max={480} integer={true} optional={true} value={value.fps} setValue={(fps) => setValue({ ...value, fps })} setIsValid={(valid) => { setFpsValid(valid); onValidityChange?.(valid && rateValid); }} />
          </Field>
          <Field label="HDR" description={description("hdr")} childrenContainerWidth="fixed">
            <OptionalBooleanDropdown value={value.hdr} optValueLabel={label("hdr")} setValue={(hdr) => setValue({ ...value, hdr })} />
          </Field>
        </>
      )}
      <Field label="Chroma sampling" description={description("yuv444", "Requests the chosen format; actual support depends on both GPUs and the codec.")} childrenContainerWidth="fixed">
        <ListDropdown optionList={chromaOptions} label={label("yuv444")} withOptionalValue={true} value={value.yuv444} setValue={(yuv444) => setValue({ ...value, yuv444 })} />
      </Field>
      {toggleFields.map(({ key, label: title, description: help }) => (
        <Field key={key} label={title} description={description(key, help)} childrenContainerWidth="fixed">
          <OptionalBooleanDropdown value={value[key]} optValueLabel={label(key)} setValue={(next) => setValue({ ...value, [key]: next })} />
        </Field>
      ))}
    </>
  );
};
