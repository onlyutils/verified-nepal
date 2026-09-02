export async function downscaleImage(file: File, maxDim = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  if (scale >= 1) {
    bitmap.close();
    return file;
  }
  const nw = Math.round(width * scale);
  const nh = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, nw, nh);
  bitmap.close();
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.82),
  );
  if (!blob) return file;
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
  return new File([blob], name, { type: blob.type || file.type });
}
