/**
 * Simple Zero-Dependency Local Static HTTP Server.
 * Serves index.html, JS modules (with correct application/javascript MIME), and CSS.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getLocalIpAddresses() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(process.cwd(), reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404: Arquivo não encontrado: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`⚔️   MOBA DUPLINHA 2.5D RODANDO COM SUCESSO!`);
  console.log(`======================================================`);
  console.log(`👉 No seu computador (Host):`);
  console.log(`   http://localhost:${PORT}`);

  if (localIps.length > 0) {
    console.log(`\n👥 Para outra pessoa jogar na mesma rede (Wi-Fi/LAN):`);
    for (const item of localIps) {
      console.log(`   http://${item.ip}:${PORT}  (${item.name})`);
    }
  }

  console.log(`\n🎮 Como jogar em dupla:`);
  console.log(`   1. Você (Host): Escolha o Herói -> 'Criar Sala Multiplayer' -> Copie o código.`);
  console.log(`   2. Amigo: Acessa o link acima -> Escolhe o Herói -> 'Entrar em Sala' -> Digita o código.`);
  console.log(`======================================================`);
  console.log(`[Dica: Mantenha esta janela aberta enquanto jogam]\n`);
});
