#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { renderQr } = require('./utils/qrcode');

const DEV_PORT = process.env.PORT || '3000';
const DEV_HOST = '0.0.0.0';
const DOCS_PATH = path.join(process.cwd(), 'docs', 'MOBILE-URL.md');

function ensureDocsDir() {
  const dir = path.dirname(DOCS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hasCommand(name) {
  try {
    execSync(`command -v ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function chooseTunnel() {
  if (hasCommand('cloudflared')) return 'cloudflared';
  if (hasCommand('ngrok')) return 'ngrok';
  throw new Error('Install cloudflared or ngrok to create a mobile tunnel.');
}

function portAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function startDevServer() {
  const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
  const proc = spawn(nextBin, ['dev', '--turbopack', '--hostname', DEV_HOST, '--port', DEV_PORT], {
    env: { ...process.env, HOST: DEV_HOST, PORT: DEV_PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', (data) => process.stdout.write(`[next] ${data}`));
  proc.stderr.on('data', (data) => process.stderr.write(`[next] ${data}`));
  return proc;
}

function startTunnel(tool) {
  if (tool === 'cloudflared') {
    return spawn('cloudflared', ['tunnel', '--url', `http://localhost:${DEV_PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return spawn('ngrok', ['http', DEV_PORT], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function captureTunnelUrl(proc, tool) {
  return new Promise((resolve, reject) => {
    const regex =
      tool === 'cloudflared'
        ? /(https?:\/\/[^\s]*trycloudflare\.com[^\s]*)/i
        : /(https?:\/\/[^\s]*ngrok[^\s]*\.app[^\s]*)/i;

    const handleData = (data) => {
      const text = data.toString();
      const match = text.match(regex);
      if (match && match[1]) {
        detach();
        resolve(match[1].trim());
      }
    };

    const handleExit = (code) => {
      detach();
      reject(new Error(`${tool} exited with code ${code}`));
    };

    const handleError = (err) => {
      detach();
      reject(err);
    };

    const detach = () => {
      proc.stdout?.off('data', handleData);
      proc.stderr?.off('data', handleData);
      proc.off('exit', handleExit);
      proc.off('error', handleError);
    };

    proc.stdout?.on('data', handleData);
    proc.stderr?.on('data', handleData);
    proc.on('exit', handleExit);
    proc.on('error', handleError);
  });
}

function writeUrlFile(url) {
  ensureDocsDir();
  const content = `# Mobile Dev URL\n\nLatest: ${url}\n\nUpdated: ${new Date().toISOString()}\n`;
  fs.writeFileSync(DOCS_PATH, content);
}

async function main() {
  const available = await portAvailable(DEV_PORT, DEV_HOST);
  if (!available) {
    console.error(`[mobile] Port ${DEV_PORT} is already in use on ${DEV_HOST}. Stop the other process or set PORT before running pnpm mobile.`);
    process.exit(1);
  }

  console.log('[mobile] Starting Next.js dev server (0.0.0.0:3000)...');
  const devServer = startDevServer();

  const tunnelTool = chooseTunnel();
  console.log(`[mobile] Opening ${tunnelTool} tunnel...`);
  const tunnel = startTunnel(tunnelTool);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    tunnel.kill('SIGINT');
    devServer.kill('SIGINT');
  };

  devServer.on('exit', () => shutdown());
  tunnel.on('exit', () => shutdown());
  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });

  let url;
  try {
    url = await captureTunnelUrl(tunnel, tunnelTool);
  } catch (err) {
    console.error(`[mobile] Tunnel error: ${err.message}`);
    shutdown();
    process.exit(1);
  }

  console.log(`[mobile] Tunnel ready: ${url}`);
  console.log('[mobile] Add this URL to Supabase -> Authentication -> Redirect URLs');
  console.log('[mobile] QR code:');
  renderQr(url);

  writeUrlFile(url);
  console.log(`[mobile] Saved to ${DOCS_PATH}`);
}

main().catch((err) => {
  console.error('[mobile] Unexpected error:', err);
  process.exit(1);
});
