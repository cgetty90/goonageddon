import {loadRig,pose} from './rigs.mjs';

const priority={anticipation:1,win:2,bonus:3};
const duration={anticipation:850,win:980,bonus:1450};

export function mountForegroundPilot(canvas){
  const pilot=canvas.closest('.arcade-pilot');
  const wide=matchMedia('(min-width: 1040px) and (min-height: 560px)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const ctx=canvas.getContext('2d');
  const active=()=>ctx&&wide.matches&&!reduced.matches&&!document.hidden;
  let loading,rig,frame=0,last=0,expression='',started=0;

  function paint(now){
    frame=0;
    if(!active()||!rig)return;
    if(now-last>=1000/30){
      last=now;
      if(expression&&now-started>=duration[expression])expression='';
      const clock=now/1000;
      const t=expression?(now-started)/duration[expression]:clock;
      const phase=(clock+1.55)%6.2;
      const rise=Math.max(0,Math.min(1,phase/.18,(.82-phase)/.25));
      const lift=expression?0:rise*rise*(3-2*rise);
      pose(ctx,rig,t,false,expression||'idle',{visorLift:lift,foregroundClock:clock});
      pilot.dataset.reaction=expression||'idle';
      pilot.toggleAttribute('data-visor-lift',lift>.2);
    }
    frame=requestAnimationFrame(paint);
  }
  function sync(){
    cancelAnimationFrame(frame);
    frame=0;
    if(!active()){
      delete pilot.dataset.reaction;
      pilot.removeAttribute('data-visor-lift');
      return;
    }
    if(rig)frame=requestAnimationFrame(paint);
    else if(!loading){
      loading=loadRig('commander').then(value=>{rig=value;sync();}).catch(()=>{});
    }
  }
  wide.addEventListener('change',sync);
  reduced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  sync();
  return kind=>{
    if(!active())return;
    const now=performance.now();
    if(expression&&now-started<duration[expression]&&priority[kind]<priority[expression])return;
    expression=kind;
    started=now;
  };
}
