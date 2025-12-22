/* eslint-disable @typescript-eslint/no-require-imports */
const qrcode = require('qrcode-terminal');

function renderQr(url) {
  qrcode.generate(url, { small: true }, (code) => {
    console.log(code);
  });
}

module.exports = { renderQr };
