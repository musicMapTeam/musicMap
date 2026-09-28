import { artistById, artistName, artistsInDataset, datasetForArtist } from './map-data.js';
import { getSavedMusic, subscribeSavedMusic } from './music-library.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
// Width, case and punctuation never decide a match: "jj lin", "ＧＥＭ" and "g.e.m." all find their singer.
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s.·・_-]/g, '');
// Familiar first doors into the real network; an id the catalogue no longer has is skipped.
const EXAMPLE_STARTS = ['real-jay', 'real-jj', 'real-gem', 'real-stefanie'];
const MAX_PICKS = 4;

/** Singers from the verified catalogue, best match first: whole name, then prefix, then anywhere. */
function findArtists(query, candidates) {
  const needle = normalize(query);
  if (!needle) return [];
  return candidates
    .map(artist => {
      const names = [artist.name, ...(artist.aliases || [])].map(normalize);
      const rank = names.includes(needle) ? 0 : names.some(name => name.startsWith(needle)) ? 1 : names.some(name => name.includes(needle)) ? 2 : 3;
      return { artist, rank };
    })
    .filter(item => item.rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_PICKS)
    .map(item => item.artist);
}

/** The latest 寻声 round that has not arrived or been revealed. */
function openRound(map) {
  return map.sessions
    .filter(session => session.type === 'challenge' && session.fog && session.status !== 'complete' && session.status !== 'revealed' && artistById[session.start] && artistById[session.target])
    .sort((a, b) => (b.updated || 0) - (a.updated || 0))[0] || null;
}

const touched = session => session.path.length > 1 || Boolean(session.flipped?.length) || Boolean(session.hints?.length);

/** The front door: pick a singer to roam from, or pick up a 寻声 round. Everything here is local. */
export function mountHome(container, api) {
  const map = api.getState().map;
  const candidates = artistsInDataset('real');
  const starts = EXAMPLE_STARTS.map(id => artistById[id]).filter(artist => artist?.dataset === 'real');
  const round = openRound(map);
  const steps = round ? round.path.length - 1 : 0;
  const resume = round && touched(round);
  const pair = round ? `${datasetForArtist(round.start) === 'fictional' ? '情景示例 · ' : ''}${artistName(round.start)} → ${artistName(round.target)}` : '';
  const roundTitle = resume ? '继续寻声' : '两位歌手之间，隔着几首歌？';
  const roundMeta = resume ? `${pair} · 已走 ${steps} 步` : round ? `寻声 · ${pair}` : '寻声 · 在唱片店开一局';
  const returning = map.sessions.some(touched) || getSavedMusic().length > 0;

  // Written once: typing only repaints the picks, so focus and the title's entrance are never disturbed.
  container.innerHTML = `<section class="home-studio${returning ? ' home-studio--returning' : ''}" aria-labelledby="home-title">
    <div class="home-cover">
      <header class="home-hero">
        <p class="home-hero__kicker"><i aria-hidden="true"></i>音乐探索 · 夜场唱片店</p>
        <h1 id="home-title" class="home-hero__title"><span>从喜欢，</span><span>走向未知。</span></h1>
        <p class="home-hero__lede">从一位喜欢的歌手出发，沿着真实的合唱，翻开下一位、找到下一首。</p>
        <ol class="home-hero__steps" aria-label="怎么探索"><li>选一位歌手</li><li>沿合唱走到下一位</li><li>把路上的歌留下</li></ol>
      </header>
      <div class="home-paper home-paper--compact" data-home-paper>
        <form class="home-search" role="search" data-home-search>
          <label class="home-search__label" for="home-artist-search">今天，从谁开始？</label>
          <div class="home-search__field">${api.icon('magnifying-glass')}<input id="home-artist-search" type="search" enterkeyhint="go" autocomplete="off" spellcheck="false" placeholder="如 周杰伦、JJ Lin" aria-describedby="home-search-note"></div>
          <div class="home-search__picks" data-home-picks role="group"></div>
          <p class="home-search__note" id="home-search-note" data-home-note role="status"></p>
        </form>
        <div class="home-paper__actions">
          <button type="button" class="button button--secondary home-round" data-home="round">
            <span class="home-round__copy"><strong>${escape(roundTitle)}</strong><small>${escape(roundMeta)}</small></span>${api.icon('arrow-right')}
          </button>
        </div>
        <div class="home-paper__foot">
          <button type="button" data-home="records">我的发现 <span class="home-count">${map.sessions.length}</span></button>
          <button type="button" data-home="music">留下的歌 <span class="home-count" data-home-music>${getSavedMusic().length}</span></button>
          <button type="button" data-open-catalogue aria-haspopup="dialog">开放曲库 ${api.icon('arrow-up-right')}</button>
        </div>
      </div>
    </div>
  </section>`;
  const page = container.firstElementChild;
  const form = page.querySelector('[data-home-search]');
  const input = form.querySelector('input');
  const picks = form.querySelector('[data-home-picks]');
  const note = form.querySelector('[data-home-note]');
  const life = new AbortController();
  const { signal } = life;
  let found = [];

  function renderPicks() {
    const query = input.value.trim();
    found = findArtists(query, candidates);
    const list = found.length ? found : starts;
    picks.dataset.kind = found.length ? 'found' : 'starts';
    picks.setAttribute('aria-label', found.length ? '匹配的歌手' : '可以从这几位出发');
    picks.innerHTML = list.map(artist => `<button type="button" class="home-pick" data-home-start="${escape(artist.id)}" style="--pick-tone:${escape(artist.color)}" aria-label="从${escape(artist.name)}出发">${escape(artist.name)}</button>`).join('');
    note.textContent = query && !found.length ? `本专题还没收录「${query}」，先从这几位出发试试。` : '';
  }
  function start(artistId) {
    if (artistById[artistId]?.dataset === 'real') api.navigate('explore', { artistId, newSession: true });
  }

  input.addEventListener('input', renderPicks, { signal });
  input.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    const first = picks.querySelector('button');
    if (first) { event.preventDefault(); first.focus(); }
  }, { signal });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (found.length) start(found[0].id);
    else input.focus();
  }, { signal });
  page.addEventListener('click', event => {
    const pick = event.target.closest('[data-home-start]');
    if (pick) { start(pick.dataset.homeStart); return; }
    const button = event.target.closest('[data-home]');
    if (!button) return;
    if (button.dataset.home === 'round') api.navigate('explore', round ? { resumeSessionId: round.id } : null);
    if (button.dataset.home === 'records') api.navigate('records', { section: 'map' });
    if (button.dataset.home === 'music') api.navigate('records', { section: 'music' });
  }, { signal });
  const unsubscribe = subscribeSavedMusic(tracks => {
    const count = page.querySelector('[data-home-music]');
    if (count) count.textContent = tracks.length;
  });

  renderPicks();
  // The courtyard frames itself around this cover; no cards go on the scene.
  api.spatial?.publish({ mode: 'home', cards: [] });
  return () => { life.abort(); unsubscribe(); };
}
