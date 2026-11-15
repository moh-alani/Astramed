# Static release instructions

The local application is complete independently of hosting. The approved source is published at https://github.com/AliShahroor/astramed-prototype and deployed at https://alishahroor.github.io/astramed-prototype/. The GitHub Pages workflow runs lint, unit tests and production build before deployment. See the validation record for observed browser results. No account credentials or private medical data are included in the source.

## GitHub preparation

Create a repository under the team’s chosen account and visibility. Include only the root application source, lockfile, configuration, README, documentation and tests. Exclude node_modules, dist, Playwright traces and local exports; `.gitignore` supplies the build exclusions. The unrelated `Template2` directory and reference attachments are not part of this implementation and should not be accidentally committed.

## Vercel

Import the reviewed repository, select Vite, install with `npm ci`, build with `npm run build`, and publish `dist`. Set a supported Node version (Node 22.12+). No environment secrets or backend are needed. Other static HTTPS hosts can serve the same directory. For subdirectory hosting, use npm run build -- --base=/project/ and serve that same prefix. In-app navigation uses no server paths; service-worker navigation fallback handles cached navigations, not unauthenticated access controls.

## Public verification after publishing

Open the real public URL in a new/private browser. Verify that it needs no login and that there are no failed static assets. Repeat the scenario → reasoning → NASA evidence → assessment save → updated health → crew flow. Test all three pages at laptop and phone widths. Verify original NASA links while online. Let production caching complete, disconnect, reload and repeat local navigation/evidence/scenario actions. Browser speech may still need connectivity.

Do not advertise an untested deployment as offline-capable. Record the deployment URL and commit identifier in the team’s final submission materials only after verifying them. Use the storyboard to record an actual ≤30-second video, or turn the outline into ≤7 slides, subject to the event’s current rules. Publish AI and synthetic-data disclosures and verify the applicable local/global deadlines with the organizers.
