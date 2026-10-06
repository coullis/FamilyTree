import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { prepareImage } from "./image";

const BUCKET = "photos";

export const photoUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

// Loads one person's photos. Visitors only ever get approved ones.
export function usePhotos(personId, onlyApproved) {
  const [photos, setPhotos] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let q = supabase.from("photos").select("*").eq("person_id", personId).order("created_at");
    if (onlyApproved) q = q.eq("approved", true);
    q.then(({ data }) => { if (alive && data) setPhotos(data); });
    return () => { alive = false; };
  }, [personId, onlyApproved, tick]);

  return { photos, reload: () => setTick((t) => t + 1) };
}

export async function uploadPhoto({ personId, uploader, file, approved }) {
  if (!supabase) throw new Error("The backend isn't set up yet.");
  const { full, thumb } = await prepareImage(file);
  const id = crypto.randomUUID();
  const ext = (b) => (b.type === "image/webp" ? "webp" : "jpg");
  const path = `${personId}/${id}.${ext(full)}`;
  const thumbPath = `${personId}/${id}-t.${ext(thumb)}`;
  const opts = (b) => ({ contentType: b.type, cacheControl: "31536000" });
  const store = supabase.storage.from(BUCKET);

  let res = await store.upload(path, full, opts(full));
  if (res.error) throw res.error;
  res = await store.upload(thumbPath, thumb, opts(thumb));
  if (res.error) throw res.error;
  const { error } = await supabase.from("photos").insert({
    person_id: personId, path, thumb_path: thumbPath, uploader, approved,
  });
  if (error) throw error;
}

export const approvePhoto = (id) => supabase.from("photos").update({ approved: true }).eq("id", id);

export async function deletePhoto(photo) {
  await supabase.from("photos").delete().eq("id", photo.id);
  await supabase.storage.from(BUCKET).remove([photo.path, photo.thumb_path]);
}

export async function deletePersonPhotos(personId) {
  const { data } = await supabase.from("photos").select("path, thumb_path").eq("person_id", personId);
  if (data?.length) await supabase.storage.from(BUCKET).remove(data.flatMap((p) => [p.path, p.thumb_path]));
  await supabase.from("photos").delete().eq("person_id", personId);
}

export async function fetchPending() {
  const { data, error } = await supabase.from("photos").select("id, person_id").eq("approved", false);
  return error ? [] : data;
}
