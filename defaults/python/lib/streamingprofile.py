"""Resolve inherited host, display and transport streaming settings."""

from typing import Optional

from .plugin.settings import Dimension, HostSettings, StreamingProfile
from .networkprofile import Transport


def selected_dimension(host: HostSettings, display: Optional[str]) -> Optional[Dimension]:
    resolution = host["resolution"]
    if resolution["useLinkedDisplays"] and display:
        for dimension in resolution["dimensions"]:
            if display in dimension["linkedDisplays"]:
                return dimension
    index = resolution["selectedDimensionIndex"]
    if resolution["useCustomDimensions"] and 0 <= index < len(resolution["dimensions"]):
        return resolution["dimensions"][index]
    return None


def resolve_streaming_profile(host: HostSettings, dimension: Optional[Dimension],
                              transport: Transport) -> StreamingProfile:
    profile = {key: host.get(key) for key in StreamingProfile.__annotations__}
    profile.update(bitrate=host["resolution"]["defaultBitrate"],
                   fps=host["resolution"]["defaultFps"],
                   hdr=host["resolution"]["defaultHdr"])
    layers = [dimension] if dimension else []
    if transport in ("ethernet", "wifi"):
        layers.append(host["networkSettings"][transport])
        if dimension:
            layers.append(dimension["networkOverrides"][transport])
    for layer in layers:
        for key in profile:
            if layer.get(key) is not None:
                profile[key] = layer[key]
    return profile
