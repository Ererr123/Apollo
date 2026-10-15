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
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, LineHeight, FontSize } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, useState } from "react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { client } from "../api/client.js";
import "./textEditor.css";

// Constants for font families, line heights, and font sizes
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
const DEFAULT_HIGHLIGHT_COLOR = "#ffff00";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const LAYOUT_KEY = "textEditor.layout"; // remembers pages / pageless per browser
const MAX_IMAGE_DIMENSION = 1600; // larger uploads are scaled down before embedding

// Custom extension for paragraph spacing (space before and after paragraphs)
const ParagraphSpacing = Extension.create({
  name: "paragraphSpacing",
  addOptions() {
    return {
      types: ["paragraph", "heading", "bulletList", "orderedList", "taskList"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          spaceBefore: {
            default: null,
            renderHTML: (attributes) => {
              if (!attributes.spaceBefore) return {};
              return { style: `margin-top: ${attributes.spaceBefore}` };
            },
            parseHTML: (element) => element.style.marginTop || null,
          },
          spaceAfter: {
            default: null,
            renderHTML: (attributes) => {
              if (!attributes.spaceAfter) return {};
              return { style: `margin-bottom: ${attributes.spaceAfter}` };
            },
            parseHTML: (element) => element.style.marginBottom || null,
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setParagraphSpacing:
        (spacing) =>
        ({ commands }) =>
          this.options.types.every((type) =>
            commands.updateAttributes(type, spacing)
          ),
    };
  },
});

// Custom Page Break node to support actual page breaks in page mode
const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "div.page-break" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "page-break" })];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

// Pagination plugin: measures the document and inserts spacers to make the content fit on pages. 
// The spacers are decoration widgets, not real nodes, so they don't affect the document model or the undo history. 
// The plugin also reports how many pages are needed via the onPages callback.
const paginationKey = new PluginKey("tePagination");
const SPLITTABLE = new Set(["bulletList", "orderedList", "taskList", "listItem", "taskItem"]);
const FIT_TOLERANCE = 0.5; // px

// Page size comes from CSS (--te-page-h / --te-margin-y / --te-page-gap) so the
// sheets and the maths can't drift apart. Null = don't paginate (small screens).
function readPageGeometry(dom) {
  if (window.matchMedia?.("(max-width: 800px)").matches) return null;
  const style = window.getComputedStyle(dom);
  const px = (name, fallback) => {
    const n = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(n) ? n : fallback;
  };
  const pageHeight = px("--te-page-h", 1056);
  const margin = px("--te-margin-y", 96);
  const gap = px("--te-page-gap", 24);
  const content = pageHeight - 2 * margin;
  return content > 0 ? { period: pageHeight + gap, content } : null;
}

// Walks the document with the spacers hidden ("natural" layout) and returns
// where spacers are needed: [{ pos, h }], plus the number of pages.
function computeBreaks(view, { period, content }) {
  const base = view.dom.getBoundingClientRect().top;
  const breaks = [];
  let shift = 0; // total spacer height added so far
  let page = 0; // page the next block lands on
  let placed = false; // is there anything on the current page yet?
  let forceBreak = false; // a page-break node was just passed
  let lastBottom = 0;

  const limit = () => page * period + content + FIT_TOLERANCE;

  function measure(pos) {
    const el = view.nodeDOM(pos);
    if (!(el instanceof HTMLElement)) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top - base,
      bottom: rect.bottom - base,
      marginBottom: parseFloat(window.getComputedStyle(el).marginBottom) || 0,
    };
  }

  // Spacer in front of `pos`: lands the next block exactly on the next page's
  // first line. prevEnd = where the previous sibling's margin box ends.
  function breakBefore(pos, prevEnd) {
    const h = Math.max(0, Math.round((page + 1) * period - (prevEnd + shift)));
    breaks.push({ pos, h });
    shift += h;
    page += 1;
    placed = false;
  }

  function visit(node, pos, prevEnd) {
    const m = measure(pos);
    if (!m) return prevEnd;
    const end = m.bottom + m.marginBottom;

    if (forceBreak) {
      forceBreak = false;
      breakBefore(pos, prevEnd);
    }
    if (node.type.name === "pageBreak") {
      placed = true;
      forceBreak = true;
      lastBottom = Math.max(lastBottom, m.bottom);
      return end;
    }

    const fits = () => m.bottom + shift <= limit();
    if (fits()) {
      placed = true;
      lastBottom = Math.max(lastBottom, m.bottom);
      return end;
    }

    // Doesn't fit on this page. Lists can be split between their items, so if
    // at least the first item fits we keep the list here and split inside it.
    const splittable = SPLITTABLE.has(node.type.name) && node.childCount > 1;
    if (placed) {
      const first = splittable ? measure(pos + 1) : null;
      const firstFits = first && first.bottom + shift <= limit();
      if (!firstFits) breakBefore(pos, prevEnd);
    }
    if (fits()) {
      placed = true;
      lastBottom = Math.max(lastBottom, m.bottom);
      return end;
    }
    if (splittable) {
      let prev = m.top;
      node.forEach((child, offset) => {
        prev = visit(child, pos + 1 + offset, prev);
      });
      lastBottom = Math.max(lastBottom, m.bottom);
      return end;
    }

    // Taller than a whole page and not splittable: let it run over, then carry
    // on from the page where it ends.
    placed = true;
    lastBottom = Math.max(lastBottom, m.bottom);
    const finalBottom = m.bottom + shift;
    if (finalBottom > limit()) page = Math.max(page, Math.floor(finalBottom / period));
    return end;
  }

  let prevEnd = 0;
  view.state.doc.forEach((node, offset) => {
    prevEnd = visit(node, offset, prevEnd);
  });
  const pages = Math.max(page + 1, Math.floor(Math.max(0, lastBottom + shift - 1) / period) + 1);
  return { breaks, pages };
}

const breaksSignature = (breaks) => breaks.map((b) => `${b.pos}:${b.h}`).join(",");

function makeSpacer(height) {
  const el = document.createElement("div");
  el.className = "te-page-spacer";
  el.style.height = `${height}px`;
  el.setAttribute("contenteditable", "false");
  el.setAttribute("aria-hidden", "true");
  return el;
}

const Pagination = Extension.create({
  name: "pagination",

  addOptions() {
    return {
      isEnabled: () => true, // paginate only in "pages" layout
      onPages: null, // (count) => void, drives how many sheets are drawn
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: paginationKey,
        state: {
          init: () => ({ breaks: [], pages: 1, sig: "", decos: DecorationSet.empty }),
          apply(tr, value) {
            const meta = tr.getMeta(paginationKey);
            if (meta?.breaks) {
              return {
                breaks: meta.breaks,
                pages: meta.pages,
                sig: breaksSignature(meta.breaks),
                decos: DecorationSet.create(
                  tr.doc,
                  meta.breaks.map((b) =>
                    Decoration.widget(b.pos, () => makeSpacer(b.h), {
                      side: -1,
                      key: `pg-${b.pos}-${b.h}`,
                      ignoreSelection: true,
                    })
                  )
                ),
              };
            }
            if (tr.docChanged) {
              // keep the spacers glued to their blocks until the next measurement
              const breaks = value.breaks.map((b) => ({ ...b, pos: tr.mapping.map(b.pos) }));
              return {
                ...value,
                breaks,
                sig: breaksSignature(breaks),
                decos: value.decos.map(tr.mapping, tr.doc),
              };
            }
            return value;
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state).decos,
        },
        view(view) {
          let frame = 0;
          let destroyed = false;
          let lastPages = null;

          const run = () => {
            frame = 0;
            if (destroyed || view.isDestroyed) return;
            const geometry = options.isEnabled?.() === false ? null : readPageGeometry(view.dom);
            let result = { breaks: [], pages: 1 };
            if (geometry) {
              // hide the spacers while measuring so we see the natural layout
              const host = view.dom.parentElement;
              host?.classList.add("te-measuring");
              try {
                result = computeBreaks(view, geometry);
              } finally {
                host?.classList.remove("te-measuring");
              }
            }
            const state = paginationKey.getState(view.state);
            if (breaksSignature(result.breaks) !== state.sig || result.pages !== state.pages) {
              view.dispatch(
                view.state.tr.setMeta(paginationKey, result).setMeta("addToHistory", false)
              );
            }
            if (result.pages !== lastPages) {
              lastPages = result.pages;
              options.onPages?.(result.pages);
            }
          };
          const schedule = () => {
            if (!frame && !destroyed) frame = requestAnimationFrame(run);
          };

          // edits are covered by update(); resizes, late-loading fonts and
          // images change the layout without a transaction
          const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
          observer?.observe(view.dom);
          view.dom.addEventListener("load", schedule, true);
          document.fonts?.ready?.then(schedule);
          schedule();

          return {
            update: schedule,
            destroy() {
              destroyed = true;
              cancelAnimationFrame(frame);
              observer?.disconnect();
              view.dom.removeEventListener("load", schedule, true);
            },
          };
        },
      }),
    ];
  },
});

// Ask the plugin to re-measure (e.g. after switching between pages / pageless).
function requestPagination(editor) {
  if (!editor?.view || editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(paginationKey, { refresh: true }).setMeta("addToHistory", false)
  );
}

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

// Custom inline image node with resizable functionality
function ImageView({ node, selected, updateAttributes, editor }) {
  const imgRef = useRef(null);
  const [liveWidth, setLiveWidth] = useState(null);
  const { src, alt, title, width } = node.attrs;
  const canResize = selected && editor.isEditable;

  // Handle live width updates for resizing the image
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

//Upload image file to the server and return the URL instead of using a local data URL
// async function uploadImageFile(file, maxDimension = MAX_IMAGE_DIMENSION) {
//   // Optional: compress client-side first to save bandwidth and storage costs
//   const compressedFile = await compressImageIfNeeded(file, maxDimension);
  
//   const formData = new FormData();
//   formData.append("image", compressedFile);

//   const response = await client.uploadImage(formData); // Implement this in your API client
//   return response.url; // Returns e.g. "/uploads/xyz.png" or a CDN URL
// }

// Insert image files at `pos` (drops) or at the cursor (toolbar / paste).
async function insertImageFiles(editor, files, pos = null) {
  let at = pos;
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append("image", file);

      // Upload to your server endpoint
      const { url } = await client.uploadImage(formData);

      const content = { 
        type: "image", 
        attrs: { src: url, alt: file.name.replace(/\.[^.]+$/, "") } 
      };
      
      const chain = editor.chain().focus();
      (at != null ? chain.insertContentAt(at, content) : chain.insertContent(content)).run();
      at = null; 
    } catch (err) {
      console.error("Could not upload and insert image:", err);
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

// EditorInstance component handles the actual editor logic and rendering.
function EditorInstance({content, onChange, editable = true, documentKey}) {
  const editorRef = useRef(null);
  const [layout, setLayout] = useState(readStoredLayout);
  const [pageCount, setPageCount] = useState(1); // sheets to draw in "pages" layout
  const pagedRef = useRef(false); // read by the pagination plugin
  pagedRef.current = editable && layout === "pages";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Highlight.configure({ multicolor: true }),
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
      ParagraphSpacing,
      PageBreak,
      InlineImage,
      Pagination.configure({ isEnabled: () => pagedRef.current, onPages: setPageCount }),
    ],
    content: content || "",
    editable,
    editorProps: {
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        insertImageFiles(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false;
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

  useEffect(() => {
    if (!editor) return;
    // Loading a document must not become an undo step: otherwise Ctrl+Z right after
    // opening document B brings back document A's text (and fires onChange with it).
    editor.chain().setMeta("addToHistory", false).setContent(content || "", false).run();
  }, [editor, documentKey]);

  useEffect(() => {
    if (!editor || editor.isEditable === editable) return;
    editor.setEditable(editable, false);
  }, [editor, editable]);

  // re-measure when switching between pages / pageless
  useEffect(() => {
    requestPagination(editor);
  }, [editor, editable, layout]);

  function changeLayout(next) {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {}
  }

  if (!editor) return null;

  const paged = editable && layout === "pages";
  const rootClass = !editable
    ? "text-editor read-only"
    : layout === "pageless"
    ? "text-editor pageless"
    : "text-editor paged-mode";

  return (
    <div className={rootClass}>
      {editable && <Toolbar editor={editor} layout={layout} onLayoutChange={changeLayout} />}
      <div className="page-canvas">
        {/* The paper: white sheets (decoration only) behind the real editor */}
        <div className="te-paper" style={{ "--te-pages": pageCount }}>
          {paged && (
            <div className="te-sheets" aria-hidden="true">
              {Array.from({ length: pageCount }, (_, i) => (
                <div key={i} className="te-sheet" />
              ))}
            </div>
          )}
          <div className="text-editor-content">
            <EditorContent editor={editor} className="te-host" />
          </div>
        </div>
      </div>
      {editable && <StatusBar editor={editor} pages={paged ? pageCount : null} />}
    </div>
  );
}

// Icons (inline SVG, 24x24 grid, Lucide-style strokes)
const ICONS = {
  undo: (<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>),
  redo: (<><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>),
  minus: (<path d="M5 12h14" />),
  plus: (<><path d="M5 12h14" /><path d="M12 5v14" /></>),
  bold: (<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />),
  italic: (<><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" /></>),
  underline: (<><path d="M6 4v6a6 6 0 0 0 12 0V4" /><path d="M4 20h16" /></>),
  strike: (<><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><path d="M4 12h16" /></>),
  highlight: (<><path d="m9 11-6 6v3h3l6-6" /><path d="m22 7-4-4-10 10 4 4z" /></>),
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

// Toolbar component for the text editor

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
        highlight: editor.isActive("highlight"),
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

  // Inside Toolbar component, update the line spacing select to include paragraph spacing triggers or choices:
  function changeLineSpacing(e) {
    const value = e.target.value;
    if (value === "add-space") {
      editor.chain().focus().setParagraphSpacing({ spaceAfter: "12px" }).run();
    } else if (value === "remove-space") {
      editor.chain().focus().setParagraphSpacing({ spaceAfter: "0px" }).run();
    } else {
      editor.chain().focus().setLineSpacing(value).run();
    }
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
              <optgroup label="Line Spacing">
                {LINE_HEIGHTS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Paragraph Spacing">
                <option value="add-space">Add space after paragraph</option>
                <option value="remove-space">Remove space after paragraph</option>
              </optgroup>
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
            <HighlightButton
              active={s.highlight}
              onChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
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
            <ToolbarButton
              icon="page"
              title="Insert page break"
              onClick={() => editor.chain().focus().setPageBreak().run()}
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
  
  // The input is a controlled component, but we don't want to update the value
  // on every keystroke (that would make it hard to type a decimal number). So
  // we keep a draft state that is only committed on blur or Enter.
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

  // The menu is a simple <div> with buttons, not a real <menu> or <ul>, so we don't need to manage focus or keyboard navigation. 
  // The buttons are just for mouse users; keyboard users can paste or drop an image, or use the "Insert link" button to add an image by URL.
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

// Highlight button with native color picker overlay
function HighlightButton({ active, onChange }) {
  return (
    <label className="toolbar-btn color-btn" title="Highlight color">
      <Icon name="highlight" />
      <span className="color-bar" style={{ backgroundColor: DEFAULT_HIGHLIGHT_COLOR }} />
      <input
        type="color"
        className="color-input"
        aria-label="Highlight color"
        value={DEFAULT_HIGHLIGHT_COLOR}
        onChange={(e) => onChange(e.target.value)}
      />
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

// Count words and characters in a range of the document. Spaces between blocks
// count as spaces so words in different paragraphs don't merge. Returns an object
// with { words, chars, charsNoSpaces }.
function countRange(doc, from, to) {
  // block boundaries count as spaces so words in different paragraphs don't merge
  const spaced = doc.textBetween(from, to, " ", " ").trim();
  const raw = doc.textBetween(from, to, "", "");
  return {
    words: spaced ? spaced.split(/\s+/).length : 0,
    chars: raw.length,
    charsNoSpaces: raw.replace(/\s/g, "").length,
  };
}

const formatNumber = (n) => new Intl.NumberFormat().format(n);
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;

// Shows totals, and "x of y" while text is selected (like Docs).
function StatusBar({ editor, pages }) {
  const cache = useRef({ doc: null, totals: null }); // totals only change when the doc does
  const stats = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { doc, selection } = editor.state;
      if (cache.current.doc !== doc) {
        cache.current = { doc, totals: countRange(doc, 0, doc.content.size) };
      }
      let selected = null;
      if (!selection.empty) {
        const part = countRange(doc, selection.from, selection.to);
        if (part.chars > 0) selected = part;
      }
      return { ...cache.current.totals, selected };
    },
  });

  const { words, chars, charsNoSpaces, selected } = stats;
  return (
    <div className="te-status">
      <span>
        {selected ? `${formatNumber(selected.words)} of ${plural(words, "word")}` : plural(words, "word")}
      </span>
      <span aria-hidden="true">·</span>
      <span title={`${plural(selected ? selected.charsNoSpaces : charsNoSpaces, "character")} without spaces`}>
        {selected
          ? `${formatNumber(selected.chars)} of ${plural(chars, "character")}`
          : plural(chars, "character")}
      </span>
      {pages !== null && (
        <>
          <span aria-hidden="true">·</span>
          <span>{plural(pages, "page")}</span>
        </>
      )}
    </div>
  );
}