import catalogue from '../assets/data/hf-collaborations.json';
import { icon } from './icons.js';

export function mountOpenCatalogue() {
  const dialog = document.createElement('dialog');
  dialog.className = 'open-catalogue';
  dialog.setAttribute('aria-labelledby', 'open-catalogue-title');
  dialog.innerHTML = `<header><div><span class="open-catalogue__eyebrow">THE OPEN CRATE</span><h2 id="open-catalogue-title">开放曲库<span>120</span></h2></div><button class="icon-button" data-crate-close aria-label="关闭开放曲库">${icon('x')}</button></header>
    <label class="open-catalogue__search">${icon('magnifying-glass')}<input type="search" placeholder="搜歌曲、艺人" aria-label="搜索开放曲库"></label>
    <p class="open-catalogue__note">共同署名艺人 · 制作分工未收录</p><div class="open-catalogue__list"></div>
    <footer><span data-crate-count role="status"></span><a target="_blank" rel="noopener noreferrer">Hugging Face 数据来源 ${icon('arrow-up-right')}</a></footer>`;
  dialog.querySelector('footer a').href = catalogue.source.url;
  document.body.append(dialog);
  const list = dialog.querySelector('.open-catalogue__list');
  function render(query = '') {
    const search = query.trim().toLocaleLowerCase();
    const tracks = catalogue.tracks.filter(track => [track.title, ...track.artists].join(' ').toLocaleLowerCase().includes(search));
    list.replaceChildren();
    tracks.forEach((track, index) => {
      const row = document.createElement('details');
      row.className = 'open-catalogue__record';
      const summary = document.createElement('summary');
      const number = document.createElement('span'); number.className = 'open-catalogue__number'; number.textContent = String(index + 1).padStart(2, '0');
      const copy = document.createElement('span'); copy.className = 'open-catalogue__copy';
      const title = document.createElement('strong'); title.textContent = track.title;
      const artists = document.createElement('small'); artists.textContent = track.artists.join(' · ');
      copy.append(title, artists); summary.append(number, copy);
      const detail = document.createElement('p'); detail.textContent = `专辑：${track.album} · 原始记录 ${track.source.recordNumber}`;
      row.append(summary, detail); list.append(row);
    });
    if (!tracks.length) { const empty = document.createElement('p'); empty.className = 'open-catalogue__empty'; empty.textContent = '这箱唱片里还没有。换个关键词吧。'; list.append(empty); }
    dialog.querySelector('[data-crate-count]').textContent = `${tracks.length} 首 / 本地全库 ${catalogue.counts.rows.toLocaleString('en-US')} 行`;
  }
  dialog.querySelector('input').addEventListener('input', event => render(event.target.value));
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-crate-close]')) dialog.close(); });
  document.addEventListener('click', event => { if (event.target.closest('[data-open-catalogue]')) dialog.showModal(); });
  render();
}
