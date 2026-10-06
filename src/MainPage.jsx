import { useState } from "react";
import FamilyTree from "./FamilyTree";
import ViewPanel from "./ViewPanel";
import SearchBar from "./SearchBar";
import LoginModal from "./LoginModal";

export default function MainPage({ data, authed, onLogin, onEnterAdmin, onAddComment }) {
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const person = data.people.find((p) => p.id === selected);

  const pick = (id) => {
    setSelected(id);
    setFocus({ id });
  };

  return (
    <div className="app">
      <header>
        <div>
          <h1>{data.title}</h1>
          <p>Click a person to see details or leave a comment.</p>
        </div>
        <div className="actions">
          <button onClick={() => (authed ? onEnterAdmin() : setShowLogin(true))}>Admin</button>
        </div>
      </header>
      <div className="main">
        <FamilyTree data={data} selectedId={selected} onSelect={setSelected} focus={focus} />
        {person && (
          <ViewPanel key={person.id} person={person} onClose={() => setSelected(null)}
            onComment={(author, text) => onAddComment(person.id, author, text)} />
        )}
      </div>
      <SearchBar people={data.people} onPick={pick} />
      {showLogin && <LoginModal onLogin={onLogin} onClose={() => setShowLogin(false)} />}
    </div>
  );
}
