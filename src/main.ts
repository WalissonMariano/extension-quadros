import {
  ItemView,
  MarkdownView,
  Plugin,
  TFile,
  WorkspaceLeaf,
  ViewStateResult,
} from "obsidian";
import { Board, isBoardFile, parseBoard, serializeBoard } from "./board";

export const VIEW_TYPE_QUADRO = "quadro";

export default class QuadroPlugin extends Plugin {
  private markdownPaths = new Set<string>();
  private promoting = new Set<string>();

  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_QUADRO, (leaf) => new QuadroView(leaf, this));

    this.addCommand({
      id: "abrir-quadro",
      name: "Abrir como quadro",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.markdownPaths.has(file.path)) return false;
        if (!checking) {
          this.markdownPaths.delete(file.path);
          void this.promoteLeaf(this.app.workspace.getMostRecentLeaf());
        }
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        void this.promoteLeaf(leaf);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.iterateAllLeaves((leaf) => {
        void this.promoteLeaf(leaf);
      });
    });
  }

  allowMarkdown(path: string): void {
    this.markdownPaths.add(path);
  }

  private async promoteLeaf(leaf: WorkspaceLeaf | null): Promise<void> {
    if (!leaf) return;
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return;
    const file = view.file;
    if (!file || this.markdownPaths.has(file.path) || this.promoting.has(file.path)) return;
    const content = await this.app.vault.cachedRead(file);
    if (!isBoardFile(content)) return;
    this.promoting.add(file.path);
    try {
      await leaf.setViewState({
        type: VIEW_TYPE_QUADRO,
        state: { file: file.path },
      });
    } finally {
      this.promoting.delete(file.path);
    }
  }
}

class QuadroView extends ItemView {
  private file: TFile | null = null;
  private writing = false;
  private filterText = "";
  private drawGeneration = 0;

  constructor(leaf: WorkspaceLeaf, private plugin: QuadroPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_QUADRO;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "Quadro";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async setState(state: { file?: string }, result: ViewStateResult): Promise<void> {
    if (state.file) {
      const found = this.app.vault.getAbstractFileByPath(state.file);
      this.file = found instanceof TFile ? found : null;
    }
    await super.setState(state, result);
    await this.draw();
  }

  getState(): { file?: string } {
    return { file: this.file?.path };
  }

  async onOpen(): Promise<void> {
    this.addAction("file-text", "Ver Markdown", () => {
      if (!this.file) return;
      this.plugin.allowMarkdown(this.file.path);
      void this.leaf.setViewState({
        type: "markdown",
        state: { file: this.file.path },
      });
    });

    this.registerEvent(
      this.app.vault.on("modify", (changed) => {
        if (this.writing || changed.path !== this.file?.path) return;
        void this.draw();
      })
    );

    await this.draw();
  }

  private async draw(): Promise<void> {
    const generation = ++this.drawGeneration;
    const previous = document.activeElement;
    const keepFocus = previous instanceof HTMLInputElement && previous.classList.contains("quadro-filtro");
    const cursor = keepFocus ? previous.selectionStart : null;
    const root = this.contentEl;
    if (!this.file) {
      root.empty();
      root.addClass("quadro");
      return;
    }

    const content = await this.app.vault.cachedRead(this.file);
    if (generation !== this.drawGeneration) return;

    root.empty();
    root.addClass("quadro");

    const filter = root.createEl("input", {
      cls: "quadro-filtro",
      attr: { type: "text", placeholder: "Filtrar" },
    });
    filter.value = this.filterText;
    filter.addEventListener("input", () => {
      this.filterText = filter.value;
      void this.draw();
    });

    const board = parseBoard(content);
    const sourcePath = this.file.path;
    const columnsEl = root.createDiv({ cls: "quadro-colunas" });

    board.columns.forEach((column, columnIndex) => {
      const columnEl = columnsEl.createDiv({ cls: "quadro-coluna" });
      columnEl.createEl("h3", { text: column.title });
      const cardsEl = columnEl.createDiv({ cls: "quadro-cartas" });

      column.cards.forEach((line, cardIndex) => {
        if (!this.matches(line)) return;
        const cardEl = cardsEl.createDiv({ cls: "quadro-carta" });
        cardEl.draggable = true;
        const textEl = cardEl.createDiv({ cls: "quadro-carta-texto" });
        renderCard(textEl, line, sourcePath, (link) => {
          void this.app.workspace.openLinkText(link, sourcePath);
        });
        const actions = cardEl.createDiv({ cls: "quadro-carta-acoes" });
        const edit = actions.createEl("button", { text: "Editar" });
        const remove = actions.createEl("button", { text: "Excluir" });
        edit.addEventListener("mousedown", (event) => event.stopPropagation());
        remove.addEventListener("mousedown", (event) => event.stopPropagation());
        edit.addEventListener("click", (event) => {
          event.stopPropagation();
          this.editCard(cardEl, textEl, board, columnIndex, cardIndex);
        });
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          column.cards.splice(cardIndex, 1);
          void this.save(board);
        });
        cardEl.addEventListener("dragstart", (event) => {
          if (event.target instanceof HTMLElement && event.target.closest("button, input, a")) {
            event.preventDefault();
            return;
          }
          cardEl.addClass("arrastando");
          event.dataTransfer?.setData("text/plain", `${columnIndex}:${cardIndex}`);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        });
        cardEl.addEventListener("dragend", () => cardEl.removeClass("arrastando"));
      });

      columnEl.addEventListener("dragover", (event) => {
        event.preventDefault();
        columnEl.addClass("sobre");
      });
      columnEl.addEventListener("dragleave", () => columnEl.removeClass("sobre"));
      columnEl.addEventListener("drop", (event) => {
        event.preventDefault();
        columnEl.removeClass("sobre");
        const payload = event.dataTransfer?.getData("text/plain") ?? "";
        const [fromColumn, fromCard] = payload.split(":").map((part) => Number(part));
        if (!Number.isInteger(fromColumn) || !Number.isInteger(fromCard)) return;
        if (fromColumn === columnIndex) return;
        void this.moveCard(board, fromColumn, fromCard, columnIndex);
      });

      const input = columnEl.createEl("input", {
        cls: "quadro-novo",
        attr: { type: "text", placeholder: "Novo cartão" },
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const text = input.value.trim();
        if (!text) return;
        column.cards.push(`- [ ] ${text}`);
        void this.save(board);
      });
    });

    if (keepFocus) {
      filter.focus();
      const pos = cursor ?? filter.value.length;
      filter.setSelectionRange(pos, pos);
    }
  }

  private editCard(
    cardEl: HTMLElement,
    textEl: HTMLElement,
    board: Board,
    columnIndex: number,
    cardIndex: number
  ): void {
    const line = board.columns[columnIndex]?.cards[cardIndex];
    if (!line) return;
    const prefix = line.match(/^- \[[ xX]\] /)?.[0] ?? "- [ ] ";
    textEl.empty();
    const input = textEl.createEl("input", { cls: "quadro-editar", attr: { type: "text" } });
    input.value = line.slice(prefix.length);
    input.focus();
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        void this.draw();
        return;
      }
      if (event.key !== "Enter") return;
      const text = input.value.trim();
      if (!text) return;
      board.columns[columnIndex].cards[cardIndex] = `${prefix}${text}`;
      void this.save(board);
    });
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    cardEl.draggable = false;
  }

  private matches(line: string): boolean {
    const query = fold(this.filterText.trim());
    if (!query) return true;
    return fold(line).includes(query);
  }

  private async moveCard(board: Board, fromColumn: number, fromCard: number, toColumn: number): Promise<void> {
    const source = board.columns[fromColumn];
    const target = board.columns[toColumn];
    if (!source || !target) return;
    const [card] = source.cards.splice(fromCard, 1);
    if (!card) return;
    target.cards.push(card);
    await this.save(board);
  }

  private async save(board: Board): Promise<void> {
    if (!this.file) return;
    this.writing = true;
    try {
      await this.app.vault.modify(this.file, serializeBoard(board));
    } finally {
      this.writing = false;
    }
    await this.draw();
  }
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renderCard(
  parent: HTMLElement,
  line: string,
  _sourcePath: string,
  openLink: (link: string) => void
): void {
  const body = line.replace(/^- \[[ xX]\] /, "");
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|@\{(\d{4}-\d{2}-\d{2})\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    if (match.index > last) parent.appendText(body.slice(last, match.index));
    if (match[1]) {
      const link = match[1];
      const label = match[2] || match[1];
      const anchor = parent.createEl("a", { text: label, cls: "quadro-link" });
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openLink(link);
      });
    } else if (match[3]) {
      parent.createSpan({ text: match[3], cls: "quadro-data" });
    }
    last = match.index + match[0].length;
  }
  if (last < body.length) parent.appendText(body.slice(last));
}
