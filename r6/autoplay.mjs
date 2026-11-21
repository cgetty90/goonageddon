export const spinCounts=Object.freeze([10,25,50,100,500]);

export function createAutoplay({play,eligible,update,pace=1250}){
  let series=null;
  let timer;
  const publish=(reason='')=>update(series&&{...series},reason);
  function stop(reason='stopped'){
    if(!series)return;
    clearTimeout(timer);
    series=null;
    publish(reason);
  }
  async function next(run){
    if(series!==run)return;
    const blocker=eligible(run.quote);
    if(blocker){stop(blocker);return;}
    run.remaining--;
    publish();
    let settled;
    try{settled=await play(run.quote);}catch{stop('connection');return;}
    if(series!==run)return;
    if(!settled){stop('connection');return;}
    if(!run.remaining){stop('complete');return;}
    const nextBlocker=eligible(run.quote);
    if(nextBlocker){stop(nextBlocker);return;}
    timer=setTimeout(()=>void next(run),pace);
  }
  return {
    start(count,quote){
      if(series||!spinCounts.includes(count)||eligible(quote))return false;
      const run={remaining:count,quote:Object.freeze({...quote})};
      series=run;
      publish();
      void next(run);
      return true;
    },
    stop,
    get active(){return series!==null;}
  };
}
