// scratch (pane fx): dev server without HMR/file watching so other panes' edits do not reload the test page
import { fileURLToPath } from 'node:url';
import base from '../vite.config.ts';
const cfg = typeof base === 'function' ? await base({ command: 'serve', mode: 'development' }) : base;
export default { ...cfg, root: fileURLToPath(new URL('..', import.meta.url)), server: { ...(cfg.server ?? {}), hmr: false, watch: null } };
