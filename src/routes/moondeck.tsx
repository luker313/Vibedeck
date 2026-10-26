import { BuddySettingsView } from "../components/buddysettingsview";
import { ButtonStyleView } from "../components/buttonstyleview";
import { ChangelogView } from "../components/changelogview";
import { FC } from "react";
import { GameSessionView } from "../components/gamesessionview";
import { GameStreamAppsView } from "../components/gamestreamappsview";
import { HostInfoView } from "../components/hostinfoview";
import { HostSelectionView } from "../components/hostselectionview";
import { MoonDeckAppsView } from "../components/moondeckappsview";
import { MoonlightSettingsView } from "../components/moonlightsettingsview";
import { NonSteamAppsView } from "../components/nonsteamappsview/nonsteamappsview";
import { RunnerSettingsView } from "../components/runnersettingsview";
import { SetupGuideView } from "../components/setupguideview";
import { SidebarNavigation } from "@decky/ui";
import { StatusIndicatorsView } from "../components/statusindicatorsview";
import { WOLSettingsView } from "../components/wolsettingsview";
import { routerHook } from "@decky/api";

const MoonDeckRouter: FC<object> = () => {
  return (
    <SidebarNavigation
      pages={[
        {
          title: "Setup Guide",
          content: <SetupGuideView />,
          route: "/vibedeck/setup-guide",
          visible: true
        },
        {
          title: "Status Indicators",
          content: <StatusIndicatorsView />,
          route: "/vibedeck/status-indicators",
          visible: true
        },
        {
          title: "Changelog",
          content: <ChangelogView />,
          route: "/vibedeck/changelog",
          visible: true
        },
        "separator",
        {
          title: "Host Selection",
          content: <HostSelectionView />,
          route: "/vibedeck/host-selection",
          visible: true
        },
        {
          title: "Host Info",
          content: <HostInfoView />,
          route: "/vibedeck/host-info",
          visible: true
        },
        "separator",
        {
          title: "Moonlight Settings",
          content: <MoonlightSettingsView />,
          route: "/vibedeck/resolution-settings",
          visible: true
        },
        {
          title: "Buddy Settings",
          content: <BuddySettingsView />,
          route: "/vibedeck/buddy-settings",
          visible: true
        },
        {
          title: "Runner Settings",
          content: <RunnerSettingsView />,
          route: "/vibedeck/runner-settings",
          visible: true
        },
        {
          title: "WOL Settings",
          content: <WOLSettingsView />,
          route: "/vibedeck/wol-settings",
          visible: true
        },
        "separator",
        {
          title: "MoonDeck Apps",
          content: <MoonDeckAppsView />,
          route: "/vibedeck/moondeck-apps",
          visible: true
        },
        {
          title: "GameStream Apps",
          content: <GameStreamAppsView />,
          route: "/vibedeck/gamestream-apps",
          visible: true
        },
        {
          title: "Non-Steam Apps",
          content: <NonSteamAppsView />,
          route: "/vibedeck/non-steam-apps",
          visible: true
        },
        "separator",
        {
          title: "Game Session",
          content: <GameSessionView />,
          route: "/vibedeck/game-session",
          visible: true
        },
        {
          title: "Button Style",
          content: <ButtonStyleView />,
          route: "/vibedeck/button-style",
          visible: true
        }
      ]}
    />
  );
};

export function MoonDeckRouterHook(): () => void {
  routerHook.addRoute("/vibedeck", () => <MoonDeckRouter />);
  return () => {
    routerHook.removeRoute("/vibedeck");
  };
}
