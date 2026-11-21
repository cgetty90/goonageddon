import {checkOutcome,betLevels,formatUnits,unitsAt} from './rgs.mjs';
import {openTransport} from './transport.mjs';
import {confirmedCursor,recoveryState,sameRound,formatDemoUnits} from './recovery.mjs';
import {showWelcome,hasSeenWelcome,skipWelcome} from './intro.mjs';
import modes from './mode-prices.mjs';
import {modeLabel} from './information.mjs';
import {panel,action,showRules,showFeatures,showAutoplay} from './menus.mjs';
import {createAutoplay} from './autoplay.mjs';
import {createAudio} from './audio.mjs';
import {createRenderer} from './renderer.mjs';
import rtp from './rtp.mjs';

const $=id=>document.getElementById(id);
const wallet={settings:{music:.24,effects:.55,mute:false,turbo:false}};
const audio=createAudio(()=>wallet.settings);
const opened=Date.now();
let options,client,exclusive,replay,amount=0,balance=0,currency='',levels=[],flags={},available=[],enhanced=false,net=0,unsettledBalance=null,state='loading';
const status=message=>{$('status').textContent=message;};
const money=units=>options?.demo?formatDemoUnits(units):options?.replay&&options.amount===null?(units/100).toFixed(2)+'×':formatUnits(units,currency,options?.social);
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
  $('mode').hidden=!options?.replay&&!$('game').hasAttribute('data-tier');
  $('buy-open').hidden=!!flags.disabledBuyFeature||!available.some(mode=>mode.feature)||!!options?.replay;
  $('ante-open').hidden=!!flags.disabledBuyFeature||!available.some(mode=>mode.name==='ANTE')||!!options?.replay;
  $('buy-open').disabled=$('ante-open').disabled=!canPlay;
  $('ante-open').firstChild.nodeValue=options?.social?'ANTE ':'ANTE BET ';
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
function failure(error){
  autoplay.stop('connection');
  transition('error');
  if(error?.name==='RoundLockBusy'){status('Another tab is handling this game. Reconnect when it finishes.');return;}
  if(error?.name==='RoundLockUnavailable'){status('Use a secure browser with shared round locking.');return;}
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

async function present(round,started,{skip=false,resuming=false}={}){
  if(round.active&&!recoveryState(round)?.valid)throw Error('Missing active round identity');
  checkOutcome(round);
  const tier=round.state.find(event=>event.type==='bonus')?.tier??-1;
  if(skip){
    status('Confirming result');
    await client.checkpoint(round.state.length-1,round.betID);
  }else{
    await renderer.animateRound({events:round.state,tier},round.amount,confirmedCursor(round),
      round.active?index=>client.checkpoint(index,round.betID):null);
  }
  const remaining=Math.max(0,Number(flags.minimumRoundDuration)||0)-(performance.now()-started);
  if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
  let externallyClosed=false;
  if(round.active){
    if(resuming){
      const latest=await client.authenticate();
      setBalance(latest.balance);
      if(latest.round?.active&&(!sameRound(round,latest.round)||!recoveryState(latest.round)?.valid||round.payout!==latest.round.payout)){showRecovery(latest.round);return false;}
      externallyClosed=!latest.round?.active;
    }
    if(!externallyClosed)setBalance((await client.complete(round.betID)).balance);
  }
  if(skip){
    const lastBoard=round.state.findLast(event=>Array.isArray(event.board))?.board;
    if(lastBoard)renderer.render(lastBoard);
    renderer.reset();
  }
  renderer.winCounter(round.payout,true);
  status(externallyClosed?'Previous game closed · balance refreshed':resuming?'Previous game complete':'');
  return true;
}

function applyAuth(result){
  flags=result.config.jurisdiction||{};
  levels=betLevels(result.config);
  if(!levels.includes(amount))amount=result.config.defaultBetLevel;
  available=modes.filter(mode=>result.config.gameModes.some(entry=>entry.mode===mode.name&&entry.costMultiplier===mode.cost));
  if(flags.disabledTurbo){wallet.settings.turbo=false;$('turbo').setAttribute('aria-pressed','false');}
  if(flags.disabledBuyFeature||!available.some(mode=>mode.name==='ANTE'))enhanced=false;
  setBalance(result.balance);
  if(!available.some(mode=>mode.name==='BASE'))throw Error('Published mode does not match build');
}
function showRecovery(round){
  autoplay.stop('connection');
  skipWelcome();
  transition('recovery');
  const {valid,cursor}=recoveryState(round);
  const mode=modes.find(entry=>entry.name===round.mode);
  const tier=valid?round.state.find(event=>event.type==='bonus')?.tier:null;
  const title=tier!=null?['Regular Bonus','Super Bonus','Super Super Bonus'][tier]:modeLabel(mode,options.social)||'Previous game';
  const cost=mode&&Number.isSafeInteger(round.amount)&&round.amount>0&&Number.isSafeInteger(round.amount*mode.cost)?money(round.amount*mode.cost):'Awaiting confirmation';
  const progress=cursor<0?'Round start':cursor===round.state.length-1?'Presentation complete':'Step '+(cursor+1)+' of '+round.state.length;
  panel('recovery','Unfinished game found');
  $('close').hidden=true;
  const content=$('panel-content');
  const description=document.createElement('p');
  description.textContent='Your previous game was interrupted. Resume its presentation or jump to its confirmed result.';
  content.append(description);
  const details=document.createElement('dl');
  details.className='recovery-details';
  for(const [label,value] of [['Game',title],['Total play amount',cost],['Last confirmed progress',progress],['Result',valid?'Ready to recover':'Waiting for Engine']]){
    const term=document.createElement('dt');term.textContent=label;
    const data=document.createElement('dd');data.textContent=value;
    details.append(term,data);
  }
  content.append(details);
  if(!mode||!valid)action('Reconnect',()=>{closeRecovery();transition('error');void connect();},{primary:true});
  action('Resume Game',()=>void recover(round,false),{primary:valid,disabled:!valid||!mode});
  action('Skip to Result',()=>void recover(round,true),{disabled:!valid||!mode});
  status('Unfinished game');
}
function closeRecovery(){
  if($('panel').open)$('panel').close();
  $('close').hidden=false;
}
$('panel').addEventListener('cancel',event=>{if(state==='recovery')event.preventDefault();});

async function recover(expected,skip){
  if(state!=='recovery'||!recoveryState(expected)?.valid)return;
  audio.unlock();
  const before=unsettledBalance??balance;
  closeRecovery();
  transition('recovering');
  status('Checking previous game');
  try{
    await exclusive(async()=>{
      const latest=await client.authenticate();
      applyAuth(latest);
      if(!latest.round?.active){
        renderer.reset();
        status('Previous game closed · balance refreshed');
      }else{
        if(!sameRound(expected,latest.round)||!recoveryState(latest.round)?.valid){
          showRecovery(latest.round);
          return;
        }
        if(levels.includes(latest.round.amount))amount=latest.round.amount;
        enhanced=latest.round.mode==='ANTE'&&!flags.disabledBuyFeature;
        if(!await present(latest.round,performance.now(),{skip,resuming:true}))return;
      }
      net+=balance-before;unsettledBalance=null;
      readouts();
      transition('ready');
    });
  }catch(error){failure(error);}
}

async function connect(){
  if(state!=='loading'&&state!=='error')return;
  transition('connecting');
  status(options.replay?'Loading replay':options.demo?'Loading demo':'Connecting to Engine');
  try{
    if(options.replay){
      replay=await client.replay();
      checkOutcome(replay,{replay:true,amount:options.amount});
      if(typeof replay.costMultiplier!=='number'||!Number.isFinite(replay.costMultiplier)||replay.costMultiplier<1)throw Error('Invalid replay cost');
      currency=options.currency||'';
      $('stake').textContent=options.amount===null?replay.costMultiplier+'×':money(Math.round(options.amount*replay.costMultiplier));
      const label=modeLabel(modes.find(mode=>mode.name===options.keys[2]),options.social)||'Round';
      $('base-stake').hidden=false;
      $('base-stake').textContent=options.amount===null?'Base 1× · Cost '+replay.costMultiplier+'×':'Base '+money(options.amount)+' · Cost '+replay.costMultiplier+'×';
      $('mode').textContent=label.toUpperCase()+' REPLAY';
      status('Replay ready · '+label+' · '+replay.payoutMultiplier.toLocaleString('en-GB')+'× result');
    }else{
      const before=unsettledBalance??(levels.length?balance:null);
      const result=await client.authenticate();
      applyAuth(result);
      if(result.round?.active){showRecovery(result.round);return;}
      if(before!==null)net+=balance-before;
      const reconciled=unsettledBalance!==null;
      unsettledBalance=null;
      renderer.reset();
      status(reconciled?'Balance refreshed':'');
      if(!hasSeenWelcome()){
        transition('welcome');
        await showWelcome(audio);
      }
    }
    readouts();
    transition('ready');
  }catch(error){failure(error);}
}

async function play(mode,automatic=false){
  if(!mode||state!=='ready'||options.replay||(!automatic&&autoplay.active)||!available.includes(mode)||!levels.includes(amount)||balance<amount*mode.cost||
      (flags.disabledBuyFeature&&(mode.feature||mode.name==='ANTE')))return false;
  const before=balance;
  transition('submitting');
  status('Starting game');
  try{
    return await exclusive(async()=>{
      unsettledBalance=before;
      const started=performance.now();
      const response=await client.play(mode.name,amount);
      setBalance(response.balance);
      if(response.round?.amount!==amount||response.round?.mode!==mode.name)throw Error('Unexpected Engine round');
      await present(response.round,started);
      net+=balance-before;unsettledBalance=null;readouts();
      transition('ready');
      return true;
    });
  }catch(error){failure(error);return false;}
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
    $('mode').textContent=(modeLabel(modes.find(mode=>mode.name===options.keys[2]),options.social)||'Round').toUpperCase()+' REPLAY';
    status('Replay complete · '+replay.payoutMultiplier.toLocaleString('en-GB')+'× result');
    transition('ready');
  }catch(error){failure(error);}
}
$('info').onclick=()=>showRules(options?.social);
$('auto-open').onclick=()=>{
  const mode=currentMode();
  if(!mode)return;
  const quote={...mode,amount};
  if(autoplayBlocker(quote))return;
  showAutoplay({label:modeLabel(mode,options.social)+' · '+(options.social?'Play amount':'Stake'),amount:money(amount*mode.cost),confirm:count=>{
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
  panel('amount','Choose amount','<p>'+ (enhanced?'Ante totals are 3× the base amount.':'Choose a supported amount.')+'</p>');
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
  if(state!=='ready'||flags.disabledBuyFeature||autoplay.active)return;
  if(enhanced){enhanced=false;controls();readouts();return;}
  const name=options.social?'Ante':'Ante Bet';
  panel('feature-confirm',name,'<p>'+name+' increases the chance of triggering free spins. It costs 3× the base '+(options.social?'play amount':'stake')+' and returns '+(rtp.ANTE.rtp*100).toFixed(2)+'% RTP.</p><dl class="recovery-details"><dt>'+ (options.social?'Base play amount':'Base stake')+'</dt><dd>'+money(amount)+'</dd><dt>Multiplier</dt><dd>3×</dd><dt>Total per spin</dt><dd>'+money(amount*3)+'</dd></dl>');
  action('Cancel',()=>$('panel').close());
  action('Enable '+name,()=>{enhanced=true;controls();readouts();$('panel').close();},{primary:true});
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
function activateGameAudio(){
  if($('intro').open)return;
  document.removeEventListener('pointerdown',activateGameAudio);
  audio.unlock();
}
document.addEventListener('pointerdown',activateGameAudio);
renderer.render(preview);
transition('loading');
try{({options,client,exclusive}=await openTransport(location.href));void connect();}catch(error){failure(error);}
