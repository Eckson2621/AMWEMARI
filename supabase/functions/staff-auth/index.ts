import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = new Set(["https://amwemari.workers.dev","https://amwemari.eckson.workers.dev","https://amwemari.mwalimueckson2104.workers.dev"]);
function response(data: unknown, status = 200, origin = "") {
  const h = new Headers({"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"});
  if(origin && ALLOWED_ORIGINS.has(origin)){h.set("Access-Control-Allow-Origin",origin);h.set("Access-Control-Allow-Headers","authorization, apikey, content-type");h.set("Access-Control-Allow-Methods","POST, OPTIONS");}
  return new Response(JSON.stringify(data),{status,headers:h});
}
async function rest(path:string,init:RequestInit={}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,"Content-Type":"application/json",...(init.headers||{})}});
}
async function loginIpHash(req:Request) {
 const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").trim();
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
 return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function loginRateCall(name:string,username:string,ipHash:string) {
 return rest("rpc/"+name,{method:"POST",body:JSON.stringify({p_username:username,p_ip_hash:ipHash})});
}
async function authenticatedOwner(req:Request) {
  const raw=req.headers.get("Authorization")||"";
  const token=raw.replace(/^Bearer\s+/i,"").trim();
  if(!token)return null;
  const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:ANON_KEY,Authorization:`Bearer ${token}`}});
  return r.ok?await r.json():null;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS"){if(!ALLOWED_ORIGINS.has(origin))return new Response("Forbidden",{status:403});return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}});}
 if(req.method!=="POST")return response({error:"Method not allowed"},405,origin);
 if(!ALLOWED_ORIGINS.has(origin))return response({error:"Origin not allowed"},403,origin);
 let body:Record<string,unknown>;try{body=await req.json();}catch{return response({error:"Invalid request"},400,origin);}
 const action=String(body.action||"");
 if(action==="login"){
  const username=String(body.username||"").trim().toLowerCase(),password=String(body.password||"");
  if(!/^[a-z0-9._-]{3,30}$/.test(username)||password.length<8)return response({error:"Username au password si sahihi."},400,origin);
  const ipHash=await loginIpHash(req);
  const rate=await loginRateCall("staff_login_allowed",username,ipHash);
  if(!rate.ok)return response({error:"Imeshindikana kuthibitisha usalama wa kuingia. Jaribu tena baadaye."},503,origin);
  if((await rate.json())!==true)return response({error:"Majaribio mengi ya kuingia. Subiri dakika 15 kisha ujaribu tena."},429,origin);
  const q=await rest("staff_accounts?select=username,is_active&username=eq."+encodeURIComponent(username)+"&limit=1");
  if(!q.ok)return response({error:"Imeshindikana kuthibitisha akaunti."},500,origin);
  const staffRows=await q.json();
  if(!staffRows.length){await loginRateCall("staff_login_record_failure",username,ipHash);return response({error:"Username au password si sahihi."},401,origin);}
  if(staffRows[0].is_active===false)return response({error:"Akaunti hii imeondolewa na mmiliki wa biashara. Wasiliana na mmiliki."},403,origin);
  const login=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:username+"@staff.amwemari.invalid",password})});
  const session=await login.json();
  if(!login.ok){await loginRateCall("staff_login_record_failure",username,ipHash);return response({error:"Username au password si sahihi."},401,origin);}
  await loginRateCall("staff_login_clear_failures",username,ipHash);
  return response({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,token_type:session.token_type},200,origin);
 }
 if(action==="create_staff"||action==="list_staff"||action==="remove_staff"){
  const owner=await authenticatedOwner(req);if(!owner)return response({error:"Session imeisha. Ingia tena."},401,origin);
  const storeId=String(body.store_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(storeId))return response({error:"Biashara haijachaguliwa."},400,origin);
  const owned=await rest(`stores?select=id&id=eq.${encodeURIComponent(storeId)}&owner_id=eq.${encodeURIComponent(owner.id)}&limit=1`);
  if(!owned.ok)return response({error:"Imeshindikana kuthibitisha umiliki."},500,origin);
  if(!(await owned.json()).length)return response({error:"Mmiliki pekee ndiye anayeruhusiwa."},403,origin);
  if(action==="list_staff"){
   const q=await rest(`staff_accounts?select=id,user_id,full_name,username,created_at,is_active&store_id=eq.${encodeURIComponent(storeId)}&order=created_at.desc`);
   if(!q.ok)return response({error:"Imeshindikana kupata orodha ya wafanyakazi."},500,origin);
   return response({staff:await q.json()},200,origin);
  }
  if(action==="remove_staff"){
   const userId=String(body.user_id||"");
   if(!/^[0-9a-f-]{36}$/i.test(userId)||userId===owner.id)return response({error:"Mfanyakazi hajachaguliwa kwa usahihi."},400,origin);
   const target=await rest(`staff_accounts?select=id,user_id,is_active&store_id=eq.${encodeURIComponent(storeId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
   if(!target.ok)return response({error:"Imeshindikana kuthibitisha mfanyakazi."},500,origin);
   const rows=await target.json();if(!rows.length)return response({error:"Mfanyakazi hakupatikana kwenye biashara hii."},404,origin);
   if(rows[0].is_active===false)return response({success:true,already_removed:true},200,origin);
   const disabled=await rest(`staff_accounts?store_id=eq.${encodeURIComponent(storeId)}&user_id=eq.${encodeURIComponent(userId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({is_active:false})});
   if(!disabled.ok)return response({error:"Imeshindikana kuondoa ruhusa za mfanyakazi."},500,origin);
   const removed=await rest(`store_members?store_id=eq.${encodeURIComponent(storeId)}&user_id=eq.${encodeURIComponent(userId)}&role=eq.cashier`,{method:"DELETE",headers:{Prefer:"return=minimal"}});
   if(!removed.ok){
    await rest(`staff_accounts?store_id=eq.${encodeURIComponent(storeId)}&user_id=eq.${encodeURIComponent(userId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({is_active:true})});
    return response({error:"Imeshindikana kufunga ruhusa za mfanyakazi. Jaribu tena."},500,origin);
   }
   return response({success:true,full_name:rows[0].full_name},200,origin);
  }
  const fullName=String(body.full_name||"").trim(),username=String(body.username||"").trim().toLowerCase(),password=String(body.password||"");
  if(fullName.length<2||fullName.length>100||!/^[a-z0-9._-]{3,30}$/.test(username)||password.length<8||password.length>72)return response({error:"Jaza jina, username sahihi na password yenye angalau herufi 8."},400,origin);
  const exists=await rest(`staff_accounts?select=id&username=eq.${encodeURIComponent(username)}&limit=1`);
  if(!exists.ok)return response({error:"Imeshindikana kukagua username."},500,origin);
  if((await exists.json()).length)return response({error:"Username hii tayari imetumika. Chagua nyingine."},409,origin);
  const created=await fetch(`${SUPABASE_URL}/auth/v1/admin/users`,{method:"POST",headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({email:`${username}@staff.amwemari.invalid`,password,email_confirm:true,user_metadata:{full_name:fullName,account_type:"staff"}})});
  const userData=await created.json();if(!created.ok)return response(userData.msg||userData.message||"Imeshindikana kutengeneza akaunti.",400,origin);
  const userId=userData.id;
  const member=await rest("store_members",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({store_id:storeId,user_id:userId,role:"cashier"})});
  if(!member.ok){await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`,{method:"DELETE",headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`}});return response({error:"Akaunti haikuunganishwa na biashara."},500,origin);}
  const saved=await rest("staff_accounts",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({user_id:userId,store_id:storeId,username,full_name:fullName})});
  if(!saved.ok){await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`,{method:"DELETE",headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`}});return response({error:"Taarifa za mfanyakazi hazijahifadhiwa."},500,origin);}
  return response({success:true,full_name:fullName,username},201,origin);
 }
 return response({error:"Action haijatambuliwa."},400,origin);
});