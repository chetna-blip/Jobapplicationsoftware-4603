/**
 * Autofill payload + bookmarklet.
 *
 * Neither Greenhouse nor Lever lets anyone submit an application programmatically without an
 * employer-held private API key (Lever's public apply endpoint answers
 * `403 {"ok":false,"error":"You need an API key..."}`), so the honest maximum is to fill the real
 * form inside the candidate's own browser session and let them press Submit.
 *
 * The bookmarklet below runs on the actual apply page, matches fields by name and by visible
 * label, writes values through React's own value setter so controlled inputs update, and reports
 * what it filled. No credentials, no headless browser, no scraping of a logged-in session.
 */

export interface AutofillField {
  /** Field name on the real form when we know it (Greenhouse question ids, Lever field names). */
  name?: string;
  /** Visible question text — used to match when the name is unknown. */
  label: string;
  value: string;
  kind: "text" | "textarea" | "select" | "checkbox";
  /**
   * One of several shapes different boards use for the same thing — Lever asks for a single
   * "Full name", Greenhouse for first + last; only some forms have an "Additional information"
   * box. An unmatched alias is normal, so it is not reported back as work left for the candidate.
   */
  alias?: boolean;
}

export interface AutofillPayload {
  company: string;
  title: string;
  applyUrl: string;
  fields: AutofillField[];
}

const RUNNER = `(function(){
  var P=__PAYLOAD__;
  function norm(s){return (s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function setNative(el,val){
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto,"value");
    if(setter && setter.set) setter.set.call(el,val); else el.value=val;
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
    el.dispatchEvent(new Event("blur",{bubbles:true}));
  }
  function labelTextFor(el){
    var parts=[];
    if(el.id){var l=document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if(l) parts.push(l.innerText);}
    if(el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
    if(el.placeholder) parts.push(el.placeholder);
    var w=el.closest("label,div,fieldset,li");
    for(var i=0;i<3 && w;i++){ parts.push((w.innerText||"").slice(0,220)); w=w.parentElement; }
    return norm(parts.join(" "));
  }
  // A react-select style combobox cannot be set from a bookmarklet: its menu state is driven by
  // real (isTrusted) keystrokes, so synthetic events write visible text that never commits — the
  // field *looks* filled and submits empty. Verified live on Greenhouse. So never touch one;
  // collect them and tell the candidate to pick those themselves.
  function isCombo(el){
    return el.getAttribute("role")==="combobox" || el.getAttribute("aria-autocomplete")==="list" ||
      /select__input|react-select/.test(el.className||"") || !!el.closest('[class*="select__control"]');
  }
  function niceLabel(el){
    var l=el.id?document.querySelector('label[for="'+CSS.escape(el.id)+'"]'):null;
    var t=(l&&l.innerText)||el.getAttribute("aria-label")||el.name||el.id||"a dropdown";
    return t.replace(/\\s+/g," ").replace(/\\*$/,"").trim().slice(0,32);
  }
  // Greenhouse hides its Cover Letter / Resume textareas behind an "Enter manually" toggle, so the
  // letter we wrote has nowhere to go until that button is pressed. Reveal it first. Verified live.
  var revealed=false;
  [].slice.call(document.querySelectorAll("button,[role=button]")).forEach(function(b){
    if(!/enter manually/i.test(b.textContent||"")) return;
    var box=b.closest(".file-upload,fieldset,section")||b.parentElement;
    if(box && /cover\\s*letter/i.test(box.innerText||"")) { try{ b.click(); revealed=true; }catch(e){} }
  });
  // The reveal is a React state change, so the textarea only exists on a later tick — wait for it.
  function fill(){
  var all=[].slice.call(document.querySelectorAll("input,textarea,select")).filter(function(el){
    if(el.disabled||el.readOnly) return false;
    var t=(el.type||"").toLowerCase();
    return !["hidden","file","submit","button","image","reset"].includes(t);
  });
  var combos=all.filter(isCombo), controls=all.filter(function(el){return !isCombo(el);});
  var used=[],filled=0,missed=[],letterPlaced=false;
  var letterField=P.fields.filter(function(f){return /cover\\s*letter/i.test(f.label);})[0];
  var letter=letterField?letterField.value:"";
  function pick(f){
    if(f.name){
      var byName=controls.filter(function(el){
        if(used.includes(el)) return false;
        var n=el.name||"";
        return n===f.name || n===f.name+"[]" || n.replace(/\\[\\]$/,"")===f.name.replace(/\\[\\]$/,"");
      });
      if(byName.length) return byName;
      // Greenhouse's newer form leaves the name attribute empty and puts the question id on id.
      var byId=controls.filter(function(el){ return !used.includes(el) && el.id===f.name; });
      if(byId.length) return byId;
    }
    var want=norm(f.label);
    if(!want) return [];
    var scored=controls.filter(function(el){return !used.includes(el);}).map(function(el){
      var hay=labelTextFor(el), s=0;
      if(hay.includes(want)) s=want.length;
      else {
        var ws=want.split(" ").filter(function(w){return w.length>3;});
        var hit=ws.filter(function(w){return hay.includes(w);}).length;
        if(ws.length && hit/ws.length>=0.7) s=hit*3;
      }
      return {el:el,s:s};
    }).filter(function(x){return x.s>0;}).sort(function(a,b){return b.s-a.s;});
    return scored.length?[scored[0].el]:[];
  }
  var fillable=P.fields.length, unmatched=[];
  P.fields.forEach(function(f){
    var els=pick(f);
    // Unmatched fields are judged after the whole pass, not here: a posting often asks for the
    // same thing twice (its own "LinkedIn or website" question and our identity field) and the
    // other copy may not be written until later in the loop.
    if(!els.length){ unmatched.push(f); return; }
    var el=els[0];
    used.push(el);
    var tag=el.tagName.toLowerCase(), type=(el.type||"").toLowerCase();
    if(tag==="select"){
      var want=norm(f.value), opt=[].slice.call(el.options).find(function(o){
        return norm(o.text)===want||norm(o.value)===want;
      })|| [].slice.call(el.options).find(function(o){return norm(o.text).includes(want)&&want.length>2;});
      if(opt){ setNative(el,opt.value); filled++; } else missed.push(f.label);
      return;
    }
    if(type==="radio"){
      var want2=norm(f.value);
      var group=controls.filter(function(x){return x.type==="radio"&&x.name===el.name;});
      var hit=group.find(function(x){return norm(x.value)===want2||labelTextFor(x).includes(want2);})||group[0];
      if(hit){ hit.click(); filled++; } else missed.push(f.label);
      return;
    }
    if(type==="checkbox"){
      var yes=/^(yes|true|1|i agree|agree|accept)$/i.test(f.value.trim());
      if(el.checked!==yes) el.click();
      filled++; return;
    }
    setNative(el,f.value);
    if(/cover\\s*letter/i.test(f.label)) letterPlaced=true;
    filled++;
  });
  unmatched.forEach(function(f){
    // Already handled if some box we wrote is the same question, or already holds this value.
    var done=used.some(function(el){
      if(f.name && (el.name===f.name||el.id===f.name)) return true;
      if(labelTextFor(el).includes(norm(f.label))) return true;
      return f.value.length>=8 && !!el.value && String(el.value).indexOf(f.value)>=0;
    });
    if(done||f.alias) fillable--; else missed.push(f.label);
  });
  // Plenty of Lever postings have no cover-letter box at all (verified live). Say so rather than
  // silently dropping the letter, and try the clipboard — only claiming it once it actually lands.
  var letterNote=(!letterPlaced && letter)?"This form has no cover-letter box — copy your letter from Apply Copilot to paste it wherever fits.":"";
  var bar=document.createElement("div");
  bar.style.cssText="position:fixed;z-index:2147483647;left:16px;right:16px;bottom:16px;background:#0B0C0B;color:#F2EFE6;border:1px solid #C8FF4D;border-radius:14px;padding:14px 18px;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5)";
  bar.innerHTML='<b style="color:#C8FF4D">Apply Copilot</b> filled '+filled+' of '+fillable+' fields for '+P.title+' @ '+P.company+'.'+
    (missed.length?'<br><span style="opacity:.7">Left for you: '+missed.slice(0,6).join(" · ")+(missed.length>6?" …":"")+'</span>':'')+
    (letterNote?'<br><span id="ac-letter" style="color:#F0B429">'+letterNote+'</span>':'')+
    (combos.length?'<br><span style="opacity:.7">Pick these dropdowns yourself (a browser will not let a script choose them): '+combos.map(niceLabel).slice(0,5).join(" · ")+(combos.length>5?" …":"")+'</span>':'')+
    '<br><span style="opacity:.7">Attach your resume file, check everything, then press the page\’s own Submit button.</span>';
  document.body.appendChild(bar);
  if(letterNote){
    try{
      navigator.clipboard.writeText(letter).then(function(){
        var s=document.getElementById("ac-letter");
        if(s) s.textContent="This form has no cover-letter box — your letter is on the clipboard, ready to paste.";
      }).catch(function(){});
    }catch(e){}
  }
  setTimeout(function(){bar.remove();},14000);
  }
  setTimeout(fill, revealed?400:0);
})();`;

/** A `javascript:` bookmarklet that fills this application's fields on the real apply page. */
export function bookmarklet(payload: AutofillPayload): string {
  const body = RUNNER.replace("__PAYLOAD__", JSON.stringify(payload));
  return `javascript:${encodeURIComponent(body)}`;
}

/** Plain console-pasteable version of the same script. */
export function consoleSnippet(payload: AutofillPayload): string {
  return RUNNER.replace("__PAYLOAD__", JSON.stringify(payload, null, 0));
}
