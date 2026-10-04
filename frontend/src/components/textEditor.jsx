import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
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
import { useEffect } from "react";
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

// Used by both line-height extensions below and by the toolbar fallback.
// Google Docs' own default is "1.15"; it's "1" here to keep existing behavior.
const DEFAULT_LINE_HEIGHT = "1";

const DEFAULT_TEXT_COLOR = "#000000";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Okay, so Line Spacing wasn't wporking so I constulted Claude. 
// It suggested creating a custom extension for line spacing, which is what LineSpacing does.
const LineSpacing = Extension.create({
  name: "lineSpacing",
  addOptions() {
    return {
      types: ["paragraph", "heading"],
      defaultLineHeight: DEFAULT_LINE_HEIGHT,
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
      LineHeight.configure({
        types: ["heading", "paragraph"],
        defaultLineHeight: DEFAULT_LINE_HEIGHT
      }),
      LineSpacing,
    ],
    content: content || "",
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
  });

  // Update the editor content when the documentKey changes (this was the issue with the frontend bug)
  useEffect(() => {
    if (!editor) return;

    editor.commands.setContent(content || "", false);
  }, [editor, documentKey]);

  // `editable` is only read when the editor is created, so keep it in sync if
  // the prop flips later (otherwise a "read-only" doc could still be typed in).
  useEffect(() => {
    if (!editor || editor.isEditable === editable) return;
    editor.setEditable(editable, false);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className={editable ? "text-editor" : "text-editor read-only"}>
      {editable && <Toolbar editor={editor} />}
      <div className="page-canvas">
        <EditorContent editor={editor} className="text-editor-content" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVG, 24x24 grid, Lucide-style strokes)
// ---------------------------------------------------------------------------
const ICONS = {
  undo: (<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>),
  redo: (<><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>),
  bold: (<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />),
  italic: (<><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" /></>),
  underline: (<><path d="M6 4v6a6 6 0 0 0 12 0V4" /><path d="M4 20h16" /></>),
  strike: (<><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><path d="M4 12h16" /></>),
  colorA: (<><path d="m6 16 6-12 6 12" /><path d="M8 12h8" /></>),
  alignLeft: (<><path d="M3 6h18" /><path d="M3 12h12" /><path d="M3 18h14" /></>),
  alignCenter: (<><path d="M3 6h18" /><path d="M7 12h10" /><path d="M5 18h14" /></>),
  alignRight: (<><path d="M3 6h18" /><path d="M9 12h12" /><path d="M7 18h14" /></>),
  alignJustify: (<><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>),
  lineSpacing: (<><path d="M5 4v16" /><path d="m2 7 3-3 3 3" /><path d="m2 17 3 3 3-3" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></>),
  bulletList: (<><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /></>),
  orderedList: (<><path d="M10 6h11" /><path d="M10 12h11" /><path d="M10 18h11" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></>),
  taskList: (<><rect x="3" y="5" width="6" height="6" rx="1" /><path d="m3 17 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></>),
  link: (<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
  clear: (<><path d="M4 7V4h16v3" /><path d="M5 20h6" /><path d="M13 4 8 20" /><path d="m15 15 5 5" /><path d="m20 15-5 5" /></>),
};

function Icon({ name, size = 18, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

// Fonts parsed back from HTML lose their quotes, so compare without them.
const normFont = (v) => (v || "").replace(/['"\s]/g, "").toLowerCase();

// Toolbar component for the text editor
function Toolbar({ editor }) {
  // Tiptap 3's useEditor doesn't re-render on every transaction, so read the
  // toolbar state through useEditorState to keep it in sync with the cursor.
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      const block = editor.state.selection.$from.parent.attrs; // paragraph/heading under the cursor
      const textStyle = editor.getAttributes("textStyle");
      return {
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
        heading: [1, 2, 3].find((level) => editor.isActive("heading", { level })) ?? 0,
        fontFamily: textStyle.fontFamily || "",
        color: textStyle.color || "",
        lineHeight: block.lineHeight || DEFAULT_LINE_HEIGHT,
        align: block.textAlign || "left",
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        underline: editor.isActive("underline"),
        strike: editor.isActive("strike"),
        bulletList: editor.isActive("bulletList"),
        orderedList: editor.isActive("orderedList"),
        taskList: editor.isActive("taskList"),
        link: editor.isActive("link"),
      };
    },
  });

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

  function changeHeading(e) {
    const level = Number(e.target.value);
    if (!level) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level }).run();
  }

  function changeFont(e) {
    const value = e.target.value;
    if (!value) editor.chain().focus().unsetFontFamily().run();
    else editor.chain().focus().setFontFamily(value).run();
  }

  function changeLineSpacing(e) {
    // setLineSpacing writes the paragraph/heading attribute (see LineSpacing above).
    editor.chain().focus().setLineSpacing(e.target.value).run();
  }

  // Selects must always have a matching <option>; add one for values that
  // aren't in our lists (e.g. pasted content).
  const knownFont = FONT_FAMILIES.find((f) => normFont(f.value) === normFont(s.fontFamily));
  const fontValue = knownFont ? knownFont.value : s.fontFamily;
  const knownLineHeight = LINE_HEIGHTS.some((l) => l.value === s.lineHeight);

  return (
    // Toolbar UI with buttons and dropdowns for formatting
    <div className="toolbar-shell">
      <div className="toolbar" role="toolbar" aria-label="Text formatting">
        <div className="toolbar-group">
          <ToolbarButton
            icon="undo"
            title="Undo (Ctrl+Z)"
            disabled={!s.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            icon="redo"
            title="Redo (Ctrl+Y)"
            disabled={!s.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>

        <div className="toolbar-group">
          <SelectControl
            title="Styles"
            value={String(s.heading)}
            onChange={changeHeading}
          >
            <option value="0">Normal text</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </SelectControl>

          <SelectControl title="Font" value={fontValue} onChange={changeFont}>
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
            {!knownFont && (
              <option value={s.fontFamily}>
                {s.fontFamily.split(",")[0].replace(/['"]/g, "").trim()}
              </option>
            )}
          </SelectControl>

          <SelectControl
            title="Line & paragraph spacing"
            icon="lineSpacing"
            value={s.lineHeight}
            onChange={changeLineSpacing}
          >
            {LINE_HEIGHTS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
            {!knownLineHeight && <option value={s.lineHeight}>{s.lineHeight}</option>}
          </SelectControl>
        </div>

        <div className="toolbar-group">
          <ToolbarButton
            active={s.bold}
            icon="bold"
            title="Bold (Ctrl+B)"
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            active={s.italic}
            icon="italic"
            title="Italic (Ctrl+I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            active={s.underline}
            icon="underline"
            title="Underline (Ctrl+U)"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            active={s.strike}
            icon="strike"
            title="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <ColorButton
            color={s.color}
            onChange={(value) => editor.chain().focus().setColor(value).run()}
          />
        </div>

        <div className="toolbar-group">
          <ToolbarButton
            active={s.align === "left"}
            icon="alignLeft"
            title="Align left"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          />
          <ToolbarButton
            active={s.align === "center"}
            icon="alignCenter"
            title="Align center"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          />
          <ToolbarButton
            active={s.align === "right"}
            icon="alignRight"
            title="Align right"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          />
          <ToolbarButton
            active={s.align === "justify"}
            icon="alignJustify"
            title="Justify"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          />
        </div>

        <div className="toolbar-group">
          <ToolbarButton
            active={s.bulletList}
            icon="bulletList"
            title="Bulleted list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            active={s.orderedList}
            icon="orderedList"
            title="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            active={s.taskList}
            icon="taskList"
            title="Checklist"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          />
          <ToolbarButton
            active={s.link}
            icon="link"
            title="Insert link"
            onClick={setLink}
          />
        </div>

        <div className="toolbar-group">
          <ToolbarButton
            icon="clear"
            title="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          />
        </div>
      </div>
    </div>
  );
}

// `active` is only passed for toggle buttons (it drives aria-pressed).
function ToolbarButton({ active, disabled, onClick, icon, title }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // keep focus (and the visible selection) in the editor while clicking
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={active ? "toolbar-btn active" : "toolbar-btn"}
    >
      <Icon name={icon} />
    </button>
  );
}

// Borderless native <select> with a chevron, styled like the Docs dropdowns.
function SelectControl({ title, icon, value, onChange, children }) {
  return (
    <label className={icon ? "toolbar-select has-icon" : "toolbar-select"} title={title}>
      {icon && <Icon name={icon} className="lead-icon" />}
      <select value={value} onChange={onChange} aria-label={title}>
        {children}
      </select>
      <svg className="chevron" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 10l5 5 5-5z" fill="currentColor" />
      </svg>
    </label>
  );
}

// "A" with a color bar under it; the real <input type="color"> sits invisibly
// on top so a click opens the native picker.
function ColorButton({ color, onChange }) {
  return (
    <label className="toolbar-btn color-btn" title="Text color">
      <Icon name="colorA" />
      <span className="color-bar" style={{ backgroundColor: color || DEFAULT_TEXT_COLOR }} />
      <input
        type="color"
        className="color-input"
        aria-label="Text color"
        value={HEX_COLOR.test(color) ? color : DEFAULT_TEXT_COLOR}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
