import {checkOutcome} from './round-validation.mjs';

export function createRoundLock(name,locks=globalThis.navigator?.locks){
  return async task=>{
    if(!locks)throw Object.assign(new Error('Exclusive round access is unavailable'),{name:'RoundLockUnavailable'});
    return locks.request(name,{ifAvailable:true},async lock=>{
      if(!lock)throw Object.assign(new Error('Another tab is handling the current round'),{name:'RoundLockBusy'});
      return task();
    });
  };
}

export function confirmedCursor(round){
  if(typeof round.event!=='string'||!/^\d{1,9}$/.test(round.event))return -1;
  const index=Number(round.event);
  return index<round.state?.length?index:-1;
}

export function recoveryState(round){
  if(!round?.active)return null;
  const identified=(typeof round.betID==='string'&&round.betID.length>0)||Number.isSafeInteger(round.betID);
  let valid=false;
  try{valid=identified&&Number.isSafeInteger(round.amount)&&round.amount>0&&Number.isSafeInteger(checkOutcome(round));}catch{}
  return {valid,cursor:valid?confirmedCursor(round):-1};
}

export function sameRound(a,b){
  return !!(a&&b&&a.betID!=null&&b.betID!=null&&String(a.betID)===String(b.betID)&&a.mode===b.mode&&a.amount===b.amount);
}

export function formatDemoUnits(units){
  return (units/1000000).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' GC';
}
