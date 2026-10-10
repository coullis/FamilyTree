import { useEffect, useState } from "react";
import family from "./data/family.json";
import MainPage from "./MainPage";
import AdminPage from "./AdminPage";
import { supabase } from "./lib/supabase";
import { fetchPending } from "./lib/photos";
import "./index.css";

const NOT_SET_UP = "The backend isn't set up yet (missing Supabase keys in .env.local).";

export default function App() {
  const [data, setData] = useState(family);       // the tree being shown / edited
  const [saved, setSaved] = useState(null);       // the tree as stored in Supabase
  const [loading, setLoading] = useState(!!supabase);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [pending, setPending] = useState([]); // photos waiting for approval
  const [view, setView] = useState("main");       // "main" | "admin"
  const [session, setSession] = useState(null);

  // load the shared tree (falls back to family.json if there is none yet)
  useEffect(() => {
    localStorage.removeItem("family-tree-data"); // old browser-only copy
    if (!supabase) return;
    supabase.from("family").select("data").eq("id", 1).maybeSingle().then(({ data: row, error }) => {
      if (error) setLoadError(true);
      else if (row?.data) { setData(row.data); setSaved(row.data); }
      setLoading(false);
    });
  }, []);

  // keep track of the admin's login session
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // load comments whenever the admin page is opened
  useEffect(() => {
    if (!session || view !== "admin") return;
    fetchPending().then(setPending);
    supabase.from("comments").select("*").order("created_at").then(({ data: rows, error }) => {
      if (!error)
        setComments(rows.map((r) => ({
          id: r.id, personId: r.person_id, author: r.author, text: r.text, date: r.created_at,
        })));
    });
  }, [session, view]);

  const dirty = !!session && JSON.stringify(data) !== JSON.stringify(saved);
  const savedPeople = new Set((saved || family).people.map((person) => person.id));
  const unsavedIds = new Set(data.people.filter((person) => !savedPeople.has(person.id)).map((person) => person.id));

  // warn before closing the tab with unsaved admin edits
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const saveTree = async (tree = data) => {
    if (loadError)
      return "The saved tree couldn't be loaded, so saving is turned off to protect it. Reload the page and try again.";
    setSaving(true);
    const { error } = await supabase.from("family").upsert({ id: 1, data: tree, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return "Couldn't save the tree. Please try again.";
    setSaved(tree);
    return null;
  };

  const login = async (email, password) => {
    if (!supabase) return NOT_SET_UP;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return "Wrong email or password.";
    setView("admin");
    return null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setComments([]);
    setPending([]);
    setData(saved || family); // drop unsaved edits
    setView("main");
  };

  // visitors: returns an error message, or null on success
  const addComment = async (personId, author, text) => {
    if (!supabase) return NOT_SET_UP;
    const { error } = await supabase.from("comments").insert({ person_id: personId, author, text });
    return error ? "Couldn't send your comment. Please try again." : null;
  };

  const deleteComment = async (id) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (!error) setComments((c) => c.filter((x) => x.id !== id));
  };

  const deleteCommentsFor = async (personId) => {
    await supabase.from("comments").delete().eq("person_id", personId);
    setComments((c) => c.filter((x) => x.personId !== personId));
  };

  if (loading) return <div className="loading">Loading the family tree…</div>;

  if (view === "admin" && session) {
    return (
      <AdminPage data={data} setData={setData} comments={comments}
        dirty={dirty} saving={saving} onSave={saveTree}
        pending={pending} onPhotosChanged={() => fetchPending().then(setPending)}
        unsavedIds={unsavedIds}
        onDeleteComment={deleteComment} onDeleteCommentsFor={deleteCommentsFor}
        onMainPage={() => setView("main")} onLogout={logout} />
    );
  }
  return (
    <MainPage data={data} authed={!!session} onLogin={login}
      onEnterAdmin={() => setView("admin")} onAddComment={addComment} />
  );
}
