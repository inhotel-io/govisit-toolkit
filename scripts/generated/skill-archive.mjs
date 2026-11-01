// GENERATED from inhotel-io/govisit-web/scripts/lib/skill-archive.mjs. Do not edit.
import { gzipSync } from "fflate";

// Small deterministic POSIX ustar package: regular files only, fixed ownership and mtime.
// No external archiver or platform-dependent metadata enters the published digest.
export function createSkillArchive(files) {
  const blocks = [];
  for (const name of Object.keys(files).sort()) {
    const value = files[name];
    if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.includes("..") || name.startsWith("/") || Buffer.byteLength(name) > 100) throw new Error(`Unsafe skill archive path: ${name}`);
    const data = Buffer.from(value);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    const octal = (number, offset, width) => header.write(number.toString(8).padStart(width - 1, "0") + "\0", offset, width);
    octal(0o644, 100, 8);
    octal(0, 108, 8);
    octal(0, 116, 8);
    octal(data.length, 124, 12);
    octal(0, 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = 0x30;
    header.write("ustar\0", 257, 6);
    header.write("00", 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    blocks.push(header, data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  // Native zlib encoders can emit different bytes across Node/platform versions.
  // Pin a portable encoder and the gzip timestamp so CI verifies identical digests.
  return Buffer.from(gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]), { level: 9, mtime: 0 }));
}
