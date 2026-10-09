/**
 * Reproducible, source-derived coats for LuizMelo's CC0 Pet Cats Pack.
 * No source files are changed. Only RGB palette entries are replaced; PNG
 * dimensions, pixel locations, alpha, frame order, and art geometry are retained.
 * Run: node generate-coats.cjs <source-cats-directory> <output-directory>
 * Requires pngjs and sharp. Install locally, or set CAT_ASSET_NODE_MODULES.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
if (process.argv.length !== 4) {
  console.error('Usage: node generate-coats.cjs <source-cats-directory> <output-directory>');
  process.exit(1);
}
let moduleRequire = require;
try { require.resolve('pngjs'); require.resolve('sharp'); }
catch {
  const modules = process.env.CAT_ASSET_NODE_MODULES;
  if (!modules) {
    console.error('Install pngjs and sharp locally, or set CAT_ASSET_NODE_MODULES to a node_modules directory containing both packages.');
    process.exit(1);
  }
  moduleRequire = createRequire(path.resolve(modules, '_cat-assets.cjs'));
}
const { PNG } = moduleRequire('pngjs');
const sharp = moduleRequire('sharp');
const source = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
if (source === output || output.startsWith(source + path.sep)) throw Error('Output must be separate from source assets.');
fs.mkdirSync(output, {recursive:true});
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const rgb = hex => [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
const hexAt = (data,p) => [...data.subarray(p,p+3)].map(v=>v.toString(16).padStart(2,'0')).join('');

const original = [
  {id:1,name:'Golden Ginger',description:'A warm golden coat with a pale cream chest.',category:'solid'},
  {id:2,name:'Midnight Black',description:'A charcoal-black coat and bright yellow eyes.',category:'solid'},
  {id:3,name:'Seal Point',description:'A pale coat with smoky dark points and blue eyes.',category:'point'},
  {id:4,name:'Soft Tortoiseshell',description:'Muted charcoal and copper patches with pale accents.',category:'tortoiseshell'},
  {id:5,name:'Silver Longhair',description:'Fluffy silver-and-cream fur with one blue and one gold eye.',category:'longhair'},
  {id:6,name:'Gray Tabby',description:'A gray coat with dark tabby stripes and yellow eyes.',category:'tabby'},
].map(cat=>({...cat,originalBaseVariant:cat.id,sourceKind:'original'}));

const recipes = [
  {id:7,name:'Classic Tuxedo',description:'A black coat with a bright white chest and pale accents.',category:'bicolor',originalBaseVariant:1,
   palette:{'9b7521':'34383d','88671c':'23272c','88671d':'25292e','b59858':'c8cdd0','d6c295':'f6f2e9','6b5012':'15191f','785b18':'1c2026','8f6c1f':'282d33','95701f':'2e3339','505121':'6cc67c','ac7a0a':'41464d','b48827':'4b5158','7e5e18':'20252b','a1781e':'3d434a'}},
  {id:8,name:'Snow White',description:'A snowy white coat with cool shading and blue eyes.',category:'solid',originalBaseVariant:2,
   palette:{'1d2020':'e1e8ed','2d3131':'fffdf6','171919':'b9c6d1','131616':'a2b3c0','101212':'899eae','b5aa30':'318aa8','3c4141':'ffffff'}},
  {id:9,name:'Chocolate Point',description:'A toasted cream coat with rich chocolate points and turquoise eyes.',category:'point',originalBaseVariant:3,
   palette:{'625956':'65391f','c2c2c2':'d7b789','d5d5d5':'f6dab0','554c48':'482716','5d5b5b':'57301a','836d67':'956247','267792':'42a4ad','171919':'321a13','66605d':'754729','716f6f':'805136'}},
  {id:10,name:'Russet',description:'Deep red-ginger fur with a warm cream chest and amber eyes.',category:'solid',originalBaseVariant:1,
   palette:{'9b7521':'b54329','88671c':'90321f','88671d':'94341f','b59858':'e7a86e','d6c295':'ffdeaa','6b5012':'632217','785b18':'76281b','8f6c1f':'9c3720','95701f':'a63c24','505121':'edbf56','ac7a0a':'bd5730','b48827':'d1683d','7e5e18':'822b1b','a1781e':'bd4c2b'}},
  {id:11,name:'Silver Tabby',description:'A bright silver coat with graphite stripes and green eyes.',category:'tabby',originalBaseVariant:6,
   palette:{'a8a9a9':'e4e9eb','4f4f4f':'68717c','848484':'c0cbd2','a0a0a0':'d6dfe4','c0c0c0':'f4f5f2','646464':'8d9aa7','d6d6d6':'fffdf6','e8d82a':'46b279','65391b':'53596b'}},
  {id:12,name:'Calico',description:'A white saddle, ginger patches, and charcoal accents.',category:'calico',originalBaseVariant:4,
   palette:{'6c6c6c':'f5eee3','ac8475':'d27332','5c5b5b':'c8beb0','c7a79b':'30333c','916e61':'a84d22','b68c7d':'e78a3e','d9bbb0':'4b4c56','328a95':'5cab6f','2f2e2e':'22242b','d3b2a5':'3e424b','7e5e18':'905423','776360':'c99774','a47b70':'ca662b'}},
  {id:13,name:'Blue Smoke',description:'A slate-blue coat with deep blue shadows and green eyes.',category:'solid',originalBaseVariant:2,
   palette:{'1d2020':'597f9e','2d3131':'7eacc5','171919':'3d607e','131616':'304b68','101212':'253b55','b5aa30':'a9d776','3c4141':'a6c9d9'}},
  {id:14,name:'Cream Longhair',description:'Fluffy buttery cream fur with a pale ruff and golden eyes.',category:'longhair',originalBaseVariant:5,
   palette:{'d1d1d1':'f2dc9f','adadad':'d2b778','e6e6e6':'fff4d7','c3bab2':'e6bf77','8d8d8d':'b5955d','7d746c':'a17c4e','7e7e7e':'ae8c55','b4b4b4':'d6bd82','595959':'795b3c','1385c0':'a87e2f','e2d656':'e5a73f','4b4b4b':'654930'}},
  {id:15,name:'Chocolate Longhair',description:'A fluffy chocolate coat with a copper saddle and pale cream ruff.',category:'longhair',originalBaseVariant:5,
   palette:{'d1d1d1':'885135','adadad':'613822','e6e6e6':'f5dcad','c3bab2':'bc804c','8d8d8d':'46281a','7d746c':'81502e','7e7e7e':'4e2d1d','b4b4b4':'855035','595959':'2d1b15','1385c0':'77bec5','e2d656':'d6bc68','4b4b4b':'21130f'}},
  {id:16,name:'Ginger Tabby',description:'Golden-orange fur with burnt-ginger stripes and a pale muzzle.',category:'tabby',originalBaseVariant:6,
   palette:{'a8a9a9':'efa552','4f4f4f':'91441f','848484':'ce792f','a0a0a0':'e89641','c0c0c0':'ffd394','646464':'ad5925','d6d6d6':'fff0c5','e8d82a':'65a077','65391b':'7b371c'}},
  {id:17,name:'Flame Point',description:'An ivory coat with bright ginger points and blue eyes.',category:'point',originalBaseVariant:3,
   palette:{'625956':'dc7a3f','c2c2c2':'f4ecda','d5d5d5':'fff9ec','554c48':'b2592a','5d5b5b':'c36732','836d67':'ecaa73','267792':'3e96bf','171919':'8e421f','66605d':'e3894a','716f6f':'e49a62'}},
  {id:18,name:'Amber Tortoiseshell',description:'A dark espresso saddle with bold amber and honey patches.',category:'tortoiseshell',originalBaseVariant:4,
   palette:{'6c6c6c':'3b2c28','ac8475':'d79a38','5c5b5b':'241c1b','c7a79b':'f4c66d','916e61':'a76d23','b68c7d':'e5aa43','d9bbb0':'ffdfa0','328a95':'79b45c','2f2e2e':'141414','d3b2a5':'f8d385','7e5e18':'996421','776360':'a67b3d','a47b70':'ce8f31'}},
];

function sourceFiles(id) {
  return fs.readdirSync(path.join(source,`Cat-${id}`)).filter(f=>f.endsWith('.png')).sort();
}
function stat(name, bytes) {
  const png = PNG.sync.read(bytes);
  if (png.height !== 50 || png.width % 50) throw Error(`Bad frame grid ${name}`);
  return {state:name.replace(/^Cat-\d+-/,'').replace(/\.png$/,''),width:png.width,height:png.height,frames:png.width/50,sha256:sha(bytes)};
}
async function main() {
  const sourceBefore = Object.fromEntries(original.flatMap(cat=>sourceFiles(cat.id).map(file=>{
    const relative = `Cat-${cat.id}/${file}`;
    return [relative,sha(fs.readFileSync(path.join(source,relative)))];
  })));
  const records = [];
  const validations = [];
  for (const cat of original) {
    records.push({...cat,frameWidth:50,frameHeight:50,states:sourceFiles(cat.id).map(file=>stat(file,fs.readFileSync(path.join(source,`Cat-${cat.id}`,file))))});
  }
  for (const recipe of recipes) {
    const {palette,...meta} = recipe;
    const dir=path.join(output,`Cat-${recipe.id}`);
    fs.mkdirSync(dir,{recursive:true});
    const states=[];
    for (const file of sourceFiles(recipe.originalBaseVariant)) {
      const sourceBytes=fs.readFileSync(path.join(source,`Cat-${recipe.originalBaseVariant}`,file));
      const src=PNG.sync.read(sourceBytes);
      const dst=new PNG({width:src.width,height:src.height});
      dst.data=Buffer.from(src.data);
      let altered=0;
      for (let p=0; p<dst.data.length; p+=4) {
        if (!dst.data[p+3]) continue;
        const color=palette[hexAt(src.data,p)];
        if (!color) continue;
        const [r,g,b]=rgb(color);
        dst.data[p]=r; dst.data[p+1]=g; dst.data[p+2]=b;
        altered++;
      }
      const name=file.replace(`Cat-${recipe.originalBaseVariant}-`,`Cat-${recipe.id}-`);
      const data=PNG.sync.write(dst,{colorType:6,inputColorType:6,bitDepth:8,deflateLevel:9,filterType:4});
      fs.writeFileSync(path.join(dir,name),data);
      const decoded=PNG.sync.read(data);
      for (let p=3;p<decoded.data.length;p+=4) {
        if (decoded.data[p]!==src.data[p]) throw Error(`Alpha altered ${name} at pixel ${(p-3)/4}`);
        if (!src.data[p]) for (let c=1;c<=3;c++) if (decoded.data[p-c]!==src.data[p-c]) throw Error(`Transparent RGB altered ${name}`);
      }
      if (!altered) throw Error(`No coat pixels changed in ${name}`);
      states.push(stat(name,data));
      validations.push({variant:recipe.id,state:states.at(-1).state,source:`Cat-${recipe.originalBaseVariant}/${file}`,output:`Cat-${recipe.id}/${name}`,dimensionsRetained:true,alphaIdentical:true,transparentRgbIdentical:true,changedCoatPixels:altered,sourceSha256:sha(sourceBytes),outputSha256:sha(data)});
    }
    const record={...meta,sourceKind:'palette-derived',frameWidth:50,frameHeight:50,states};
    if (recipe.originalBaseVariant===3) record.sourceNote='The official Cat-3 family has no Itch strip; all 11 supplied source states are retained.';
    records.push(record);
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(record,null,2)+'\n');
  }
  const sourceAfter=Object.fromEntries(Object.keys(sourceBefore).map(file=>[file,sha(fs.readFileSync(path.join(source,file)))]));
  if (JSON.stringify(sourceBefore)!==JSON.stringify(sourceAfter)) throw Error('Source changed during generation');
  const idleHashes=records.map(cat=>cat.states.find(s=>s.state==='Idle').sha256);
  if (new Set(idleHashes).size!==18) throw Error('Duplicate Idle sprites');
  const outputHashes=validations.map(v=>v.outputSha256);
  if (new Set(outputHashes).size!==outputHashes.length) throw Error('Duplicate output strips');
  const manifest={source:{name:'Pet Cats Pack',author:'LuizMelo',url:'https://luizmelo.itch.io/pet-cat-pack',license:'CC0-1.0',method:'Exact RGB palette substitution over original art; no image generation, resampling, pose edits, geometry edits, or frame changes.'},variants:records};
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(output,'catalog.json'),JSON.stringify(records.map(({id,name,description,category,originalBaseVariant})=>({id,name,description,category,originalBaseVariant})),null,2)+'\n');
  fs.writeFileSync(path.join(output,'recipes.json'),JSON.stringify(recipes,null,2)+'\n');
  fs.writeFileSync(path.join(output,'source-sha256.json'),JSON.stringify(sourceBefore,null,2)+'\n');
  const report={sourceStrips:Object.keys(sourceBefore).length,sourceFilesUnchanged:true,derivedVariants:recipes.length,derivedStrips:validations.length,derivedFrames:records.filter(c=>c.id>6).flatMap(c=>c.states).reduce((sum,s)=>sum+s.frames,0),distinctIdleHashes:new Set(idleHashes).size,distinctOutputHashes:new Set(outputHashes).size,allDimensionsRetained:true,allAlphaIdentical:true,allTransparentRgbIdentical:true,allOriginalAnimationStatesRetained:true,checks:validations};
  fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2)+'\n');
  await contactSheet(records);
  await stateSheet(records);
  await animationPreview(records);
  console.log(JSON.stringify({...report,checks:undefined},null,2));
}
function fileFor(cat,state='Idle') {
  return path.join(cat.id<=6?source:output,`Cat-${cat.id}`,`Cat-${cat.id}-${state}.png`);
}
function labelSvg(text,width=260,height=30,size=17,color='#263535') {
  return Buffer.from(`<svg width="${width}" height="${height}"><text x="16" y="22" fill="${color}" font-family="sans-serif" font-size="${size}">${text.replace(/&/g,'&amp;')}</text></svg>`);
}
async function contactSheet(records) {
  const cellWidth=260,cellHeight=235,columns=6;
  const layers=[];
  for (let i=0;i<records.length;i++) {
    const cat=records[i],left=(i%columns)*cellWidth,top=Math.floor(i/columns)*cellHeight;
    const tile=Buffer.from(`<svg width="260" height="235"><rect x="5" y="5" width="250" height="225" rx="14" fill="${cat.id<=6?'#dedacb':'#f1eadb'}"/></svg>`);
    layers.push({input:tile,left,top});
    layers.push({input:labelSvg(`${cat.id} · ${cat.name}`,260,30,cat.name.length>17?16:18),left,top:top+8});
    layers.push({input:labelSvg(`${cat.id<=6?'Original':`Base ${cat.originalBaseVariant}`} · ${cat.category}`,260,30,13,'#60706c'),left,top:top+34});
    // Full frame dimensions stay unchanged in the actual assets; this zoom is only for review.
    layers.push({input:await sharp(fileFor(cat)).extract({left:0,top:0,width:50,height:50}).resize(250,250,{kernel:'nearest'}).toBuffer(),left:left+5,top:top-17+60});
  }
  // Margin allows the untrimmed review frames to overlap only transparent tile space.
  await sharp({create:{width:columns*cellWidth,height:3*cellHeight+64,channels:4,background:'#f8f4e9'}}).composite(layers).png().toFile(path.join(output,'all-18-coats-contact-sheet.png'));
}
async function stateSheet(records) {
  const cats=records.filter(cat=>cat.id>6),samples=['Idle','Walk','Run','Laying','Licking 1','Licking 2','Meow','Sitting','Sleeping1','Sleeping2','Stretching'];
  const width=1540,rowHeight=126,layers=[];
  layers.push({input:labelSvg('12 source-derived coats · representative frames across every shared animation',1540,40,24,'#ede7d9'),left:8,top:0});
  for(let i=0;i<samples.length;i++) layers.push({input:labelSvg(samples[i],120,30,13,'#ede7d9'),left:220+i*120,top:36});
  for(let r=0;r<cats.length;r++) {
    const cat=cats[r],top=70+r*rowHeight;
    layers.push({input:labelSvg(`${cat.id} ${cat.name}`,220,30,16,'#ede7d9'),left:0,top:top+40});
    for(let i=0;i<samples.length;i++) {
      const state=samples[i],entry=cat.states.find(s=>s.state===state),frame=state==='Run'?3:state==='Stretching'?7:state==='Laying'?6:0;
      layers.push({input:await sharp(fileFor(cat,state)).extract({left:Math.min(frame,entry.frames-1)*50,top:0,width:50,height:50}).resize(150,150,{kernel:'nearest'}).toBuffer(),left:210+i*120,top:top-20});
    }
  }
  await sharp({create:{width:width+40,height:70+cats.length*rowHeight+28,channels:4,background:'#596874'}}).composite(layers).png().toFile(path.join(output,'new-coats-animation-contact-sheet.png'));
}
async function animationPreview(records) {
  const width=1320,height=630,frameCount=8,frames=[];
  for(let f=0;f<frameCount;f++) {
    const layers=[];
    for(let i=0;i<records.length;i++) {
      const cat=records[i],left=(i%6)*220,top=Math.floor(i/6)*210;
      layers.push({input:labelSvg(`${cat.id} · ${cat.name}`,220,30,14,'#253b3e'),left,top:top+8});
      layers.push({input:await sharp(fileFor(cat,'Walk')).extract({left:f*50,top:0,width:50,height:50}).resize(200,200,{kernel:'nearest'}).toBuffer(),left:left+10,top:top+8});
    }
    frames.push(await sharp({create:{width,height,channels:4,background:'#e9e5d7'}}).composite(layers).raw().toBuffer());
  }
  await sharp(Buffer.concat(frames),{raw:{width,height:height*frameCount,channels:4,pageHeight:height}}).gif({loop:0,delay:Array(frameCount).fill(120),colours:256,dither:0}).toFile(path.join(output,'all-18-walk-animation.gif'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
