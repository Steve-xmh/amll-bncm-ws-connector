import { type FC, Suspense } from "react";
import { AppKitWindow, AppKitWindowFrame, SidebarItem } from "../appkit/window";
import { PlayerConfig } from "./player";
import { atom, useAtom, useAtomValue } from "jotai";
import "./config.sass";
import { AboutConfig } from "./about";
import { FullSpinner } from "../appkit/spinner/spinner";
import { LyricSourceConfig } from "./lyric-source";
import { DebugConfig } from "./debug";
import { AMLLEnvironment, amllEnvironmentAtom } from "../../injector";

export const configPageAtom = atom("player");

const ConfigSidebarItems: FC = () => {
	const [configPage, setConfigPage] = useAtom(configPageAtom);
	return (
		<>
			<SidebarItem
				selected={configPage === "player"}
				onClick={() => setConfigPage("player")}
			>
				连接设置
			</SidebarItem>
			<SidebarItem
				selected={configPage === "lyric-source"}
				onClick={() => setConfigPage("lyric-source")}
			>
				歌词源
			</SidebarItem>
			<SidebarItem
				selected={configPage === "debug"}
				onClick={() => setConfigPage("debug")}
			>
				调试
			</SidebarItem>
		</>
	);
};

const ConfigSidebarBottomItems: FC = () => {
	const [configPage, setConfigPage] = useAtom(configPageAtom);
	const amllEnvironment = useAtomValue(amllEnvironmentAtom);
	return (
		<>
			<SidebarItem
				selected={configPage === "about"}
				onClick={() => setConfigPage("about")}
			>
				{amllEnvironment === AMLLEnvironment.BetterNCM &&
					"关于 AMLL WS Connector"}
				{amllEnvironment === AMLLEnvironment.AMLLPlayer && "关于 AMLL Player"}
				{amllEnvironment === AMLLEnvironment.Component && "关于 AMLL 组件库"}
			</SidebarItem>
		</>
	);
};

const ConfigContent: FC = () => {
	const configPage = useAtomValue(configPageAtom);
	return (
		<div id="amll-config-content">
			<Suspense fallback={<FullSpinner />}>
				{configPage === "lyric-source" && <LyricSourceConfig />}
				{configPage === "player" && <PlayerConfig />}
				{configPage === "about" && <AboutConfig />}
				{configPage === "debug" && <DebugConfig />}
			</Suspense>
		</div>
	);
};

export const AMLLConfig: FC = () => {
	return (
		<AppKitWindowFrame
			sidebarItems={<ConfigSidebarItems />}
			sidebarBottomItems={<ConfigSidebarBottomItems />}
			id="amll-config"
		>
			<ConfigContent />
		</AppKitWindowFrame>
	);
};

export const amllConfigWindowedOpenedAtom = atom(false);

export const AMLLConfigWindowed: FC = () => {
	const [amllConfigWindowedOpened, setAMLLConfigWindowedOpened] = useAtom(
		amllConfigWindowedOpenedAtom,
	);
	return (
		<AppKitWindow
			sidebarItems={<ConfigSidebarItems />}
			sidebarBottomItems={<ConfigSidebarBottomItems />}
			width={600}
			height={350}
			open={amllConfigWindowedOpened}
			onClose={() => setAMLLConfigWindowedOpened(false)}
			id="amll-config"
		>
			<Suspense>
				<ConfigContent />
			</Suspense>
		</AppKitWindow>
	);
};
