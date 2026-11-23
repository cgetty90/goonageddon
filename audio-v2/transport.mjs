import {unitsAt} from './round-validation.mjs';
import modes from './mode-prices.mjs';
import {createRoundLock} from './recovery.mjs';

const key='goonageddon-audio-v2-fictional';
const unit=1_000_000;
const levels=[.1,.2,.5,1,2,5,10].map(x=>Math.round(x*unit));
const initial=10_000*unit;
let fixtures;
export async function loadFixtures(){
  fixtures??=fetch(new URL('./fixtures.json',import.meta.url),{credentials:'omit',redirect:'error'}).then(response=>{
    if(!response.ok)throw Error('Visual fixtures unavailable');
    return response.json();
  }).catch(error=>{fixtures=null;throw error});
  return fixtures;
}
function read(){
  const value=localStorage.getItem(key);
  return value?JSON.parse(value):{balance:initial,id:0,round:null,lastId:0};
}
const write=wallet=>localStorage.setItem(key,JSON.stringify(wallet));
const snapshot=wallet=>({amount:wallet.balance,currency:'XGC'});
export async function openTransport(){
  const {pool}=await loadFixtures();
  return {options:{demo:true,social:false,replay:false},exclusive:createRoundLock(key),client:{
    async authenticate(){
      const wallet=read();
      return {balance:snapshot(wallet),round:wallet.round,config:{
        minBet:levels[0],maxBet:levels.at(-1),stepBet:levels[0],defaultBetLevel:unit,betLevels:levels,
        gameModes:modes.map(mode=>({mode:mode.name,costMultiplier:mode.cost})),jurisdiction:{disabledAutoplay:false}
      }};
    },
    async play(name,amount){
      const mode=modes.find(entry=>entry.name===name);
      const wallet=read();
      if(!mode||!levels.includes(amount)||wallet.round||wallet.balance<amount*mode.cost)throw Error('Fictional-credit round unavailable');
      const index=wallet.id;
      const rows=name==='MYSTERY'?pool.MYSTERY[index%pool.MYSTERY.length]:pool[name];
      const book=rows[(name==='MYSTERY'?Math.floor(index/pool.MYSTERY.length):index)%rows.length];
      const payout=unitsAt(amount,book.payoutMultiplier);
      const round={betID:++wallet.id,amount,payout,payoutMultiplier:book.payoutMultiplier/100,active:payout>0,mode:name,state:book.events};
      wallet.balance-=amount*mode.cost;
      wallet.round=round.active?round:null;
      if(!round.active)wallet.lastId=round.betID;
      write(wallet);
      return {balance:snapshot(wallet),round};
    },
    async checkpoint(index,id){
      const wallet=read();
      if(wallet.round?.betID!==id)throw Error('Local round changed');
      wallet.round.event=String(index);
      write(wallet);
    },
    async complete(id){
      const wallet=read();
      if(wallet.round?.betID===id){
        wallet.balance+=wallet.round.payout;
        wallet.round=null;wallet.lastId=id;
        write(wallet);
      }else if(wallet.round||wallet.lastId!==id)throw Error('Local round changed');
      return {balance:snapshot(wallet)};
    }
  }};
}
