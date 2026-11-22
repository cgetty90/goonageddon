const scenes=[
  [0,'space','Deep space','space','ambience'],
  [1000,'ufo','Incoming transmission','ufo','spin'],
  [2300,'pilot','Stay smooth, Commander','space','expand'],
  [3350,'alarm','Wrong lever!','space','alarm'],
  [4100,'beam','Galactic chaos','beam','burst'],
  [5900,'reveal','GOONAGEDDON','beam','large']
];
const storageKey='goonageddon-welcome-r6';
let shown=false;
export function skipWelcome(){
  shown=true;
  try{sessionStorage.setItem(storageKey,'1');}catch{}
}
export function hasSeenWelcome(){
  try{return shown||sessionStorage.getItem(storageKey)==='1';}catch{return shown;}
}

export function showWelcome(audio,muted=false){
  const dialog=document.getElementById('intro');
  const scene=document.getElementById('scene');
  const title=document.getElementById('scene-title');
  const progress=document.getElementById('progress');
  const play=document.getElementById('enter');
  const skip=document.getElementById('intro-skip');
  const sound=document.getElementById('intro-audio');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const asset of new Set(scenes.map(entry=>entry[3])))new Image().src='assets/intro-'+asset+'.jpg';
  let frame,index=-1,soundOn=false;
  sound.disabled=muted;
  if(muted)sound.title='Game sound is muted';
  audio.setSilenced(true);
  const started=performance.now();
  function draw(now){
    const elapsed=reduced?8000:now-started;
    const next=scenes.findLastIndex(([time])=>time<=elapsed);
    if(next!==index&&next>=0){
      index=next;
      const [,name,text,art,cue]=scenes[index];
      dialog.dataset.scene=name;
      scene.style.backgroundImage='url(assets/intro-'+art+'.jpg)';
      title.textContent=text;
      if(soundOn)audio.cue(cue);
    }
    progress.value=Math.min(100,elapsed/80);
    if(elapsed<8000)frame=requestAnimationFrame(draw);
  }
  return new Promise(resolve=>{
    const finish=()=>{
      cancelAnimationFrame(frame);
      audio.setSilenced(false);
      skipWelcome();
      dialog.close();
      resolve();
    };
    play.onclick=()=>{audio.unlock();finish();};
    skip.onclick=finish;
    sound.onclick=()=>{
      soundOn=!soundOn;
      audio.setSilenced(!soundOn);
      if(soundOn)audio.unlock();
      sound.setAttribute('aria-pressed',String(soundOn));
      if(soundOn)audio.cue('ambience');
    };
    dialog.oncancel=event=>{event.preventDefault();finish();};
    dialog.showModal();
    draw(started);
  });
}
