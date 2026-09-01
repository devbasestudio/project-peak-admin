import "server-only";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function text(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function validSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (mimeType === "image/webp") return text(bytes, 0, 4) === "RIFF" && text(bytes, 8, 12) === "WEBP";
  if (mimeType === "video/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") return text(bytes, 4, 8) === "ftyp";
  return false;
}

export async function validatedUpload(file: File, imagesOnly: boolean, maxBytes: number) {
  const allowed = imagesOnly ? imageTypes.has(file.type) : imageTypes.has(file.type) || videoTypes.has(file.type);
  if (!allowed || file.size <= 0 || file.size > maxBytes) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validSignature(bytes, file.type) ? bytes : null;
}

export function extensionFor(mimeType: string) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  } as Record<string, string>)[mimeType] ?? "bin";
}
