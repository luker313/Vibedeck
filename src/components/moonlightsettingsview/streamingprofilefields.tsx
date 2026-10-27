import { FC, useState } from "react";
import { ListDropdown, NumericTextInput, OptionalBooleanDropdown } from "../shared";
import { StreamingProfile, maxBitrate, videoCodecOptions } from "../../lib";
import { Field } from "@decky/ui";

interface Props {
  value: StreamingProfile;
  setValue: (value: StreamingProfile) => void;
  inheritLabel?: string;
  includeRateAndHdr?: boolean;
  onValidityChange?: (valid: boolean) => void;
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

export const StreamingProfileFields: FC<Props> = ({ value, setValue, inheritLabel = "Inherit", includeRateAndHdr = true, onValidityChange }) => {
  const [rateValid, setRateValid] = useState(true);
  const [fpsValid, setFpsValid] = useState(true);
  return (
    <>
      <Field label="Video codec" description="PyroWave requires Nonary's client, Vibepollo and substantial LAN bandwidth." childrenContainerWidth="fixed">
        <ListDropdown optionList={videoCodecOptions} stringifySimpleLabels={false} label={inheritLabel} withOptionalValue={true} value={value.videoCodec} setValue={(videoCodec) => setValue({ ...value, videoCodec })} />
      </Field>
      {includeRateAndHdr && (
        <>
          <Field label="Bitrate (kbps)" description="Blank inherits. 1000000 kbps = 1 Gbps; maximum 3000000 kbps. For PyroWave, use the bitrate from Moonlight's calibration for this link." childrenContainerWidth="fixed">
            <NumericTextInput min={500} max={maxBitrate} integer={true} optional={true} value={value.bitrate} setValue={(bitrate) => setValue({ ...value, bitrate })} setIsValid={(valid) => { setRateValid(valid); onValidityChange?.(valid && fpsValid); }} />
          </Field>
          <Field label="FPS" description="Blank inherits; this is the stream frame rate target." childrenContainerWidth="fixed">
            <NumericTextInput min={10} max={480} integer={true} optional={true} value={value.fps} setValue={(fps) => setValue({ ...value, fps })} setIsValid={(valid) => { setFpsValid(valid); onValidityChange?.(valid && rateValid); }} />
          </Field>
          <Field label="HDR" childrenContainerWidth="fixed">
            <OptionalBooleanDropdown value={value.hdr} optValueLabel={inheritLabel} setValue={(hdr) => setValue({ ...value, hdr })} />
          </Field>
        </>
      )}
      <Field label="Chroma sampling" description="Requests the chosen format; actual support depends on both GPUs and the codec." childrenContainerWidth="fixed">
        <ListDropdown optionList={chromaOptions} label={inheritLabel} withOptionalValue={true} value={value.yuv444} setValue={(yuv444) => setValue({ ...value, yuv444 })} />
      </Field>
      {toggleFields.map(({ key, label, description }) => (
        <Field key={key} label={label} description={description} childrenContainerWidth="fixed">
          <OptionalBooleanDropdown value={value[key]} optValueLabel={inheritLabel} setValue={(next) => setValue({ ...value, [key]: next })} />
        </Field>
      ))}
    </>
  );
};
