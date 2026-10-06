import { useState } from "react";

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function SearchBar({ people, onPick }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const words = norm(query).split(/\s+/).filter(Boolean);
  const results = words.length
    ? people
        .filter((p) => {
          const full = norm(`${p.name} ${p.surname}`);
          return words.every((w) => full.includes(w));
        })
        .slice(0, 6)
    : [];

  const pick = (id) => {
    onPick(id);
    setQuery("");
    document.activeElement?.blur();
  };

  return (
    <div className="search">
      {open && words.length > 0 && (
        <ul className="results" onMouseDown={(e) => e.preventDefault()}>
          {results.length ? (
            results.map((p) => (
              <li key={p.id}>
                <button onClick={() => pick(p.id)}>
                  <span className={`dot ${p.gender === "m" ? "male" : "female"}`} />
                  {p.name} {p.surname}
                </button>
              </li>
            ))
          ) : (
            <li className="empty">No one found</li>
          )}
        </ul>
      )}
      <input
        type="search"
        placeholder="Search…"
        aria-label="Search people"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) pick(results[0].id);
          if (e.key === "Escape") { setQuery(""); e.target.blur(); }
        }}
      />
    </div>
  );
}
