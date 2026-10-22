import { h, loadTitles, typeLabel } from './dom.js';
import qrcode from './vendor/qrcode.mjs';

const COLS = 3;
const PER_SHEET = 12;
const base = new URL('index.html', location.href).href.split('#')[0];

const front = card => {
  const qr = qrcode(0, 'M');
  qr.addData(`${base}#card=${encodeURIComponent(card.id)}`);
  qr.make();
  const box = h('div', { class: 'qr' });
  box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  return h('div', { class: 'pcard' }, h('div', {}, box, h('small', {}, 'Screen Timeline')));
};

const back = card => h('div', { class: 'pcard' }, h('div', {},
  h('div', { class: 'year' }, String(card.year)),
  h('div', { class: 'title' }, card.title),
  h('div', { class: 'kind' }, typeLabel(card))));

// Mirror each row so a back lines up behind its front when printed double-sided.
function mirrorRows(cells) {
  const out = [];
  for (let i = 0; i < cells.length; i += COLS) out.push(...cells.slice(i, i + COLS).reverse());
  return out;
}

loadTitles().then(titles => {
  const sheets = document.getElementById('sheets');
  for (let i = 0; i < titles.length; i += PER_SHEET) {
    const chunk = titles.slice(i, i + PER_SHEET);
    sheets.append(
      h('div', { class: 'sheet' }, chunk.map(front)),
      h('div', { class: 'sheet' }, mirrorRows(chunk.map(back))));
  }
}).catch(err => document.getElementById('sheets').append(h('p', { class: 'error' }, err.message)));
