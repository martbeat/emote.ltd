import { textStyles } from './text-styles.js';
const source = document.querySelector('#source');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const dialog = document.querySelector('#copy-dialog');
let filter = 'all';
const rows = textStyles.map(style => {
  const row = document.createElement('article');
  row.className = 'style';
  const content = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'style-name';
  title.textContent = style.name;
  const preview = document.createElement('p');
  preview.className = 'preview';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', `Copy ${style.name.toLowerCase()} text`);
  let reset;
  button.addEventListener('click', async () => {
    const text = style.convert(source.value);
    try {
      await navigator.clipboard.writeText(text);
      clearTimeout(reset);
      button.textContent = 'Copied';
      button.dataset.copied = 'true';
      status.textContent = `${style.name} text copied.`;
      reset = setTimeout(() => { button.textContent = 'Copy'; delete button.dataset.copied; }, 1800);
    } catch {
      const manual = document.querySelector('#manual-copy');
      manual.value = text;
      dialog.showModal();
      manual.focus();
      manual.select();
    }
  });
  content.append(title, preview);
  row.append(content, button);
  results.append(row);
  return {style, row, preview, button};
});
function render() {
  const text = source.value;
  document.querySelector('#count').textContent = `${Array.from(text).length.toLocaleString()} characters`;
  let visible = 0;
  for (const {style, row, preview, button} of rows) {
    row.hidden = filter !== 'all' && style.group !== filter;
    if (!row.hidden) visible++;
    preview.textContent = text ? style.convert(text) : 'Your text will appear here';
    button.disabled = !text.trim();
    button.textContent = 'Copy';
    delete button.dataset.copied;
  }
  document.querySelector('#style-count').textContent = `${visible} styles`;
}
source.addEventListener('input', render);
document.querySelector('#clear').addEventListener('click', () => { source.value = ''; render(); source.focus(); status.textContent = 'Text cleared.'; });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
render();
