# Verification and first hardware run

Run the automated checks from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run test
pnpm run typecheck
pnpm run test:frontend
pnpm run test:backend
pnpm run build:plugin
```

The Python regression suite exercises profile precedence, display selection,
network classification and timeouts, CLI arguments, capability rejection, and
settings migration/import. The frontend regression suite executes the real
launcher against mocked Steam APIs, checking imported and quoted runner paths,
shortcut ID preservation, failed executable updates, and literal path matching.
The frontend is also type-checked, linted and bundled.
Packaging verifies that the frontend and Buddy trust certificate exist and
produces a ZIP plus SHA-256 checksum. Build the plugin with its vendored Python
dependencies for Decky's Python runtime; a desktop machine's Python can still
run the stdlib-only tests.

## Hardware acceptance checklist (pending)

Use Nonary's VRR Moonlight paired with Vibepollo, and the normal host Buddy.
Keep the host address in Moonlight and Vibedeck consistent.

1. Disable upstream MoonDeck before installing Vibedeck; restart Steam after
   the swap. Confirm the imported host, pairing and existing display links.
   Launch a game with an existing MoonDeck shortcut: it should point to
   Vibedeck's `python/moondeckrun.sh` while keeping the same shortcut ID.
2. Link three screen profiles, including two with the same resolution but
   different labels/settings. Confirm each screen selects the intended profile.
3. Set Ethernet to PyroWave with an appropriate bitrate/4:4:4 request, and Wi-Fi
   to AV1 with a lower bitrate/4:2:0 request. Reconnect over each transport.
   Verify the requested arguments in `/tmp/vibedeck-runner.log` and the actual
   negotiated codec/chroma/rate in Moonlight's stats/logs.
4. Leave Wi-Fi connected while Ethernet routes to the host, and repeat with
   Ethernet connected but Wi-Fi routing to the host. The route's interface,
   rather than an unrelated carrier, should determine the overrides.
5. On a VRR-capable external screen, compare VRR off/on and smoothing off/on.
   Test microstutter absorption separately because it adds latency.
6. Suspend, change transport, and resume. Confirm new network settings. For a
   display change while asleep, start a new stream to refresh screen selection.
7. Select stock/older Moonlight with PyroWave or unsupported VRR options. Check
   the actionable compatibility error and missing features in the runner log.
8. Test an existing Steam game, a synced non-Steam game and a direct Vibepollo
   app. Confirm game launch, stream exit, WOL and Buddy power actions.

These checks are pending on user hardware; passing automated tests does not
establish end-to-end streaming compatibility or performance.
