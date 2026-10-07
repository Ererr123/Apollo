import {
  useEditor,
  useEditorState,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, LineHeight, FontSize } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, useState } from "react";
import "./textEditor.css";

const FONT_FAMILIES = [
  {label: "Arial", value: "Arial, sans-serif"},
  {label: "Serif", value: "Georgia, serif"},
  {label: "Sans", value: "Inter, Arial, sans-serif"},
  {label: "Mono", value: "'Courier New', monospace"},
  {label: "Verdana", value: "Verdana, sans-serif"},
  {label: "Tahoma", value: "Tahoma, sans-serif"},
  {label: "Trebuchet", value: "Trebuchet MS, sans-serif"},
  {label: "Impact", value: "Impact, Charcoal, sans-serif"},
  {label: "Comic Sans", value: "'Comic Sans MS', cursive, sans-serif"},
  {label: "Palatino", value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif"},
  {label: "Garamond", value: "Garamond, serif"},
  {label: "Bookman", value: "'Bookman Old Style', serif"},
  {label: "Candara", value: "Candara, sans-serif"},
  {label: "Calibri", value: "Calibri, sans-serif"},
  {label: "Futura", value: "Futura, sans-serif"},
  {label: "Helvetica", value: "Helvetica, sans-serif"},
  {label: "Gill Sans", value: "Gill Sans, sans-serif"},
  {label: "Optima", value: "Optima, sans-serif"},
  {label: "Franklin Gothic", value: "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif"},
  {label: "Century Gothic", value: "'Century Gothic', sans-serif"},
  {label: "Lucida Sans", value: "'Lucida Sans', 'Lucida Grande', sans-serif"},
  {label: "Lucida Console", value: "'Lucida Console', Monaco, monospace"},
  {label: "Times New Roman", value: "'Times New Roman', Times, serif"}
];

const LINE_HEIGHTS = [
  {label: "Single", value: "1"},
  {label: "1.15", value: "1.15"},
  {label: "1.5", value: "1.5"},
  {label: "Double", value: "2"},
];

// Text size is stored in pt (Docs units) on the textStyle mark.
// The - / + buttons walk this list; the box accepts any value.
const FONT_SIZE_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96];
const DEFAULT_FONT_SIZE = 11; // body text, see textEditor.css
const HEADING_FONT_SIZES = { 1: 20, 2: 16, 3: 14 }; // matches the h1-h3 sizes in textEditor.css
const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 400;

// Used by both line-height extensions below and by the toolbar fallback.
const DEFAULT_LINE_HEIGHT = "1";

const DEFAULT_TEXT_COLOR = "#000000";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const LAYOUT_KEY = "textEditor.layout"; // remembers pages / pageless per browser
const MAX_IMAGE_DIMENSION = 1600; // larger uploads are scaled down before embedding

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

// ---------------------------------------------------------------------------
// Images
// Custom inline image node (no extra package). Images sit in the text flow,
// so the alignment buttons center / right-align them like Docs. Drag the
// corner handle of a selected image to resize it.
// ---------------------------------------------------------------------------
function ImageView({ node, selected, updateAttributes, editor }) {
  const imgRef = useRef(null);
  const [liveWidth, setLiveWidth] = useState(null);
  const { src, alt, title, width } = node.attrs;
  const canResize = selected && editor.isEditable;

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current.getBoundingClientRect().width;
    const maxWidth = imgRef.current.closest(".ProseMirror")?.clientWidth ?? Infinity;
    let latest = startWidth;

    const onMove = (ev) => {
      latest = Math.min(maxWidth, Math.max(32, startWidth + ev.clientX - startX));
      setLiveWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setLiveWidth(null);
      updateAttributes({ width: Math.round(latest) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <NodeViewWrapper as="span" className={canResize ? "te-image selected" : "te-image"}>
      <img
        ref={imgRef}
        src={src}
        alt={alt || ""}
        title={title || undefined}
        width={liveWidth ?? width ?? undefined}
        draggable={false}
      />
      {canResize && <span className="te-image-handle" onPointerDown={startResize} />}
    </NodeViewWrapper>
  );
}

const InlineImage = Node.create({
  name: "image",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (element) => {
          const w = parseInt(element.getAttribute("width") || element.style.width, 10);
          return Number.isFinite(w) ? w : null;
        },
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

// File -> data URL. Big photos are scaled down first so the saved document
// doesn't balloon; GIF/SVG are left alone (re-encoding would break them).
function readImageFile(file, maxDimension = MAX_IMAGE_DIMENSION) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = reader.result;
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return resolve(dataUrl);

      const img = new window.Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1) return resolve(dataUrl);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.85));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// Insert image files at `pos` (drops) or at the cursor (toolbar / paste).
async function insertImageFiles(editor, files, pos = null) {
  let at = pos;
  for (const file of files) {
    try {
      const src = await readImageFile(file);
      const content = { type: "image", attrs: { src, alt: file.name.replace(/\.[^.]+$/, "") } };
      const chain = editor.chain().focus();
      (at != null ? chain.insertContentAt(at, content) : chain.insertContent(content)).run();
      at = null; // any further files follow the cursor
    } catch (err) {
      console.error("Could not insert image:", err);
    }
  }
}

const imageFilesFrom = (list) =>
  Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

function readStoredLayout() {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === "pageless" ? "pageless" : "pages";
  } catch {
    return "pages";
  }
}

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
  const editorRef = useRef(null); // lets the paste/drop handlers reach the editor
  const [layout, setLayout] = useState(readStoredLayout); // "pages" | "pageless"

  const editor = useEditor({
    extensions: [
      // StarterKit 3 already bundles Link and Underline; they're added (and
      // configured) below, so turn the built-in copies off to avoid duplicates.
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
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
      InlineImage,
    ],
    content: content || "",
    editable,
    editorProps: {
      // Pasted screenshots / dropped files become images.
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        insertImageFiles(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false; // moving existing content around
        const files = imageFilesFrom(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
        insertImageFiles(editorRef.current, files, pos);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

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

  function changeLayout(next) {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }

  if (!editor) return null;

  const rootClass = !editable
    ? "text-editor read-only"
    : layout === "pageless"
    ? "text-editor pageless"
    : "text-editor";

  return (
    <div className={rootClass}>
      {editable && <Toolbar editor={editor} layout={layout} onLayoutChange={changeLayout} />}
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
  minus: (<path d="M5 12h14" />),
  plus: (<><path d="M5 12h14" /><path d="M12 5v14" /></>),
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
  image: (<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" /></>),
  page: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>),
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

// Attributes of the first paragraph/heading in the selection. With Select All
// (or a drag across blocks) the selection's parent is the doc itself, so
// looking at $from.parent alone would miss the real paragraph.
function getBlockAttrs(editor) {
  const { selection, doc } = editor.state;
  let attrs = null;
  doc.nodesBetween(selection.from, selection.to, (node) => {
    if (attrs) return false;
    if (node.isTextblock) {
      attrs = node.attrs;
      return false;
    }
  });
  return attrs ?? selection.$from.parent.attrs;
}

// "14pt" / "18.6667px" -> 14 (pt). Anything else (em, %, ...) -> null.
function toPt(value) {
  if (!value) return null;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return null;
  const unit = String(value).trim().replace(/^[\d.\s]+/, "");
  if (unit === "pt") return n;
  if (unit === "px") return Math.round(n * 0.75 * 2) / 2;
  return null;
}

// Toolbar component for the text editor
function Toolbar({ editor, layout, onLayoutChange }) {
  // Tiptap 3's useEditor doesn't re-render on every transaction, so read the
  // toolbar state through useEditorState to keep it in sync with the cursor.
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      const block = getBlockAttrs(editor); // paragraph/heading under the cursor / selection
      const textStyle = editor.getAttributes("textStyle");
      const heading = [1, 2, 3].find((level) => editor.isActive("heading", { level })) ?? 0;
      return {
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
        heading,
        fontFamily: textStyle.fontFamily || "",
        fontSize: toPt(textStyle.fontSize) ?? HEADING_FONT_SIZES[heading] ?? DEFAULT_FONT_SIZE,
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
    // The page default (first entry) clears the mark rather than storing it.
    if (!value || value === FONT_FAMILIES[0].value) editor.chain().focus().unsetFontFamily().run();
    else editor.chain().focus().setFontFamily(value).run();
  }

  function changeLineSpacing(e) {
    // setLineSpacing writes the paragraph/heading attribute (see LineSpacing above).
    editor.chain().focus().setLineSpacing(e.target.value).run();
  }

  function applyFontSize(n, refocus = true) {
    const size = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(n * 2) / 2));
    const chain = refocus ? editor.chain().focus() : editor.chain();
    chain.setFontSize(`${size}pt`).run();
  }

  function stepFontSize(direction, refocus = true) {
    const current = s.fontSize;
    const next =
      direction > 0
        ? FONT_SIZE_STEPS.find((v) => v > current)
        : [...FONT_SIZE_STEPS].reverse().find((v) => v < current);
    applyFontSize(next ?? current + direction, refocus);
  }

  // Selects must always have a matching <option>; add one for values that
  // aren't in our lists (e.g. pasted content).
  const knownFont = s.fontFamily
    ? FONT_FAMILIES.find((f) => normFont(f.value) === normFont(s.fontFamily))
    : FONT_FAMILIES[0]; // no font mark = the page default
  const fontValue = knownFont ? knownFont.value : s.fontFamily;
  const knownLineHeight = LINE_HEIGHTS.some((l) => l.value === s.lineHeight);

  return (
    // Toolbar UI with buttons and dropdowns for formatting.
    // Two tidy rows; one single row when the editor is wide enough (see CSS).
    <div className="toolbar-shell">
      <div className="toolbar" role="toolbar" aria-label="Text formatting">
        <div className="toolbar-row">
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
              className="w-styles"
              value={String(s.heading)}
              onChange={changeHeading}
            >
              <option value="0">Normal text</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </SelectControl>

            <SelectControl title="Font" className="w-font" value={fontValue} onChange={changeFont}>
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
              {!knownFont && (
                <option value={s.fontFamily}>
                  {s.fontFamily.split(",")[0].replace(/['"]/g, "").trim()}
                </option>
              )}
            </SelectControl>

            <FontSizeControl
              size={s.fontSize}
              onStep={stepFontSize}
              onCommit={applyFontSize}
              onCancel={() => editor.commands.focus()}
            />

            <SelectControl
              title="Line & paragraph spacing"
              className="w-spacing"
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
        </div>

        <div className="toolbar-row">
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
            <ImageMenu editor={editor} />
          </div>

          <div className="toolbar-group">
            <ToolbarButton
              icon="clear"
              title="Clear formatting"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            />
          </div>

          <div className="toolbar-group toolbar-group--end">
            <SelectControl
              title="Page layout"
              className="w-layout"
              icon="page"
              value={layout}
              onChange={(e) => onLayoutChange(e.target.value)}
            >
              <option value="pages">Pages</option>
              <option value="pageless">Pageless</option>
            </SelectControl>
          </div>
        </div>
      </div>
    </div>
  );
}

// `active` is only passed for toggle buttons (it drives aria-pressed).
// `expanded` is for buttons that open a menu.
function ToolbarButton({ active, expanded, disabled, onClick, icon, title }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : "menu"}
      disabled={disabled}
      // keep focus (and the visible selection) in the editor while clicking
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={active || expanded ? "toolbar-btn active" : "toolbar-btn"}
    >
      <Icon name={icon} />
    </button>
  );
}

// Borderless native <select> with a chevron, styled like the Docs dropdowns.
function SelectControl({ title, icon, className, value, onChange, children }) {
  const classes = ["toolbar-select", icon && "has-icon", className].filter(Boolean).join(" ");
  return (
    <label className={classes} title={title}>
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

// Docs-style text size: [-] [ 11 ] [+]. The box takes any number (Enter or
// leaving the box applies it, Esc cancels); - / + walk FONT_SIZE_STEPS.
function FontSizeControl({ size, onStep, onCommit, onCancel }) {
  const [draft, setDraft] = useState(null);
  const draftRef = useRef(null); // current draft, readable from blur handlers

  function updateDraft(value) {
    draftRef.current = value;
    setDraft(value);
  }

  function commit(refocus) {
    const value = draftRef.current;
    if (value === null) return;
    updateDraft(null);
    const n = parseFloat(value);
    if (Number.isFinite(n)) onCommit(n, refocus);
    else if (refocus) onCancel();
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (draftRef.current === null) onCancel();
      else commit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      updateDraft(null);
      onCancel();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      updateDraft(null);
      onStep(e.key === "ArrowUp" ? 1 : -1, false); // keep focus in the box
    }
  }

  return (
    <div className="font-size-control" role="group" aria-label="Font size">
      <button
        type="button"
        className="toolbar-btn size-step"
        title="Decrease font size"
        aria-label="Decrease font size"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onStep(-1)}
      >
        <Icon name="minus" size={16} />
      </button>
      <input
        className="size-input"
        type="text"
        inputMode="decimal"
        title="Font size"
        aria-label="Font size"
        value={draft ?? String(size)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => updateDraft(e.target.value)}
        onBlur={() => commit(false)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="toolbar-btn size-step"
        title="Increase font size"
        aria-label="Increase font size"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onStep(1)}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

// Insert image: upload from the computer or by URL. (Pasting or dropping an
// image into the page also works.)
function ImageMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onFilesPicked(e) {
    const files = imageFilesFrom(e.target.files);
    e.target.value = ""; // allow picking the same file again
    if (files.length) insertImageFiles(editor, files);
  }

  function insertByUrl() {
    setOpen(false);
    const url = window.prompt("Image URL", "https://");
    if (!url || url === "https://") return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  }

  return (
    <div className="toolbar-menu-wrap" ref={wrapRef}>
      <ToolbarButton
        icon="image"
        title="Insert image"
        expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="toolbar-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              fileRef.current?.click();
            }}
          >
            Upload from computer
          </button>
          <button type="button" role="menuitem" onClick={insertByUrl}>
            By URL
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onFilesPicked}
      />
    </div>
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

