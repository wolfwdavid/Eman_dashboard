// router.ts - PURE routing of a final transcript to a result the widget renders.
// Framework-free and browser-free: runs in node (vitest).
//   command  -> instant local result (no network)
//   choices  -> ambiguous funder, "Did you mean" buttons
//   question -> falls through to the existing POST /chat
//   busy     -> a question arrived while one is pending (never sent)
import type { Grant } from '../data/types';
import { parse, type PendingOption, type Intent } from './commands';
import type { ActionResult } from './actions';
import { COPY, youSaid, didYouMeanLive } from './copy';

export type PendingOutcome =
	| { kind: 'none' }
	| { kind: 'chosen'; id: string }
	| { kind: 'cancelled' }
	| { kind: 'dropped' };

export type RouteResult =
	| {
			type: 'command';
			intent: Intent;
			text: string;
			spoken: string;
			opened: ActionResult['opened'];
			live: string;
			pendingOutcome: PendingOutcome;
	  }
	| { type: 'choices'; options: PendingOption[]; text: string; spoken: string; live: string }
	| { type: 'question'; text: string; live: string; pendingOutcome: PendingOutcome }
	| { type: 'busy'; text: string; live: string; pendingOutcome: PendingOutcome };

const MAX_TRANSCRIPT = 500;

/** Trim and cap a transcript before routing and before it can reach POST /chat. */
export function capTranscript(t: string): string {
	return t.trim().slice(0, MAX_TRANSCRIPT);
}

export function isEmptyUtterance(t: string): boolean {
	return t.trim().length === 0;
}

export function createRouter(
	actions: { run: (i: any) => ActionResult },
	data: { grants: Grant[] }
) {
	function route(
		transcript: string,
		state: { pending?: PendingOption[]; busy: boolean }
	): RouteResult {
		const capped = capTranscript(transcript);
		const pending = state.pending && state.pending.length > 0 ? state.pending : undefined;
		const intent = parse(capped, { grants: data.grants, pending });

		if (intent.kind === 'did-you-mean') {
			const labels = intent.options.map((o) => o.label);
			const spoken = `Did you mean: ${labels.map((l, i) => `${i + 1}, ${l}`).join('. ')}?`;
			return {
				type: 'choices',
				options: intent.options,
				text: 'Did you mean…?',
				spoken,
				live: didYouMeanLive(capped, labels)
			};
		}

		if (intent.kind === 'chat') {
			const dropped: PendingOutcome = pending ? { kind: 'dropped' } : { kind: 'none' };
			if (state.busy) {
				return {
					type: 'busy',
					text: COPY.busy,
					live: `${youSaid(capped)} ${COPY.busy}`,
					pendingOutcome: dropped
				};
			}
			return {
				type: 'question',
				text: capped,
				live: `${youSaid(capped)} ${COPY.asking}`,
				pendingOutcome: dropped
			};
		}

		const result = actions.run(intent);
		let pendingOutcome: PendingOutcome = { kind: 'none' };
		if (pending) {
			if (intent.kind === 'open-grant' && pending.some((p) => p.id === intent.id)) {
				pendingOutcome = { kind: 'chosen', id: intent.id };
			} else if (intent.kind === 'cancel-pending') {
				pendingOutcome = { kind: 'cancelled' };
			} else {
				pendingOutcome = { kind: 'dropped' };
			}
		}
		return {
			type: 'command',
			intent,
			text: result.text,
			spoken: result.spoken,
			opened: result.opened,
			live: `${youSaid(capped)} ${result.text}`,
			pendingOutcome
		};
	}

	return { route };
}
