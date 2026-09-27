import { SPACE_MOMENTS } from './space-data.js';

/** Facts shared by the duet page and its PNG. They only read accepted snapshots. */
export const PERSPECTIVE_NAMES = { stage: '舞台', crowd: '人海', friends: '身边', detail: '细节' };

export const momentLabel = id => SPACE_MOMENTS.find(item => item.id === id)?.name || '现场瞬间';

export function perspectiveLabel(card = {}) {
  return PERSPECTIVE_NAMES[card.perspective || card.photoKey] || (card.photoKey === 'custom' ? '我的视角' : '现场');
}

/** One rule everywhere: a song needs both cards to carry it; then a shared moment; then the night itself. */
export function sharedLine(cards = [], event = {}) {
  const [a, b] = cards;
  if (a?.trackId && a.trackId === b?.trackId && event.song) return { label: '让两张卡相遇的歌', value: `♪ ${event.song}`, kind: 'song' };
  if (a?.momentId && a.momentId === b?.momentId) return { label: '我们共同记住的时刻', value: momentLabel(a.momentId), kind: 'moment' };
  return { label: '我们交换的这一晚', value: event.title || '这一场现场', kind: 'night' };
}

/** A single card PNG uses the same stub language. */
export function singleLine(card = {}, event = {}) {
  if (card.trackId && event.song) return { label: '带上的这首歌', value: `♪ ${event.song}`, kind: 'song' };
  return { label: '我记得的这一刻', value: momentLabel(card.momentId), kind: 'moment' };
}

/** 2026-09-26 and 2026.09.26 both print as 2026.09.26. */
export function eventDateLabel(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return match ? `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}` : String(value);
}

export const eventTitle = (event = {}) => [event.title, event.subtitle].filter(Boolean).join(' / ') || '这一场现场';
export const eventMeta = (event = {}) => [eventDateLabel(event.date), event.city].filter(Boolean).join(' · ');

const pad = value => String(value).padStart(2, '0');
function dateOf(iso) {
  const date = new Date(iso || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
/** 09/27 21:14 */
export function completedLabel(iso) {
  if (!iso) return '';
  const date = dateOf(iso);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** 2026/09/27 21:14 */
export function completedFull(iso) {
  const date = dateOf(iso);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** 09·27 for the consent seal. */
export function stampDate(iso) {
  const date = dateOf(iso);
  return `${pad(date.getMonth() + 1)}·${pad(date.getDate())}`;
}
