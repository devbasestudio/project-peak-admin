import type { ReactNode } from "react";

function inline(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) parts.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("_")) parts.push(<em key={`${match.index}-i`}>{token.slice(1, -1)}</em>);
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) parts.push(<a key={`${match.index}-a`} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.startsWith("### ")) { blocks.push(<h3 key={index}>{inline(line.slice(4))}</h3>); index += 1; continue; }
    if (line.startsWith("## ")) { blocks.push(<h2 key={index}>{inline(line.slice(3))}</h2>); index += 1; continue; }
    if (line.startsWith("> ")) { blocks.push(<blockquote key={index}>{inline(line.slice(2))}</blockquote>); index += 1; continue; }
    if (/^-\s+/.test(line)) {
      const items: ReactNode[] = [];
      const start = index;
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(<li key={index}>{inline(lines[index].trim().replace(/^-\s+/, ""))}</li>);
        index += 1;
      }
      blocks.push(<ul key={`ul-${start}`}>{items}</ul>);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      const start = index;
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(<li key={index}>{inline(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>);
        index += 1;
      }
      blocks.push(<ol key={`ol-${start}`}>{items}</ol>);
      continue;
    }
    const paragraph: string[] = [line];
    const start = index;
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(##? |### |> |-\s+|\d+\.\s+)/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={start}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className={className}>{blocks}</div>;
}
