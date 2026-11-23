import {symbolArt as symbolPath} from './visual-art.mjs';
import {symbols} from './math-v1.mjs';
import {config} from './math-v2.mjs';
import modes from './mode-prices.mjs';

export function modeLabel(mode,social){
  if(mode?.name==='BASE'&&social)return 'Base';
  if(mode?.name==='ANTE')return social?'Ante':'Ante Bet';
  return mode?.label;
}
export const tierNames=['Regular','Super','Super Super'];
export const descriptions={
  BASE:'Six reels with natural scatter triggers.',
  ANTE:'Ante increases the chance of a natural bonus. All awards use the base amount.',
  REGULAR:'Three UFOs reveal Regular Bonus. It opens with eight free spins.',
  SUPER:'Four UFOs reveal Super Bonus. It opens with eight free spins.',
  MYSTERY:'The demonstration cycles through Regular, Super and Super Super curated fixtures.'
};

const wins=symbols.map(([name,asset,...values])=>'<tr><th scope="row"><img src="'+symbolPath(asset)+'" alt="" loading="lazy"><span>'+(asset==='alien-boss'?'Goon Commander':name)+'</span></th>'+values.map(value=>'<td>'+value/100+'×</td>').join('')+'</tr>').join('');
const drops=config.milestones.map((points,index)=>'<tr><th scope="row">'+points+'</th>'+config.drops.map(tier=>{
  const [min,max,mult]=tier[index];
  return '<td>'+min+(max!==min?'–'+max:'')+' · '+mult+'×</td>';
}).join('')+'</tr>').join('');
const table=(head,rows)=>'<div class="table-wrap"><table><thead><tr>'+head.map(label=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';

export function information(social){
  const feature=social?'Features':'Bonus Buy';
  const stake=social?'play amount':'stake';
  return [
    ['How to Play','<h3>How to Play</h3><p>Six reels each reveal four to six symbols. Starting at the leftmost reel, match a symbol on at least three consecutive reels. Each matching position combination earns a ways win.</p><p>Winning positions clear, symbols fall down, and new symbols fill the gaps. Further wins continue the tumble until the reels have no new match or the round reaches its limit.</p><p>Wilds substitute for regular symbols. The XWAYS Expanding Wild fills its entire reel when revealed. UFO Scatters trigger bonuses on the opening spin and are separate from ways wins.</p>'],
    [social?'Symbols and Wins':'Symbols & Paytable','<h3>'+(social?'Symbols and Wins':'Symbols &amp; Paytable')+'</h3><p>Values are multiples of the base '+stake+' per matching way.</p>'+table(['Symbol','3 reels','4 reels','5 reels','6 reels'],wins)+'<div class="symbol-notes"><p><img src="'+symbolPath('alien-boss')+'" alt="">Regular and Expanding Wilds substitute at 1×. Wild multipliers add within each winning way. An all-wild way is counted once.</p><p><img src="assets/visual/symbols/scatter.webp" alt="">UFO Scatters unlock Free Spins. Wild Drop multipliers are 2×, 3×, 4×, 5×, 6×, 10×, 15×, 20×, 25×, 35× and 50×.</p></div>'],
    ['Free Spins','<h3>Free Spins and Bonuses</h3><p>Exactly 3 UFO Scatters start Regular, exactly 4 start Super, and 5 or more start Super Super. Each starts at eight free spins.</p><p>Every winning position removed during free spins adds one Chaos Point. Each of the five milestones awards two extra spins and schedules one Wild Drop. The table shows the wild count and multiplier at each level.</p>'+table(['Points','Regular','Super','Super Super'],drops)+'<p>Super Super can produce a stage-four surge of 12–18 wilds at 35×. Scatters do not restart the feature. The Super Super bonus has a 100× minimum unless the round reaches its 50,000× limit first.</p>'],
    [feature,'<h3>'+feature+'</h3>'+modes.filter(mode=>mode.feature).map(mode=>'<div class="rule-line"><h4>'+modeLabel(mode,social)+' <b>'+mode.cost+'×</b></h4><p>'+descriptions[mode.name]+'</p></div>').join('')+'<p>Each price multiplies the base '+stake+'. Review the total and confirm before the UFOs arrive. Ante costs 3× and increases the natural bonus chance.</p>'],
    ['Demo rules','<h3>Visual testing only</h3><p>All credit amounts are fictional and stay in this browser. This demo cycles through curated outcome samples to help check graphics and animations. It does not advertise an official return to player. Visual test scenarios do not charge or award credits.</p>'],
    ['Controls','<h3>Controls</h3><dl>'+[
      ['Spin','Starts a round. Spacebar also spins when the operator enables it.'],
      [social?'Play amount':'Stake','Open the list of supported amounts, or step through them using minus and plus.'],
      ['Turbo','Shortens animations where available.'],
      ['Autoplay','Choose 10, 25, 50, 100 or 500 spins and confirm. The counter shows spins still to start. Stop Autoplay ends the queue and any current round settles normally.'],
      ['Sound','Toggle all sound or adjust music and effects separately in Settings.'],
      ['Information','Opens rules, symbol values and verified mode returns.'],
      [feature,'Opens available features. Select and confirm the displayed total to start.'],
      ['Reconnect and recovery','Reconnect checks for an open round. Resume Game continues its recorded events. Skip to Result reveals the same final result.'],
      ['Replay','Play Replay or Play Again displays a recorded round without changing your balance.'],
      ['Skip cinematic','Advances presentation to the next recorded event.']
    ].map(([term,detail])=>'<dt>'+term+'</dt><dd>'+detail+'</dd>').join('')+'</dl>']
  ];
}
