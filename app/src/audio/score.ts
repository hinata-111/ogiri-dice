// Original sixteen-bar travel tunes. MIDI notes, rests and swung eighths are
// written explicitly; these are not melodies from the reference games.
export type Instrument = 'reed' | 'mallet' | 'bass' | 'brush' | 'kick';
export interface Note { beat: number; pitch: number; length: number; velocity: number; voice: Instrument }
type Phrase = Array<[number, number, number]>;
const menu: Phrase[] = [
  [[0,72, .7],[1,76,.4],[1.65,79,.3],[2.5,81,.45],[3.2,79,.45]],
  [[0,76,1.2],[1.65,74,.3],[2.2,72,.5],[3,69,.6]],
  [[.5,74,.5],[1.2,77,.5],[2,81,.7],[3.2,79,.45]],
  [[0,77,.7],[1,76,.45],[1.65,74,.3],[2.5,71,1]],
  [[0,72,.5],[.65,76,.3],[1.5,79,.5],[2.5,84,.8]],
  [[0,83,.7],[1.1,81,.5],[2,79,.4],[2.65,76,.3],[3.3,74,.4]],
  [[0,77,.8],[1.5,76,.5],[2.3,74,.45],[3,71,.7]],
  [[0,72,1.8],[2.65,67,.35],[3.3,69,.4]],
  [[0,69,.7],[1.1,72,.4],[1.7,76,.3],[2.5,79,.8]],
  [[.2,77,1],[1.65,76,.35],[2.3,74,.5],[3.3,72,.4]],
  [[0,71,.7],[1,74,.45],[1.65,77,.35],[2.5,81,.8]],
  [[0,79,1.4],[2,77,.6],[3.2,74,.5]],
  [[0,76,.7],[1.2,79,.45],[2,84,.7],[3.2,83,.45]],
  [[0,81,.7],[1.1,79,.45],[2,76,.5],[3,72,.7]],
  [[0,74,.5],[.65,77,.35],[1.5,76,.4],[2.3,71,.5],[3,74,.6]],
  [[0,72,2.3]],
];
const board: Phrase[] = [
  [[0,67,.6],[1,72,.6],[2.5,76,.8]], [[0,74,.7],[1.5,72,.5],[2.5,69,1]],
  [[.5,65,.6],[1.5,69,.6],[2.5,72,.7]], [[0,71,1],[2,69,.4],[2.65,67,.6]],
  [[0,67,.6],[1,72,.6],[2.3,79,1]], [[0,77,.7],[1.5,76,.7],[3,72,.6]],
  [[0,74,.7],[1.5,71,.5],[2.5,67,1]], [[0,72,2]],
  [[.5,76,.5],[1.5,79,.5],[2.5,81,.8]], [[0,79,1],[1.65,76,.4],[2.5,72,.8]],
  [[0,77,.7],[1.5,76,.5],[2.5,74,.8]], [[0,71,1.5],[2.5,67,.8]],
  [[0,72,.6],[1,76,.6],[2.5,79,.8]], [[0,81,.7],[1.5,79,.5],[2.5,76,.8]],
  [[0,74,.7],[1.5,71,.5],[2.5,67,.7]], [[0,72,2.2]],
];
const harmony = [[48,60,64,67,71],[45,60,64,67,69],[50,60,65,69,72],[43,59,62,65,69], [48,60,64,67,71],[45,60,64,67,69],[43,59,62,65,69],[48,60,64,67,72]];
export function musicBar(scene: 'menu' | 'board', bar: number): Note[] {
  const phrase = (scene === 'menu' ? menu : board)[bar % 16];
  const chord = harmony[bar % 8];
  const notes: Note[] = phrase.map(([beat,pitch,length],i) => ({beat,pitch,length,velocity: i % 3 === 0 ? .23 : .19,voice: scene === 'menu' ? 'reed' : 'mallet'}));
  for (let beat = 0; beat < 4; beat++) {
    notes.push({ beat, pitch: beat % 2 ? chord[0] + 7 : chord[0], length: .62, velocity: beat % 2 ? .26 : .33, voice: 'bass' });
    notes.push({ beat: beat + .65, pitch: 0, length: .18, velocity: beat % 2 ? .055 : .035, voice: 'brush' });
    if (beat % 2 === 0) notes.push({ beat, pitch: 0, length: .25, velocity: .09, voice: 'kick' });
  }
  for (const beat of [.65, 2.65]) chord.slice(1).forEach((pitch,i) => notes.push({beat: beat + i * .015,pitch,length:.55,velocity:.058,voice:'mallet'}));
  return notes.sort((a,b) => a.beat - b.beat);
}
