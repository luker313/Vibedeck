# Vibedeck

A MoonDeck fork built around **Nonary's Vibepollo and VRR Moonlight**. Launch
Steam games through the existing MoonDeck Buddy workflow, with streaming
settings selected automatically for your current screen and Ethernet/Wi-Fi
connection.

## What it adds

- PyroWave, AV1, HEVC and H.264 selection.
- Display-linked profiles for resolution, FPS, HDR, bitrate, codec, chroma,
  VRR pacing, VRR smoothing, microstutter absorption, V-sync and frame pacing.
- Ethernet/Wi-Fi overrides for the host and for each screen.
- Route-based transport detection, plus manual selection for VPNs or unusual
  networks. Detection follows the host address configured in Vibedeck.
- Explicit Nonary Flatpak `master` selection, or a custom AppImage/executable.
- Compatibility checks for requested PyroWave/VRR options, and separate
  settings with a one-time import of existing MoonDeck pairing and profiles.

**0.1.1 is a hardware-testing prerelease.** The automated checks and frontend
build are covered; end-to-end streaming must be checked on your Deck/TV setup.
See [scope](docs/SCOPE.md) and [verification](docs/TESTING.md).

## Install

1. Keep [Nonary/Vibepollo](https://github.com/Nonary/Vibepollo) and the standard
   [MoonDeck Buddy](https://github.com/FrogTheFrog/moondeck-buddy) on the host.
   Buddy API 9 is retained; no Buddy fork is needed.
2. Install [Nonary's VRR Moonlight](https://github.com/Nonary/moonlight-qt/releases)
   on the client. Pair it with Vibepollo and test a normal stream first. Its
   Flatpak uses `com.moonlight_stream.Moonlight` on branch `master`.
3. Disable upstream MoonDeck in Decky. Both plugins use the same Steam
   shortcuts and should not run together.
4. Download `vibedeck.zip` from this repository's **Releases**, or the
   `vibedeck` artifact in a successful **Actions** run. Extract an Actions
   artifact first to get the inner plugin ZIP. In Decky's developer settings,
   use **Install Plugin from ZIP File** and select `vibedeck.zip`.
5. Restart Steam. Open **Vibedeck → Moonlight Settings**. For an AppImage,
   enable the custom executable option and browse to Nonary's VRR AppImage.
   Otherwise Vibedeck explicitly launches the Flatpak's `master` branch.

Existing settings are imported from `~/.config/moondeck/settings.json` into
`~/.config/vibedeck/settings.json` on first use. The original file is left
untouched and the Buddy client ID is preserved. Imported Steam shortcuts are
rebound to this plugin's runner on first launch.

## Set profiles once

In **Moonlight Settings**, enable passing options to Moonlight. Set the host
fallbacks, add named **Display profiles**, and link each screen to its profile.
Open a display profile and use **Edit settings for** to choose display defaults,
Ethernet overrides, or Wi-Fi overrides. The **Network profiles** section also
provides host-wide overrides and automatic/manual transport selection.

Later non-inherited values win:

**Host defaults → display profile → host network overrides → display network overrides.**

For example, configure Ethernet to request PyroWave/4:4:4 at a bitrate your
wired LAN can sustain, and Wi-Fi to request AV1/4:2:0 at a lower bitrate. Each
screen can have its own HDR, FPS and VRR settings. The controls request these
features; hardware and the client/host determine what can actually be used.
PyroWave's calibration and FEC remain under Nonary's client/host control.

Profiles apply at stream start. Network selection is refreshed on resume.
Reconnect after changing screens while suspended or changing codec/chroma
settings; active streams do not switch codecs when a cable changes.

## Build

```sh
git clone --recurse-submodules https://github.com/luker313/Vibedeck.git
cd Vibedeck
pnpm install --frozen-lockfile
pnpm run test
pnpm run typecheck
pnpm run test:frontend
pnpm run test:backend
pnpm run build:plugin
```

The package and checksum are written to `out/vibedeck.zip` and
`out/vibedeck.zip.sha256`. No Docker is required for this packaging step.
The fork retains upstream's vendored Python dependencies for the Decky runtime.

## Troubleshooting

- Version 0.1.1 fixes imported MoonDeck shortcuts being rejected with
  "Failed to create shortcut (needs restart?)!". Update the plugin and restart
  Steam; existing shortcuts are rebound in place, preserving their IDs.
- Runner decisions and resolved profile: `/tmp/vibedeck-runner.log`.
- Moonlight output: `/tmp/vibedeck-runner-moonlight.log`.
- Backend/frontend: `/tmp/vibedeck-backend.log`, `/tmp/vibedeck-frontend.log`.
- A stock/older client may lack requested options. Select an up-to-date Nonary
  VRR build; the runner log identifies missing capabilities.
- Unknown routes inherit display settings. Use the manual network selector if
  a VPN, bridge or unusual NIC cannot be classified. Keep Moonlight's saved
  host endpoint consistent with the address configured in Vibedeck.
- Steam's display identity comes from the screen description and physical
  dimensions. Identical screens reporting identical identifiers share a link.
- If shaders take longer than the launch timeout, increase **Runner Settings
  → App launch** for that host.

## Credits and license

Forked from [FrogTheFrog/MoonDeck](https://github.com/FrogTheFrog/moondeck)
1.13.0, commit `00f8c31a6d9324878811178a2f8a319e4ca5c7c2`. Original code and
assets remain credited to their authors. Vibedeck is independently maintained
by Luke Richards and is not an official Nonary or MoonDeck release.

Licensed under [GNU GPLv3](LICENSE).
