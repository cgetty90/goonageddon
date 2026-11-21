import {symbols,tiers} from "./math-v1.mjs";
import {config} from "./math-v2.mjs";
import {entryScenes,selectEnding,cinematicDuration} from "./bonus-cinema.mjs";
import {unitsAt} from "./rgs.mjs";
const SCATTER=14, EXPAND=15, WILD=16;
const characterArt=Object.freeze({'alien-boss':'commander',cyclopz:'cyclopz','octo-lab':'octo','space-cow':'cow','wild-base':'commander'});
const artFor=asset=>assetFile(characterArt[asset]?'assets/goon-v5/'+characterArt[asset]+'.png':'assets/reel-art-v4/'+asset+'.png');
const displaySymbol=(asset,name)=>asset==='alien-boss'?'Goon Commander':name;
const $ = id => document.getElementById(id);
const assetFile = path => globalThis.__toonAssets?.[path] || path;
export function createRenderer({wallet, money, audio, status, transition}) {
const prefersReduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
let feature=-1,shownWin=0,shownPoints=0,shownStage=0,cells=[],ticker=0;
const wait=(ms,fast=false)=>new Promise(done=>setTimeout(done,fast?0:prefersReduced?Math.min(ms,45):wallet.settings.turbo?Math.min(ms*.23,260):ms));
function imageInfo(id) {
  if(id<SCATTER) return [symbols[id][1],displaySymbol(symbols[id][1],symbols[id][0]),''];
  if(id===SCATTER) return ['scatter-ufo','Scatter','SCATTER'];
  if(id===EXPAND) return ['wild-base','Expanding wild','EXPAND WILD'];
  const mult=id-WILD;
  return ['wild-base',mult?'Wild ×'+mult:'Wild',mult?'WILD ×'+mult:'WILD'];
}
function makeCell(id){
  const [asset,name,badge]=imageInfo(id);
  const cell=document.createElement('div');
  cell.dataset.symbol=id;
  cell.className='cell'+(id>=EXPAND?' wild':id===SCATTER?' scatter':'');
  const img=new Image();
  img.alt=name;
  img.src=artFor(asset);
  img.addEventListener('error',()=>{img.hidden=true;cell.textContent=name; cell.classList.add('missing');},{once:true});
  cell.append(img);
  if(badge) cell.append(Object.assign(document.createElement('span'),{className:'symbol-caption',textContent:badge}));
  return cell;
}
function reelNode(reel){
  const container=document.createElement('div');
  container.className='reel';
  container.style.setProperty('--rows',reel.length);
  container.append(...reel.map(makeCell));
  return container;
}
function render(board){
  $('reels').dataset.max=Math.max(...board.map(reel=>reel.length));
  const reels=board.map(reelNode);
  $('reels').replaceChildren(...reels);
  cells=reels.map(node=>Array.from(node.children));
}
function winCounter(units,fast){
  cancelAnimationFrame(ticker);
  const previous=shownWin;
  shownWin=units;
  if(fast||prefersReduced||wallet.settings.turbo){$('win').textContent=money(units);return;}
  const start=performance.now();
  function animate(now){
    const t=Math.min(1,(now-start)/360);
    $('win').textContent=money(previous+(units-previous)*t);
    if(t<1) ticker=requestAnimationFrame(animate);
  }
  ticker=requestAnimationFrame(animate);
}
function featurePanel(tier,remaining=0,scatters=0){
  feature=tier;
  const active=tier>=0;
  if(active) $('game').dataset.tier=tier+1;
  else delete $('game').dataset.tier;
  $('chaos').hidden=!active;
  $('pilot').hidden=false;
  if(!active) $('commander-reaction').hidden=true;
  $('feature-stage').hidden=!active;
  $('mode').textContent=active?tiers[tier].toUpperCase():'';
  $('feature-label').textContent=active?'FREE SPINS':'SCATTER BONUS';
  $('feature-number').hidden=!active;
  $('feature-number').textContent=active?remaining:'';
  if(active)$('feature-note').textContent=scatters?scatters+' scatters triggered':'Direct feature entry';
  else $('feature-note').textContent='3 / 4 / 5+ UFOs';
  updateMeter();
}
const reactions=['Smooth, Commander','Tongue out','Drool alert','Heart eyes','Maximum swoon'];
function showCommanderReaction(stage){
  const panel=$('commander-reaction');
  panel.hidden=false;
  panel.dataset.stage=stage;
  panel.querySelector('img').src=assetFile('assets/goon-v5/stage-'+stage+'.png');
  panel.querySelector('span').textContent=reactions[stage-1];
}
function updateMeter(){
  $('points').textContent=shownPoints+' / 120 Chaos Points';
  $('chaos-progress').value=shownPoints;
  $('feature-stage').textContent='Stage '+shownStage+' / 5';
  $('meter').replaceChildren(...config.milestones.map((points,index)=>{
    const level=document.createElement('div');
    level.className='level'+(index<shownStage?' active':'');
    level.textContent=(index<shownStage?'✓ ':'')+points;
    level.append(Object.assign(document.createElement('small'),{textContent:feature<0?'+2 spins':'+2 spins · ×'+config.drops[feature][index][2]}));
    return level;
  }));
}
function particles(positions,count=6){
  if(prefersReduced||wallet.settings.turbo)return;
  const bounds=$('effect').getBoundingClientRect();
  for(const [c,r] of positions){
    const box=cells[c]?.[r]?.getBoundingClientRect();
    if(!box)continue;
    for(let i=0;i<count;i++){
      const spark=document.createElement('i');
      spark.className='spark';
      spark.style.left=(box.x-bounds.x+box.width/2)+'px';
      spark.style.top=(box.y-bounds.y+box.height/2)+'px';
      const angle=(i/count)*Math.PI*2+c;
      const reach=21+((r*17+i*7)%29);
      spark.style.setProperty('--dx',Math.cos(angle)*reach+'px');
      spark.style.setProperty('--dy',Math.sin(angle)*reach+'px');
      $('effect').append(spark);
      setTimeout(()=>spark.remove(),550);
    }
  }
}
function showConnections(groups) {
  if(prefersReduced||wallet.settings.turbo)return;
  const bounds=$('effect').getBoundingClientRect();
  for(const group of groups){
    const eligible=cells.slice(0,group.length).map(reel=>reel.filter(cell=>{
      const id=Number(cell.dataset.symbol);
      return id===group.id||id>=WILD;
    }));
    const natural=eligible.findIndex(reel=>reel.some(cell=>Number(cell.dataset.symbol)===group.id));
    const nodes=eligible.map((reel,c)=>c===natural?reel.find(cell=>Number(cell.dataset.symbol)===group.id):reel[0]);
    for(let c=1;c<nodes.length;c++){
      const a=nodes[c-1].getBoundingClientRect(), b=nodes[c].getBoundingClientRect();
      const x=a.x+a.width/2, y=a.y+a.height/2;
      const dx=b.x+b.width/2-x, dy=b.y+b.height/2-y;
      const line=document.createElement('i');
      line.className='connection';
      Object.assign(line.style,{left:(x-bounds.x)+'px',top:(y-bounds.y)+'px',width:Math.hypot(dx,dy)+'px',transform:'rotate('+Math.atan2(dy,dx)+'rad)'});
      $('effect').append(line);
      setTimeout(()=>line.remove(),360);
    }
  }
}
async function spinReels(board){
  if(prefersReduced){render(board);await wait(60);return;}
  const previous=cells.map(reel=>reel.map(cell=>Number(cell.dataset.symbol)));
  render(board);
  const turbo=wallet.settings.turbo;
  await Promise.all(Array.from($('reels').children).map(async (reel,c)=>{
    const final=board[c];
    const old=Array.from({length:final.length},(_,r)=>previous[c]?.[r] ?? (c+r)%14);
    const intermediate=Array.from({length:turbo?5:16},(_,r)=>(r*5+c*3+2)%14);
    const strip=document.createElement('div');
    strip.className='reel-strip';
    strip.setAttribute('aria-hidden','true');
    strip.append(...[...final,...intermediate,...old].map(makeCell));
    reel.append(strip);
    reel.classList.add('in-flight');
    const travel=(final.length+intermediate.length)*cells[c][0].getBoundingClientRect().height;
    const y=distance=>'translate3d(0,'+distance+'px,0)';
    const duration=turbo?345+c*21:1010+c*101;
    const delay=c*(turbo?8:23);
    const animation=strip.animate([
      {transform:y(-travel),filter:'blur(0)',offset:0,easing:'cubic-bezier(.55,0,.76,.63)'},
      {transform:y(-travel*.82),filter:'blur(2px)',offset:.28,easing:'linear'},
      {transform:y(-travel*.23),filter:'blur(2px)',offset:.64,easing:'cubic-bezier(.17,.58,.32,1)'},
      {transform:y(0),filter:'blur(0)',offset:.87,easing:'ease-out'},
      {transform:y(-3),filter:'blur(0)',offset:.93,easing:'ease-in-out'},
      {transform:y(0),filter:'blur(0)',offset:1}
    ],{duration,delay,fill:'both'});
    const brake=setTimeout(()=>{
      if(!reel.isConnected)return;
      reel.classList.add('braking');
      audio.cue('stop',c);
    },delay+duration*.87);
    await animation.finished.catch(()=>{});
    clearTimeout(brake);
    strip.remove();
    reel.classList.remove('in-flight','braking');
    reel.classList.add('impact');
  }));
}
async function deliverWilds(event){
  if(prefersReduced||wallet.settings.turbo||!event.positions.length){await wait(270);return;}
  const bounds=$('effect').getBoundingClientRect();
  const ship=$('beam-ship').getBoundingClientRect();
  const originX=ship.x+ship.width*.5-bounds.x;
  const originY=ship.y+ship.height*.68-bounds.y;
  await Promise.all(event.positions.map(async ([c,r],count)=>{
    const target=cells[c][r].getBoundingClientRect();
    const x=target.x+target.width*.5-bounds.x;
    const y=target.y+target.height*.5-bounds.y;
    const bolt=document.createElement('i');
    bolt.className='wild-flight';
    bolt.textContent='×'+event.mult;
    Object.assign(bolt.style,{left:originX+'px',top:originY+'px'});
    $('effect').append(bolt);
    const dx=x-originX,dy=y-originY;
    const flight=bolt.animate([
      {transform:'translate(-50%,-50%) scale(.26)',opacity:0},
      {transform:'translate('+dx*.38+'px,'+dy*.18+'px) scale(1.15)',opacity:1,offset:.3},
      {transform:'translate('+dx+'px,'+dy+'px) scale(.74)',opacity:.92}
    ],{duration:435+event.level*29,delay:Math.min(200,count*30),fill:'both',easing:'cubic-bezier(.32,.12,.58,1)'});
    await flight.finished.catch(()=>{});
    bolt.remove();
    cells[c][r].classList.add('hit-wild');
  }));
}
function runCinematic(scene,{tier=0,kind='entry',award='',title=scene.name,scatters=0}={}){
  const dialog=$('bonus-cinema');
  const duration=cinematicDuration(scene.duration,{reduced:prefersReduced,turbo:wallet.settings.turbo});
  dialog.dataset.tier=String(tier+1);
  dialog.dataset.kind=kind;
  dialog.dataset.band=scene.band??'';
  dialog.dataset.cast=scene.cast;
  dialog.dataset.beat='approach';
  dialog.style.setProperty('--cinema-time',duration+'ms');
  dialog.querySelector('.cinema-cast').src=assetFile('assets/goon-v5/'+scene.cast+'.png');
  $('cinema-kicker').textContent=kind==='entry'?scene.name:scene.band==='maximum'?'GOONAGEDDON · ROUND TOTAL':'GOONAGEDDON · BONUS COMPLETE';
  $('cinema-title').textContent=title;
  $('cinema-award').textContent=award;
  $('cinema-reaction').textContent=scene.reaction;
  $('cinema-signal').replaceChildren(...Array.from({length:scatters},()=>{
    const icon=new Image();
    icon.src=artFor('scatter-ufo');icon.alt='';return icon;
  }));
  const energy=kind==='entry'?tier+1:['low','moderate','high','exceptional','maximum'].indexOf(scene.band);
  $('cinema-particles').replaceChildren(...Array.from({length:prefersReduced?0:8+energy*5},(_,i)=>{
    const speck=document.createElement('i');
    const a=i*2.399, distance=35+(i%7)*5;
    speck.style.setProperty('--x',Math.cos(a)*distance+'vw');
    speck.style.setProperty('--y',Math.sin(a)*distance*.8+'vh');
    speck.style.setProperty('--lag',i%6*25+'ms');
    return speck;
  }));
  return new Promise(resolve=>{
    const timers=[];
    function finish(){
      timers.forEach(clearTimeout);
      $('cinema-skip').removeEventListener('click',finish);
      dialog.removeEventListener('cancel',cancel);
      dialog.removeEventListener('close',finish);
      if(dialog.open)dialog.close();
      resolve();
    }
    function cancel(event){event.preventDefault();finish();}
    function phase(fraction,beat,cue){
      timers.push(setTimeout(()=>{
        dialog.dataset.beat=beat;
        if(kind==='entry')$('cinema-reaction').textContent=beat==='fire'?scene.charge:scene.reaction;
        if(cue)audio.cue(cue,tier);
      },duration*fraction));
    }
    $('cinema-skip').addEventListener('click',finish);
    dialog.addEventListener('cancel',cancel);
    dialog.addEventListener('close',finish);
    dialog.showModal();
    audio.cue(kind==='entry'?['regularAlarm','superAlarm','ultimateAlarm'][tier]:scene.band==='low'?'deflated':'endingLift',tier);
    phase(.22,'cockpit',kind==='entry'?'alienGasp':undefined);
    phase(.53,'fire',kind==='entry'?['purpleCharge','weaponSurge','planetBlast'][tier]:energy>1?'planetBlast':undefined);
    phase(.68,'title',kind==='entry'?'entryFanfare':scene.band==='maximum'?'cap':undefined);
    timers.push(setTimeout(finish,duration));
  });
}
async function animateRound(round, amount, cursor, checkpoint){
  const value = multiplier => amount === null ? multiplier : unitsAt(amount, multiplier);
  shownPoints=0;shownStage=0;
  featurePanel(-1);
  winCounter(0,true);
  let scatterCount=0;
  for(const e of round.events){
    const fast=e.index<=cursor;
    transition(e.type);
    switch(e.type){
      case 'purchaseReveal':
        scatterCount=e.scatters;
        await showPurchaseScatters(e.tier,e.board,fast);
        break;
      case 'spin': {
        if(e.bonus) $('feature-number').textContent=e.remaining;
        scatterCount=e.scatters || scatterCount;
        $('ways').textContent=e.ways.toLocaleString('en-GB')+' WAYS';
        status(e.bonus?'Free spin in flight':'Reels spinning');
        if(!fast){
          audio.cue('spin');
          await spinReels(e.board);
        } else render(e.board);
        if(!e.bonus&&e.scatters>1){audio.cue('scatter');status(e.scatters+' scatters landed');await wait(220,fast);}
        break;
      }
      case 'expand':
        status('Expanding wild');
        if(!fast){
          audio.cue('expand');
          $('pilot').classList.add('react');
          setTimeout(()=>$('pilot').classList.remove('react'),680);
        }
        e.reels.forEach(c=>$('reels').children[c].classList.add('expanding'));
        await wait(310,fast);
        render(e.board);
        e.reels.forEach(c=>$('reels').children[c].classList.add('expanding'));
        await wait(440,fast);
        break;
      case 'win':
        status(e.groups.reduce((n,g)=>n+g.ways,0).toLocaleString('en-GB')+' winning ways');
        winCounter(value(e.total),fast);
        if(!fast){
          audio.cue(e.paid>=1500?'large':'win');
          e.positions.forEach(([c,r])=>cells[c][r].classList.add('winning'));
          showConnections(e.groups);
          await wait(330);
          audio.cue('burst');
          e.positions.forEach(([c,r])=>cells[c][r].classList.add('burst'));
          particles(e.positions);
          await wait(200);
        }
        break;
      case 'tumble':
        render(e.board);
        if(!fast){
          audio.cue('tumble');
          e.fallen.forEach(([c,r,dist])=>{
            const cell=cells[c][r];
            cell.style.setProperty('--from',(-100*dist)+'%');
            cell.classList.add('falling');
          });
          await wait(445);
        }
        break;
      case 'bonus':
        if(!fast)await runCinematic(entryScenes[e.tier],{
          tier:e.tier,title:tiers[e.tier],award:e.remaining+' FREE SPINS',scatters:scatterCount||e.tier+3
        });
        featurePanel(e.tier,e.remaining,scatterCount);
        status(tiers[e.tier]+' activated · '+e.remaining+' free spins');
        await wait(420,fast);
        break;
      case 'points':
        shownPoints=e.points;
        updateMeter();
        break;
      case 'milestone':
        shownStage=e.stage;
        showCommanderReaction(e.stage);
        $('feature-number').textContent=e.remaining;
        updateMeter();
        status('Milestone '+e.stage+' · +2 free spins');
        if(!fast)audio.cue('milestone',e.stage);
        await wait(690,fast);
        break;
      case 'drop':
        status((e.boosted?'Wild Surge':'Wild Drop')+' · '+e.positions.length+' wilds ×'+e.mult);
        if(!fast){
          audio.cue('beam',e.level);
          $('game').classList.add('beaming');
          $('game').classList.toggle('surging',e.boosted);
          await wait(175);
          await deliverWilds(e);
        }
        render(e.board);
        e.positions.forEach(([c,r])=>cells[c][r].classList.add('dropping','wild-impact'));
        if(!fast){particles(e.positions,e.boosted?7:4);audio.cue('drop',e.level);}
        await wait(425,fast);
        $('game').classList.remove('beaming','surging');
        break;
      case 'guarantee':
        winCounter(value(e.total),fast);
        status('100× bonus minimum applied');
        await wait(920,fast);
        break;
      case 'cap':
        status('Maximum win · 50,000×');
        document.querySelectorAll('.burst,.winning').forEach(cell=>cell.classList.remove('burst','winning'));
        if(!fast&&round.tier<0)await runCinematic(selectEnding(e.paid,true),{tier:2,kind:'ending',award:money(value(e.paid))});
        break;
      case 'summary': {
        const adjustedBonus=e.bonusWin+round.events.at(-2).bonusDelta;
        const finalTotal=round.events.at(-1).total;
        status(tiers[e.tier]+' complete · '+money(value(adjustedBonus)));
        if(!fast)await runCinematic(selectEnding(e.bonusWin,e.capped),{
          tier:e.tier,kind:'ending',award:money(value(e.capped?finalTotal:adjustedBonus))
        });
        break;
      }
      case 'settlementAdjustment':
        winCounter(value(e.total),true);
        if(e.delta)status('Final total adjusted to '+money(value(e.total)));
        break;
      case 'end':
        if(round.tier<0)status(e.capped?'Maximum win · 50,000×':e.total?'Round complete · '+money(value(e.total)):'Ready to spin');
        break;
    }
    if(!fast&&checkpoint&&['purchaseReveal','spin','bonus','summary','end'].includes(e.type))await checkpoint(e.index);
  }
  featurePanel(-1);
}
async function showPurchaseScatters(tier,board,fast){
  winCounter(0,true);
  transition('purchase-entry');
  const game=$('game');
  const effects=$('effect');
  status('Incoming UFO scatters');
  render(board);
  game.classList.add('beaming','purchase-flight');
  const landingOrder=[0,2,4,1,5];
  try {
    for(const [i,c] of landingOrder.slice(0,tier+3).entries()){
      const r=Math.floor(board[c].length/2);
      const old=cells[c][r];
      const scatter=makeCell(SCATTER);
      scatter.classList.add('purchased-scatter');
      if(!fast&&!prefersReduced){
        const area=effects.getBoundingClientRect(), target=old.getBoundingClientRect();
        const x=target.left+target.width/2-area.left;
        const y=target.top+target.height/2-area.top;
        const fromX=area.width/2;
        const fromY=-Math.min(48,area.height*.11);
        const flyer=new Image();
        flyer.src=scatter.querySelector('img').src;
        flyer.alt='';
        flyer.className='purchase-flyer';
        flyer.style.width=Math.min(target.width*.84,target.height*.94)+'px';
        effects.append(flyer);
        audio.cue('scatterLaunch',i);
        try {
          await flyer.animate([
            {transform:'translate3d('+fromX+'px,'+fromY+'px,0) translate(-50%,-50%) scale(.38)',opacity:.18},
            {transform:'translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) scale(1.16)',opacity:1,offset:.84},
            {transform:'translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) scale(1)',opacity:1}
          ],{duration:wallet.settings.turbo?225:395,easing:'cubic-bezier(.32,.15,.63,1)',fill:'both'}).finished.catch(()=>{});
        }finally{flyer.remove();}
      }
      old.replaceWith(scatter);
      cells[c][r]=scatter;
      if(!fast){audio.cue('scatterLand',i);particles([[c,r]],6);await wait(75);}
    }
    status((tier+3)+' scatters landed · '+tiers[tier]);
    if(!fast)await new Promise(done=>setTimeout(done,prefersReduced?410:wallet.settings.turbo?640:900));
  }finally{game.classList.remove('beaming','purchase-flight');}
}

return {render,animateRound,winCounter,reset:()=>featurePanel(-1)};
}
