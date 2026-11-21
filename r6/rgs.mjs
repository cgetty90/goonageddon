import {verifySettlement} from './settlement.mjs';
const integer = value => Number.isSafeInteger(value) && value >= 0;
export function launch(url){
  const q=new URL(url).searchParams;
  const raw=q.get('rgs_url')||'';
  const endpoint=new URL(raw.startsWith('https://')?raw:'https://'+raw);
  if(!/(^|\.)(engine\.io|stake-engine\.com)$/i.test(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.port||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw Error('Unrecognized Engine endpoint');
  const replay=q.get('replay')==='true';
  const sessionID=q.get('sessionID');
  const keys=['game','version','mode','event'].map(key=>q.get(key));
  if(replay?keys.some(value=>!value||!/^[\w.-]+$/.test(value)||value==='.'||value==='..'):!sessionID)throw Error('Missing Engine launch parameters');
  const value=q.get('amount');
  const amount=value!==null&&/^\d+$/.test(value)&&integer(Number(value))&&Number(value)>0?Number(value):null;
  return {endpoint:endpoint.origin,sessionID,replay,keys,amount,currency:/^[A-Z]{3,5}$/.test(q.get('currency')||'')?q.get('currency'):null,social:q.get('social')==='true'};
}
export function makeClient(options,fetcher=fetch){
  async function request(path,fields){
    const init={credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)};
    if(fields)Object.assign(init,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionID:options.sessionID,...fields})});
    const response=await fetcher(options.endpoint+path,init);
    if(!response.ok)throw Error('Engine request failed');
    return response.json();
  }
  if(options.replay)return {replay:()=>request('/bet/replay/'+options.keys.map(encodeURIComponent).join('/'))};
  return {authenticate:()=>request('/wallet/authenticate',{}),play:(mode,amount)=>request('/wallet/play',{mode,amount}),
    complete:()=>request('/wallet/end-round',{}),checkpoint:index=>request('/bet/event',{event:String(index)})};
}
export const unitsAt=(amount,multiplier)=>{
  if(!integer(amount)||!integer(multiplier))throw Error('Invalid payout units');
  const out=Number(BigInt(amount)*BigInt(multiplier)/100n);
  if(!integer(out))throw Error('Payout exceeds safe integer range');
  return out;
};
export function checkOutcome(round,{replay=false,amount=round.amount}={}){
  const {state,payoutMultiplier}=round;
  const total=state?.at?.(-1)?.total;
  if(!Array.isArray(state)||state.some((event,index)=>event?.index!==index)||state.at(-1)?.type!=='end'||
     !integer(total)||total>5000000||typeof payoutMultiplier!=='number'||!Number.isFinite(payoutMultiplier)||
     Math.abs(payoutMultiplier*100-total)>1e-7)throw Error('Engine outcome is inconsistent');
  if(verifySettlement(state)!==total)throw Error('Engine event payout is inconsistent');
  if(!replay&&(!integer(round.payout)||round.payout!==unitsAt(amount,total)||typeof round.active!=='boolean'))throw Error('Engine payout is inconsistent');
  return total;
}
export function betLevels(config){
  const {minBet,maxBet,stepBet,betLevels:levels,defaultBetLevel}=config;
  if(!integer(minBet)||!integer(maxBet)||!integer(stepBet)||!stepBet||minBet<=0||maxBet<minBet||
    !Array.isArray(levels)||!levels.length||levels.some(n=>!integer(n)||n<minBet||n>maxBet||(n-minBet)%stepBet)||
    !levels.includes(defaultBetLevel))throw Error('Invalid Engine limits');
  return [...new Set(levels)].sort((a,b)=>a-b);
}
const symbols={USD:'$',EUR:'€',CAD:'CA$',MXN:'MX$',JPY:'¥',GBP:'£',AUD:'A$',BRL:'R$',CNY:'¥',INR:'₹',KRW:'₩'};
const precision={JPY:0,KRW:0,BTC:6,ETH:6};
export function formatUnits(amount,currency,social){
  const unit=({XSC:'SC',XEC:'SC',XGC:'GC'})[currency]||(social?(currency==='SC'?'SC':'GC'):currency||'');
  const prefix=social?'':symbols[unit]||'';
  const abs=Math.floor(Math.abs(amount));
  const normal=precision[unit]??2;
  const micros=String(abs%1000000).padStart(6,'0');
  const digits=Math.max(normal,micros.replace(/0+$/,'').length);
  return (amount<0?'−':'')+prefix+Math.floor(abs/1000000).toLocaleString('en-GB')+
    (digits?'.'+micros.slice(0,digits):'')+(unit&&!prefix?' '+unit:'');
}