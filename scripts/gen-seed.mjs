import { PNG } from 'pngjs';
import fs from 'fs';
const png = PNG.sync.read(fs.readFileSync('/home/user/Atlas/assets/the-fort-world-map.png'));
const { width:W, height:H, data } = png;
const at=(x,y)=>{ const i=(y*W+x)*4; return [data[i],data[i+1],data[i+2]]; };
const isTeal=(r,g,b)=> (b>=r+8 && g>=r+3 && r<170 && b<205 && !(r>205&&g>205&&b>205));
const cols=26, rows=16, size=10;
const hexCenter=(c,r)=>({x:size*1.5*c+size, y:size*Math.sqrt(3)*(r+0.5*(c&1))+size});
const bw=size*1.5*(cols-1)+size*3, bh=size*Math.sqrt(3)*(rows+0.5)+size;
const pad=(n)=>String(n+1).padStart(2,'0'); const hid=(c,r)=>pad(c)+pad(r);

// [regionName, fx, fy] — full region names, matching wag.js REGIONS
const REGIONS=[['The White March',0.30,0.40],['The Meltlands',0.52,0.28],['The River Settlements',0.47,0.53],
  ['The Bastion at Stonefall',0.68,0.55],['The Pine Expanse',0.42,0.83]];
const CAP=0.20*W; // land beyond this from every anchor is 'Beyond the Frontier' (Unassigned)
const nearestRegion=(ix,iy)=>{ let b=null,bd=1e18; for(const [n,fx,fy] of REGIONS){ const d=Math.hypot(ix-fx*W,iy-fy*H); if(d<bd){bd=d;b=n;} } return bd<=CAP?b:'Unassigned'; };
const seaHex=(c,r)=>{ const ct=hexCenter(c,r), ix=ct.x/bw*W, iy=ct.y/bh*H; let teal=0,tot=0;
  for(let dx=-7;dx<=7;dx+=2)for(let dy=-7;dy<=7;dy+=2){const x=Math.round(ix+dx),y=Math.round(iy+dy);if(x<0||y<0||x>=W||y>=H)continue;tot++;const [rr,gg,bb]=at(x,y);if(isTeal(rr,gg,bb))teal++;}
  return {sea: tot>0&&teal/tot>=0.5, ix, iy}; };

// anchors: [key, fx, fy, region, terrain, icon, town, type, conflict, factions, notes]
const A=[
 ['Fort Caspar',0.585,0.70,'Unassigned','Urban','urban','Fort Caspar',
  'Fort stronghold — a black-basalt fort at the confluence of two rivers, atop a continental cliff; some 200 souls under an iron-willed Warrior.',
  'The Dreamer stirs — each night, 1-in-5 a Fort NPC hears the Call and turns on another. Order is reactive; the party is the only initiative the good guys have.',
  ['Fort Caspar','The Church of the Northern Light','The Sunless Court'],
  'The gate to the Hinterlands. Tavern, church, forge, reliquary, library, a Cleric healer (resurrection, 50 gp), the master-at-arms, and the rumored Black Cells beneath.'],
 ['The White March',0.30,0.40,'The White March','Tundra','tundra','Mons Albus',
  'Mission station — anchor of the northwestern foothills, snow nine months a year.',
  'Brother Halvard is sheriff and cleric both; the Mission Spreads, and the Vargoth paint marks that match no known band.',
  ['The Church of the Northern Light','The Vargoth'],'Anchor station of the White March.'],
 ['The Meltlands',0.52,0.28,'The Meltlands','Swamp or Wetlands','swamp','Sodwater',
  'Mining camp — anchor of the gold-rush bog country.',
  '"Wandering" Cay Roeber rides a circuit for law; claim-jumping and the false thaw kill in equal measure.',
  ['Hollander’s Crew'],'Anchor camp of the Meltlands.'],
 ['The River Settlements',0.47,0.53,'The River Settlements','Swamp or Wetlands','swamp','Three Branches Landing',
  'Barge landing — anchor of the delta and barge country.',
  'Sheriff Toby Vell keeps a fraying peace; the Black Sluice moves cargo the law pretends not to see.',
  ['The Black Sluice'],'Anchor town of the River Settlements.'],
 ['The Bastion at Stonefall',0.68,0.55,'The Bastion at Stonefall','Hills or Mountains','mountain','The Bastion at Stonefall',
  'Walled town — a Tombstone in a basalt gorge.',
  'Sheriff Garrick Holm, a former Fort officer, has not smiled since; the Frostmelt Boys test his walls nightly.',
  ['The Frostmelt Boys'],'Anchor town of the Bastion region.'],
 ['The Pine Expanse',0.42,0.83,'The Pine Expanse','Forest or Jungle','forest','Hollowpine',
  'Trapper town — anchor of the vast boreal Pine Expanse.',
  'Sheriff Aelwyn Greyscale holds the line where the Long Pine Whistle gang runs the timber trails.',
  ['The Long Pine Whistle'],'Anchor town of the Pine Expanse. The Cold Caverns are a peer region below.'],
];
const anchorAt={};
for(const a of A){ const fx=a[1],fy=a[2]; let best=null,bd=1e9;
  for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){const ct=hexCenter(c,r);const d=(ct.x/bw*W-fx*W)**2+(ct.y/bh*H-fy*H)**2;if(d<bd){bd=d;best=hid(c,r);}} anchorAt[best]=a; }

const hexes={};
for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){ const id=hid(c,r); const cell=seaHex(c,r);
  if(anchorAt[id]){ const [,,,region,terrain,icon,town,type,conflict,factions,notes]=anchorAt[id];
    hexes[id]={ name:town, region, terrain, icon, canon:true, settlements:[{name:town,type,conflict}], factions, notes };
  } else if(cell.sea){ hexes[id]={ terrain:'Ocean or Coast', icon:'coast' }; }
  else { hexes[id]={ region: nearestRegion(cell.ix,cell.iy) }; }
}
const seed={ name:'The Hinterlands', cols, rows, hexMiles:6, hexes };
const js='// hinterlands-seed.js — the Hinterlands, converted from the canonical Fort world\n'+
'// map into native hexes: teal = sea (Ocean or Coast), land partitioned into the\n'+
'// five regions by nearest anchor, the six canon towns placed and locked.\n'+
'// Regions are a nearest-anchor (Voronoi) approximation — refine by hand.\n'+
'// Regenerate with scripts/gen-seed.mjs against assets/the-fort-world-map.png.\n\n'+
'export const HINTERLANDS_SEED = '+JSON.stringify(seed)+';\n';
fs.writeFileSync('/home/user/Atlas/hinterlands-seed.js', js);
const land=Object.values(hexes).filter(h=>h.region&&h.region!=='Unassigned'&&!h.canon).length;
const sea=Object.values(hexes).filter(h=>h.terrain==='Ocean or Coast').length;
console.log('wrote hinterlands-seed.js —', Object.keys(hexes).length,'hexes ( land',land,'sea',sea,'anchors',Object.keys(anchorAt).length,') bytes',js.length);
// also copy the generator into the repo for reproducibility
fs.mkdirSync('/home/user/Atlas/scripts',{recursive:true});
fs.copyFileSync('gen-seed.mjs','/home/user/Atlas/scripts/gen-seed.mjs');
