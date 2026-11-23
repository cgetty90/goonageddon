import {symbols,tiers} from "./math-v1.mjs";
import {config} from "./math-v2.mjs";
import {entryScenes,selectEnding,cinematicDuration} from "./bonus-cinema.mjs";
import {unitsAt} from "./round-validation.mjs";
import {symbolArt} from './visual-art.mjs';
import {animateCells,animateCinema,cinemaArt,warmReactions} from './visual-reactions.mjs';
import {mountForegroundPilot} from './foreground-pilot.mjs';
import {scoreAtCursor} from './audio.mjs';
const SCATTER=14, EXPAND=15, WILD=16;
const artFor=asset=>assetFile(symbolArt(asset));
const displaySymbol=(asset,name)=>asset==='alien-boss'?'Goon Commander':name;
const $ = id => document.getElementById(id);
const assetFile = path => globalThis.__toonAssets?.[path] || path;
export function createRenderer({wallet, money, audio, status, transition}) {
warmReactions();
const react=mountForegroundPilot($('pilot-rig'));
const prefersReduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
let feature=-1,shownWin=0,shownPoints=0,shownStage=0,cells=[],ticker=0;
const wait=(ms,fast=false)=>new Promise(done=>setTimeout(done,fast?0:prefersReduced?Math.min(ms,45):wallet.settings.turbo?Math.min(ms*.23,260):ms));
function imageInfo(id) {
  if(id<SCATTER) return [symbols[id][1],displaySymbol(symbols[id][1],symbols[id][0]),''];
  if(id===SCATTER) return ['scatter-ufo','Scatter','SCATTER'];
  if(id===EXPAND) return ['expanding','XWAYS expanding wild','XWAYS'];
  const mult=id-WILD;
  return [mult?'multiplier':'wild-base',mult?'Wild ×'+mult:'Wild',mult?'WILD ×'+mult:'WILD'];
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
  if(asset==='octo-lab'||asset==='scatter-ufo'){
    const picture=document.createElement('picture');
    const source=document.createElement('source');
    source.media='(max-height: 300px) and (orientation: landscape)';
    source.srcset=artFor(asset==='octo-lab'?'octo-compact':'scatter-compact');
    picture.append(source,img);cell.append(picture);
  }else cell.append(img);
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
  $('ways').textContent=board.reduce((ways,reel)=>ways*reel.length,1).toLocaleString('en-GB');
}
let winFeedback,stopCounterSound;
function winCounter(units,fast){
  cancelAnimationFrame(ticker);
  stopCounterSound?.();
  stopCounterSound=undefined;
  const previous=shownWin;
  shownWin=units;
  $('win-panel').toggleAttribute('data-award',units>0);
  winFeedback?.cancel();
  if(units>previous&&!prefersReduced&&!wallet.settings.turbo){
    winFeedback=$('win-panel').animate([
      {boxShadow:'inset 0 0 19px #f3a33f85, 0 0 7px #ffb85483'},
      {boxShadow:'inset 0 1px 6px #0a060f'}
    ],{duration:640,easing:'ease-out'});
  }
  if(fast||prefersReduced||wallet.settings.turbo){$('win').textContent=money(units);return;}
  const start=performance.now();
  if(units>previous)stopCounterSound=audio.cue('count-up',{length:.36});
  function animate(now){
    const t=Math.min(1,(now-start)/360);
    $('win').textContent=money(Math.round(previous+(units-previous)*t));
    if(t<1) ticker=requestAnimationFrame(animate);
  }
  ticker=requestAnimationFrame(animate);
}
function featurePanel(tier,remaining=0){
  feature=tier;
  const active=tier>=0;
  if(active) $('game').dataset.tier=tier+1;
  else delete $('game').dataset.tier;
  $('chaos').hidden=!active;
  if(!active) $('commander-reaction').hidden=true;
  $('feature-stage').hidden=!active;
  $('mode').textContent=active?tiers[tier].toUpperCase():'';
  $('feature-label').textContent=active?'FREE SPINS':'SCATTER BONUS';
  $('feature-number').hidden=!active;
  $('feature-number').textContent=active?remaining:'';
  updateMeter();
}
const reactions=['Smooth, Commander','Tongue out','Drool alert','Heart eyes','Maximum swoon'];
function showCommanderReaction(stage){
  const panel=$('commander-reaction');
  panel.hidden=false;
  panel.dataset.stage=stage;
  panel.querySelector('img').src=cinemaArt('commander');
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
      setTimeout(()=>line.remove(),440);
    }
  }
}
async function spinReels(board){
  const stopSound=()=>audio.cue('reel-stop',{length:wallet.settings.turbo?.22:.48});
  function specialLandings(symbols){
    audio.scatter(symbols.filter(id=>id===SCATTER).length);
    if(symbols.some(id=>id>=WILD))audio.cue('wild-land',{length:wallet.settings.turbo?.38:.85});
  }
  if(prefersReduced){render(board);stopSound();specialLandings(board.flat());await wait(60);return;}
  const previous=cells.map(reel=>reel.map(cell=>Number(cell.dataset.symbol)));
  render(board);
  const turbo=wallet.settings.turbo;
  await Promise.all(Array.from($('reels').children).map(async (reel,c)=>{
    const final=board[c];
    const old=previous[c]?.length?previous[c]:final;
    const intermediate=Array.from({length:turbo?5:16},(_,r)=>(r*5+c*3+2)%14);
    const strip=document.createElement('div');
    strip.className='reel-strip';
    strip.setAttribute('aria-hidden','true');
    strip.style.setProperty('--outgoing-pitch','calc(var(--aperture-height) / '+old.length+')');
    const outgoing=[...old,...intermediate.slice(0,2)].map(makeCell);
    outgoing.forEach(cell=>cell.classList.add('outgoing'));
    strip.append(...[...final,...intermediate].map(makeCell),...outgoing);
    reel.append(strip);
    reel.classList.add('in-flight');
    const travel=final.length+intermediate.length;
    const y=distance=>'translate3d(0,calc(var(--reel-pitch) * '+distance+'),0)';
    const duration=turbo?345+c*21:1010+c*101;
    const delay=c*(turbo?8:23);
    if(old.length!==final.length){
      for(const cell of outgoing)cell.animate([
        {height:'var(--outgoing-pitch)',offset:0},
        {height:'var(--outgoing-pitch)',offset:.16},
        {height:'var(--reel-pitch)',offset:1}
      ],{duration:duration*.29,delay,fill:'both',easing:'ease-in-out'});
    }
    const animation=strip.animate([
      {transform:y(-travel),filter:'blur(0)',offset:0,easing:'cubic-bezier(.55,0,.76,.63)'},
      {transform:y(-travel*.82),filter:'blur(2px)',offset:.28,easing:'linear'},
      {transform:y(-travel*.23),filter:'blur(2px)',offset:.64,easing:'cubic-bezier(.17,.58,.32,1)'},
      {transform:'translateY(0)',filter:'blur(0)',offset:.87,easing:'ease-out'},
      {transform:'translateY(-3px)',filter:'blur(0)',offset:.93,easing:'ease-in-out'},
      {transform:'translateY(0)',filter:'blur(0)',offset:1}
    ],{duration,delay,fill:'both'});
    let landed=false;
    function land(){
      if(landed||!reel.isConnected)return;
      landed=true;
      reel.classList.add('braking');
      stopSound();specialLandings(final);
    }
    const brake=setTimeout(land,delay+duration*.87);
    await animation.finished.catch(()=>{});
    clearTimeout(brake);
    land();
    strip.remove();
    reel.classList.remove('in-flight','braking');
    reel.classList.add('impact');
  }));
}
function tumbleFallen(event,fast){
  // Math v1 keeps each reel's height during a cascade. If a different board shape
  // is supplied, use the recorded distance and the previous row pitch for its origins.
  const oldGeometry=fast||prefersReduced?[]:cells.map((reel,c)=>
    reel.length!==event.board[c].length?reel[0]?.getBoundingClientRect():null);
  render(event.board);
  if(fast)return;
  for(const [c,r,dist] of event.fallen){
    const cell=cells[c][r],before=oldGeometry[c];
    let from=(-100*dist)+'%';
    if(before){
      const after=cell.getBoundingClientRect();
      const origin=before.top+(r-dist+.5)*before.height;
      from=(origin-after.top-after.height*.5)+'px';
      const art=cell.querySelector('picture, img');
      art?.animate([
        {height:before.height*.99+'px',alignSelf:'center'},
        {height:after.height*.99+'px',alignSelf:'center'}
      ],{duration:wallet.settings.turbo?90:385,easing:'ease-out'});
    }
    cell.style.setProperty('--from',from);
    cell.classList.add('falling');
  }
}
function tumbleImpacts(event){
  const arrivals=event.fallen.filter(([,row,distance])=>row-distance<0);
  const symbols=arrivals.map(([col,row])=>event.board[col][row]);
  const delay=prefersReduced?0:wallet.settings.turbo?.065:.34;
  audio.scatter(symbols.filter(id=>id===SCATTER).length,delay);
  const wildReels=new Set(arrivals.filter(([col,row])=>event.board[col][row]>=WILD).map(([col])=>col));
  for(const [i] of [...wildReels].entries())audio.cue('wild-land',{delay:delay+i*.022,length:wallet.settings.turbo?.33:.62,level:1/Math.sqrt(wildReels.size)});
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
function runCinematic(scene,{tier=0,kind='entry',award='',title=scene.name,scatters=0,bonusEnding=false}={}){
  const dialog=$('bonus-cinema');
  const duration=cinematicDuration(scene.duration,{reduced:prefersReduced,turbo:wallet.settings.turbo});
  if(kind==='entry')audio.enterBonus(tier);
  dialog.dataset.tier=String(tier+1);
  dialog.dataset.kind=kind;
  dialog.dataset.band=scene.band??'';
  dialog.dataset.cast=scene.cast;
  dialog.dataset.beat='approach';
  dialog.style.setProperty('--cinema-time',duration+'ms');
  dialog.querySelector('.cinema-cast').src=cinemaArt(scene.cast);
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
    let stopSound;
    let ended=false;
    const stopStinger=()=>{stopSound?.();stopSound=undefined;};
    const dismiss=()=>finish(true);
    function finish(skipped){
      if(ended)return;
      ended=true;
      timers.forEach(clearTimeout);
      $('cinema-skip').removeEventListener('click',dismiss);
      dialog.removeEventListener('cancel',cancel);
      dialog.removeEventListener('close',dismiss);
      if(skipped||!(kind==='entry'&&tier===2||scene.band==='maximum'))stopStinger();
      if(skipped)audio.releaseDuck();
      if(dialog.open)dialog.close();
      resolve();
    }
    function cancel(event){event.preventDefault();dismiss();}
    function phase(fraction,beat,onBeat){
      timers.push(setTimeout(()=>{
        dialog.dataset.beat=beat;
        if(kind==='entry')$('cinema-reaction').textContent=beat==='fire'?scene.charge:scene.reaction;
        onBeat?.();
      },duration*fraction));
    }
    $('cinema-skip').addEventListener('click',dismiss);
    dialog.addEventListener('cancel',cancel);
    dialog.addEventListener('close',dismiss);
    dialog.showModal();
    animateCinema(dialog,scene.cast,kind==='entry'?'bonus':'win',duration);
    if(kind==='entry')stopSound=audio.cue(['regular-trigger','super-trigger','super-super-trigger'][tier]);
    const winCue={high:'big-win',exceptional:'mega-win',maximum:'max-win'}[scene.band];
    if(kind==='ending'&&bonusEnding&&winCue)stopSound=audio.cue('bonus-complete',{length:duration*.32/1000});
    phase(.22,'cockpit');
    phase(.53,'fire');
    phase(.68,'title',kind==='ending'?()=>{
      stopStinger();
      if(winCue||bonusEnding)stopSound=audio.cue(winCue??'bonus-complete');
    }:undefined);
    timers.push(setTimeout(()=>finish(false),duration));
  });
}
async function animateRound(round, amount, cursor, checkpoint){
  const value = multiplier => amount === null ? multiplier : unitsAt(amount, multiplier);
  shownPoints=0;shownStage=0;
  audio.beginRound(round.id);
  audio.prime(round.tier);
  audio.setScore(scoreAtCursor(round.events,cursor));
  featurePanel(-1);
  winCounter(0,true);
  let scatterCount=0;
  for(const e of round.events){
    const fast=e.index<=cursor;
    audio.beginEvent(e.index);
    transition(e.type);
    switch(e.type){
      case 'purchaseReveal':
        scatterCount=e.scatters;
        await showPurchaseScatters(e.tier,e.board,fast);
        break;
      case 'spin': {
        if(e.bonus) $('feature-number').textContent=e.remaining;
        scatterCount=e.scatters || scatterCount;
        status(e.bonus?'Free spin in flight':'Reels spinning');
        if(!fast){
          audio.cue('spin-start',{length:wallet.settings.turbo?.34:Infinity});
          if(!wallet.settings.turbo&&!prefersReduced){
            animateCells(cells.flat(),'anticipation',245);
            await wait(245);
          }
          await spinReels(e.board);
        } else render(e.board);
        if(!e.bonus&&e.scatters>1){
          if(!fast)react('anticipation');
          status(e.scatters+' scatters landed');await wait(220,fast);
        }
        break;
      }
      case 'expand':
        status('XWAYS · Expanding Wild');
        if(!fast){
          animateCells(e.reels.flatMap(c=>cells[c]),'anticipation',310);
        }
        e.reels.forEach(c=>$('reels').children[c].classList.add('expanding'));
        await wait(440,fast);
        render(e.board);
        if(!fast){
          const level=1/Math.sqrt(e.reels.length);
          e.reels.forEach((_,i)=>audio.cue('wild-land',{delay:i*.038,level,length:wallet.settings.turbo?.34:.75}));
        }
        e.reels.forEach(c=>{
          $('reels').children[c].classList.add('expanding','expanded-reel');
          cells[c][0].append(Object.assign(document.createElement('span'),{
            className:'xways-reel-badge',textContent:'XWAYS'
          }));
        });
        if(!fast&&!wallet.settings.turbo)animateCells(e.reels.flatMap(c=>cells[c]),'bonus',440);
        await wait(440,fast);
        break;
      case 'win':
        status(e.groups.reduce((n,g)=>n+g.ways,0).toLocaleString('en-GB')+' winning ways');
        winCounter(value(e.total),fast);
        if(!fast){
          react('win');
          e.positions.forEach(([c,r])=>cells[c][r].classList.add('winning'));
          if(!wallet.settings.turbo)animateCells(e.positions.map(([c,r])=>cells[c][r]),'win',530);
          showConnections(e.groups);
          if(prefersReduced)await new Promise(done=>setTimeout(done,280));
          else await wait(440);
          audio.cue('destruction',{length:wallet.settings.turbo?.29:Infinity});
          e.positions.forEach(([c,r])=>cells[c][r].classList.add('burst'));
          particles(e.positions);
          await wait(200);
        }
        break;
      case 'tumble':
        tumbleFallen(e,fast);
        if(!fast){
          tumbleImpacts(e);
          await wait(445);
        }
        break;
      case 'bonus':
        if(!fast)await runCinematic(entryScenes[e.tier],{
          tier:e.tier,title:tiers[e.tier],award:e.remaining+' FREE SPINS',scatters:scatterCount||e.tier+3
        });
        featurePanel(e.tier,e.remaining);
        if(!fast)react('bonus');
        status(tiers[e.tier]+' activated · '+e.remaining+' free spins');
        await wait(420,fast);
        break;
      case 'points':
        shownPoints=e.points;
        updateMeter();
        break;
      case 'milestone':
        shownStage=e.stage;
        if(!fast&&!prefersReduced&&!wallet.settings.turbo){
          $('chaos').animate([
            {boxShadow:'inset 0 0 32px #ccff6688, 0 0 24px #beff66aa'},
            {boxShadow:'inset 0 1px #ffffff28, 0 3px 12px #090410'}
          ],{duration:650,easing:'ease-out'});
        }
        showCommanderReaction(e.stage);
        $('feature-number').textContent=e.remaining;
        updateMeter();
        status('Milestone '+e.stage+' · +2 free spins');
        await wait(690,fast);
        break;
      case 'drop':
        status((e.boosted?'Wild Surge':'Wild Drop')+' · '+e.positions.length+' wilds ×'+e.mult);
        if(!fast){
          $('game').classList.add('beaming');
          $('game').classList.toggle('surging',e.boosted);
          await wait(175);
          await deliverWilds(e);
        }
        render(e.board);
        e.positions.forEach(([c,r])=>cells[c][r].classList.add('dropping','wild-impact'));
        if(!fast){particles(e.positions,e.boosted?7:4);if(e.positions.length)audio.cue('wild-land',{length:wallet.settings.turbo?.42:Infinity});}
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
          tier:e.tier,kind:'ending',bonusEnding:true,award:money(value(e.capped?finalTotal:adjustedBonus))
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
  audio.setScore(-1);
  audio.beginRound(null);
}
async function showPurchaseScatters(tier,board,fast){
  winCounter(0,true);
  transition('purchase-entry');
  const game=$('game');
  const effects=$('effect');
  status('Incoming UFO scatters');
  if(!fast)react('anticipation');
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
      if(!fast){audio.scatter(1);particles([[c,r]],6);await wait(75);}
    }
    status((tier+3)+' scatters landed · '+tiers[tier]);
    if(!fast)await new Promise(done=>setTimeout(done,prefersReduced?410:wallet.settings.turbo?640:900));
  }finally{game.classList.remove('beaming','purchase-flight');}
}

return {render,animateRound,winCounter,reset:()=>{featurePanel(-1);audio.setScore(-1);}};
}
