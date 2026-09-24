import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, LineHeight } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import "./textEditor.css";

const FONT_FAMILIES = [
  {label: "Default", value: ""},
  {label: "Serif", value: "Georgia, serif"},
  {label: "Sans", value: "Inter, Arial, sans-serif"},
  {label: "Mono", value: "'Courier New', monospace"},
];

const LINE_HEIGHTS = [
  {label: "Single", value: "1"},
  {label: "1.15", value: "1.15"},
  {label: "1.5", value: "1.5"},
  {label: "Double", value: "2"},
];

// Okay, so Line Spacing wasn't wporking so I constulted Claude. 
// It suggested creating a custom extension for line spacing, which is what LineSpacing does.
const LineSpacing = Extension.create({
  name: "lineSpacing",
  addOptions() {
    return {
      types: ["paragraph", "heading"],
      defaultLineHeight: "1",
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.defaultLineHeight,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
            parseHTML: (element) => element.style.lineHeight || null,
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineSpacing:
        (lineHeight) =>
        ({ commands }) =>
          this.options.types.every((type) =>
            commands.updateAttributes(type, { lineHeight })
          ),
    };
  },
});

//fix for the document not updating correctly when the content changes externally
export default function TextEditor({
  content,
  onChange,
  editable = true,
  documentKey,
}) {
  return (
    <EditorInstance
      content={content}
      onChange={onChange}
      editable={editable}
      documentKey={documentKey}
    />
  )
}

// EditorInstance is a wrapper around the Tiptap editor that handles initialization and updates.
function EditorInstance({content, onChange, editable = true, documentKey}) {
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
        TaskList,
        TaskItem.configure({ nested: true }),
        LineHeight.configure({ types: ["heading", "paragraph"], defaultLineHeight: "1" }), 
        LineSpacing,
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

        <select
          title="Line & Paragraph Spacing"
          onChange={(e) =>
            editor.chain().focus().setLineHeight(e.target.value).run()
          }
          defaultValue="1"
        >
          {LINE_HEIGHTS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
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
          active={isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          label="☑"
          title="Checklist"
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