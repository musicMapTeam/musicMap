/** Original print artwork, drawn once and placed on the courtyard's 3D props. */
export function createSakuraPrintwork({ THREE, textures, materials }) {
  const ink = '#365c59';
  const paper = '#f5ebd6';
  const rose = '#cf8190';
  const mint = '#9cb7a7';

  function surface(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    paint(context, width, height);
    // Fixed, quiet flecks suggest uncoated stock without a noisy screen overlay.
    let seed = 37;
    for (let i = 0; i < width * height / 175; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = seed % width;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const y = seed % height;
      context.fillStyle = i % 3 ? 'rgba(70,65,48,.055)' : 'rgba(255,255,240,.14)';
      context.fillRect(x, y, 1, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    return texture;
  }
  function print(width, height, paint) {
    const texture = surface(width, height, paint);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    materials.add(material);
    return material;
  }
  function disc(context, x, y, radius, color) {
    context.fillStyle = color; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
  }
  function type(context, text, x, y, size, color = ink, align = 'left') {
    context.fillStyle = color; context.textAlign = align;
    context.font = `600 ${size}px Arial, "Microsoft YaHei", sans-serif`;
    context.fillText(text, x, y);
  }
  const sleeves = [0, 1, 2].map(edition => print(512, 512, context => {
    context.fillStyle = [paper, ink, rose][edition]; context.fillRect(0, 0, 512, 512);
    if (edition === 0) {
      disc(context, 268, 217, 159, rose);
      context.fillStyle = mint; context.beginPath(); context.moveTo(24, 392);
      context.bezierCurveTo(166, 237, 267, 377, 488, 186); context.lineTo(488, 458); context.lineTo(24, 458); context.fill();
      context.strokeStyle = paper; context.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        context.beginPath(); context.moveTo(24, 365 + i * 19);
        context.bezierCurveTo(167, 246 + i * 18, 316, 353 + i * 13, 488, 213 + i * 17); context.stroke();
      }
      type(context, 'AFTER THE SHOW', 32, 57, 25);
      type(context, 'SIDE A   /   33 RPM', 32, 487, 17);
    } else if (edition === 1) {
      for (let i = 0; i < 9; i++) {
        context.strokeStyle = i % 2 ? mint : paper; context.lineWidth = 5;
        context.beginPath(); context.ellipse(255, 233, 48 + i * 18, 83 + i * 12, -.47, 0, Math.PI * 2); context.stroke();
      }
      disc(context, 255, 233, 18, rose);
      type(context, 'NIGHT BLOOM', 32, 463, 36, paper);
      type(context, 'SIDE B', 33, 490, 16, paper);
    } else {
      context.fillStyle = paper; context.fillRect(38, 36, 436, 378);
      disc(context, 257, 233, 135, ink);
      disc(context, 257, 233, 85, mint);
      disc(context, 257, 233, 28, paper);
      context.save(); context.translate(257, 233); context.rotate(-.47);
      context.fillStyle = paper; context.fillRect(-174, -13, 348, 26); context.restore();
      type(context, 'ONE MORE SONG', 38, 475, 30, paper);
    }
  }));
  const marquee = print(1024, 256, context => {
    context.fillStyle = paper; context.fillRect(0, 0, 1024, 256);
    context.strokeStyle = ink; context.lineWidth = 5; context.strokeRect(18, 18, 988, 220);
    disc(context, 123, 128, 68, ink); disc(context, 123, 128, 25, rose); disc(context, 123, 128, 5, paper);
    type(context, '樱下放映', 275, 148, 91);
    type(context, 'RECORDS  &  LITTLE MOMENTS', 282, 202, 25);
  });
  const badge = print(256, 256, context => {
    context.fillStyle = ink; context.fillRect(0, 0, 256, 256);
    context.strokeStyle = paper; context.lineWidth = 3;
    context.beginPath(); context.arc(128, 128, 111, 0, Math.PI * 2); context.stroke();
    type(context, 'SIDE', 128, 92, 31, paper, 'center');
    type(context, 'B', 128, 175, 94, paper, 'center');
    type(context, '33⅓', 128, 211, 20, paper, 'center');
  });
  const poster = print(384, 512, context => {
    context.fillStyle = paper; context.fillRect(0, 0, 384, 512);
    context.fillStyle = ink; context.fillRect(22, 22, 340, 307);
    disc(context, 190, 163, 91, rose);
    context.fillStyle = mint; context.beginPath(); context.moveTo(22, 265);
    context.bezierCurveTo(103, 190, 196, 284, 362, 204); context.lineTo(362, 329); context.lineTo(22, 329); context.fill();
    type(context, '樱下', 26, 393, 53); type(context, 'ACOUSTIC SESSION', 27, 434, 24);
    context.fillStyle = rose; context.fillRect(27, 461, 192, 4);
    type(context, 'SIDE B', 358, 482, 22, ink, 'right');
  });
  const woodGrain = surface(512, 256, context => {
    context.fillStyle = '#fffdf8'; context.fillRect(0, 0, 512, 256);
    context.strokeStyle = '#e4ddd4'; context.lineWidth = .7;
    for (let i = 0; i < 25; i++) {
      const y = 7 + i * 10;
      context.beginPath(); context.moveTo(0, y);
      context.bezierCurveTo(149, y + Math.sin(i) * 7, 325, y - Math.sin(i * .7) * 6, 512, y + 2); context.stroke();
    }
    context.strokeStyle = '#e7dfd5'; context.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      context.beginPath(); context.ellipse(172, 123, 20 + i * 10, 3 + i * 2, .03, 0, Math.PI * 2); context.stroke();
    }
  });
  return { sleeves, marquee, badge, poster, woodGrain };
}
