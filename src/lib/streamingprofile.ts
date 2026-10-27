import { Dimension, HostSettings, StreamingProfile, emptyStreamingProfile } from "./settingsmanager";

export type ProfileTransport = "wifi" | "ethernet" | "unknown";
export type ProfileLayer = "host" | "screen" | "host-network" | "screen-network";
export const profileKeys = Object.keys(emptyStreamingProfile()) as Array<keyof StreamingProfile>;

export interface ResolvedProfile {
  values: StreamingProfile;
  sources: Record<keyof StreamingProfile, string>;
}

export function hostStreamingProfile(host: HostSettings): StreamingProfile {
  const result = emptyStreamingProfile();
  for (const key of profileKeys) {
    if (key in host) Object.assign(result, { [key]: host[key as keyof HostSettings] });
  }
  return { ...result, bitrate: host.resolution.defaultBitrate, fps: host.resolution.defaultFps, hdr: host.resolution.defaultHdr };
}

export function selectDisplayProfile(host: HostSettings, display: string | null): Dimension | null {
  const resolution = host.resolution;
  if (resolution.useLinkedDisplays && display) {
    const linked = resolution.dimensions.find((dimension) => dimension.linkedDisplays.includes(display));
    if (linked) return linked;
  }
  return resolution.useCustomDimensions ? resolution.dimensions[resolution.selectedDimensionIndex] ?? null : null;
}

export function transportLabel(transport: ProfileTransport): string {
  return transport === "wifi" ? "Wi-Fi" : transport === "ethernet" ? "Ethernet" : "Unknown connection";
}

// Read-only UI preview of the runner's existing order. Cross-language regression
// tests compare these values against lib.streamingprofile.resolve_streaming_profile.
export function resolveProfile(host: HostSettings, dimension: Dimension | null, transport: ProfileTransport, before?: ProfileLayer): ResolvedProfile {
  const values = emptyStreamingProfile();
  const sources = Object.fromEntries(profileKeys.map((key) => [key, "Moonlight"])) as ResolvedProfile["sources"];
  const layers: Array<{ id: ProfileLayer; label: string; value: StreamingProfile }> = [
    { id: "host", label: "shared defaults", value: hostStreamingProfile(host) }
  ];
  if (dimension) layers.push({ id: "screen", label: "screen defaults", value: dimension });
  if (transport !== "unknown") {
    layers.push({ id: "host-network", label: `shared ${transportLabel(transport)} override`, value: host.networkSettings[transport] });
    if (dimension) layers.push({ id: "screen-network", label: `screen ${transportLabel(transport)} override`, value: dimension.networkOverrides[transport] });
  }
  for (const layer of layers) {
    if (layer.id === before) break;
    for (const key of profileKeys) {
      const next = layer.value[key];
      if (next !== null && next !== undefined) {
        Object.assign(values, { [key]: next });
        sources[key] = layer.label;
      }
    }
  }
  return { values, sources };
}

export function formatProfileValue(key: keyof StreamingProfile, value: StreamingProfile[keyof StreamingProfile]): string {
  if (value === null || value === undefined) return "Moonlight setting / automatic";
  if (key === "bitrate" && typeof value === "number") {
    if (value === 0) return "Automatic bitrate";
    return value >= 1_000_000 ? `${value / 1_000_000} Gbps` : `${value / 1000} Mbps`;
  }
  if (key === "fps") return value === 0 ? "Automatic FPS" : `${value} FPS`;
  if (key === "yuv444") return value ? "4:4:4" : "4:2:0";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return `${value}`;
}

export function inheritedDescription(resolved: ResolvedProfile, key: keyof StreamingProfile): string {
  const value = resolved.values[key];
  return value === null ? "Inherited: Moonlight setting / automatic" : `Inherited: ${formatProfileValue(key, value)} — ${resolved.sources[key]}`;
}

export function countProfileOverrides(profile: StreamingProfile): number {
  return profileKeys.filter((key) => profile[key] !== null && profile[key] !== undefined).length;
}
