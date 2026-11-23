// Registration coordinates on a common 400 Ã— 400 stage.
export const rigs={
  commander:{name:'Goon Commander',base:[65,29,245,266],parts:[
    ['hand',227,197,116,109,'limb'],['glasses',114,76,171,72,'visor'],['tongue',181,174,92,90,'tongue'],['cigar',239,157,94,78,'cigar']
  ]},
  cyclopz:{name:'Cyclopz',base:[63,20,263,345],eyes:[[200,172,47,41,'#8cd548']],parts:[
    ['hand',267,228,91,106,'limb'],['iris',171,137,61,61,'eye'],['tongue',181,238,99,74,'tongue']
  ]},
  'octo-lab':{name:'Octo-Lab',base:[83,17,220,361],eyes:[[168,158,26,15,'#d971e1'],[219,158,26,15,'#d971e1']],parts:[
    ['eyes',146,146,95,24,'eye'],['left-arm',72,221,102,97,'limb'],['right-arm',201,226,112,84,'counter']
  ]},
  'space-cow':{name:'Space Cow',base:[65,28,246,343],eyes:[[185,131,19,14,'#e1ac95'],[225,122,19,14,'#e1ac95']],parts:[
    ['ear',92,142,88,60,'counter'],['tongue',197,178,83,89,'tongue']
  ]}
};
export async function loadRig(name){
  const rig=rigs[name];
  const parts=Object.fromEntries(await Promise.all(['base',...rig.parts.map(x=>x[0])].map(async id=>{
    const img=new Image();img.src='assets/visual/rigs/'+name+'/'+id+'.webp';await img.decode();return [id,img];
  })));
  return {rig,parts};
}
function sprite(ctx,img,x,y,w,h,angle=0,sx=1,sy=1){
  const ratio=Math.min(w/img.naturalWidth,h/img.naturalHeight);
  ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(angle);ctx.scale(sx,sy);
  const dw=img.naturalWidth*ratio,dh=img.naturalHeight*ratio;
  ctx.drawImage(img,-dw/2,-dh/2,dw,dh);ctx.restore();
}
export function pose(ctx,layered,t,rest=false,expression='idle',{visorLift=0,foregroundClock}={}){
  const {rig,parts}=layered;
  const idle=rest?0:Math.sin((foregroundClock??t)*2);
  const phase=Math.min(1,Math.max(0,t));
  const lift=Math.sin(Math.PI*phase);
  const snap=Math.sin(Math.PI*Math.min(1,phase*2.05))*(1-.24*phase);
  const reaction=rest?0:expression==='anticipation'?-snap*1.17:expression==='win'?snap*1.96:expression==='bonus'?lift*2.18:0;
  const cyclops=rig.name==='Cyclopz',octopus=rig.name==='Octo-Lab',cow=rig.name==='Space Cow';
  const blink=rest?0:Math.max(0,1-Math.abs((t+.33)%3.4-2.2)/.115);
  const tongueFlick=rest||foregroundClock===undefined?0:Math.max(0,Math.sin(foregroundClock*2.8+.5))**6;
  ctx.clearRect(0,0,400,400);ctx.save();
  ctx.translate(200,218);ctx.rotate(idle*.024+reaction*(cow?-.165:octopus?.037:.065));
  ctx.scale(1+reaction*.065,1+reaction*(cyclops?.13:.06));
  ctx.translate(-200,-218-reaction*(cyclops?19:14));
  sprite(ctx,parts.base,...rig.base);
  for(const [id,x,y,w,h,action] of rig.parts){
    const gaze=action==='eye',limb=action==='limb'||action==='counter',direction=action==='counter'?-1:1;
    const mouth=action==='tongue',visor=action==='visor';
    const dx=gaze?idle*6+reaction*(octopus?6:3):limb?reaction*(octopus?23:11)*direction:0;
    const dy=mouth?idle*3+reaction*(cow?22:15)+tongueFlick*9:limb?-reaction*(octopus?12:23):visor?-reaction*16-visorLift*33:0;
    const angle=limb?direction*(idle*.105+reaction*(octopus?.52:.33)):mouth?idle*.12+tongueFlick*.12:visor?reaction*.05-visorLift*.18:0;
    if(gaze&&blink>.74)continue;
    sprite(ctx,parts[id],x+dx,y+dy,w,h,angle,1,mouth?1+reaction*.16:gaze&&cyclops?1+reaction*.11:1);
  }
  if(rig.name==='Goon Commander'){
    const stretch=reaction*12+idle*2+tongueFlick*7;
    ctx.beginPath();ctx.moveTo(225,233);ctx.quadraticCurveTo(221-tongueFlick*3,244,225,251+stretch);
    ctx.strokeStyle='#ccf5eda8';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.stroke();
    ctx.fillStyle='#cdf8ebd1';ctx.beginPath();ctx.ellipse(225,252+stretch,2.6,3.4,.13,0,Math.PI*2);ctx.fill();
  }
  if(blink>0)for(const [x,y,w,h,color] of rig.eyes||[]){
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,w,h*blink,.07,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#311a38';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-w*.85,y);ctx.quadraticCurveTo(x,y+h*.25,x+w*.85,y);ctx.stroke();
  }
  ctx.restore();
}


