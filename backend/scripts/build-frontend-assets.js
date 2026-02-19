const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const publicRoot = path.join(projectRoot, 'frontend/public');
const distRoot = path.join(publicRoot, 'dist');

function minifyJs(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\/\/.*$/g, '').trim())
    .filter(Boolean)
    .join('\n');
}

function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim();
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeMinified(inputPath, outputPath, type) {
  const raw = await fs.readFile(inputPath, 'utf8');
  const content = type === 'css' ? minifyCss(raw) : minifyJs(raw);
  await fs.writeFile(outputPath, content, 'utf8');
}

async function run() {
  await ensureDir(distRoot);

  await writeMinified(
    path.join(publicRoot, 'app.js'),
    path.join(distRoot, 'app.min.js'),
    'js'
  );
  await writeMinified(
    path.join(publicRoot, 'js/homepage.js'),
    path.join(distRoot, 'homepage.min.js'),
    'js'
  );
  await writeMinified(
    path.join(publicRoot, 'style.css'),
    path.join(distRoot, 'style.min.css'),
    'css'
  );

  console.log('Frontend assets built to frontend/public/dist');
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
