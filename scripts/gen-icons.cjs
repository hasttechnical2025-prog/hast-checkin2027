// Tạo PNG icon cho PWA từ public/icon.svg (nguồn duy nhất).
// Chạy: node scripts/gen-icons.cjs   (cần sharp — đã có trong node_modules qua Next).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public', 'icon.svg'));
const out = (name) => path.join(root, 'public', name);

(async () => {
  await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
  await sharp(svg).resize(180, 180).png().toFile(out('apple-touch-icon.png'));

  // Maskable: nội dung co về ~80% trên nền xanh #1a73e8 để không bị mặt nạ cắt mất.
  const inner = await sharp(svg).resize(410, 410).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#1a73e8' } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(out('icon-maskable-512.png'));

  console.log('Đã tạo: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png');
})();
