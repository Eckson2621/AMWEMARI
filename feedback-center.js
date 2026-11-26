(()=>{if(window.__eamFeedbackLoaded)return;window.__eamFeedbackLoaded=true;
const API="https://pzgnnjwmwylkmikcxwmf.supabase.co/functions/v1/feedback-center",KEY="sb_publishable_1jZy2d-qVJOiCZvHoB6-ow_AytoxBA2",APP="AMWEMARI";
const css=`#eam-fb-open{position:fixed;right:18px;bottom:18px;z-index:2147483000;border:0;border-radius:999px;padding:13px 18px;background:#164e63;color:white;font:600 14px system-ui;box-shadow:0 8px 28px #0003;cursor:pointer}#eam-fb-panel{position:fixed;inset:0;z-index:2147483001;background:#0b122099;display:none;align-items:center;justify-content:center;padding:16px;font:14px system-ui}#eam-fb-panel[aria-hidden=false]{display:flex}#eam-fb-card{width:min(100%,480px);max-height:90vh;overflow:auto;background:#fff;color:#17212b;border-radius:16px;padding:20px;box-shadow:0 20px 60px #0005}#eam-fb-card h2{margin:0 0 6px;font-size:21px}#eam-fb-card p{color:#536170;margin:0 0 15px}#eam-fb-card label{display:block;font-weight:600;margin:11px 0 5px}#eam-fb-card input,#eam-fb-card select,#eam-fb-card textarea{box-sizing:border-box;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:9px;font:14px system-ui;background:white;color:#17212b}#eam-fb-card textarea{min-height:110px;resize:vertical}#eam-fb-actions{display:flex;gap:8px;margin-top:15px}#eam-fb-actions button{border:0;border-radius:9px;padding:11px 15px;font-weight:600;cursor:pointer}#eam-fb-send{background:#0f766e;color:white;flex:1}#eam-fb-close{background:#e2e8f0;color:#17212b}#eam-fb-msg{min-height:20px;margin-top:10px;font-weight:600}#eam-fb-card .eam-fb-small{font-size:12px;color:#64748b}`;
const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
const open=document.createElement("button");open.id="eam-fb-open";open.type="button";open.textContent="Maoni / Msaada";
const panel=document.createElement("div");panel.id="eam-fb-panel";panel.setAttribute("aria-hidden","true");
panel.innerHTML=`<section id="eam-fb-card" role="dialog" aria-modal="true" aria-labelledby="eam-fb-title"><h2 id="eam-fb-title">Tuma maoni</h2><p>Tuambie tatizo, pendekezo au kipengele unachohitaji kwenye ${APP}.</p><form id="eam-fb-form"><label for="eam-fb-cat">Aina ya maoni</label><select id="eam-fb-cat" required><option value="problem">Tatizo</option><option value="bug">Hitilafu ya mfumo</option><option value="suggestion">Pendekezo</option><option value="feature_request">Kipengele kipya</option><option value="other">Mengineyo</option></select><label for="eam-fb-module">Sehemu ya mfumo (si lazima)</label><input id="eam-fb-module" maxlength="120" placeholder="Mfano: Mauzo, Malipo, Wanafunzi"><label for="eam-fb-name">Jina (si lazima)</label><input id="eam-fb-name" maxlength="160" autocomplete="name"><label for="eam-fb-email">Barua pepe (si lazima)</label><input id="eam-fb-email" type="email" maxlength="254" autocomplete="email"><label for="eam-fb-text">Eleza kwa ufupi</label><textarea id="eam-fb-text" minlength="5" maxlength="10000" required placeholder="Eleza kilichotokea au unachopendekeza..."></textarea><div class="eam-fb-small">Usiweke nenosiri au taarifa za siri hapa.</div><div id="eam-fb-actions"><button id="eam-fb-send" type="submit">Tuma maoni</button><button id="eam-fb-close" type="button">Funga</button></div><div id="eam-fb-msg" role="status" aria-live="polite"></div></form></section>`;
document.body.append(open,panel);
const close=()=>{panel.setAttribute("aria-hidden","true");};open.addEventListener("click",()=>panel.setAttribute("aria-hidden","false"));panel.addEventListener("click",e=>{if(e.target===panel)close()});panel.querySelector("#eam-fb-close").addEventListener("click",close);document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
panel.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const send=panel.querySelector("#eam-fb-send"),msg=panel.querySelector("#eam-fb-msg");send.disabled=true;msg.textContent="Inatuma...";try{const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({action:"submit",app_name:APP,category:panel.querySelector("#eam-fb-cat").value,module_name:panel.querySelector("#eam-fb-module").value,sender_name:panel.querySelector("#eam-fb-name").value,sender_email:panel.querySelector("#eam-fb-email").value,message:panel.querySelector("#eam-fb-text").value})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Imeshindikana kutuma.");msg.textContent="Asante! Maoni yako yamepokelewa.";panel.querySelector("form").reset();}catch(err){msg.textContent=err.message||"Hitilafu imetokea. Jaribu tena.";}finally{send.disabled=false;}});

/* EAM Center announcements and opt-in release notices */
(async function eamCenterNotices(){
 const esc=v=>String(v||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 const get=async(action)=>{const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({action,app_name:APP})});const d=await r.json();if(!r.ok)throw Error(d.error||"");return d;};
 try{
  const data=await get("announcement_list");
  const now=Date.now();
  const active=(data.items||[]).filter(x=>{
   const start=x.maintenance_start?new Date(x.maintenance_start).getTime():0;
   const end=x.maintenance_end?new Date(x.maintenance_end).getTime():Infinity;
   return (!start||now>=start-86400000)&&(!end||now<=end);
  });
  if(active.length){
   const box=document.createElement("aside");box.id="eam-center-announcement";
   box.style.cssText="position:fixed;top:12px;left:50%;transform:translateX(-50%);width:min(92vw,680px);z-index:2147482998;background:#fff7d6;color:#553b00;border:1px solid #e9c65b;border-radius:12px;padding:13px 16px;box-shadow:0 8px 28px #0003;font:14px/1.45 system-ui";
   box.innerHTML=active.map(x=>'<strong>'+esc(x.title)+'</strong><div>'+esc(x.message)+'</div>'+(x.maintenance_start||x.maintenance_end?'<small>Matengenezo: '+(x.maintenance_start?new Date(x.maintenance_start).toLocaleString():"")+' – '+(x.maintenance_end?new Date(x.maintenance_end).toLocaleString():"")+'</small>':"")).join("<hr style='border:0;border-top:1px solid #e9c65b;margin:8px 0'>");
   document.body.appendChild(box);
  }
 }catch(e){console.warn("EAM Center notice unavailable",e);}
 try{
  const data=await get("release_list"),release=data.release;
  if(release&&release.package_url){
   const box=document.createElement("aside");box.id="eam-center-update";
   box.style.cssText="position:fixed;right:18px;bottom:76px;z-index:2147482997;max-width:min(90vw,340px);background:#e8f3ff;color:#12365a;border:1px solid #93c5fd;border-radius:12px;padding:13px 15px;box-shadow:0 8px 28px #0003;font:14px/1.4 system-ui";
   box.innerHTML='<strong>Update mpya: '+esc(release.version)+'</strong><div>'+esc(release.title)+'</div><small>'+esc(release.release_notes)+'</small><div style="display:flex;gap:8px;margin-top:10px"><button type="button" id="eam-center-update-now" style="border:0;border-radius:8px;padding:9px 12px;background:#1d4ed8;color:white;font-weight:700">Update</button><button type="button" id="eam-center-update-later" style="border:0;border-radius:8px;padding:9px 12px;background:#dbeafe;color:#12365a">Baadaye</button></div>';
   document.body.appendChild(box);
   box.querySelector("#eam-center-update-now").onclick=()=>{window.location.assign(release.package_url);};
   box.querySelector("#eam-center-update-later").onclick=()=>box.remove();
  }
 }catch(e){console.warn("EAM Center release check unavailable",e);}
})();
})();