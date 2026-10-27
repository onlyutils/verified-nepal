# End-to-end suite

The Playwright suite runs in Chromium against the local Vite app at
`http://localhost:8765` and uses the dev news and mutual-aid APIs. Load its
short-lived credentials into the shell from SSM, then run:

```sh
eval "$(e2e/load-env.sh)" && pnpm e2e
```

To use an already deployed copy, set `E2E_BASE_URL` before running the same
command. `pnpm e2e:headed` opens the browser UI. The suite creates uniquely
named `E2E-` news records and deletes those records in its cleanup hook.
Playwright traces and screenshots are written under ignored output directories;
they can contain page content, so they are not committed.
