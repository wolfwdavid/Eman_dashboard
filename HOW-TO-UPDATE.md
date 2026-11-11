# How to update the Grant Crystarium (for Eman / non-developers)

The dashboard at **https://wolfwdavid.github.io/Eman_dashboard/** is generated
from ONE spreadsheet file. You never edit the website itself.

## Update the grants

1. Open `data/grants.csv` (in this repository, on github.com you can click the
   pencil icon to edit in the browser).
2. Edit rows like a spreadsheet. Columns:
   `Funder / Program, Type, Amount, Deadline, 501(c)(3) Required, Fit / Eligibility, Status, Next Action, Link, Template`

   `Template` is optional — paste the Google Doc / file link for that grant's proposal draft; leave it blank if there isn't one. A blank cell hides the button; anything that isn't a link fails the build on purpose.
3. **Status** must be one of:
   `Active funder · In progress · To research · Recurring · Applied · Declined · Not eligible (yet) · Not eligible`
4. Commit the change to the `main` branch.

That's it — GitHub automatically rebuilds and republishes the site in ~2 minutes.
If a row is malformed (bad link, unknown status), the build **fails on purpose**
and the live site keeps the last good version; the Actions tab shows which row
is wrong.

**Adding or removing a row?** The build also checks the number of rows on
purpose. When the row count changes, `EXPECTED_ROWS` in `tools/ingest-grants.mjs`
must be bumped to the new count and the dataset tests re-pinned to match, or
just ask David to do it.

## What the visuals mean

- **Ring position**: how far along the funnel (center = money secured, rim = to research)
- **Crystal size**: grant amount (tiny raw crystals = amount unknown/TBD)
- **Color**: status (legend, bottom-left)
- **Pulsing glow**: a real deadline is approaching
- **Gold beam**: NY Community Trust could fiscally sponsor those funders
- **SECURED / POTENTIAL** (top-right): computed automatically from the CSV

## Change the QR codes

Edit `src/lib/config/sites.js` — two lines with the URLs — commit. Done.

## Teach the mic a new word

The microphone button next to the assistant understands a short list of spoken
commands. Anything it does not recognise is sent to the assistant as a normal
question, so a missed phrase is never lost.

What it understands today:

- **Filter**: "show recurring", "only applied", "show open grants" (no 501(c)(3)
  needed), "show fellowships". Works for a status, the 501(c)(3) gate, or a type.
- **Open a funder**: "open Kellogg", "go to Ford". Funder names are matched by
  sound and spelling, so small mishearings still work. If two funders sound
  alike it offers a short "did you mean" list you can answer with "the second one".
- **Panels**: "open templates", "share" (the QR codes), and "close" to dismiss.
- **Facts**: "what's due next", "how much is secured".
- **Reset**: "reset", "clear filters", "show all".

All of the phrases live in one file: `src/lib/voice/commands.ts`. Each list
below is a table near the top of that file. Phrases are written in lowercase
with no punctuation (say "not eligible yet", write `'not eligible yet'`).

**Add another way of saying an existing command**

1. Open `src/lib/voice/commands.ts` and find the right table:
   - `STATUS_SYNONYMS` (words for a status), `GATE_SYNONYMS` (501(c)(3) gate),
     `TYPE_SYNONYMS` (grant, fellowship, investment)
   - `RESET_PHRASES`, `CLOSE_PHRASES` (plain lists of phrases)
   - `PANEL_PHRASES` (templates and share), `FACT_PHRASES` (due next, secured)
2. Add one line. For the lookup tables the spoken phrase goes on the left and
   the value the dashboard already uses goes on the right. For example, to let
   "pending" mean the same as "in progress", add this line to `STATUS_SYNONYMS`:

   ```
   pending: 'in-progress',
   ```

   For the plain lists, just add the phrase, for example `'start over',` in
   `RESET_PHRASES`.

**Add a nickname for a funder the mic keeps mishearing**

Add a line to `FUNDER_ALIASES` in the same file. Left side: what the speech
engine writes down. Right side: how that word appears in the funder name.
Example: the mic hears "ben and jerry" but the funder is "Ben & Jerry's":

```
'ben and jerry': 'ben and jerrys',
```

New funder rows added to `data/grants.csv` are matched automatically. No code
change is needed for them.

**Then, to make it live**

1. Add one test row for your new phrase in the matching table in
   `src/lib/voice/commands.test.ts` (copy a neighbouring row and change the
   words), then run `pnpm test:unit` and check it passes. If you would rather not,
   ask David.
2. Commit to `main`. The site rebuilds in about 2 minutes, like any other update.

**Browsers without built-in speech recognition**

Chrome, Edge and Safari listen directly. On Firefox, and any other browser
without built-in speech recognition, the mic records a short clip (up to about
18 seconds) and the assistant server turns it into text. Both ways end up in the
same command list above.

## If something breaks

Open an issue or ping David. Useful facts: the site rebuilds on every push to
`main`; the Actions tab shows red if a build failed; the data gate is designed
to fail loudly rather than publish wrong totals.
