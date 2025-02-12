import { type FC, useCallback, useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
	currentTimeAtom,
	musicArtistsAtom,
	musicContextAtom,
	musicCoverAtom,
	musicDurationAtom,
	musicIdAtom,
	musicNameAtom,
	currentVolumeAtom,
	playStatusAtom,
} from "./wrapper";
import { log, warn } from "../utils/logger";
import { toBody, parseBody } from "@applemusic-like-lyrics/ws-protocol";
import { enableWSPlayer, wsPlayerURL } from "../components/config/atoms";
import { debounce } from "../utils/debounce";
import { lyricLinesAtom } from "../lyric/provider";
import type { MusicStatusGetterEvents } from ".";
import { ConnectionColor, wsConnectionStatusAtom } from "./ws-states";
import type { WSBodyMap, WSBodyMessageMap } from "./ws-types.js";

export const WebSocketWrapper: FC = () => {
	const musicId = useAtomValue(musicIdAtom);
	const musicName = useAtomValue(musicNameAtom);
	const musicCover = useAtomValue(musicCoverAtom);
	const musicDuration = useAtomValue(musicDurationAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const artists = useAtomValue(musicArtistsAtom);
	const musicContext = useAtomValue(musicContextAtom);
	const playProgress = useAtomValue(currentTimeAtom);
	const volume = useAtomValue(currentVolumeAtom);
	const currentPlayMode = useAtomValue(playStatusAtom);
	const setWSStatus = useSetAtom(wsConnectionStatusAtom);
	const enabled = useAtomValue(enableWSPlayer);
	const url = useAtomValue(wsPlayerURL);
	const ws = useRef<WebSocket>();

	const sendWSMessage = useCallback(function sendWSMessage<
		T extends keyof WSBodyMessageMap,
	>(
		type: T,
		value: WSBodyMessageMap[T] extends undefined
			? undefined
			: WSBodyMessageMap[T] | undefined = undefined,
	) {
		try {
			ws.current?.send(
				toBody({
					type,
					value,
				}),
			);
		} catch (err) {
			warn("发送消息到播放器失败", err);
			warn("出错的消息", type, value);
		}
	}, []);

	useEffect(() => {
		sendWSMessage("setMusicInfo", {
			musicId,
			musicName,
			albumId: "",
			albumName: "",
			artists: artists.map((v) => ({
				id: String(v.id),
				name: v.name,
			})),
			duration: musicDuration,
		});
	}, [musicId, musicName, musicDuration, artists, sendWSMessage]);

	useEffect(() => {
		sendWSMessage("onPlayProgress", {
			progress: playProgress,
		});
	}, [playProgress, sendWSMessage]);

	useEffect(() => {
		sendWSMessage("setVolume", {
			volume: volume,
		});
	}, [volume, sendWSMessage]);

	useEffect(() => {
		if (lyricLines.state === "hasData") {
			const clampTime = (time: number) =>
				Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, time | 0));
			sendWSMessage("setLyric", {
				data: lyricLines.data.map((line) => ({
					...line,
					startTime: clampTime(line.startTime),
					endTime: clampTime(line.endTime),
					words: line.words.map((word) => ({
						...word,
						startTime: clampTime(word.startTime),
						endTime: clampTime(word.endTime),
					})),
				})),
			});
		}
	}, [lyricLines, sendWSMessage]);

	useEffect(() => {
		sendWSMessage("setMusicAlbumCoverImageURI", {
			imgUrl: musicCover,
		});
	}, [musicCover, sendWSMessage]);

	// useEffect(() => {
	// 	if (musicContext && ws.current?.readyState === WebSocket.OPEN) {
	// 		musicContext.acquireAudioData();
	// 		const onAudioData = (evt: MusicStatusGetterEvents["audio-data"]) => {
	// 			ws.current?.send(
	// 				toBody({
	// 					type: "onAudioData",
	// 					value: {
	// 						data: new Uint8Array(evt.detail.data),
	// 					},
	// 				}),
	// 			);
	// 		};
	// 		musicContext.addEventListener("audio-data", onAudioData);
	// 		return () => {
	// 			musicContext.removeEventListener("audio-data", onAudioData);
	// 			musicContext.releaseAudioData();
	// 		};
	// 	}
	// }, [musicContext, ws.current?.readyState]);

	useEffect(() => {
		if (!enabled) {
			setWSStatus({
				color: ConnectionColor.Disabled,
				progress: false,
				text: "未开启",
			});
			return;
		}
		let webSocket: WebSocket | undefined = undefined;
		let canceled = false;

		const connect = () => {
			if (canceled) return;
			setWSStatus({
				progress: true,
				color: ConnectionColor.Connecting,
				text: "正在连接",
			});

			webSocket?.close();
			try {
				webSocket = new WebSocket(url);
			} catch (err) {
				warn("连接到播放器失败", err);
				setWSStatus({
					progress: false,
					color: ConnectionColor.Error,
					text: "连接时出错，五秒后重试",
				});
				enqueueConnect();
				return;
			}
			const nowWS = webSocket;

			webSocket.addEventListener("message", async (evt) => {
				if (nowWS !== webSocket || canceled) return;
				let data: WSBodyMap[keyof WSBodyMessageMap] = {
					type: "ping",
					value: undefined,
				};
				if (evt.data instanceof ArrayBuffer) {
					data = parseBody(new Uint8Array(evt.data));
				} else if (typeof evt.data === "string") {
					data = parseBody(new TextEncoder().encode(evt.data));
				} else if (evt.data instanceof Blob) {
					data = parseBody(new Uint8Array(await evt.data.arrayBuffer()));
				} else {
					warn("未知的数据类型", evt.data);
				}
				switch (data.type) {
					case "seekPlayProgress":
						musicContext?.seekToPosition(data.value.progress);
						break;
					case "ping":
						sendWSMessage("pong");
						break;
					case "pause":
						musicContext?.pause();
						break;
					case "resume":
						musicContext?.resume();
						break;
					case "forwardSong":
						musicContext?.forwardSong();
						break;
					case "backwardSong":
						musicContext?.rewindSong();
						break;
					case "setVolume":
						musicContext?.setVolume(data.value.volume);
				}
			});

			webSocket.addEventListener("error", () => {
				if (nowWS !== webSocket || canceled) return;
				webSocket = undefined;
				ws.current = undefined;
				setWSStatus({
					progress: false,
					color: ConnectionColor.Error,
					text: "连接失败，五秒后重试",
				});
				warn("连接到播放器失败");
				enqueueConnect();
			});

			webSocket.addEventListener("close", () => {
				if (nowWS !== webSocket || canceled) return;
				webSocket = undefined;
				ws.current = undefined;
				setWSStatus({
					progress: false,
					color: ConnectionColor.Error,
					text: "连接已关闭，五秒后重试",
				});
				warn("连接到播放器失败");
				enqueueConnect();
			});

			webSocket.addEventListener("open", () => {
				if (nowWS !== webSocket || canceled) return;
				setWSStatus({
					progress: false,
					color: ConnectionColor.Active,
					text: "已连接",
				});
				log("已连接到播放器");
				ws.current?.close();
				ws.current = webSocket;
			});
		};
		const enqueueConnect = debounce(connect, 5000);

		connect();

		return () => {
			webSocket?.close();
			webSocket = undefined;
			canceled = true;
			setWSStatus({
				color: ConnectionColor.Disabled,
				progress: false,
				text: "未开启",
			});
		};
	}, [enabled, url, musicContext, setWSStatus, sendWSMessage]);

	return null;
};
