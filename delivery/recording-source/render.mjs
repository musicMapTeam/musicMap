import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(resolve(root, 'edit-plan.json'), 'utf8'));
if (plan.status !== 'ready-to-render') {
  throw new Error('素材与剪辑点尚未确认。先填写 edit-plan.json，再将 status 设为 ready-to-render。');
}
if (!Array.isArray(plan.segments) || !plan.segments.length) throw new Error('没有待渲染片段。');

const execute = (program, args, cwd = root) => execFileSync(program, args, { cwd, stdio: 'inherit', windowsHide: true });
const probe = (path) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], { encoding: 'utf8', windowsHide: true }));
const assTime = (value) => {
  const ticks = Math.round(value * 100);
  const sec = Math.floor(ticks / 100);
  return `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}.${String(ticks % 100).padStart(2, '0')}`;
};
const srtTime = (value) => {
  const ticks = Math.round(value * 1000);
  const sec = Math.floor(ticks / 1000);
  return `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')},${String(ticks % 1000).padStart(3, '0')}`;
};
const assText = (value) => String(value).replace(/\\/g, '／').replace(/[{}]/g, '').replace(/\r?\n/g, '\\N');
const event = (style, start, end, value) => `Dialogue: 0,${assTime(start)},${assTime(end)},${style},,0,0,0,,${assText(value)}`;
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Microsoft YaHei,38,&H00E7EFF2,&H00E7EFF2,&H0016100C,&H0016100C,0,0,0,0,100,100,0,0,1,1,0,2,90,90,66,1
Style: Chapter,Microsoft YaHei,28,&H00CFDD70,&H00CFDD70,&H0016100C,&H0016100C,-1,0,0,0,100,100,0,0,1,0,0,7,48,48,23,1
Style: Session,Microsoft YaHei,25,&H00597EFF,&H00597EFF,&H0016100C,&H0016100C,0,0,0,0,100,100,0,0,1,0,0,9,48,48,25,1
Style: Note,Microsoft YaHei,20,&H00C1C4B5,&H00C1C4B5,&H0016100C,&H0016100C,0,0,0,0,100,100,0,0,1,0,0,2,48,48,18,1
Style: Hold,Microsoft YaHei,18,&H00C1C4B5,&H00C1C4B5,&H0016100C,&H0016100C,0,0,0,0,100,100,0,0,1,0,0,3,48,48,18,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

let duration = 0;
const segments = plan.segments.map((item, index) => {
  const source = resolve(root, item.file);
  if (!existsSync(source)) throw new Error(`缺少实际录屏：${item.file}`);
  const sourceInfo = probe(source);
  const sourceDuration = Number(sourceInfo.format?.duration);
  if (!Number.isFinite(item.in) || !Number.isFinite(item.out) || item.in < 0 || item.out <= item.in || item.out > sourceDuration + 0.1) {
    throw new Error(`请填写原片内有效剪辑范围：${item.id}`);
  }
  const sourceLength = item.out - item.in;
  const hold = item.hold || 0;
  if (!Number.isFinite(hold) || hold < 0 || hold > 15) throw new Error(`末帧阅读停留应在 0–15 秒内：${item.id}`);
  const length = sourceLength + hold;
  const captions = item.captions || [];
  for (const cue of captions) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || cue.end > length) {
      throw new Error(`字幕超出剪后片段范围：${item.id}`);
    }
  }
  const result = { ...item, source, sourceLength, hold, length, timelineStart: duration, fileStem: `segment-${String(index + 1).padStart(2, '0')}` };
  duration += length;
  return result;
});
if (duration > 180) throw new Error(`剪后总长 ${duration.toFixed(2)} 秒，超过 3 分钟。`);

const work = resolve(root, 'work');
const outputDirectory = resolve(root, 'rendered');
mkdirSync(work, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });
const srt = [];
for (const segment of segments) {
  const lines = [
    event('Chapter', 0, segment.length, segment.chapter),
    event('Session', 0, segment.length, segment.sessionLabel),
    event('Note', 0, segment.length, segment.footnote),
    ...(segment.hold ? [event('Hold', segment.sourceLength, segment.length, '画面定格 · 供阅读')] : []),
    ...segment.captions.map((cue) => event('Caption', cue.start, cue.end, cue.text)),
  ];
  writeFileSync(resolve(work, `${segment.fileStem}.ass`), assHeader + lines.join('\n') + '\n', 'utf8');
  for (const cue of segment.captions) {
    srt.push(`${srt.length + 1}\n${srtTime(segment.timelineStart + cue.start)} --> ${srtTime(segment.timelineStart + cue.end)}\n${cue.text}\n`);
  }
  const filters = `trim=duration=${segment.sourceLength},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${segment.hold},scale=1824:846:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,pad=1920:1080:(ow-iw)/2:84:color=0x0c1016,fps=30,ass=filename=${segment.fileStem}.ass`;
  execute('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-nostdin', '-y', '-ss', String(segment.in), '-i', segment.source, '-t', String(segment.length), '-map', '0:v:0', '-an', '-vf', filters, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-video_track_timescale', '15360', `${segment.fileStem}.mp4`], work);
}
writeFileSync(resolve(work, 'segments.txt'), segments.map((segment) => `file '${segment.fileStem}.mp4'`).join('\n') + '\n', 'utf8');
const output = resolve(outputDirectory, 'music-map-space-0.4-recorded.mp4');
execute('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-nostdin', '-y', '-f', 'concat', '-safe', '1', '-i', 'segments.txt', '-map', '0:v:0', '-c', 'copy', '-movflags', '+faststart', output], work);
writeFileSync(resolve(outputDirectory, 'captions.zh-CN.srt'), srt.join('\n'), 'utf8');
writeFileSync(resolve(outputDirectory, 'edit-manifest.json'), JSON.stringify({
  version: plan.version,
  title: plan.title,
  method: 'Native browser screencast, chronological cuts, original speed, disclosed last-frame reading holds, burned Chinese subtitles, no audio',
  segments: segments.map(({ source, fileStem, ...item }) => ({ ...item, sourceFile: basename(source) })),
}, null, 2), 'utf8');
const finalInfo = probe(output);
console.log(JSON.stringify({ output, bytes: statSync(output).size, duration: finalInfo.format.duration, video: finalInfo.streams.find((stream) => stream.codec_type === 'video'), note: '已编码；仍需实际播放与画面核对，尚未更新正式交付文件。' }, null, 2));
