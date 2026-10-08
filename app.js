import {generateDraft,cleanInput} from './engine.mjs?v=0.2.0';
const $=id=>document.getElementById(id); const HISTORY='policyreply:history:v1';
let latest=null, toastTimer;
function notify(message){const e=$('toast');e.textContent=message;e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,2800);}
function readHistory(){try{const h=JSON.parse(localStorage.getItem(HISTORY)||'[]');return Array.isArray(h)?h.slice(0,10):[];}catch{return [];}}
function renderHistory(){const list=$('history');list.replaceChildren();const entries=readHistory();if(!entries.length){const e=document.createElement('p');e.className='emptyhistory';e.textContent='No drafts saved yet.';list.append(e);return;}
for(const item of entries){const wrap=document.createElement('div');wrap.className='historyitem';const meta=document.createElement('div');const name=document.createElement('strong');name.textContent=item.category||'Reply';const date=document.createElement('small');date.textContent='Saved '+new Date(item.when).toLocaleString();meta.append(name,date);const b=document.createElement('button');b.type='button';b.className='subtlebutton';b.textContent='Load';b.addEventListener('click',()=>{$('message').value=item.message;$('policy').value=item.policy;$('business').value=item.business;$('category').value=item.categorySelection||'auto';$('tone').value=item.tone||'warm';generate();$('draft').value=item.draft;$('draft').focus();notify('Saved draft loaded');});wrap.append(meta,b);list.append(wrap);}}
function generate(){latest=generateDraft({message:$('message').value,policy:$('policy').value,businessName:$('business').value,tone:$('tone').value,category:$('category').value});$('draft').value=latest.draft;$('categorylabel').textContent=latest.categoryLabel;$('status').textContent=latest.confidence==='policy-match'?'✓ Policy clause found':latest.confidence==='empty'?'Add a message':'⚠ Needs human review';$('status').className='statepill '+(latest.confidence==='policy-match'?'good':latest.confidence==='empty'?'':'caution');const ev=$('evidence');ev.replaceChildren();for(const clause of latest.evidence){const li=document.createElement('li');li.textContent=clause;ev.append(li);}$('evidencepanel').hidden=!latest.evidence.length;$('warnings').textContent=latest.warnings.join(' ');if(!latest.draft)notify('Enter a customer message first');}
$('generate').addEventListener('click',generate);
$('sample').addEventListener('click',()=>{$('business').value='Amara Studio';$('message').value='Hi, I received my order yesterday but the size doesn’t fit. Can I return it for a refund?';$('policy').value='Returns are accepted within 7 days of delivery for unused items with original tags attached.\nRefunds are processed to the original payment method within 5–7 business days after inspection.\nShipping usually takes 3–5 business days after dispatch.\nDamaged or incorrect items should be reported within 48 hours of delivery with photographs.';generate();notify('Example loaded');});
$('copy').addEventListener('click',async()=>{const val=$('draft').value.trim();if(!val)return notify('Generate a reply first');try{await navigator.clipboard.writeText(val);notify('Reply copied');}catch{const ta=$('draft');ta.focus();ta.select();notify('Select and copy the highlighted reply');}});
$('download').addEventListener('click',()=>{const val=$('draft').value.trim();if(!val)return notify('Generate a reply first');const link=document.createElement('a');const url=URL.createObjectURL(new Blob([val+'\n'],{type:'text/plain;charset=utf-8'}));link.href=url;link.download='policyreply-draft.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Text file downloaded');});
$('save').addEventListener('click',()=>{if(!$('draft').value.trim())return notify('Generate a reply first');const record={when:new Date().toISOString(),category:latest?.categoryLabel||'Draft',categorySelection:$('category').value,tone:$('tone').value,message:cleanInput($('message').value),policy:$('policy').value.slice(0,6000),business:cleanInput($('business').value,60),draft:$('draft').value.slice(0,8000)};try{localStorage.setItem(HISTORY,JSON.stringify([record,...readHistory()].slice(0,10)));renderHistory();notify('Saved to this browser');}catch{notify('Browser storage is unavailable');}});
$('clear').addEventListener('click',()=>{try{localStorage.removeItem(HISTORY);renderHistory();notify('Local draft history cleared');}catch{notify('Unable to clear history');}});
function updateActions(){for(const id of ['copy','download','save'])$(id).disabled=!$('draft').value.trim()||inputsChanged;}
let inputsChanged=false;
for(const id of ['business','message','policy','category','tone']){
 $(id).addEventListener('input',()=>{
  inputsChanged=true;
  $('status').textContent='Inputs changed · Generate again';
  $('status').className='statepill caution';
  $('categorylabel').textContent='';
  $('evidencepanel').hidden=true;
  $('warnings').textContent='This draft uses your previous inputs. Generate a new reply before copying or saving.';
  updateActions();
 });
}
$('generate').addEventListener('click',()=>{inputsChanged=false;updateActions();});
$('sample').addEventListener('click',()=>{inputsChanged=false;updateActions();});
$('draft').addEventListener('input',updateActions);
$('history').addEventListener('click',event=>{if(event.target.closest('.historyitem button')){inputsChanged=false;updateActions();}});
$('year').textContent=String(new Date().getFullYear());renderHistory();generate();updateActions();
