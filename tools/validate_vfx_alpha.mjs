import { inflateSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_DIR = path.resolve('public/assets/vfx/donor');

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngAlpha(buffer, filePath) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath}: invalid PNG signature`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idatChunks = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) {
      throw new Error(`${filePath}: truncated ${type} chunk`);
    }

    const data = buffer.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || idatChunks.length === 0) {
    throw new Error(`${filePath}: missing IHDR or IDAT data`);
  }
  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error(`${filePath}: only 8-bit non-interlaced PNGs are supported`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 4 ? 2 : 0;
  if (bytesPerPixel === 0) {
    throw new Error(`${filePath}: PNG must include an alpha channel (color type ${colorType})`);
  }

  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const expected = height * (stride + 1);
  if (inflated.length !== expected) {
    throw new Error(`${filePath}: unexpected decompressed length ${inflated.length}, expected ${expected}`);
  }

  const rows = Array.from({ length: height }, () => Buffer.alloc(stride));
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const source = inflated.subarray(sourceOffset, sourceOffset + stride);
    sourceOffset += stride;
    const row = rows[y];
    const previous = y > 0 ? rows[y - 1] : null;

    for (let x = 0; x < stride; x += 1) {
      const raw = source[x];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous ? previous[x] : 0;
      const upLeft = previous && x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value;
      switch (filter) {
        case 0: value = raw; break;
        case 1: value = raw + left; break;
        case 2: value = raw + up; break;
        case 3: value = raw + Math.floor((left + up) / 2); break;
        case 4: value = raw + paethPredictor(left, up, upLeft); break;
        default: throw new Error(`${filePath}: unsupported PNG filter ${filter}`);
      }
      row[x] = value & 0xff;
    }
  }

  const alphaIndex = bytesPerPixel - 1;
  const alphaAt = (x, y) => rows[y][x * bytesPerPixel + alphaIndex];
  return { width, height, alphaAt };
}

async function validateFile(filePath) {
  const buffer = await readFile(filePath);
  const { width, height, alphaAt } = decodePngAlpha(buffer, filePath);
  const margin = Math.max(1, Math.floor(Math.min(width, height) / 32));
  const values = [];

  for (let x = 0; x < margin; x += 1) {
    for (let y = 0; y < margin; y += 1) {
      values.push(alphaAt(x, y));
      values.push(alphaAt(width - 1 - x, y));
      values.push(alphaAt(x, height - 1 - y));
      values.push(alphaAt(width - 1 - x, height - 1 - y));
    }
  }

  const minCornerAlpha = Math.min(...values);
  if (minCornerAlpha > 220) {
    throw new Error(`${filePath}: opaque corners can render as a square card (minimum alpha ${minCornerAlpha})`);
  }

  return { file: path.basename(filePath), width, height, minCornerAlpha };
}

async function main() {
  const targetDir = path.resolve(process.argv[2] ?? DEFAULT_DIR);
  const names = (await readdir(targetDir))
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort();

  if (names.length === 0) {
    throw new Error(`No PNG files found in ${targetDir}`);
  }

  const checked = [];
  const errors = [];
  for (const name of names) {
    try {
      checked.push(await validateFile(path.join(targetDir, name)));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  console.log(JSON.stringify({
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    directory: targetDir,
    checked,
    errors,
  }, null, 2));

  if (errors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
