import { ResolvedProfile, formatProfileValue } from "../../lib/streamingprofile";
import { FC } from "react";
import { Field } from "@decky/ui";

interface Props {
  label: string;
  resolved: ResolvedProfile;
}

export const ProfileSummary: FC<Props> = ({ label, resolved }) => {
  const profile = resolved.values;
  const value = (key: keyof typeof profile): string => formatProfileValue(key, profile[key]);
  const detail = [profile.hdr === null ? null : `HDR ${profile.hdr ? "on" : "off"}`,
    profile.yuv444 === null ? null : value("yuv444"),
    profile.enableVrr === null ? null : `VRR ${profile.enableVrr ? "on" : "off"}`].filter(Boolean).join(" · ");
  return (
    <Field
      label={label}
      description={
        <div style={{ overflowWrap: "anywhere" }}>
          <div>{[value("videoCodec"), value("bitrate"), value("fps")].join(" · ")}</div>
          {detail && <div>{detail}</div>}
        </div>
      }
    />
  );
};
