import { useState } from "react";

export default function LoginModal({ onLogin, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const err = await onLogin(email.trim(), password);
    if (err) { setError(err); setPassword(""); setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Admin login</h2>
        <label>Email
          <input type="email" value={email} autoFocus onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "…" : "Log in"}</button>
        </div>
      </form>
    </div>
  );
}
