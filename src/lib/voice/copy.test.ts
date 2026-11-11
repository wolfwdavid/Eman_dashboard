import { describe, it, expect } from 'vitest';
import { COPY, truncateReply, youSaid, assistantLive, didYouMeanLive } from './copy';

describe('COPY strings', () => {
	it('pins the exact UI-SPEC strings', () => {
		expect(COPY.asking).toBe('Asking the assistant, this can take a minute…');
		expect(COPY.busy).toBe("I'm still working on your last question. Ask again once it's answered.");
		expect(COPY.didntCatchLead).toBe("I didn't catch that.");
		expect(COPY.didntCatchHint).toBe('Press the mic to try again.');
		expect(COPY.didntCatchLive).toBe("I didn't catch that. Press the mic to try again.");
		expect(COPY.listeningLead).toBe('Listening…');
		expect(COPY.transcribingLead).toBe('Transcribing…');
		expect(COPY.hintBrowser).toBe('Try “show recurring grants”, or ask a question.');
		expect(COPY.hintServer).toBe("Press the mic again when you're done.");
		expect(COPY.restOfChat).toBe('The rest is in the chat.');
		expect(COPY.spokenOn).toBe('Spoken replies on.');
		expect(COPY.cancelled).toBe('OK, cancelled.');
		expect(COPY.noticeStart).toBe('Start listening');
		expect(COPY.noticeUseServer).toBe('Use the server instead');
		expect(COPY.noticeServer).toBe(
			'Voice input sends a short recording to the DID assistant server to be transcribed.'
		);
		expect(COPY.noticeBrowser).toBe(
			"Voice input uses your browser's speech recognition, which sends your audio to the browser vendor (for example Google or Apple)."
		);
	});

	it('pins settings, error and mic title strings', () => {
		expect(COPY.settingsHelpNoBrowser).toBe(
			'This browser has no built-in speech recognition, so the server is always used.'
		);
		expect(COPY.settingsHelpScreenReader).toBe(
			"Using a screen reader? Leave spoken replies off so replies aren't read twice."
		);
		expect(COPY.settingsHelpBrowser).toBe(
			"Off: your browser's speech service (Google or Apple) receives your audio. On: a short recording goes to the DID assistant server instead."
		);
		expect(COPY.errBlocked).toBe(
			"Microphone access is blocked. Allow the microphone in your browser's site settings, or type your question instead."
		);
		expect(COPY.errServiceNotAllowed).toBe(
			"Your browser's speech service is blocked or turned off, so I've switched to server transcription. Press the mic and say that again."
		);
		expect(COPY.errNetwork).toBe(
			"I couldn't reach your browser's speech service, so I've switched to server transcription. Press the mic and say that again."
		);
		expect(COPY.errNoMic).toBe('No microphone found. Connect one, or type your question instead.');
		expect(COPY.errOther).toBe("Voice input isn't working right now. You can type your question instead.");
		expect(COPY.errUnavailable).toBe(
			"Voice input isn't available in this browser. You can type your question instead."
		);
		expect(COPY.errTranscribeUnreachable).toBe(
			"I couldn't reach the transcription server. Try again, or type your question instead."
		);
		expect(COPY.errRateLimited).toBe(
			'Too many voice requests. Wait a minute and try again, or type your question.'
		);
		expect(COPY.errTooLong).toBe('That recording was too long. Keep it under 20 seconds and try again.');
		expect(COPY.errUnsupportedFormat).toBe(
			"This browser's recording format isn't supported. You can type your question instead."
		);
		expect(COPY.micTitleIdle).toBe('Voice input');
		expect(COPY.micTitleListening).toBe('Stop listening');
		expect(COPY.micTitleProcessing).toBe('Transcribing…');
		expect(COPY.micTitleError).toBe('Voice input. Last attempt failed, press to try again');
		expect(COPY.micTitleBlocked).toBe('Microphone blocked. Press to try again');
		expect(COPY.micTitleUnavailable).toBe("Voice input isn't available in this browser");
	});
});

describe('helpers', () => {
	it('truncateReply leaves <= 600 chars alone', () => {
		const t = 'a'.repeat(600);
		expect(truncateReply(t)).toBe(t);
	});

	it('truncateReply cuts at 600 and appends the suffix', () => {
		const t = 'a'.repeat(601);
		expect(truncateReply(t)).toBe('a'.repeat(600) + ' The rest is in the chat.');
	});

	it('youSaid / assistantLive', () => {
		expect(youSaid('show recurring grants')).toBe('You said: show recurring grants.');
		expect(assistantLive('hi')).toBe('Assistant: hi');
		expect(assistantLive('b'.repeat(700))).toBe('Assistant: ' + 'b'.repeat(600) + ' The rest is in the chat.');
	});

	it('didYouMeanLive', () => {
		expect(
			didYouMeanLive('open ford', [
				'Ford Foundation: JustFilms',
				'Ford Foundation: NYC Good Neighbor Committee'
			])
		).toBe(
			'You said: open ford. Did you mean: 1, Ford Foundation: JustFilms. 2, Ford Foundation: NYC Good Neighbor Committee? Say the number, or choose a button.'
		);
	});
});
