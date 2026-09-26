// Servidor de desarrollo alterno (puerto 3001, carpeta .next-alt) para no chocar con `npm run dev`.
import { spawn } from 'node:child_process';

const hijo = spawn('npx', ['next', 'dev', '-p', '3001'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: '.next-alt' },
});
hijo.on('exit', (c) => process.exit(c ?? 0));
