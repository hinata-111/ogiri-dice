import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
mkdirSync(resolve(here, 'movement-modules'), { recursive: true });
for (const name of ['state', 'graph', 'rules', 'destination', 'topics']) {
  const source = readFileSync(resolve(root, `app/src/game/${name}.ts`), 'utf8');
  const output = stripTypeScriptTypes(source).replace(/from "\.\/(\w+)"/g, 'from "./$1.js"');
  writeFileSync(resolve(here, `movement-modules/${name}.js`), output);
}
const source = JSON.parse(readFileSync(resolve(root, 'app/src/data/map.json'), 'utf8'));
writeFileSync(resolve(here, 'movement-modules/topic-data.js'), `export default ${readFileSync(resolve(root, 'app/src/data/topics.json'), 'utf8')};\n`);
writeFileSync(resolve(here, 'movement-modules/mock.js'), stripTypeScriptTypes(readFileSync(resolve(root, 'app/src/ai/mock.ts'), 'utf8')));
// Original topology and cell types are copied, not edited. Coordinates live in the preview renderer.
writeFileSync(resolve(here, 'movement-modules/map.js'), `export default ${JSON.stringify(source)};\n`);
let html = readFileSync(resolve(here, 'landscape.html'), 'utf8');
html = html.replace('tokyo-map-art-v2.png', 'tokyo-map-art-v3.png');
html = html.replace(/<span class="landmark ueno">[\s\S]*?<\/div>\s*<div class="hud">/, '<svg id="tracks" viewBox="0 0 1000 562.5" aria-hidden="true"></svg><div id="boardLabels"></div><div id="choices"></div><div id="traveler" aria-label="プレイヤー1"><span>1</span></div></div>\n<div class="hud">');
html = html.replace('<div class="review">原画・配置の試作 ／ 経路未接続・コマは仮</div>', '<div class="review">移動検証版・4点で開始 ／ 街の絵は地理を簡略化</div>');
html = html.replace(/<script>[\s\S]*?<\/script>/, '<script type="module" src="movement.js"></script>');
html = html.replace('<div id="traveler" aria-label="プレイヤー1"><span>1</span></div>', '<div id="traveler" aria-label="プレイヤー1・青い人型ピンのコマ"><span>1</span></div>');
html = html.replace('</head>', '</head>');
html = html.replace('</style>', '</style><link rel="stylesheet" href="movement.css"><link rel="stylesheet" href="game-finish.css">');
html = html.replace('<title>大喜利ダイス｜横持ちマップ原画</title>', '<title>大喜利ダイス｜東京マップ移動検証</title>');
writeFileSync(resolve(here, 'movement.html'), html);
console.log('Built movement.html from landscape.html and current game reducer / map.');
