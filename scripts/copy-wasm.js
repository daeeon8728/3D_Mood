const path = require('path');
const fs = require('fs');

const distDir = path.resolve(__dirname, '../node_modules/@xenova/transformers/dist');
const publicDir = path.resolve(__dirname, '../public/onnx');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const wasmFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.wasm'));
for (const file of wasmFiles) {
  const src = path.join(distDir, file);
  const dest = path.join(publicDir, file);
  fs.copyFileSync(src, dest);
  console.log(`Copied ${file} -> public/onnx/${file}`);
}

console.log('WASM files copied successfully!');
