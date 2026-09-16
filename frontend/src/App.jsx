import { useState } from "react";
import AuthPage from "./pages/AuthenticationPage.jsx";
import { setToken } from "./api/client.js";

export default function App() {
  const [user, setUser] = useState(null);
  
  function handleLogout() {
    setToken(null);
    setUser(null);
  }

  if (!user) {
    return <AuthPage onAuthed={setUser} />;
  }
  return <div>Welcome, {user.name}!</div>;
}
