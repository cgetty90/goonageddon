export const CAP=5_000_000;
export const QUANTUM=10;
export const BONUS_MINIMUM=10_000;

// Amounts are hundredths of the base bet. Half-steps round up.
export function settlePayout(raw){
  if(!Number.isSafeInteger(raw)||raw<0||raw>CAP)throw Error('Invalid raw award');
  return raw===0?0:Math.max(QUANTUM,raw+(raw%QUANTUM>=5?QUANTUM:0)-raw%QUANTUM);
}

export function verifySettlement(events){
  const end=events.at(-1);
  const adjustment=events.at(-2);
  if(end?.type!=='end'||adjustment?.type!=='settlementAdjustment')throw Error('Missing settlement events');
  let running=0;
  let summary;
  let bonus;
  let baseAtBonus=0;
  let guaranteed=false;
  let capSeen=false;
  let reveal;
  for(const event of events.slice(0,-2)){
    if(event.type==='settlementAdjustment'||event.type==='end')throw Error('Premature settlement');
    if(event.type==='bonus'){
      if(bonus)throw Error('Unexpected second bonus');
      bonus=event;
      baseAtBonus=running;
    }
    if(event.type==='purchaseReveal'){
      if(event!==events[0]||reveal||![0,1,2].includes(event.tier)||event.scatters!==event.tier+3)throw Error('Invalid feature reveal');
      reveal=event;
    }
    if(event.type==='summary')summary=event;
    if(event.type==='cap')capSeen=true;
    if(['win','guarantee'].includes(event.type)){
      if(!Number.isSafeInteger(event.paid)||event.paid<0)throw Error('Invalid award');
      running+=event.paid;
      if(event.total!==running||running>CAP)throw Error('Invalid running total');
      if(event.type==='guarantee'){
        if(guaranteed||bonus?.tier!==2||event.paid<=0||running-baseAtBonus!==BONUS_MINIMUM)throw Error('Invalid minimum guarantee');
        guaranteed=true;
      }
    }
  }
  if(reveal&&reveal.tier!==bonus?.tier)throw Error('Feature reveal and entered tier differ');
  const settled=settlePayout(running);
  const delta=settled-running;
  const expectedBonus=bonusDeltaFor(summary,delta);
  if(adjustment.rawTotal!==running||adjustment.delta!==delta||adjustment.total!==settled||
     adjustment.bonusDelta!==expectedBonus||adjustment.baseDelta!==delta-expectedBonus||
     end.total!==settled||end.capped!==capSeen||capSeen!==(running===CAP))throw Error('Settlement does not reconcile');
  if(summary&&(summary.total!==running||summary.bonusWin!==running-baseAtBonus||summary.bonusWin<0||
     summary.bonusWin+expectedBonus<0||summary.bonusWin+expectedBonus>settled||
     summary.tier!==bonus?.tier||summary.capped!==capSeen))throw Error('Invalid adjusted bonus amount');
  if(bonus?.tier===2&&!capSeen&&(!summary||summary.bonusWin<BONUS_MINIMUM||
      summary.bonusWin+expectedBonus<BONUS_MINIMUM))throw Error('Super Super minimum underpaid');
  return settled;
}

export function bonusDeltaFor(summary,delta){
  if(!summary)return 0;
  if(summary.tier===2&&!summary.capped)return Math.max(delta,BONUS_MINIMUM-summary.bonusWin);
  return Math.max(delta,-summary.bonusWin);
}
