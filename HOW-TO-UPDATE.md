# How to update the Grant Crystarium (for Eman / non-developers)

The dashboard at **https://wolfwdavid.github.io/Eman_dashboard/** is generated
from ONE spreadsheet file. You never edit the website itself.

## Update the grants

1. Open `data/grants.csv` (in this repository, on github.com you can click the
   pencil icon to edit in the browser).
2. Edit rows like a spreadsheet. Columns:
   `Funder / Program, Type, Amount, Deadline, 501(c)(3) Required, Fit / Eligibility, Status, Next Action, Link`
3. **Status** must be one of:
   `Active funder · In progress · To research · Recurring · Applied · Declined · Not eligible (yet) · Not eligible`
4. Commit the change to the `main` branch.

That's it — GitHub automatically rebuilds and republishes the site in ~2 minutes.
If a row is malformed (bad link, unknown status), the build **fails on purpose**
and the live site keeps the last good version; the Actions tab shows which row
is wrong.

## What the visuals mean

- **Ring position**: how far along the funnel (center = money secured, rim = to research)
- **Crystal size**: grant amount (tiny raw crystals = amount unknown/TBD)
- **Color**: status (legend, bottom-left)
- **Pulsing glow**: a real deadline is approaching
- **Gold beam**: NY Community Trust could fiscally sponsor those funders
- **SECURED / POTENTIAL** (top-right): computed automatically from the CSV

## Change the QR codes

Edit `src/lib/config/sites.js` — two lines with the URLs — commit. Done.

## If something breaks

Open an issue or ping David. Useful facts: the site rebuilds on every push to
`main`; the Actions tab shows red if a build failed; the data gate is designed
to fail loudly rather than publish wrong totals.
