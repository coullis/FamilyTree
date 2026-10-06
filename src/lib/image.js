// Shrinks a photo in the browser before upload, to save storage and bandwidth.
const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

async function resize(file, maxSide, quality) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await toBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality); // older Safari
  return blob;
}

// full: 1280px longest side (~100-200 KB), thumb: 320px (~10 KB)
export async function prepareImage(file) {
  return { full: await resize(file, 1280, 0.78), thumb: await resize(file, 320, 0.7) };
}
