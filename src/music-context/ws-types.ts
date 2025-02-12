export interface WSArtist {
	id: string;
	name: string;
}

export interface WSLyricWord {
	startTime: number;
	endTime: number;
	word: string;
}

export interface WSLyricLine {
	startTime: number;
	endTime: number;
	words: WSLyricWord[];
	isBG: boolean;
	isDuet: boolean;
	translatedLyric: string;
	romanLyric: string;
}

export type WSBodyMessageMap = {
	ping: undefined;
	pong: undefined;
	setMusicInfo: {
		musicId: string;
		musicName: string;
		albumId: string;
		albumName: string;
		artists: WSArtist[];
		duration: number;
	};
	setMusicAlbumCoverImageURI: {
		imgUrl: string;
	};
	setMusicAlbumCoverImageData: {
		data: number[];
	};
	onPlayProgress: {
		progress: number;
	};
	onVolumeChanged: {
		volume: number;
	};
	onPaused: undefined;
	onResumed: undefined;
	onAudioData: {
		data: number[];
	};
	setLyric: {
		data: WSLyricLine[];
	};
	setLyricFromTTML: {
		data: string;
	};
	pause: undefined;
	resume: undefined;
	forwardSong: undefined;
	backwardSong: undefined;
	setVolume: {
		volume: number;
	};
	seekPlayProgress: {
		progress: number;
	};
};

export type WSBodyMap = {
	[T in keyof WSBodyMessageMap]: {
		type: T;
		value: WSBodyMessageMap[T];
	};
};
