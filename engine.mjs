/** PolicyReply deterministic prototype. No language model is used in this file. */
export const CATEGORIES = Object.freeze({
 shipping: {label:'Delivery & shipping', keywords:['delivery','deliver','shipping','ship','arrive','dispatch','late','delay','track','courier','order'], hints:['delivery','dispatch','shipping','ship','courier','tracking','working day','business day','order']},
 refunds: {label:'Refund & returns', keywords:['refund','return','cancel','money back','exchange','replace','replacement'], hints:['refund','return','cancellation','cancel','exchange','replace','replacement']},
 damaged: {label:'Damaged items', keywords:['damaged','broken','defective','faulty','missing','wrong item','not working'], hints:['damaged','broken','defective','faulty','missing','incorrect','wrong','replacement','refund','return']},
 payment: {label:'Payment', keywords:['payment','pay','upi','card','cash on delivery','cod','charged','transaction','invoice','bill'], hints:['payment','upi','card','cash on delivery','cod','transaction','invoice','charged','bill']},
 general: {label:'General question', keywords:[], hints:[]}
});
const MAX_POLICY = 6000, MAX_MESSAGE = 2000;
export function cleanInput(v, max=2000) {return String(v ?? '').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
const matchesPhrase=(text,phrase)=>new RegExp(`(?:^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}${phrase.includes(' ')?'':'(?:s|ed|ing)?'}(?:$|[^a-z])`,'i').test(text);
export function chooseCategory(message) {
 const m=cleanInput(message,MAX_MESSAGE).toLowerCase();
 let winner='general', best=0;
 for (const [id,data] of Object.entries(CATEGORIES)) {
  if(id==='general')continue;
  const score=data.keywords.reduce((n,kw)=>n+(matchesPhrase(m,kw)?(kw.includes(' ')?3:kw==='order'?0.25:1):0),0);
  if(score>best){best=score;winner=id;}
 }
 return winner;
}
export function policySentences(policy) {
 const text=String(policy ?? '').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g,' ').trim().slice(0,MAX_POLICY);
 if (!text)return [];
 // Split only on high confidence boundaries to preserve numbers and abbreviations.
 return text.split(/(?:\n+|(?<=[.!?])\s+(?=[A-Z0-9]))/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
}
export function extractEvidence(policy, category, message='') {
 const categoryData=CATEGORIES[category]||CATEGORIES.general;
 const tokens=cleanInput(message,MAX_MESSAGE).toLowerCase().match(/[a-z]{4,}/g)||[];
 const stop=new Set(['please','could','would','about','there','where','which','their','having','thank','thanks','hello','order','customer','want','need','what','when','this','that','have','from','with']);
 const relevantTokens=[...new Set(tokens.filter(t=>!stop.has(t)))].slice(0,20);
 return policySentences(policy).map((sentence,index)=>{
   const s=sentence.toLowerCase();
   const hints=categoryData.hints.filter(kw=>matchesPhrase(s,kw)).length;
   const overlap=relevantTokens.filter(t=>matchesPhrase(s,t)).length;
   return {sentence, index, score:hints*3+overlap};
 }).filter(x=>category==='general'?x.score>0:categoryData.hints.some(kw=>matchesPhrase(x.sentence,kw))).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,2).sort((a,b)=>a.index-b.index).map(x=>x.sentence);
}
export function generateDraft({message,policy,businessName='your store',tone='warm',category='auto'}={}) {
 const msg=cleanInput(message,MAX_MESSAGE), pol=String(policy ?? '').trim().slice(0,MAX_POLICY), business=cleanInput(businessName,60)||'our store';
 const selected=category==='auto'||!CATEGORIES[category]?chooseCategory(msg):category;
 const evidence=extractEvidence(pol,selected,msg);
 const hasMessage=Boolean(msg), hasPolicy=Boolean(pol);
 const greetings={warm:'Hi there,',professional:'Hello,',concise:'Hello,'};
 const closings={warm:`Thanks for reaching out to ${business}.`,professional:`Thank you for contacting ${business}.`,concise:'Thank you.'};
 const opening={shipping:'I understand you have a delivery question.',refunds:'I understand you have a question about returns or refunds.',damaged:'I’m sorry to hear there may be an issue with your item.',payment:'I understand you have a payment question.',general:'Thank you for your message.'};
 const lines=[greetings[tone]||greetings.warm, '', opening[selected]];
 if(evidence.length){
  lines.push('', 'According to our stated policy:', ...evidence.map(x=>`• ${x}`));
  lines.push('', 'If you can share your order number and any relevant details, we can check the next step for your specific case.');
 } else {
  lines.push('', "I don't want to give you incorrect information. Please share your order number and any relevant details, and our team will confirm the applicable policy and next steps.");
 }
 lines.push('',closings[tone]||closings.warm);
 return {draft:hasMessage?lines.join('\n'):'',category:selected, categoryLabel:CATEGORIES[selected].label, evidence, confidence:!hasMessage?'empty':evidence.length?'policy-match':'needs-review', warnings:[...(!hasMessage?['Enter a customer message.']:[]),...(!hasPolicy?['No business policy entered. The draft intentionally makes no policy promises.']:[]),...(hasPolicy&&!evidence.length?['No relevant clause found. Review and answer manually before sending.']:[]),'Human review is required before sending. This demo is rule-based, not Claude-powered.']};
}
