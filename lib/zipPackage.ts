export type ZipFileInput = {
  path: string;
  data: string | Uint8Array;
};

const encoder = new TextEncoder();
let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(data: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(data: string | Uint8Array) {
  return typeof data === "string" ? encoder.encode(data) : data;
}

function writeUInt16(value: number, output: number[]) {
  output.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUInt32(value: number, output: number[]) {
  output.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function appendBytes(output: number[], bytes: Uint8Array) {
  for (let i = 0; i < bytes.length; i += 1) output.push(bytes[i]);
}

function dosTime(date: Date) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function dosDate(date: Date) {
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

export function dataUrlToBytes(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",", 2);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createZipBlob(files: ZipFileInput[]) {
  const now = new Date();
  const local: number[] = [];
  const central: number[] = [];

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path.replace(/^\/+/, ""));
    const data = toBytes(file.data);
    const crc = crc32(data);
    const localOffset = local.length;

    writeUInt32(0x04034b50, local);
    writeUInt16(20, local);
    writeUInt16(0, local);
    writeUInt16(0, local);
    writeUInt16(dosTime(now), local);
    writeUInt16(dosDate(now), local);
    writeUInt32(crc, local);
    writeUInt32(data.length, local);
    writeUInt32(data.length, local);
    writeUInt16(nameBytes.length, local);
    writeUInt16(0, local);
    appendBytes(local, nameBytes);
    appendBytes(local, data);

    writeUInt32(0x02014b50, central);
    writeUInt16(20, central);
    writeUInt16(20, central);
    writeUInt16(0, central);
    writeUInt16(0, central);
    writeUInt16(dosTime(now), central);
    writeUInt16(dosDate(now), central);
    writeUInt32(crc, central);
    writeUInt32(data.length, central);
    writeUInt32(data.length, central);
    writeUInt16(nameBytes.length, central);
    writeUInt16(0, central);
    writeUInt16(0, central);
    writeUInt16(0, central);
    writeUInt16(0, central);
    writeUInt32(0, central);
    writeUInt32(localOffset, central);
    appendBytes(central, nameBytes);
  });

  const centralOffset = local.length;
  const output = [...local, ...central];
  writeUInt32(0x06054b50, output);
  writeUInt16(0, output);
  writeUInt16(0, output);
  writeUInt16(files.length, output);
  writeUInt16(files.length, output);
  writeUInt32(central.length, output);
  writeUInt32(centralOffset, output);
  writeUInt16(0, output);

  return new Blob([new Uint8Array(output)], { type: "application/zip" });
}
