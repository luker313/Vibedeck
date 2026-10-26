# Vibedeck 0.1 scope and integration contract

Vibedeck extends the client-side MoonDeck Decky plugin. It targets
[Nonary/Vibepollo](https://github.com/Nonary/Vibepollo) and
[Nonary/moonlight-qt](https://github.com/Nonary/moonlight-qt), with standard
[MoonDeck Buddy](https://github.com/FrogTheFrog/moondeck-buddy) on the host.
Buddy API version 9, pairing, Steam launching, shutdown, WOL and host-app
selection retain their upstream protocol. No host Buddy or Moonlight fork is
needed for these settings.

## Implemented

| Area | Behavior |
| --- | --- |
| Codec | Inherit, Auto, H.264, HEVC, AV1 and explicitly selected PyroWave |
| Chroma | Inherit, request 4:2:0, request 4:4:4 |
| VRR | Independent pacing, frame-timing smoothing and microstutter-absorption toggles |
| Display profiles | Name, width, height, FPS, bitrate, HDR, codec, chroma, VRR, V-sync and frame pacing; linked to the current Steam primary screen |
| Network profiles | Host-wide Ethernet/Wi-Fi overrides plus overrides inside each display profile |
| Detection | Linux iproute2 route to the configured host address, then sysfs interface classification; manual transport override available |
| Unknown route | No Ethernet or Wi-Fi override is selected; inherited host/display settings apply |
| Lifecycle | Resolve at stream launch; refresh the network and settings on suspend/resume |
| Client | Nonary Flatpak master branch, or a selected executable/AppImage; feature preflight checks CLI help |
| Existing settings | Import to a separate Vibedeck file, preserve Buddy client ID, migrate schema 43 to 44, retain display links and explicit false values |

Settings are layered in this order, with later non-null values winning:

1. Host defaults (including resolution defaults).
2. Linked display profile, otherwise selected fallback profile if enabled.
3. Host-wide override for the selected transport.
4. Display-specific override for that transport.

`null` always means inherit; `false` means explicitly disabled. Identical
resolutions can have distinct profiles and screen links. Screen identifiers
retain MoonDeck's description/physical-size format, so existing links survive.
Identical-model screens that report identical identifiers cannot be distinguished
by this upstream Steam display identity.

## Nonary interfaces verified against source

- MoonDeck base: `FrogTheFrog/moondeck` commit `00f8c31a6d9324878811178a2f8a319e4ca5c7c2` (1.13.0).
- Moonlight reference: master as inspected 27 October 2026 (Perth),
  `app/cli/commandlineparser.cpp` and `packaging/flatpak/README.md`.
- Codec: `--video-codec PyroWave`, `AV1`, `HEVC`, `H.264` or `Auto`.
- Chroma: `--yuv444` / `--no-yuv444`.
- VRR: `--vrr`, `--vrr-smooth-frame-timing`, `--vrr-absorb-microstutter`,
  each with an explicit `--no-…` counterpart.
- Existing options: `--bitrate` in kbps, `--fps`, `--hdr` / `--no-hdr`,
  `--vsync` / `--no-vsync`, `--frame-pacing` / `--no-frame-pacing`.
- Nonary's Flatpak application ID is `com.moonlight_stream.Moonlight`, branch
  `master`; ordinary Flathub Moonlight uses `stable`.

Vibedeck passes ephemeral launch overrides. It does not edit Moonlight's saved
preferences, Vibepollo's configuration or Linux networking.

## Boundaries

- Codec/chroma changes require a new stream. Active streams do not switch
  codecs when a cable is connected or removed.
- The Steam display identifier is captured at launch. After changing screens
  while suspended, start a new stream to select the new screen profile.
- Network detection follows the address configured in Vibedeck. Keep that
  address consistent with the host endpoint used by Moonlight; Moonlight can
  retain its own alternate addresses. VPN/bridge/unknown interfaces inherit
  settings unless a manual transport is chosen.
- PyroWave calibration, FEC and wire-budget behavior belong to Nonary's
  client/host. This fork passes the selected bitrate; it does not replace their
  calibration or promise a particular effective wire rate.
- A requested codec, HDR, VRR or chroma format still requires compatible
  host/client GPUs, display and presentation path. The Deck's internal screen
  does not gain hardware VRR from enabling the setting.
- This first version has automated and build verification. Actual Deck/TV
  negotiation and frame presentation require hardware testing.

## Follow-up work after hardware verification

Re-evaluate screen identity on dock changes during resume, improve routing for
Moonlight's alternate endpoints, and add optional profile import/export only
if needed. Host encoder tuning and a fork of Nonary's transport are outside
this change.
