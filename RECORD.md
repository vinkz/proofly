
- Updated copy to use “workflow” instead of “template” across the new job flow and workflows UI, and moved the jobs table to a client component with row-click navigation and inline delete.
- Installed the missing `qrcode-terminal` dependency and refreshed the lockfile so the `pnpm mobile` tunnel script can run.
- Improved `pnpm mobile` script to check port availability before starting, preventing tunnel startup when port 3000 is already in use.
