import {useEffect, useState} from "react";
import {client} from "../api/client.js";
import "./WorldDetailsPage.css";
import TextEditor from "../components/textEditor.jsx";

const DOC_TYPES = ["chapter", "lore", "character_bio", "note"];

export default function WorldDetailPage({world, onBack}) {
    const [documents, setDocuments] = useState([]);
    const [activeDoc, setActiveDoc] = useState(null); // full document object, currently loaded
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [docType, setDocType] = useState("note");
    const [newDocTitle, setNewDocTitle] = useState("");
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState(""); // "", "saving", "saved"

    // Load documents from the API
    async function loadDocuments() {
        try {
            setDocuments(await client.listDocuments(world.id));
        } catch (err) {
            setError("There was an error loading the documents: " + err.message);
        }
    }

    useEffect(() => {
        loadDocuments();
    }, [world.id]);

    // Open a document and load its full content
    async function openDocument(doc) {
        setError(null);
        try {
            const full = await client.getDocument(doc.id);
            setActiveDoc(full);
            setTitle(full.title);
            setContent(full.content);
            setDocType(full.docType);
            setSaveStatus("");
        } catch (err) {
            setError("There was an error loading the document: " + err.message);
        }
    }

    // Handle creating a new document
    async function handleCreateDocument(e) {
        e.preventDefault();
        setError(null);
        try {
            const doc = await client.createDocument(world.id, newDocTitle, "note");
            setNewDocTitle("");
            setDocuments((prev) => [...prev, doc]);
            openDocument(doc);
        } catch (err) {
            setError("There was an error creating the document: " + err.message);
        }
    }

    // Handle saving the currently active document
    async function handleSave() {
        if (!activeDoc) return;
        setSaveStatus("saving");
        setError(null);
        try {
            const updated = await client.updateDocument(activeDoc.id, {title, content, docType});
            setActiveDoc(updated);
            setSaveStatus("saved");
        } catch (err) {
            setError("There was an error saving the document: " + err.message);
            setSaveStatus("");
        }
    }

    // Handle deleting the currently active document
    async function handleDeleteDocument() {
        if (!activeDoc) return;
        if (!confirm("Delete this document? This cannot be undone.")) return;
        setError(null);
        try {
            await client.deleteDocument(activeDoc.id);
            setDocuments((prev) => prev.filter((d) => d.id !== activeDoc.id));
            setActiveDoc(null);
            setTitle("");
            setContent("");
            setDocType("note");
        }
        catch (err) {
            setError("There was an error deleting the document: " + err.message);
        }
    }

    // Render the component
    return (
    <div className="world-detail-page">
      <header className="page-header">
        <button type="button" className="link-button" onClick={onBack}>
          &larr; Back to Worlds
        </button>
        <h1>{world?.title || "Untitled World"}</h1>
        {world?.description && (
          <p className="subtitle">{world.description}</p>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <div className="world-detail-container">
        <aside className="sidebar">
          <form onSubmit={handleCreateDocument} className="create-card">
            <input
              placeholder="New Document Title"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              required
            />
            <button type="submit">+</button>
          </form>
          <ul className="document-list">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className={activeDoc?.id === doc.id ? "active" : ""}
              >
                <div onClick={() => openDocument(doc)}>
                  <strong>{doc.title}</strong>
                  <span className="doc-type">{doc.docType || "note"}</span>
                </div>
                <button
                  type="button"
                  className="delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(doc.id);
                  }}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="document-editor">
          {!activeDoc ? (
            <p className="muted">Select a document to view or edit.</p>
          ) : (
            <>
              <input
                className="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <TextEditor
                content={content}
                onChange={(newContent) => setContent(newContent)}
              />

              <div className="editor-actions">
                <button type="button" onClick={handleSave}>
                  Save
                </button>
                {saveStatus === "saving" && (
                  <span className="muted">Saving...</span>
                )}
                {saveStatus === "saved" && (
                  <span className="muted">Saved</span>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}