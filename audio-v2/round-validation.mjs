import {verifySettlement} from './settlement.mjs';
const integer = value => Number.isSafeInteger(value) && value >= 0;
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
// Stake Engine currency metadata. Unknown codes retain their suffix.
const prefixSymbols={"USD": "$","CAD": "CA$","JPY": "Â¥","EUR": "â‚¬","RUB": "â‚½","CNY": "CNÂ¥","PHP": "â‚±","INR": "â‚¹","IDR": "Rp","KRW": "â‚©","BRL": "R$","MXN": "MX$","TRY": "â‚º","PEN": "S/","NGN": "â‚¦","ILS": "â‚ª","TWD": "NT$","KWD": "KD","JOD": "JD","CRC": "â‚¡","SGD": "SG$","MYR": "RM","BHD": "BD","PKR": "â‚¨","NZD": "NZ$","BOB": "Bs","GHS": "GHâ‚µ","KES": "KSh","BAM": "KM","TZS": "TSh","UGX": "USh","AUD": "A$","BWP": "P","GEL": "â‚¾","HNL": "L","JMD": "J$","PGK": "K","TTD": "TT$","UAH": "â‚´","XCD": "EC$"};
const suffixSymbols={"DKK": "kr","PLN": "zÅ‚","VND": "â‚«","NOK": "kr","ISK": "kr","XOF": "CFA","XGC": "GC","XSC": "SC","XEC": "SC","XRC": "SC","WRW": "SC"};
const defaultPrecision={"JPY": 0,"IDR": 0,"KRW": 0,"VND": 0,"CLP": 0,"KWD": 3,"JOD": 3,"TND": 3,"OMR": 3,"BHD": 3,"ISK": 0,"UGX": 0,"XOF": 0,"APE": 4,"BCH": 6,"BNB": 6,"BTC": 6,"CRO": 4,"DOGE": 4,"EOS": 4,"ETH": 6,"LINK": 4,"LTC": 6,"POL": 4,"SAND": 4,"SHIB": 0,"SOL": 6,"TRUMP": 4,"TRX": 4,"UNI": 4,"XRP": 4};
export function formatUnits(amount,currency,social){
  if(!Number.isSafeInteger(amount))return 'â€”';
  const code=currency||'';
  const prefix=social?'':prefixSymbols[code]||'';
  const suffix=prefix?'':suffixSymbols[code]||(social?(code==='SC'?'SC':'GC'):code);
  const abs=Math.floor(Math.abs(amount));
  const micros=String(abs%1000000).padStart(6,'0');
  const digits=Math.max(defaultPrecision[code]??2,micros.replace(/0+$/,'').length);
  return (amount<0?'âˆ’':'')+prefix+Math.floor(abs/1000000).toLocaleString('en-GB')+
    (digits?'.'+micros.slice(0,digits):'')+(suffix?' '+suffix:'');
}
