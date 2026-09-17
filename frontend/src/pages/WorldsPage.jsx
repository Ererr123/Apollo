import { useEffect, useState } from "react";
import { client } from "../api/client.js";
import "./WorldsPage.css";

export default function WorldsPage({ onOpenWorld, onLogout }) {
  const [worlds, setWorlds] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load worlds from the API
  async function loadWorlds() {
    try {
      setWorlds(await client.listWorlds());
    } catch (err) {
      setError("Error loading worlds: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorlds();
  }, []);

  // Handle creating a new world
  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    try {
      const world = await client.createWorld(title, description || undefined);
      setTitle("");
      setDescription("");
      setWorlds((prev) => [world, ...prev]);
    } catch (err) {
      setError("Error creating world: " + err.message);
    }
  }

  // Handle deleting a world
  async function handleDelete(id) {
    if (!confirm("Delete this world? This cannot be undone.")) return;
    try {
      await client.deleteWorld(id);
      setWorlds((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError("Error deleting world: " + err.message);
    }
  }

  // Render the component
  return (
    <div className="worlds-page">
      <div className="worlds-container">
        <header className="page-header">
          <div className="header-titles">
            <h1>APOLLO</h1>
            <p className="subtitle">Your Worlds</p>
          </div>
          <button className="link-button logout-btn" onClick={onLogout}>
            Log out
          </button>
        </header>

        {/* Render error message if any */}
        {error && <div className="error">{error}</div>}

        {/* Render the form for creating a new world */}
        <form onSubmit={handleCreate} className="card create-card">
          <h2>New World</h2>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Enter world title"
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter world description"
            />
          </label>
          <button type="submit">Create World</button>
        </form>

        {/* Render the list of worlds or a loading message */}
        <section className="worlds-section">
          <h2>Existing Realms</h2>
          {loading ? (
            <p className="state-message">Loading worlds...</p>
          ) : worlds.length === 0 ? (
            <p className="state-message">
              No worlds found. Create a new world to get started!
            </p>
          ) : (
            <ul className="worlds-list">
              {worlds.map((world) => (
                <li key={world.id} className="world-item">
                  <div
                    onClick={() => onOpenWorld(world)}
                    className="world-info"
                  >
                    <strong>{world.title}</strong>
                    {world.description && (
                      <p className="world-description">{world.description}</p>
                    )}
                  </div>
                  <button
                    className="link-button danger"
                    onClick={() => handleDelete(world.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}