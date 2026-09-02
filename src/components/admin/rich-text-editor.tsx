"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold, Heading2, Italic, Link2, List, ListOrdered, Quote,
} from "lucide-react";

const HTML_PATTERN = /^\s*<(?:p|h2|h3|ul|ol|blockquote|div|strong|em|a|br)\b/i;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function legacyInline(value: string) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)]\(((?:https?:\/\/|mailto:)[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

export function normalizeRichTextContent(value: string) {
  if (!value.trim() || HTML_PATTERN.test(value)) return value;
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.startsWith("## ")) { blocks.push(`<h2>${legacyInline(line.slice(3))}</h2>`); index += 1; continue; }
    if (line.startsWith("> ")) { blocks.push(`<blockquote>${legacyInline(line.slice(2))}</blockquote>`); index += 1; continue; }
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(`<li>${legacyInline(lines[index].trim().replace(/^-\s+/, ""))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${legacyInline(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    blocks.push(`<p>${legacyInline(line)}</p>`);
    index += 1;
  }
  return blocks.join("");
}

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  fullscreen: boolean;
};

export function RichTextEditor({ value, onChange, fullscreen }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const [activeEffects, setActiveEffects] = useState<Set<string>>(() => new Set());

  const updateActiveEffects = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    if (!editor || !anchor || !editor.contains(anchor)) return;

    const block = String(document.queryCommandValue("formatBlock") || "")
      .toLowerCase().replace(/[<>]/g, "");
    const anchorElement = anchor.nodeType === Node.ELEMENT_NODE
      ? anchor as Element
      : anchor.parentElement;
    const next = new Set<string>();
    if (document.queryCommandState("bold")) next.add("bold");
    if (document.queryCommandState("italic")) next.add("italic");
    if (document.queryCommandState("insertUnorderedList")) next.add("unordered");
    if (document.queryCommandState("insertOrderedList")) next.add("ordered");
    if (block === "h2") next.add("h2");
    if (block === "blockquote") next.add("quote");
    if (anchorElement?.closest("a")) next.add("link");
    setActiveEffects((current) => {
      if (current.size === next.size && [...current].every((effect) => next.has(effect))) return current;
      return next;
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveEffects);
    return () => document.removeEventListener("selectionchange", updateActiveEffects);
  }, [updateActiveEffects]);

  function bindEditor(node: HTMLDivElement | null) {
    editorRef.current = node;
    if (node && !hydratedRef.current) {
      node.innerHTML = value;
      hydratedRef.current = true;
    }
  }

  function sync() {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll("a").forEach((anchor) => {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    });
    onChange(editorRef.current.innerHTML);
    editorRef.current.focus();
    updateActiveEffects();
  }

  function command(name: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    sync();
  }

  function addLink() {
    const entered = window.prompt("Link URL ထည့်ပါ", "https://");
    if (!entered || entered === "https://") return;
    const url = /^(https?:\/\/|mailto:)/i.test(entered) ? entered : `https://${entered}`;
    command("createLink", url);
  }

  function toggleBlock(tag: "h2" | "blockquote") {
    const current = String(document.queryCommandValue("formatBlock") || "")
      .toLowerCase().replace(/[<>]/g, "");
    command("formatBlock", current === tag ? "p" : tag);
  }

  function buttonClass(effect: string) {
    return `grid h-11 min-w-11 place-items-center rounded-xl border px-2 transition ${activeEffects.has(effect)
      ? "border-sky-300 bg-sky-100 text-sky-800 shadow-sm"
      : "border-transparent text-[#07131c] hover:border-black/8 hover:bg-white focus-visible:bg-white"}`;
  }

  return <>
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t-2xl border border-black/10 bg-[#f7f8f7] p-2 shadow-sm" aria-label="စာကိုယ် format toolbar">
      <button type="button" title="ခေါင်းစဉ်" aria-label="ခေါင်းစဉ်" aria-pressed={activeEffects.has("h2")} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleBlock("h2")} className={buttonClass("h2")}><Heading2 size={18} /></button>
      <button type="button" title="စာလုံးထူ" aria-label="စာလုံးထူ" aria-pressed={activeEffects.has("bold")} onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")} className={buttonClass("bold")}><Bold size={18} /></button>
      <button type="button" title="စာလုံးစောင်း" aria-label="စာလုံးစောင်း" aria-pressed={activeEffects.has("italic")} onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")} className={buttonClass("italic")}><Italic size={18} /></button>
      <span className="mx-1 h-8 w-px bg-black/10" />
      <button type="button" title="Bullet list" aria-label="Bullet list" aria-pressed={activeEffects.has("unordered")} onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")} className={buttonClass("unordered")}><List size={19} /></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={activeEffects.has("ordered")} onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")} className={buttonClass("ordered")}><ListOrdered size={19} /></button>
      <button type="button" title="Quote" aria-label="Quote" aria-pressed={activeEffects.has("quote")} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleBlock("blockquote")} className={buttonClass("quote")}><Quote size={18} /></button>
      <button type="button" title="Link" aria-label="Link" aria-pressed={activeEffects.has("link")} onMouseDown={(event) => event.preventDefault()} onClick={addLink} className={buttonClass("link")}><Link2 size={18} /></button>
      <span className="ml-auto hidden px-2 text-[10px] font-semibold text-black/40 sm:block">စာကိုရွေးပြီး format ခလုတ်နှိပ်ပါ</span>
    </div>
    <div
      ref={bindEditor}
      id="content-editor"
      role="textbox"
      aria-label="စာကိုယ်"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder="စာကို ဒီမှာစရေးပါ…"
      onInput={(event) => { onChange(event.currentTarget.innerHTML); updateActiveEffects(); }}
      onKeyUp={updateActiveEffects}
      onMouseUp={updateActiveEffects}
      className="admin-input overflow-y-auto rounded-t-none border-t-0 bg-white text-[17px] leading-9 empty:before:pointer-events-none empty:before:text-black/30 empty:before:content-[attr(data-placeholder)] [&_a]:font-bold [&_a]:text-sky-700 [&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-sky-400 [&_blockquote]:pl-5 [&_blockquote]:text-black/60 [&_h2]:my-6 [&_h2]:text-3xl [&_h2]:font-bold [&_h3]:my-5 [&_h3]:text-2xl [&_h3]:font-bold [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-7 [&_p]:my-3 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-7"
      style={{
        height: fullscreen ? "calc(100svh - 230px)" : "clamp(520px, 62vh, 760px)",
        minHeight: fullscreen ? 420 : 520,
      }}
    />
  </>;
}
