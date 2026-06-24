const fs = require('fs');
const path = require('path');
const https = require('https');

const baseUrl = 'https://huggingface.co/Xenova/depth-anything-small-hf/resolve/main/';
const filesToDownload = [
  'config.json',
  'preprocessor_config.json',
  'onnx/model_quantized.onnx'
];

const targetDir = path.join(__dirname, 'public', 'model');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}
if (!fs.existsSync(path.join(targetDir, 'onnx'))) {
  fs.mkdirSync(path.join(targetDir, 'onnx'), { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  console.log('Downloading model files...');
  for (const file of filesToDownload) {
    const url = baseUrl + file;
    const dest = path.join(targetDir, file);
    console.log(`Downloading ${file}...`);
    try {
      await downloadFile(url, dest);
      console.log(`Successfully downloaded ${file}`);
    } catch (err) {
      console.error(`Error downloading ${file}:`, err.message);
    }
  }
  console.log('All downloads finished!');
}

main();
