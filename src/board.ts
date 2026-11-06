export interface Column {
  title: string;
  cards: string[];
}

export interface Board {
  frontmatter: string;
  settings: string;
  columns: Column[];
}

const CARD = /^- \[[ xX]\] /;

export function parseBoard(content: string): Board {
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n?/);
  const frontmatter = frontmatterMatch ? frontmatterMatch[0] : "";
  let rest = frontmatter ? content.slice(frontmatter.length) : content;

  const settingsMatch = rest.match(/%% kanban:settings[\s\S]*?%%\s*$/);
  const settings = settingsMatch ? settingsMatch[0].trimEnd() : "";
  if (settingsMatch && settingsMatch.index !== undefined) {
    rest = rest.slice(0, settingsMatch.index);
  }

  const columns: Column[] = [];
  let current: Column | null = null;
  for (const line of rest.split("\n")) {
    if (line.startsWith("## ")) {
      current = { title: line.slice(3).trim(), cards: [] };
      columns.push(current);
      continue;
    }
    if (current && CARD.test(line)) {
      current.cards.push(line);
    }
  }

  return { frontmatter: frontmatter.trimEnd(), settings, columns };
}

export function serializeBoard(board: Board): string {
  const parts: string[] = [];
  if (board.frontmatter) parts.push(board.frontmatter, "");
  for (const column of board.columns) {
    parts.push(`## ${column.title}`, "");
    for (const card of column.cards) parts.push(card);
    parts.push("");
  }
  if (board.settings) parts.push(board.settings, "");
  return parts.join("\n");
}

export function isBoardFile(content: string): boolean {
  return /^---\n[\s\S]*?kanban-plugin:\s*board[\s\S]*?\n---/.test(content);
}
