export const entryScenes = Object.freeze([
  {name:'GOON ALERT',duration:4600,cast:'commander',reaction:'He found the big purple button.',charge:'Purple beam armed'},
  {name:'GOON OVERLOAD',duration:5500,cast:'cyclopz',reaction:'Cyclopz fell for the weapons console.',charge:'Weapons discharged'},
  {name:'MAXIMUM GOONAGE',duration:7000,cast:'stage-5',reaction:'The Commander is absolutely smitten.',charge:'Planetary beam fired'}
]);

// Presentation thresholds in hundredths of the originating stake.
export const summaryThresholds=Object.freeze({moderate:1000,high:7500,exceptional:40000});
const endingScenes=Object.freeze({
  low:{name:'A LITTLE SPACE',reaction:'Even the UFO looked away.',cast:'cow',duration:2200},
  moderate:{name:'NICE LANDING',reaction:'The crew is feeling itself.',cast:'cyclopz',duration:2800},
  high:{name:'COSMIC CHAOS',reaction:'Octo-Lab wants an encore.',cast:'octo',duration:3500},
  exceptional:{name:'GOONAGE UNLEASHED',reaction:'Someone turn down the Commander.',cast:'stage-5',duration:4550},
  maximum:{name:'GALACTIC MAX WIN',reaction:'The galaxy needs a minute.',cast:'commander',duration:5200}
});
export function selectEnding(payout,capped=false,thresholds=summaryThresholds){
  const band=capped?'maximum':payout>=thresholds.exceptional?'exceptional':payout>=thresholds.high?'high':payout>=thresholds.moderate?'moderate':'low';
  return {...endingScenes[band],band};
}
export function cinematicDuration(full,{reduced=false,turbo=false}={}){
  if(reduced)return Math.min(full,1250);
  if(turbo)return Math.round(full*.52);
  return full;
}
