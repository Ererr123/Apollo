import {useEffect, useMemo, useState} from "react";
import {client} from "../api/client.js";
import "./WorldDetailsPage.css";
import TextEditor from "../components/textEditor.jsx";

const DOC_TYPES = ["chapter", "lore", "character_bio", "note"];

const TYPE_LABELS = {
    chapter: {singular: "Chapter", plural: "Chapters"},
    lore: {singular: "Lore", plural: "Lore"},
    character_bio: {singular: "Character bio", plural: "Character bios"},
    note: {singular: "Note", plural: "Notes"},
};

// Documents with a missing/unknown type are shown under "Notes".
function typeOf(doc) {
    return DOC_TYPES.includes(doc.docType) ? doc.docType : "note";
}

export default function WorldDetailPage({world, onBack}) {
    const [documents, setDocuments] = useState([]);
    const [activeDoc, setActiveDoc] = useState(null); // full document object, currently loaded
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [docType, setDocType] = useState("note");
    const [newDocTitle, setNewDocTitle] = useState("");
    const [newDocType, setNewDocType] = useState("note");
    const [openType, setOpenType] = useState(null); // which type's tab is open in the sidebar
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState(""); // "", "saving", "saved"

    // Documents grouped by type for the sidebar
    const docsByType = useMemo(() => {
        const groups = Object.fromEntries(DOC_TYPES.map((type) => [type, []]));
        for (const doc of documents) groups[typeOf(doc)].push(doc);
        return groups;
    }, [documents]);

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

    // Esc closes the open tab
    useEffect(() => {
        if (!openType) return;
        const onKey = (e) => {
            if (e.key === "Escape") setOpenType(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [openType]);

    // Open a document and load its full content
    async function openDocument(doc) {
        setError(null);
        setOpenType(null);
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
            const doc = await client.createDocument(world.id, newDocTitle, newDocType);
            const created = {...doc, docType: doc.docType || newDocType};
            setNewDocTitle("");
            setDocuments((prev) => [...prev, created]);
            openDocument(created);
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
            // keep the sidebar in step (title and type decide where a document is listed)
            setDocuments((prev) =>
                prev.map((d) => (d.id === activeDoc.id ? {...d, title, docType} : d))
            );
            setSaveStatus("saved");
        } catch (err) {
            setError("There was an error saving the document: " + err.message);
            setSaveStatus("");
        }
    }

    // Handle deleting a document (defaults to the one that's open)
    async function handleDeleteDocument(docId = activeDoc?.id) {
        if (!docId) return;
        if (!confirm("Delete this document? This cannot be undone.")) return;
        setError(null);
        try {
            await client.deleteDocument(docId);
            setDocuments((prev) => prev.filter((d) => d.id !== docId));
            if (activeDoc?.id === docId) {
                setActiveDoc(null);
                setTitle("");
                setContent("");
                setDocType("note");
            }
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
        <aside className={openType ? "sidebar menu-open" : "sidebar"}>
          <form onSubmit={handleCreateDocument} className="create-card">
            <input
              placeholder="New Document Title"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              required
            />
            <select
              aria-label="New document type"
              value={newDocType}
              onChange={(e) => setNewDocType(e.target.value)}
            >
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type].singular}
                </option>
              ))}
            </select>
            <button type="submit" aria-label="Create document">+</button>
          </form>

          <nav className="type-list" aria-label="Documents by type">
            {DOC_TYPES.map((type) => {
              const docs = docsByType[type];
              const isOpen = openType === type;
              const label = TYPE_LABELS[type];
              const hasActive = docs.some((d) => d.id === activeDoc?.id);
              return (
                <div
                  key={type}
                  className={
                    "type-group" + (isOpen ? " open" : "") + (hasActive ? " has-active" : "")
                  }
                >
                  <button
                    type="button"
                    className="type-toggle"
                    aria-expanded={isOpen}
                    aria-controls={`type-panel-${type}`}
                    onClick={() => setOpenType(isOpen ? null : type)}
                  >
                    <span className="type-name">{label.plural}</span>
                    <span className="type-count">{docs.length}</span>
                    <svg
                      className="type-chevron"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M7 10l5 5 5-5z" fill="currentColor" />
                    </svg>
                  </button>

                  {isOpen && (
                    <section
                      id={`type-panel-${type}`}
                      className="type-panel"
                      aria-label={label.plural}
                    >
                      <div className="type-panel-header">
                        <h2>{label.plural}</h2>
                        <button
                          type="button"
                          className="delete-button"
                          aria-label="Close"
                          onClick={() => setOpenType(null)}
                        >
                          &times;
                        </button>
                      </div>
                      <div className="type-panel-body">
                        {docs.length === 0 ? (
                          <p className="muted">
                            No {label.plural.toLowerCase()} yet.
                          </p>
                        ) : (
                          <ul className="document-list">
                            {docs.map((doc) => (
                              <li
                                key={doc.id}
                                className={activeDoc?.id === doc.id ? "active" : ""}
                              >
                                <button
                                  type="button"
                                  className="doc-open"
                                  onClick={() => openDocument(doc)}
                                >
                                  {doc.title}
                                </button>
                                <button
                                  type="button"
                                  className="delete-button"
                                  aria-label={`Delete ${doc.title}`}
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
                        )}
                      </div>
                    </section>
                  )}
                </div>
              );
            })}
          </nav>
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
                className="doc-type-select"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type].singular}
                  </option>
                ))}
              </select>
              <TextEditor
                documentKey={activeDoc.id}
                content={content}
                onChange={(newContent) => setContent(newContent)}
                onSave={handleSave}
                onDelete={() => handleDeleteDocument(activeDoc.id)}
                onTitleChange={(newTitle) => setTitle(newTitle)}
                onDocTypeChange={(newDocType) => setDocType(newDocType)}
                onContentChange={(newContent) => setContent(newContent)}
              />
              {console.log("documentKey:", activeDoc.id, "content:", content)}  

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

      {/* softly blurs everything but the sidebar while a type's tab is open */}
      {openType && (
        <div
          className="menu-backdrop"
          aria-hidden="true"
          onClick={() => setOpenType(null)}
        />
      )}
    </div>
  );
}