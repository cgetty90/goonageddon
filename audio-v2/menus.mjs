import {information,descriptions} from './information.mjs';
import {spinCounts} from './autoplay.mjs';
const $=id=>document.getElementById(id);
const dialog=$('panel');
const body=$('panel-content');

export function panel(kind,title,markup=''){
  dialog.dataset.skin=kind;
  const heading=$('panel-title');
  heading.textContent=title;
  heading.tabIndex=-1;
  body.innerHTML=markup;
  body.scrollTop=0;
  if(!dialog.open)dialog.showModal();
  heading.focus();
}
export function action(label,handler,{disabled=false,primary=false,target=body}={}){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=label;
  button.disabled=disabled;
  if(primary)button.classList.add('primary');
  button.onclick=handler;
  target.append(button);
  return button;
}
export function showRules(social){
  const pages=information(social);
  panel('info','Game information','<div id="rule-tabs" role="tablist" aria-label="Information pages"></div><article id="rule-page" role="tabpanel" tabindex="0"></article>');
  const buttons=pages.map(([label],i)=>{
    const button=document.createElement('button');
    button.id='rule-tab-'+i;
    button.setAttribute('role','tab');
    button.setAttribute('aria-controls','rule-page');
    button.textContent=label;
    button.onclick=()=>select(i);
    button.onkeydown=event=>{
      const next={ArrowLeft:(i+pages.length-1)%pages.length,ArrowRight:(i+1)%pages.length,Home:0,End:pages.length-1}[event.key];
      if(next===undefined)return;
      event.preventDefault();
      select(next);
      buttons[next].focus();
    };
    $('rule-tabs').append(button);
    return button;
  });
  function select(index){
    buttons.forEach((button,i)=>{
      button.tabIndex=i===index?0:-1;
      button.setAttribute('aria-selected',String(i===index));
    });
    const article=$('rule-page');
    article.setAttribute('aria-labelledby',buttons[index].id);
    article.innerHTML=pages[index][1];
    article.scrollTop=0;
  }
  select(0);
  buttons[0].focus();
}
export function showAutoplay({label,amount,confirm}){
  panel('autoplay','Autoplay','<div class="quote"><span>'+label+'</span><strong>'+amount+'</strong></div><fieldset><legend>Number of spins</legend><div class="spin-tiles">'+spinCounts.map(count=>'<label><input name="auto-count" type="radio" value="'+count+'"><span>'+count+'</span></label>').join('')+'</div></fieldset><p id="auto-summary">Select a spin count.</p>');
  let selected;
  const button=action('Start Autoplay',()=>confirm(selected),{disabled:true,primary:true});
  body.querySelectorAll('input').forEach(input=>input.onchange=()=>{
    selected=Number(input.value);
    $('auto-summary').textContent=selected+' spins at '+amount+' each. You can stop at any time.';
    button.disabled=false;
  });
}

const featureArt={
  ANTE:['scatter','satellite'],REGULAR:['cyclopz','scatter'],
  SUPER:['octo-lab','scatter'],MYSTERY:['commander','scatter']
};

export function showFeatures({social,features,ante,enhanced,canSelectAnte,selectAnte,amount,balance,money,play}){
  const title=social?'Features':'Bonus Buy';
  const formatLabel=mode=>mode.name==='ANTE'?(social?'Ante':'Ante Bet'):mode.label+(social?' Bonus':' Bonus Buy');
  const offered=ante?[ante,...features]:features;
  function choose(){
    panel('features',title,'<p class="card-intro">Choose a feature and review the total before confirming.</p><div id="feature-cards"></div><p class="feature-foot">Base play amount <strong>'+money(amount)+'</strong> <span>Fictional credits</span></p>');
    for(const mode of offered){
      const isAnte=mode.name==='ANTE';
      const total=money(amount*mode.cost);
      const label=formatLabel(mode);
      const enabled=isAnte?enhanced||canSelectAnte:amount*mode.cost<=balance;
      const [hero,prop]=featureArt[mode.name];
      const card=document.createElement('article');
      card.dataset.feature=mode.name.toLowerCase();
      card.className='arcade-card';
      card.innerHTML='<div class="card-art" aria-hidden="true"><img class="card-prop" src="assets/visual/symbols/'+prop+'.webp" alt=""><img class="card-hero" src="assets/visual/symbols/'+hero+'.webp" alt=""></div>'+
        '<div class="card-copy"><h3>'+label+(isAnte?' <span class="ante-state">'+(enhanced?'On':'Off')+'</span>':'')+'</h3><p>'+descriptions[mode.name]+'</p></div>'+
        '<div class="card-action"><p class="card-price"><strong>'+mode.cost+'×</strong> '+total+(isAnte?' per spin':'')+'</p></div>';
      const reviewLabel=isAnte?(enhanced?'Review turning Ante off':'Review Ante'):'Review purchase';
      const review=action(reviewLabel,()=>confirm(mode),{disabled:!enabled,target:card.querySelector('.card-action')});
      review.setAttribute('aria-label',isAnte?reviewLabel:'Review '+label+' · '+total);
      $('feature-cards').append(card);
    }
  }
  function confirm(mode){
    const label=formatLabel(mode);
    const total=money(amount*mode.cost);
    const isAnte=mode.name==='ANTE';
    const heading=isAnte?(enhanced?'Turn off Ante':'Enable Ante'):'Confirm bonus purchase';
    const amountText=isAnte?money(amount*(enhanced?1:mode.cost)):total;
    const detail=isAnte
      ?'This changes the amount of future spins. A spin starts when you select Spin.'
      :descriptions[mode.name]+' Confirm to start one bonus round.';
    panel('feature-confirm',heading,'<div class="quote"><span>'+label+(isAnte?' · total per spin':' · '+mode.cost+'×')+'</span><strong>'+amountText+'</strong></div><p>'+detail+'</p>');
    action('Back',choose);
    action(isAnte?heading:'Start '+mode.label+' · '+total,()=>{
      dialog.close();
      if(isAnte)selectAnte(!enhanced);
      else void play(mode);
    },{primary:true});
  }
  choose();
}
