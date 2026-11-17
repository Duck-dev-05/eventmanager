/** Shared by the upload API and the client UI, so it must stay free of node imports. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Extensions we can name precisely; anything else is served as a download. */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  key: "application/vnd.apple.keynote",
  numbers: "application/vnd.apple.numbers",
  pages: "application/vnd.apple.pages",
  psd: "image/vnd.adobe.photoshop",
  ai: "application/postscript",
  eps: "application/postscript",
  obj: "model/obj",
  stl: "model/stl",
  glb: "model/gltf-binary",
  ics: "text/calendar",
  vcf: "text/vcard",
  epub: "application/epub+zip",
  apk: "application/vnd.android.package-archive",
};

/** Any file type is accepted; this only improves the download's Content-Type. */
export function mimeTypeForFileName(
  fileName: string,
  fallback = "application/octet-stream",
) {
  if (fallback && fallback !== "application/octet-stream") return fallback;

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? fallback;
}

export type EventFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploaderName: string;
  createdAt: string;
};
