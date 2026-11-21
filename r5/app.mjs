import {demoOptions,makeDemo} from './demo.mjs';
import {checkOutcome,betLevels,formatUnits,unitsAt} from './rgs.mjs';
import modes from './mode-prices.mjs';
import {descriptions} from './information.mjs';
import {panel,action,showRules,showFeatures,showAutoplay} from './menus.mjs';
import {createAutoplay} from './autoplay.mjs';
import {createAudio} from './audio.mjs';
import {createRenderer} from './renderer.mjs';
import rtp from './rtp.mjs';

const $=id=>document.getElementById(id);
const wallet={settings:{music:.24,effects:.55,mute:false,turbo:false}};
const audio=createAudio(()=>wallet.settings);
const opened=Date.now();
let options,client,replay,amount=0,balance=0,currency='',levels=[],flags={},available=[],enhanced=false,net=0,unsettledBalance=null,state='loading';
const status=message=>{$('status').textContent=message;};
const money=units=>options?.replay&&options.amount===null?(units/100).toFixed(2)+'×':formatUnits(units,currency,options?.social);
const transition=next=>{state=next;$('game').dataset.state=next;controls();};
const renderer=createRenderer({wallet,audio,money,status,transition});
const preview=[[4,9,3,13],[5,12,11,8,1],[6,1,8,10],[1,9,7,2,5],[2,0,8,11],[3,10,12,13]];

const currentMode=()=>available.find(mode=>mode.name===(enhanced?'ANTE':'BASE'));
const autoplayAllowed=()=>!!client&&!options?.replay&&flags.disabledAutoplay===false;
function autoplayBlocker(quote){
  if(document.hidden||!autoplayAllowed()||state!=='ready'||currentMode()?.name!==quote.name||amount!==quote.amount||!levels.includes(amount))return 'unavailable';
  return balance<quote.amount*quote.cost?'funds':'';
}
const autoplay=createAutoplay({
  eligible:autoplayBlocker,
  play:quote=>play(currentMode(),true),
  update(run,reason){
    $('auto-left').textContent=run?run.remaining+' left':'';
    controls();
    if(reason==='funds')status('Autoplay stopped · available balance is too low.');
    if(reason==='complete')status('Autoplay complete');
    if(reason==='stopped')status('Autoplay stopped');
  }
});

function controls(){
  const ready=state==='ready';
  const canPlay=ready&&!options?.replay&&!autoplay.active;
  const cost=currentMode()?.cost;
  $('spin').disabled=!canPlay||!cost||amount*cost>balance;
  if(canPlay&&cost&&amount*cost>balance&&!autoplay.active)status('Available balance is below the selected amount.');
  $('spin').hidden=options?.replay===true;
  $('spin').title=flags.disabledSpacebar?'Spin':'Spin (Space)';
  $('minus').disabled=!canPlay||amount===levels[0];
  $('plus').disabled=!canPlay||amount===levels.at(-1);
  $('minus').hidden=$('plus').hidden=options?.replay===true;
  $('turbo').hidden=!!flags.disabledTurbo||!!options?.replay;
  $('turbo').disabled=!ready||autoplay.active;
  $('auto-open').hidden=!autoplayAllowed();
  $('auto-open').disabled=!canPlay||!cost||amount*cost>balance;
  $('auto-stop').hidden=$('cinema-stop').hidden=!autoplay.active;
  $('game').toggleAttribute('data-autoplay',autoplay.active);
  $('amount-open').disabled=!canPlay;
  $('amount-open').toggleAttribute('data-replay',!!options?.replay);
  if(ready&&!options?.replay)$('mode').textContent=enhanced?'ENHANCED':'BASE GAME';
  $('buy-open').hidden=!!flags.disabledBuyFeature||!available.some(mode=>mode.feature)||!!options?.replay;
  $('ante-open').hidden=!!flags.disabledBuyFeature||!available.some(mode=>mode.name==='ANTE')||!!options?.replay;
  $('buy-open').disabled=$('ante-open').disabled=!canPlay;
  $('ante-open').setAttribute('aria-pressed',String(enhanced));
  $('ante-open').querySelector('b').textContent=enhanced?'ON':'OFF';
  $('retry').hidden=state!=='error'||!client;
  $('replay-action').hidden=!(options?.replay&&replay&&ready);
  $('settings').disabled=$('info').disabled=!ready||autoplay.active;
  $('balance-panel').hidden=!!options?.replay;
  if(!options?.replay&&levels.length){
    $('stake').textContent=money(amount*(cost||1));
    $('base-stake').hidden=!enhanced;
    $('base-stake').textContent='Base '+money(amount);
  }
}
function setBalance(next){
  if(!Number.isSafeInteger(next?.amount)||next.amount<0||typeof next.currency!=='string')throw Error('Invalid balance response');
  balance=next.amount;currency=next.currency;
  $('balance').textContent=money(balance);
}
function failure(){
  autoplay.stop('connection');
  transition('error');
  status(client?(options.replay?'Replay unavailable. Reconnect to try again.':'Connection interrupted. Reconnect to check the last round.'):'Unable to connect. Open the game through a valid Engine launch.');
}
function readouts(){
  const time=Math.floor((Date.now()-opened)/1000);
  $('jurisdiction-readout').textContent=[
    flags.displayNetPosition?'Session net '+money(net):'',
    flags.displaySessionTimer?'Session time '+Math.floor(time/60)+':'+String(time%60).padStart(2,'0'):'',
    flags.displayRTP?'RTP '+((rtp[enhanced?'ANTE':'BASE']?.rtp||0)*100).toFixed(3)+'%':''
  ].filter(Boolean).join(' · ');
}
setInterval(readouts,1000);

async function present(round,started){
  checkOutcome(round);
  const tier=round.state.find(event=>event.type==='bonus')?.tier??-1;
  const index=typeof round.event==='string'&&/^\d+$/.test(round.event)?Number(round.event):-1;
  const cursor=index>=0&&index<round.state.length?index:-1;
  await renderer.animateRound({events:round.state,tier},round.amount,cursor,
    round.active?i=>client.checkpoint(i):null);
  renderer.winCounter(round.payout,true);
  const remaining=Math.max(0,Number(flags.minimumRoundDuration)||0)-(performance.now()-started);
  if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
  if(round.active)setBalance((await client.complete()).balance);
  status('');
}

async function connect(){
  if(state!=='loading'&&state!=='error')return;
  transition('connecting');
  status(options.replay?'Loading replay':'Connecting to Engine');
  try{
    if(options.replay){
      replay=await client.replay();
      checkOutcome(replay,{replay:true,amount:options.amount});
      if(typeof replay.costMultiplier!=='number'||!Number.isFinite(replay.costMultiplier)||replay.costMultiplier<1)throw Error('Invalid replay cost');
      currency=options.currency||'';
      $('stake').textContent=options.amount===null?replay.costMultiplier+'×':money(Math.round(options.amount*replay.costMultiplier));
      const label=modes.find(mode=>mode.name===options.keys[2])?.label||'Round';
      $('base-stake').hidden=false;
      $('base-stake').textContent=options.amount===null?'Base 1× · Cost '+replay.costMultiplier+'×':'Base '+money(options.amount)+' · Cost '+replay.costMultiplier+'×';
      $('mode').textContent=label.toUpperCase()+' REPLAY';
      status('Replay ready · '+label+' · '+replay.payoutMultiplier.toLocaleString('en-GB')+'× result');
    }else{
      const before=unsettledBalance??(levels.length?balance:null);
      const result=await client.authenticate();
      flags=result.config.jurisdiction||{};

      levels=betLevels(result.config);
      if(!levels.includes(amount))amount=result.config.defaultBetLevel;
      available=modes.filter(mode=>result.config.gameModes.some(entry=>entry.mode===mode.name&&entry.costMultiplier===mode.cost));
      if(flags.disabledTurbo){wallet.settings.turbo=false;$('turbo').setAttribute('aria-pressed','false');}
      if(flags.disabledBuyFeature||!available.some(mode=>mode.name==='ANTE'))enhanced=false;
      setBalance(result.balance);
      if(!available.some(mode=>mode.name==='BASE'))throw Error('Published mode does not match build');
      if(result.round?.active){
        if(levels.includes(result.round.amount))amount=result.round.amount;
        enhanced=result.round.mode==='ANTE'&&!flags.disabledBuyFeature;
        status('Resuming interrupted round');
        await present(result.round,performance.now());
      }else status('');
      if(before!==null)net+=balance-before;
      unsettledBalance=null;
    }
    readouts();
    transition('ready');
  }catch{failure();}
}
async function play(mode,automatic=false){
  if(!mode||state!=='ready'||options.replay||(!automatic&&autoplay.active)||!available.includes(mode)||!levels.includes(amount)||balance<amount*mode.cost||
      (flags.disabledBuyFeature&&(mode.feature||mode.name==='ANTE')))return;
  const before=balance;
  unsettledBalance=before;
  const started=performance.now();
  transition('submitting');
  status('Contacting Engine');
  try{
    const response=await client.play(mode.name,amount);
    setBalance(response.balance);
    if(response.round?.amount!==amount||response.round?.mode!==mode.name)throw Error('Unexpected Engine round');
    await present(response.round,started);
    net+=balance-before;unsettledBalance=null;readouts();
    transition('ready');
    return true;
  }catch{failure();return false;}
}
async function watchReplay(){
  if(state!=='ready'||!replay)return;
  transition('replaying');
  try{
    const tier=replay.state.find(event=>event.type==='bonus')?.tier??-1;
    await renderer.animateRound({events:replay.state,tier},options.amount,-1);
    const total=replay.state.at(-1).total;
    renderer.winCounter(options.amount===null?total:unitsAt(options.amount,total),true);
    $('replay-action').textContent='Play again';
    $('mode').textContent=(modes.find(mode=>mode.name===options.keys[2])?.label||'Round').toUpperCase()+' REPLAY';
    status('Replay complete · '+replay.payoutMultiplier.toLocaleString('en-GB')+'× result');
    transition('ready');
  }catch{failure();}
}
$('info').onclick=()=>showRules(options?.social);
$('auto-open').onclick=()=>{
  const mode=currentMode();
  if(!mode)return;
  const quote={...mode,amount};
  if(autoplayBlocker(quote))return;
  showAutoplay({label:mode.label+' · '+(options.social?'Play amount':'Stake'),amount:money(amount*mode.cost),confirm:count=>{
    if(autoplayBlocker(quote))return;
    $('panel').close();
    if(autoplay.start(count,quote))$('auto-stop').focus();
  }});
};
for(const id of ['auto-stop','cinema-stop'])$(id).onclick=()=>autoplay.stop();
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoplay.stop('stopped');});
$('amount-open').onclick=()=>{
  if(state!=='ready'||options.replay||autoplay.active)return;
  const cost=currentMode().cost;
  panel('amount','Choose amount','<p>'+ (enhanced?'Enhanced totals are 3× the base amount.':'Choose a supported amount.')+'</p>');
  for(const level of levels){
    const choice=action(money(level*cost),()=>{amount=level;$('panel').close();controls();});
    choice.setAttribute('aria-pressed',String(level===amount));
  }
};
$('settings').onclick=()=>{
  panel('settings','Sound and settings','<label>Music <input id="music" type="range" min="0" max="1" step=".01"></label><label>Effects <input id="effects" type="range" min="0" max="1" step=".01"></label>');
  for(const name of ['music','effects']){
    $(name).value=wallet.settings[name];
    $(name).oninput=()=>{wallet.settings[name]=Number($(name).value);audio.refresh();};
  }
};
$('buy-open').onclick=()=>{
  if(state!=='ready'||flags.disabledBuyFeature||autoplay.active)return;
  showFeatures({social:options.social,features:available.filter(mode=>mode.feature),amount,balance,money,play});
};
$('ante-open').onclick=()=>{
  if(state!=='ready'||flags.disabledBuyFeature)return;
  panel('feature-confirm','Enhanced mode','<p>'+descriptions.ANTE+' Total cost is 3× the base amount.</p>');
  action(enhanced?'Turn off enhanced mode':'Enable · '+money(amount*3),()=>{enhanced=!enhanced;controls();readouts();$('panel').close();});
};
$('close').onclick=()=>$('panel').close();
$('spin').onclick=()=>void play(available.find(mode=>mode.name===(enhanced?'ANTE':'BASE')));
$('retry').onclick=()=>void connect();
$('replay-action').onclick=()=>void watchReplay();
$('turbo').onclick=()=>{if(!flags.disabledTurbo){wallet.settings.turbo=!wallet.settings.turbo;$('turbo').setAttribute('aria-pressed',String(wallet.settings.turbo));}};
$('mute').onclick=()=>{wallet.settings.mute=!wallet.settings.mute;audio.refresh();$('mute').setAttribute('aria-pressed',String(wallet.settings.mute));};
function adjust(offset){if(state==='ready'&&!options.replay&&!autoplay.active){amount=levels[levels.indexOf(amount)+offset]??amount;controls();}}
$('minus').onclick=()=>adjust(-1);
$('plus').onclick=()=>adjust(1);
document.addEventListener('keydown',event=>{
  if(event.code==='Space'&&!event.repeat&&!flags.disabledSpacebar&&!$('spin').disabled&&!document.querySelector('dialog[open]')&&event.target===document.body){
    event.preventDefault();$('spin').click();
  }
});
document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});
renderer.render(preview);
transition('loading');
options=demoOptions;client=makeDemo();void connect();
