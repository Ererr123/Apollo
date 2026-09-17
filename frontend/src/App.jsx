import { useState } from "react";
import AuthPage from "./pages/AuthenticationPage.jsx";
import WorldsPage from "./pages/WorldsPage.jsx";
import { setToken } from "./api/client.js";
import WorldDetailsPage from "./pages/WorldDetailsPage.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [activeWorld, setActiveWorld] = useState(null);

  function handleLogout() {
    setToken(null);
    setUser(null);
    setActiveWorld(null);
  }

  if (!user) {
    return <AuthPage onAuthed={setUser} />;
  }

  if (activeWorld) {
    return (
      <WorldDetailsPage world={activeWorld} onBack={() => setActiveWorld(null)} />
    );
  }

  return <WorldsPage onOpenWorld={setActiveWorld} onLogout={handleLogout} />;
}
