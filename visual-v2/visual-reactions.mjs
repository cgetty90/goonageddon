import {loadRig,pose} from './rigs.mjs';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const compact=matchMedia('(max-height: 300px) and (orientation: landscape)');
const resources=new Map();
const running=new WeakMap();

function animate(canvas,id,expression,duration,until){
  if(reduced.matches)return;
  const token=Symbol();
  running.set(canvas,token);
  let parts=resources.get(id);
  if(!parts){
    parts=loadRig(id);
    resources.set(id,parts);
  }
  void parts.then(layered=>{
    if(running.get(canvas)!==token||!canvas.isConnected||!until())return;
    const ctx=canvas.getContext('2d'), start=performance.now();
    ctx.setTransform(canvas.width/400,0,0,canvas.height/400,0,0);
    canvas.dataset.reaction=expression;
    const frame=now=>{
      if(running.get(canvas)!==token)return;
      if(!canvas.isConnected||!until()||now-start>=duration){
        delete canvas.dataset.reaction;
        if(canvas.classList.contains('reaction-cell'))canvas.remove();
        return;
      }
      pose(ctx,layered,Math.min((now-start)/duration,1),false,expression);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }).catch(()=>{if(running.get(canvas)===token)delete canvas.dataset.reaction;});
}
const character=['commander','cyclopz','octo-lab','space-cow'];
export function warmReactions(){
  if(reduced.matches)return;
  for(const id of character){
    const promise=loadRig(id);
    resources.set(id,promise);
    void promise.catch(()=>{if(resources.get(id)===promise)resources.delete(id);});
  }
}

export function animateCells(cells,expression,duration){
  if(reduced.matches)return;
  const seen=new Set();
  for(const cell of cells){
    if(!cell)continue;
    const symbol=Number(cell.dataset.symbol);
    const id=character[symbol]??(symbol>=15?'commander':null);
    if(!id||seen.has(id)||(compact.matches&&symbol===2))continue;
    seen.add(id);
    const canvas=document.createElement('canvas');
    canvas.className='reaction-cell';
    const bounds=cell.getBoundingClientRect();
    const density=Math.min(1.5,devicePixelRatio);
    canvas.width=canvas.height=Math.max(48,Math.ceil(Math.min(bounds.width,bounds.height)*density));
    canvas.setAttribute('aria-hidden','true');
    cell.querySelector('canvas')?.remove();
    cell.append(canvas);
    animate(canvas,id,expression,duration,()=>true);
  }
}

const cinematicCast={commander:'commander','stage-5':'commander',cyclopz:'cyclopz',octo:'octo-lab',cow:'space-cow'};
export function animateCinema(dialog,cast,expression,duration){
  const canvas=dialog.querySelector('#cinema-rig');
  delete canvas.dataset.reaction;
  animate(canvas,cinematicCast[cast]||'commander',expression,duration,()=>dialog.open);
}
export function cinemaArt(cast){
  return 'assets/visual/symbols/'+(cinematicCast[cast]||'commander')+'.webp';
}

