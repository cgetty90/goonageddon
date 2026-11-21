import {information,descriptions} from './information.mjs';
import {spinCounts} from './autoplay.mjs';
const $=id=>document.getElementById(id);
const dialog=$('panel');
const body=$('panel-content');

export function panel(kind,title,markup=''){
  dialog.dataset.skin=kind;
  $('panel-title').textContent=title;
  body.innerHTML=markup;
  body.scrollTop=0;
  if(!dialog.open)dialog.showModal();
}
export function action(label,handler,{disabled=false,primary=false,markup}={}){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=label;
  button.disabled=disabled;
  if(primary)button.classList.add('primary');
  if(markup){button.innerHTML=markup;button.setAttribute('aria-label',label);}
  button.onclick=handler;
  body.append(button);
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

export function showFeatures({social,features,amount,balance,money,play}){
  const title=social?'Bonuses':'Bonus Buy';
  function choose(){
    panel('features',title);
    for(const mode of features){
      const total=money(amount*mode.cost);
      const label=mode.label+' · '+total;
      action(label,()=>{
        panel('feature-confirm','Confirm feature','<div class="quote"><span>'+mode.label+' · '+mode.cost+'×</span><strong>'+total+'</strong></div><p>'+descriptions[mode.name]+'</p>');
        action('Back',choose);
        action('Start '+label,()=>{dialog.close();void play(mode);},{primary:true});
      },{
        disabled:amount*mode.cost>balance,
        markup:'<img src="assets/goon-v5/'+({REGULAR:'cyclopz',SUPER:'octo',MYSTERY:'commander'})[mode.name]+'.png" alt=""><span><strong>'+mode.label+'</strong><small>'+mode.cost+'× base</small></span><b>'+total+'</b>'
      });
    }
  }
  choose();
}
