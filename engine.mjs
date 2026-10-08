/** Browser-only policy matcher. It does not use a language model. */
export const CATEGORIES = Object.freeze({
  shipping: {label:'Delivery & shipping', keywords:['delivery','deliver','shipping','ship','arrive','dispatch','late','delay','track','courier','parcel','package'], hints:['delivery','dispatch','shipping','ship','courier','tracking','parcel','package']},
  refunds: {label:'Refund & returns', keywords:['refund','return','cancel','money back','exchange','replace','replacement'], hints:['refund','return','cancellation','cancel','exchange','replace','replacement']},
  damaged: {label:'Damaged items', keywords:['damaged','broken','defective','faulty','missing item','wrong item','not working'], hints:['damaged','damage','broken','defective','faulty','missing','incorrect','wrong']},
  payment: {label:'Payment', keywords:['payment','pay','upi','card','cash on delivery','cod','charged','transaction','invoice','bill','debited'], hints:['payment','pay','upi','card','cash on delivery','cod','transaction','invoice','charged','bill','debit']},
  general: {label:'General question', keywords:[], hints:[]}
});
const MAX_POLICY=6000, MAX_MESSAGE=2000;
export function cleanInput(value,max=2000) {
  return String(value??'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
function normalize(value) {
  return cleanInput(value,MAX_POLICY).toLowerCase().replace(/[’‘]/g,"'");
}
function matchesPhrase(text,phrase) {
  const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(?:^|[^a-z])${escaped}${phrase.includes(' ')?'':'(?:s|ed|ing)?'}(?:$|[^a-z])`,'i').test(text);
}
const ALIASES={
  shipping:[/\bwhere(?:'s| is)?\b.{0,40}\b(order|parcel|package|purchase|stuff)\b/,/\bwhen\b.{0,40}\b(get|receive|reach|come|arrive)\b/,/\b(not|never|hasn't|haven't|didn't|still haven't)\b.{0,30}\b(received|arrived|delivered|shown up|got)\b/,/\b(hasn't|haven't|not|nothing)\b.{0,15}\b(shown up|turned up|here yet)\b/],
  refunds:[/\b(send|take|give)\b.{0,25}\bback\b/,/\b(too small|too big|too large|doesn't fit|does not fit|didn't fit|change my mind|changed my mind|different size)\b/,/\b(call off|stop my order)\b/],
  damaged:[/\b(cracked|torn|scratched|smashed|leaking|doesn't work|does not work|won't turn on|stopped working|piece missing|item missing|different item|wrong size)\b/],
  payment:[/\b(charged|debited|deducted|paid|payment)\b.{0,30}\b(twice|double|two times|failed|declined)\b/,/\b(money|amount)\b.{0,25}\b(deducted|debited|taken)\b/,/\b(how|can|ways to)\b.{0,25}\bpay\b/]
};
// Specific questions need evidence about that subject, rather than any clause in its category.
const SPECIFIC={
  refunds:[
    {ask:/\b(cancel|cancellation|call off|stop my order)\b/, terms:['cancel','cancellation'],label:'cancellation'},
    {ask:/\b(exchange|swap|different size|replace|replacement)\b/,terms:['exchange','swap','replace','replacement'],label:'exchanges or replacements'},
    {ask:/\b(refund|money back)\b/,terms:['refund','money back','reimbursement'],label:'refunds'}
  ],
  shipping:[{ask:/\b(track|tracking|tracking number|tracking link)\b/,terms:['track','tracking','tracking number','tracking link'],label:'tracking'}],
  payment:[
    {ask:/\b(charged|debited|deducted|paid|payment)\b.{0,30}\b(twice|double|two times)\b/,terms:['twice','double','duplicate','overcharge'],label:'duplicate payment problems'},
    {ask:/\b(payment|transaction|card)\b.{0,30}\b(failed|declined|unsuccessful)\b/,terms:['failed','declined','unsuccessful'],label:'failed payment problems'},
    {ask:/\b(money|amount)\b.{0,25}\b(deducted|debited|taken)\b/,unless:/\b(twice|double|two times)\b/,terms:['deducted','debited','dispute'],label:'deducted payment problems'}
  ],
  damaged:[
    {ask:/\b(wrong item|different item|wrong size|incorrect item)\b/,terms:['wrong','incorrect'],label:'incorrect items'},
    {ask:/\b(missing item|item missing|piece missing|missing piece)\b/,terms:['missing','incomplete'],label:'missing items'}
  ],
  general:[
    {ask:/\b(open|opening|close|closing|hours|weekend|sunday|saturday)\b/,terms:['open','opening','close','closing','hours'],label:'opening hours'},
    {ask:/\b(warranty|guarantee|guaranteed)\b/,terms:['warranty','guarantee'],label:'warranty'},
    {ask:/\b(contact|phone number|email|reach you)\b/,terms:['contact','phone','email'],label:'contact information'},
    {ask:/\b(located|location|address|where is your shop)\b/,terms:['location','address','located'],label:'store location'},
    {ask:/\b(stock|available|availability|sell|selling)\b/,terms:['stock','available','availability','sell'],label:'product availability'},
    {ask:/\b(discount|coupon|promo)\b/,terms:['discount','coupon','promo'],label:'discounts'}
  ]
};
function rankedTopics(message) {
  const text=normalize(message);
  return Object.entries(CATEGORIES).filter(([id])=>id!=='general').map(([id,data])=>({
    id,score:data.keywords.reduce((score,word)=>score+(matchesPhrase(id==='shipping'?text.replace(/\bcash on delivery\b/g,''):text,word)?(word.includes(' ')?3:1):0),0)+(ALIASES[id]||[]).filter(pattern=>pattern.test(text)).length*4
  })).filter(topic=>topic.score>0).sort((a,b)=>b.score-a.score);
}
export function chooseCategory(message) { return rankedTopics(message)[0]?.id||'general'; }
export function policySentences(policy) {
  const text=String(policy??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g,' ').trim().slice(0,MAX_POLICY);
  return text.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);
}
const STOP=new Set('please could would about there where which their having thank thanks hello order customer want need what when this that have from with store policy tell know items item product products question help does your ours much will some then also'.split(' '));
function tokens(value) {return [...new Set((normalize(value).match(/[a-z]{4,}/g)||[]).filter(word=>!STOP.has(word)))];}
function evidenceDetails(policy,category,message) {
  const data=CATEGORIES[category]||CATEGORIES.general;
  const active=(SPECIFIC[category]||[]).filter(rule=>rule.ask.test(normalize(message))&&!(rule.unless?.test(normalize(message))));
  const words=tokens(message);
  let candidates=policySentences(policy).map((sentence,index)=>{
    const text=normalize(sentence);
    const hints=data.hints.filter(word=>matchesPhrase(text,word)).length;
    const overlap=words.filter(word=>matchesPhrase(text,word)).length;
    const specific=active.filter(rule=>rule.terms.some(word=>matchesPhrase(text,word))).length;
    return {sentence,index,score:hints*3+overlap+specific*10,hints,overlap,specific};
  }).filter(row=>category==='general'?(active.length?row.specific>0:row.overlap>=2):row.hints>0);
  // For a specific request, generic rules do not resolve the question.
  if(active.length)candidates=candidates.filter(row=>row.specific>0);
  const chosen=candidates.sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,Math.max(2,active.length)).sort((a,b)=>a.index-b.index);
  const missing=active.filter(rule=>!chosen.some(row=>rule.terms.some(word=>matchesPhrase(normalize(row.sentence),word)))).map(rule=>rule.label);
  return {evidence:chosen.map(row=>row.sentence),missing};
}
export function extractEvidence(policy,category,message='') {return evidenceDetails(policy,category,message).evidence;}
export function generateDraft({message,policy,businessName='your store',tone='warm',category='auto'}={}) {
  const msg=cleanInput(message,MAX_MESSAGE),pol=String(policy??'').trim().slice(0,MAX_POLICY),business=cleanInput(businessName,60)||'our store';
  const automatic=category==='auto'||!CATEGORIES[category];
  const topics=automatic?rankedTopics(msg).map(topic=>topic.id):[category];
  if(!topics.length)topics.push('general');
  const selected=topics[0];
  const details=topics.map(topic=>({topic,...evidenceDetails(pol,topic,msg)}));
  const evidence=[...new Set(details.flatMap(detail=>detail.evidence))];
  const gaps=[...new Set(details.flatMap(detail=>detail.missing.length?detail.missing:detail.evidence.length?[]:[CATEGORIES[detail.topic].label]))];
  const greetings={warm:'Hi there,',professional:'Hello,',concise:'Hello,'};
  const closings={warm:`Thanks for reaching out to ${business}.`,professional:`Thank you for contacting ${business}.`,concise:'Thank you.'};
  const opening={shipping:'I understand you have a delivery question.',refunds:'I understand you have a question about returns or refunds.',damaged:'I’m sorry to hear there may be an issue with your item.',payment:'I understand you have a payment question.',general:'Thank you for your message.'};
  const lines=[greetings[tone]||greetings.warm,'',topics.length>1?'Thank you for explaining the situation. We’ll review each part of your question.':opening[selected]];
  if(evidence.length){
    lines.push('','According to our stated policy:',...evidence.map(clause=>`• ${clause}`));
    if(gaps.length)lines.push('',`We’ll need to confirm ${gaps.join(' and ').toLowerCase()} before giving you a definite answer on that part of your question.`);
    lines.push('',selected==='general'?'Please let us know if you need clarification on these details.':'Please share your order reference so our team can review how these terms apply to your case.');
  }else if(selected==='general'){
    lines.push('',"I don't want to give you incorrect information. Could you clarify what you’d like help with? Our team will confirm the details before giving you a definite answer.");
  }else{
    lines.push('',"I don't want to give you incorrect information. Our team will need to confirm the applicable policy before answering this question. Please share your order reference so we can review your case.");
  }
  lines.push('',closings[tone]||closings.warm);
  const liveStatus=topics.includes('shipping')&&/\b(where|when|tracking|track|status|not received|hasn't arrived)\b/i.test(normalize(msg));
  const warnings=[
    ...(!msg?['Enter a customer message.']:[]),
    ...(!pol?['No business policy entered. The draft intentionally makes no policy promises.']:[]),
    ...(pol&&gaps.length?[`Policy information missing for: ${gaps.join(', ')}. Add the relevant rules or confirm the answer manually.`]:[]),
    ...(topics.includes('general')&&!evidence.length&&msg?['Question not recognized or not covered. Try choosing a question type or adding a policy that addresses it.']:[]),
    ...(liveStatus?['This demo cannot look up order status, tracking details, or actual delivery dates.']:[]),
    'Human review is required before sending. This demo is rule-based, not Claude-powered.'
  ];
  return {draft:msg?lines.join('\n'):'',category:selected,categories:topics,categoryLabel:topics.map(topic=>CATEGORIES[topic].label).join(' + '),evidence,confidence:!msg?'empty':evidence.length&&!gaps.length?'policy-match':'needs-review',warnings};
}
