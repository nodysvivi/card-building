const { spawn } = require('child_process');
const path = require('path');

// Start Vite dev server
const vite = spawn('npx', ['vite'], {
  cwd: path.join(__dirname, '..'),
  shell: true,
  stdio: 'pipe'
});

vite.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  // Wait for Vite to be ready then launch Electron
  if (output.includes('Local:')) {
    setTimeout(() => {
      const electron = spawn('npx', ['electron', '.'], {
        cwd: path.join(__dirname, '..'),
        shell: true,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
      });
      electron.on('close', () => {
        vite.kill();
        process.exit();
      });
    }, 1000);
  }
});

vite.stderr.on('data', (data) => process.stderr.write(data));
