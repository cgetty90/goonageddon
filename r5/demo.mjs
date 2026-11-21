import {unitsAt} from './rgs.mjs';
import modes from './mode-prices.mjs';
const unit=1000000;
const initial=10000*unit;
const levels=[.10,.20,.50,1,2,5,10].map(value=>Math.round(value*unit));
const key='goonageddon-r5-demo';
let wallet={balance:initial,round:null,id:0};
try{
  const stored=JSON.parse(sessionStorage.getItem(key));
  if(stored&&Number.isSafeInteger(stored.balance)&&stored.balance>=0)wallet=stored;
}catch{}
function save(){try{sessionStorage.setItem(key,JSON.stringify(wallet));}catch{}}
const snapshot=()=>({amount:wallet.balance,currency:'XGC'});
let samples;
const pick=rows=>rows[Math.floor(Math.random()*rows.length)];
export const demoOptions={replay:false,social:true,demo:true};
export function makeDemo(){
  return {
    async authenticate(){
      samples??=await fetch('./demo-rounds.json').then(response=>{
        if(!response.ok)throw Error('Demo data unavailable');
        return response.json();
      });
      return {balance:snapshot(),round:wallet.round,config:{minBet:levels[0],maxBet:levels.at(-1),stepBet:levels[0],defaultBetLevel:levels[1],betLevels:levels,
        gameModes:modes.map(mode=>({mode:mode.name,costMultiplier:mode.cost})),jurisdiction:{disabledAutoplay:false}}};
    },
    async play(name,amount){
      const mode=modes.find(candidate=>candidate.name===name);
      if(!mode||!levels.includes(amount)||wallet.round||wallet.balance<amount*mode.cost)throw Error('Demo round unavailable');
      const roll=Math.random();
      const books=name==='MYSTERY'?samples[name][roll<.6?0:roll<.92?1:2]:samples[name];
      const result=pick(books);
      const payout=unitsAt(amount,result.payoutMultiplier);
      const round={betID:++wallet.id,amount,payout,payoutMultiplier:result.payoutMultiplier/100,active:payout>0,mode:name,state:result.events};
      wallet.balance-=amount*mode.cost;
      wallet.round=round.active?round:null;
      save();
      return {balance:snapshot(),round};
    },
    async checkpoint(index){
      if(wallet.round){wallet.round.event=String(index);save();}
    },
    async complete(){
      if(!wallet.round)throw Error('No active demo round');
      wallet.balance+=wallet.round.payout;
      wallet.round=null;
      save();
      return {balance:snapshot()};
    }
  };
}
