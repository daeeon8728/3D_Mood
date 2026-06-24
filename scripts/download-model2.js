const fs = require('fs');
const https = require('https');
const path = require('path');

const baseUrl = 'https://huggingface.co/Xenova/depth-anything-small-hf/resolve/main/';
const filesToDownload = ['config.json', 'preprocessor_config.json'];
const targetDir = path.join(__dirname, 'public', 'model');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode)) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => fs.unlink(dest, () => reject(err)));
  });
}

(async () => {
  for (const f of filesToDownload) {
    await downloadFile(baseUrl + f, path.join(targetDir, f));
    console.log('Downloaded', f);
  }
})();
