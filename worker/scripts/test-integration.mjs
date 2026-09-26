import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
execFileSync(process.execPath, [wrangler, 'deploy', '--dry-run', '--outdir', '.wrangler/test'], {
  stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: resolve('.wrangler/logs') },
});
execFileSync(process.execPath, ['--test', 'tests/rooms.integration.mjs'], { stdio: 'inherit' });
