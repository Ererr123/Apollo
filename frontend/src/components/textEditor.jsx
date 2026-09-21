import {useEditor, EditorContent} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {TextStyle} from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import "./textEditor.css"; 

const FONT_FAMILIES = [
  {label: "Default", value: ""},
  {label: "Serif", value: "Georgia, serif"},
  {label: "Sans", value: "Inter, Arial, sans-serif"},
  {label: "Mono", value: "'Courier New', monospace"},
];



// `content` is a Tiptap/ProseMirror JSON document (an object), not a
export default function TextEditor({content, onChange, editable = true}) {
  const editor = useEditor({
      extensions: [
        StarterKit,
        Underline,
        TextStyle,
        FontFamily,
        Color,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: "" }),
      ],
      content: content || "",
      editable,
      onUpdate: ({ editor }) => {
        onChange?.(editor.getJSON());
      },
    });

    if (!editor) return null;
    
    return (
        <div className="text-editor">
          <Toolbar editor={editor} />
          <EditorContent editor={editor} className="text-editor-content" />
        </div>
    );
}

// Toolbar component for the text editor
function Toolbar({ editor }) {
  function isActive(name, attrs) {
    return editor.isActive(name, attrs);
  }

  function setLink() {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl || "https://");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    // Toolbar UI with buttons and dropdowns for formatting
    <div className="toolbar">
      <div className="toolbar-group">
        <select
          onChange={(e) => {
            const level = Number(e.target.value);
            if (!level) editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level }).run();
          }}
          value={
            editor.isActive("heading", { level: 1 })
              ? "1"
              : editor.isActive("heading", { level: 2 })
              ? "2"
              : editor.isActive("heading", { level: 3 })
              ? "3"
              : "0"
          }
        >
          <option value="0">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        <select
          onChange={(e) =>
            editor.chain().focus().setFontFamily(e.target.value).run()
          }
          defaultValue=""
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
          
      <div className="toolbar-group">
        <ToolbarButton
          active={isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="B"
          title="Bold"
        />
        <ToolbarButton
          active={isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="I"
          title="Italic"
        />
        <ToolbarButton
          active={isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          label="U"
          title="Underline"
        />
        <ToolbarButton
          active={isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="S"
          title="Strikethrough"
        />
        <input
          type="color"
          title="Text color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          active={isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          label="⟸"
          title="Align left"
        />
        <ToolbarButton
          active={isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          label="↔"
          title="Align center"
        />
        <ToolbarButton
          active={isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          label="⟹"
          title="Align right"
        />
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          active={isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="•"
          title="Bullet list"
        />
        <ToolbarButton
          active={isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="1."
          title="Numbered list"
        />
        <ToolbarButton
          active={isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="❝"
          title="Quote"
        />
        <ToolbarButton
          active={isActive("link")}
          onClick={setLink}
          label="🔗"
          title="Link"
        />
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, label, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={active ? "toolbar-btn active" : "toolbar-btn"}
    >
      {label}
    </button>
  );
}