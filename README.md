# Quadro

Plugin do [Obsidian](https://obsidian.md) que abre um quadro de tarefas a partir de um arquivo Markdown no formato do plugin Kanban.

Ao abrir uma nota com `kanban-plugin: board` no frontmatter, o Quadro substitui a visualização de Markdown por colunas e cartões. O arquivo continua sendo Markdown: arrastar, criar, editar e excluir cartões grava de volta na nota.

## O que dá para fazer

- Ver as seções `##` como colunas e os itens `- [ ]` como cartões.
- Arrastar um cartão para outra coluna.
- Criar um cartão no campo **Novo cartão** e confirmar com Enter.
- Editar o texto de um cartão, ou excluí-lo.
- Filtrar cartões, ignorando maiúsculas e acentos.
- Abrir links `[[nota]]` e `[[nota|rótulo]]` a partir do cartão.
- Exibir datas no formato `@{2026-11-05}`.
- Voltar ao Markdown pelo ícone **Ver Markdown** e reabrir o quadro pelo comando **Abrir como quadro**.

O frontmatter e o bloco `%% kanban:settings ... %%` são preservados ao salvar.

## Formato do arquivo

```markdown
---
kanban-plugin: board
---

## A fazer

- [ ] Escrever o rascunho @{2026-11-05}
- [ ] Revisar [[notas/roteiro|roteiro]]

## Em andamento

- [ ] Publicar a versão

## Feito

- [x] Criar o quadro

%% kanban:settings
{"kanban-plugin":"board"}
%%
```

Só entram no quadro linhas que começam com `- [ ]`, `- [x]` ou `- [X]`, dentro de um título de nível 2 (`##`).

## Instalação

Requisitos: Obsidian 1.5.0 ou mais recente, no computador ou no celular.

1. Gere os arquivos do plugin:

   ```bash
   npm install
   npm run build
   ```

2. Copie `main.js`, `manifest.json` e `styles.css` para a pasta do vault:

   ```text
   <seu-vault>/.obsidian/plugins/quadro/
   ```

3. Em **Configurações → Plugins da comunidade**, ative o **Quadro**.

## Desenvolvimento

```bash
npm install
npm run dev    # recompila ao salvar, com sourcemap
npm run build  # checagem de tipos e bundle de produção
```

O código-fonte fica em `src/`. O `esbuild` gera `main.js` a partir de `src/main.ts`.

## Licença

[MIT](LICENSE) © 2026 Walisson Mariano
