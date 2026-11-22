const scenarios={
  'four':'Four-row reels','five':'Five-row reels','six':'Six-row reels','mixed':'Mixed-height reels',
  expand:'Expanding Wild',scatter:'Scatter anticipation',regular:'Regular Bonus',super:'Super Bonus',
  ultimate:'Super Super Bonus',big:'Big Win',maximum:'Maximum Win presentation',characters:'Character celebrations',
  'chaos-12':'Chaos · 12 points','chaos-30':'Chaos · 30 points','chaos-55':'Chaos · 55 points',
  'chaos-85':'Chaos · 85 points','chaos-120':'Chaos · 120 points'
};
const version='visual-v2-silent-1';
let last='Normal play',draft='';
export function noteNormal(){last='Normal play';}
function description(){
  const ua=navigator.userAgent;
  return {
    device:/iPhone|iPad|iPod/.test(ua)?'iOS':/Android/.test(ua)?'Android':'Desktop or tablet',
    browser:/Edg/.test(ua)?'Edge':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Other',
    viewport:innerWidth+' × '+innerHeight, screen:screen.width+' × '+screen.height
  };
}
export function mountDemoTools(container,run){
  const tools=document.createElement('div');
  tools.id='demo-tools';
  tools.innerHTML='<strong>Visual test scenarios</strong><p>Wallet-neutral previews using curated outcomes. Normal play uses fictional credits and has no official RTP.</p><label>Visual scenario<select></select></label><button type="button" data-run>Run visual scenario</button><label>Feedback<textarea placeholder="What did you notice?"></textarea></label><button type="button" data-copy>Copy Feedback</button><output aria-live="polite"></output>';
  const select=tools.querySelector('select');
  for(const [id,name] of Object.entries(scenarios))select.add(new Option(name,id));
  const field=tools.querySelector('textarea');
  field.value=draft;
  field.oninput=()=>{draft=field.value;};
  tools.querySelector('[data-run]').onclick=()=>{
    last=scenarios[select.value];
    run(select.value,last);
  };
  tools.querySelector('[data-copy]').onclick=async()=>{
    const d=description();
    const feedback=['GOONAGEDDON Visual V2 feedback','Version: '+version,'Device: '+d.device,'Browser: '+d.browser,
      'Viewport: '+d.viewport,'Screen: '+d.screen,'Scenario: '+last,'Feedback: '+field.value.trim()].join('\n');
    const result=tools.querySelector('output');
    try{await navigator.clipboard.writeText(feedback);result.textContent='Feedback copied.';}
    catch{field.value=feedback;field.select();result.textContent='Select and copy the prepared feedback.';}
  };
  container.append(tools);
}
