// Tạo PNG icon cho PWA từ public/logo.png (LOGO CÔNG TY).
// Logo là ảnh ngang (trong suốt) -> ghép canh giữa trên nền trắng để thành icon vuông.
// Chạy: node scripts/gen-icons.cjs   (cần sharp — đã có trong node_modules qua Next).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logo = fs.readFileSync(path.join(root, 'public', 'logo.png'));
const out = (name) => path.join(root, 'public', name);
const BG = '#ffffff';

async function makeIcon(size, logoFrac, file) {
  const inner = await sharp(logo)
    .resize({ width: Math.round(size * logoFrac), fit: 'inside' })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(out(file));
}

(async () => {
  await makeIcon(192, 0.9, 'icon-192.png');
  await makeIcon(512, 0.9, 'icon-512.png');
  // Maskable: logo nhỏ hơn (chừa safe zone 80%) để mặt nạ tròn/bo không cắt mất.
  await makeIcon(512, 0.72, 'icon-maskable-512.png');
  await makeIcon(180, 0.9, 'apple-touch-icon.png');
  console.log('Đã tạo icon từ logo công ty: icon-192/512, icon-maskable-512, apple-touch-icon.');
})();
