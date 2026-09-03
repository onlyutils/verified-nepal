import type { PresignResponse } from "./api";
import { MEDIA_LIMITS } from "../articles/types";

export type MediaUploadErrorCode = "too_large" | "bad_type" | "presign" | "upload";

export class MediaUploadError extends Error {
  readonly code: MediaUploadErrorCode;
  readonly cause?: unknown;

  constructor(code: MediaUploadErrorCode, message: string = code, cause?: unknown) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
    this.cause = cause;
  }
}

function mediaKind(contentType: string): "image" | "video" | null {
  if (MEDIA_LIMITS.image.types.includes(contentType as (typeof MEDIA_LIMITS.image.types)[number])) return "image";
  if (MEDIA_LIMITS.video.types.includes(contentType as (typeof MEDIA_LIMITS.video.types)[number])) return "video";
  return null;
}

export function uploadMedia(
  presign: (body: { filename: string; contentType: string; size: number }) => Promise<PresignResponse>,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ fileId: string; url: string }> {
  const kind = mediaKind(file.type);
  if (!kind) return Promise.reject(new MediaUploadError("bad_type"));
  if (file.size > MEDIA_LIMITS[kind].maxBytes) return Promise.reject(new MediaUploadError("too_large"));

  return (async () => {
    let signed: PresignResponse;
    try {
      signed = await presign({ filename: file.name, contentType: file.type, size: file.size });
    } catch (cause) {
      throw new MediaUploadError("presign", cause instanceof Error ? cause.message : "presign", cause);
    }
    onProgress?.(0);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.uploadUrl);
      const headers = { ...(signed.headers || {}) };
      if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) headers["Content-Type"] = file.type;
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new MediaUploadError("upload"));
      };
      xhr.onerror = () => reject(new MediaUploadError("upload"));
      xhr.onabort = () => reject(new MediaUploadError("upload"));
      xhr.send(file);
    });
    onProgress?.(1);
    return { fileId: signed.fileId, url: signed.publicUrl };
  })();
}
