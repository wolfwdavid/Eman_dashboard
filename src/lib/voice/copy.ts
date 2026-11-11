// Exact UI-SPEC strings for the voice widget (08-UI-SPEC.md, Copywriting Contract).
// Copied character for character; tests pin them so edits fail loudly.

export const COPY = {
	// Status strip
	asking: 'Asking the assistant, this can take a minute…',
	busy: "I'm still working on your last question. Ask again once it's answered.",
	didntCatchLead: "I didn't catch that.",
	didntCatchHint: 'Press the mic to try again.',
	didntCatchLive: "I didn't catch that. Press the mic to try again.",
	listeningLead: 'Listening…',
	transcribingLead: 'Transcribing…',
	hintBrowser: 'Try “show recurring grants”, or ask a question.',
	hintServer: "Press the mic again when you're done.",

	// Speech / confirmations
	restOfChat: 'The rest is in the chat.',
	spokenOn: 'Spoken replies on.',
	cancelled: 'OK, cancelled.',

	// Privacy notice
	noticeBrowser:
		"Voice input uses your browser's speech recognition, which sends your audio to the browser vendor (for example Google or Apple).",
	noticeServer: 'Voice input sends a short recording to the DID assistant server to be transcribed.',
	noticeStart: 'Start listening',
	noticeUseServer: 'Use the server instead',

	// Settings
	settingsHelpBrowser:
		"Off: your browser's speech service (Google or Apple) receives your audio. On: a short recording goes to the DID assistant server instead.",
	settingsHelpNoBrowser:
		'This browser has no built-in speech recognition, so the server is always used.',
	settingsHelpScreenReader:
		"Using a screen reader? Leave spoken replies off so replies aren't read twice.",

	// Voice errors
	errBlocked:
		"Microphone access is blocked. Allow the microphone in your browser's site settings, or type your question instead.",
	errServiceNotAllowed:
		"Your browser's speech service is blocked or turned off, so I've switched to server transcription. Press the mic and say that again.",
	errNetwork:
		"I couldn't reach your browser's speech service, so I've switched to server transcription. Press the mic and say that again.",
	errNoMic: 'No microphone found. Connect one, or type your question instead.',
	errOther: "Voice input isn't working right now. You can type your question instead.",
	errUnavailable: "Voice input isn't available in this browser. You can type your question instead.",
	errTranscribeUnreachable:
		"I couldn't reach the transcription server. Try again, or type your question instead.",
	errRateLimited: 'Too many voice requests. Wait a minute and try again, or type your question.',
	errTooLong: 'That recording was too long. Keep it under 20 seconds and try again.',
	errUnsupportedFormat:
		"This browser's recording format isn't supported. You can type your question instead.",

	// Mic titles
	micTitleIdle: 'Voice input',
	micTitleListening: 'Stop listening',
	micTitleProcessing: 'Transcribing…',
	micTitleError: 'Voice input. Last attempt failed, press to try again',
	micTitleBlocked: 'Microphone blocked. Press to try again',
	micTitleUnavailable: "Voice input isn't available in this browser"
} as const satisfies Record<string, string>;

const MAX_SPOKEN = 600;

/** Replies over 600 chars are cut and pointed at the chat. */
export function truncateReply(text: string): string {
	if (text.length <= MAX_SPOKEN) return text;
	return `${text.slice(0, MAX_SPOKEN).trim()} ${COPY.restOfChat}`;
}

export function youSaid(transcript: string): string {
	return `You said: ${transcript}.`;
}

export function assistantLive(reply: string): string {
	return `Assistant: ${truncateReply(reply)}`;
}

export function didYouMeanLive(transcript: string, labels: string[]): string {
	const list = labels.map((l, i) => `${i + 1}, ${l}`).join('. ');
	return `You said: ${transcript}. Did you mean: ${list}? Say the number, or choose a button.`;
}
