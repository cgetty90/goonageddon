import {unitsAt} from './rgs.mjs';
import {createRoundLock} from './recovery.mjs';
import modes from './mode-prices.mjs';

const unit=1000000;
const key='goonageddon-r6-demo';
const levels=[100000,200000,500000,1000000,2000000,5000000,10000000];
const initial=10000*unit;
function read(){
  const raw=localStorage.getItem(key);
  if(raw===null)return {balance:initial,id:0,round:null,lastId:null};
  const state=JSON.parse(raw);
  if(!Number.isSafeInteger(state.balance)||state.balance<0||!Number.isSafeInteger(state.id))throw Error('Invalid demo storage');
  return state;
}
function write(wallet){localStorage.setItem(key,JSON.stringify(wallet));}
const snapshot=wallet=>({amount:wallet.balance,currency:'XGC'});
const pick=rows=>rows[Math.floor(Math.random()*rows.length)];

export async function openTransport(url){
  const query=new URL(url).searchParams;
  const replay=query.get('replay')==='true';
  const options={replay,social:false,demo:true,amount:null,currency:'XGC',keys:[]};
  const samples=await fetch('./demo-rounds.json').then(response=>{
    if(!response.ok)throw Error('Demo books unavailable');
    return response.json();
  });
  if(replay){
    const mode=modes.find(entry=>entry.name===query.get('mode'));
    const id=Number(query.get('event'));
    const book=(samples[mode?.name]||[]).flat().find(entry=>entry.id===id);
    if(!mode||!book)throw Error('Unknown demo replay');
    const rawAmount=query.get('amount');
    const amount=rawAmount===null?null:Number(rawAmount);
    options.amount=Number.isSafeInteger(amount)&&amount>0&&amount%10000===0?amount:200000;
    options.keys=['goonageddon','6',mode.name,String(id)];
    return {options,client:{replay:async()=>({state:book.events,payoutMultiplier:book.payoutMultiplier/100,costMultiplier:mode.cost})}};
  }
  const exclusive=createRoundLock(key);
  return {options,exclusive,client:{
    async authenticate(){
      const wallet=read();
      return {balance:snapshot(wallet),round:wallet.round,config:{
        minBet:levels[0],maxBet:levels.at(-1),stepBet:levels[0],defaultBetLevel:levels[1],betLevels:levels,
        gameModes:modes.map(mode=>({mode:mode.name,costMultiplier:mode.cost})),jurisdiction:{disabledAutoplay:false}
      }};
    },
    async play(name,amount){
      const mode=modes.find(entry=>entry.name===name);
      const wallet=read();
      if(!mode||!levels.includes(amount)||wallet.round||wallet.balance<amount*mode.cost)throw Error('Demo round unavailable');
      const roll=Math.random();
      const book=pick(name==='MYSTERY'?samples[name][roll<.6?0:roll<.92?1:2]:samples[name]);
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
      if(wallet.round?.betID!==id)throw Error('Demo round changed');
      wallet.round.event=String(index);
      write(wallet);
    },
    async complete(id){
      const wallet=read();
      if(wallet.round?.betID===id){
        wallet.balance+=wallet.round.payout;
        wallet.round=null;
        wallet.lastId=id;
        write(wallet);
      }else if(wallet.round||wallet.lastId!==id)throw Error('Demo round changed');
      return {balance:snapshot(wallet)};
    }
  }};
}
