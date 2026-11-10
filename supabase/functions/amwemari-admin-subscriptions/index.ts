import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const SUPER_ADMIN_EMAIL="mwalimueckson2104@gmail.com";
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return json({error:"Ingia kwanza."},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:authError}=await userClient.auth.getUser();
  if(authError||!user)return json({error:"Session imeisha."},401);
  const admin=createClient(url,service);
  const body=await req.clone().json().catch(()=>({}));

  // Wateja wanaweza kuuliza hali ya akaunti yao pekee.
  if((user.email||"").toLowerCase()!==SUPER_ADMIN_EMAIL){
   if(body.action!=="account_status")return json({error:"Ruhusa ya Super Admin inahitajika."},403);
   const {data:pending,error:pendingError}=await admin.from("amwemari_delete_pending").select("requested_at,scheduled_delete_at,status,store_name").eq("user_id",user.id).eq("status","pending").order("requested_at",{ascending:false}).limit(1).maybeSingle();
   if(pendingError)throw pendingError;
   if(pending)return json({pending:true,deletion:pending,access_status:"delete_pending"});
   const {data:ownedStores,error:ownedStoreError}=await admin.from("stores").select("id,owner_id").eq("owner_id",user.id);
   if(ownedStoreError)throw ownedStoreError;
   let accessStores:any[]=ownedStores||[];
   let ownerIds:string[]=[user.id];
   if(!accessStores.length){
    const {data:members,error:memberError}=await admin.from("store_members").select("store_id").eq("user_id",user.id);
    if(memberError)throw memberError;
    const memberStoreIds=(members||[]).map((m:any)=>m.store_id);
    if(memberStoreIds.length){
     const {data:memberStores,error:memberStoresError}=await admin.from("stores").select("id,owner_id").in("id",memberStoreIds);
     if(memberStoresError)throw memberStoresError;
     accessStores=memberStores||[];
     ownerIds=[...new Set(accessStores.map((s:any)=>s.owner_id))];
    }
   }
   if(ownerIds.length>1||ownerIds[0]!==user.id){
    const {data:ownerDelete,error:ownerDeleteError}=await admin.from("amwemari_delete_pending").select("requested_at,scheduled_delete_at,status,store_name").in("user_id",ownerIds).eq("status","pending").order("requested_at",{ascending:false}).limit(1).maybeSingle();
    if(ownerDeleteError)throw ownerDeleteError;
    if(ownerDelete)return json({pending:true,deletion:ownerDelete,access_status:"delete_pending"});
   }
   const storeIds=accessStores.map((s:any)=>s.id);
   let subs:any[]=[];
   if(storeIds.length){
    const {data:subRows,error:subError}=await admin.from("store_subscriptions").select("status,starts_at,ends_at").in("store_id",storeIds).eq("status","active").order("ends_at",{ascending:false}).limit(10);
    if(subError)throw subError;subs=subRows||[];
   }
   const active=subs.find((s:any)=>!s.ends_at||new Date(s.ends_at)>new Date());
   if(active)return json({pending:false,access_status:"active",subscription_ends_at:active.ends_at||null});
   const {data:accessRows,error:accessError}=await admin.from("amwemari_account_access").select("*").in("user_id",ownerIds).order("updated_at",{ascending:false});
   if(accessError)throw accessError;
   const access=(accessRows||[]).find((a:any)=>a.status==="trial"&&a.trial_ends_at&&new Date(a.trial_ends_at)>new Date())||(accessRows||[]).find((a:any)=>a.status==="trial")||(accessRows||[])[0]||null;
   if(access?.status==="trial"&&access.trial_ends_at&&new Date(access.trial_ends_at)>new Date()){
    return json({pending:false,access_status:"trial",trial_starts_at:access.trial_starts_at,trial_ends_at:access.trial_ends_at,trial_days:access.trial_days});
   }
   if(access?.status==="trial"){
    const {error:updateError}=await admin.from("amwemari_account_access").update({status:"expired",updated_at:new Date().toISOString()}).eq("user_id",access.user_id);
    if(updateError)throw updateError;
    return json({pending:false,access_status:"expired",trial_ends_at:access.trial_ends_at,trial_days:access.trial_days});
   }
   return json({pending:false,access_status:access?.status||"pending"});
  }

  const {data:allowed}=await admin.from("amwemari_super_admins").select("user_id").eq("user_id",user.id).eq("email",SUPER_ADMIN_EMAIL).maybeSingle();
  if(!allowed)return json({error:"Huna ruhusa ya Super Admin."},403);

  if(body.action==="list"){
   const [{data:storeRows,error:storeError},{data:pendingRows,error:pendingError},{data:accessRows,error:accessError}]=await Promise.all([
    admin.from("stores").select("id,name,business_type,owner_id,phone,email,address,created_at,is_active,store_subscriptions(id,status,starts_at,ends_at,last_payment_at),subscription_payments(id,amount,status,paid_at,created_at,payment_method,admin_note)").order("created_at",{ascending:false}),
    admin.from("amwemari_delete_pending").select("*").eq("status","pending").order("scheduled_delete_at",{ascending:true}),
    admin.from("amwemari_account_access").select("*")
   ]);
   if(storeError)throw storeError;if(pendingError)throw pendingError;if(accessError)throw accessError;
   const allUsers:any[]=[];
   for(let page=1;page<=1000;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
    if(error)throw error;
    const batch=data?.users||[];allUsers.push(...batch);
    if(batch.length<100)break;
   }
   const registered=allUsers.filter((u:any)=>u.email&&!u.email.endsWith(".invalid")&&u.id!==user.id);
   const results:any[]=[];
   for(const u of registered){
    const owned=(storeRows||[]).filter((s:any)=>s.owner_id===u.id);
    const access=(accessRows||[]).find((a:any)=>a.user_id===u.id)||null;
    const activeSub=owned.flatMap((s:any)=>s.store_subscriptions||[]).find((s:any)=>s.status==="active"&&(!s.ends_at||new Date(s.ends_at)>new Date()));
    let accessStatus=activeSub?"active":(access?.status||"pending");
    if(accessStatus==="trial"&&(!access?.trial_ends_at||new Date(access.trial_ends_at)<=new Date()))accessStatus="expired";
    if(!owned.length){
     results.push({id:null,name:"Bado hajafungua biashara",owner_id:u.id,owner_email:u.email,owner_name:u.user_metadata?.full_name||u.email,phone:u.phone||"",created_at:u.created_at,is_active:false,subscription:null,latest_payment:null,access_status:accessStatus,trial_days:access?.trial_days||null,trial_starts_at:access?.trial_starts_at||null,trial_ends_at:access?.trial_ends_at||null});
     continue;
    }
    for(const s of owned){
     results.push({...s,owner_email:u.email,owner_name:u.user_metadata?.full_name||u.email,access_status:accessStatus,trial_days:access?.trial_days||null,trial_starts_at:access?.trial_starts_at||null,trial_ends_at:access?.trial_ends_at||null,
      subscription:s.store_subscriptions?.[0]||null,
      latest_payment:(s.subscription_payments||[]).sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]||null});
    }
   }
   results.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
   return json({stores:results,pendingDeletes:pendingRows||[]});
  }

  if(body.action==="grant_trial"){
   if(typeof body.user_id!=="string")return json({error:"Akaunti haijachaguliwa."},400);
   const days=Number(body.trial_days);
   if(!Number.isInteger(days)||days<1||days>365)return json({error:"Weka siku kati ya 1 na 365."},400);
   if(body.user_id===user.id)return json({error:"Huwezi kuweka majaribio kwenye akaunti yako ya Super Admin."},400);
   const {data:target,error:targetError}=await admin.auth.admin.getUserById(body.user_id);
   if(targetError||!target?.user?.email)return json({error:"Mtumiaji hajapatikana."},404);
   if(target.user.email.toLowerCase()===SUPER_ADMIN_EMAIL)return json({error:"Akaunti ya Super Admin haiwezi kubadilishwa."},403);
   const start=new Date(),end=new Date(start.getTime()+days*86400000);
   const {error:upsertError}=await admin.from("amwemari_account_access").upsert({user_id:body.user_id,status:"trial",trial_starts_at:start.toISOString(),trial_ends_at:end.toISOString(),trial_days:days,note:typeof body.note==="string"?body.note.slice(0,500):null,granted_by:user.id,updated_at:start.toISOString()},{onConflict:"user_id"});
   if(upsertError)throw upsertError;
   const {error:deleteError}=await admin.from("amwemari_delete_pending").update({status:"cancelled"}).eq("user_id",body.user_id).eq("status","pending");
   if(deleteError)throw deleteError;
   const {data:owned,error:ownedError}=await admin.from("stores").select("id").eq("owner_id",body.user_id);
   if(ownedError)throw ownedError;
   for(const s of owned||[]){
    const {error:subError}=await admin.from("store_subscriptions").upsert({store_id:s.id,plan_id:"monthly-5000",status:"active",starts_at:start.toISOString(),ends_at:end.toISOString(),updated_at:start.toISOString()},{onConflict:"store_id"});
    if(subError)throw subError;
    const {error:storeError}=await admin.from("stores").update({is_active:true,updated_at:start.toISOString()}).eq("id",s.id);
    if(storeError)throw storeError;
   }
   const {error:auditError}=await admin.from("amwemari_admin_audit").insert({target_user_id:body.user_id,action:"grant_trial",details:{trial_days:days,trial_starts_at:start.toISOString(),trial_ends_at:end.toISOString()},performed_by:user.id});
   if(auditError)throw auditError;
   return json({ok:true,trial_days:days,trial_starts_at:start.toISOString(),trial_ends_at:end.toISOString()});
  }

  if(body.action==="mark_delete"){
   if(typeof body.user_id!=="string")return json({error:"Akaunti haijachaguliwa."},400);
   if(body.user_id===user.id)return json({error:"Huwezi kuweka akaunti yako ya Super Admin kwenye Delete Pending."},400);
   const {data:target,error:targetError}=await admin.auth.admin.getUserById(body.user_id);
   if(targetError||!target?.user?.email)return json({error:"Mtumiaji hajapatikana."},404);
   if(target.user.email.toLowerCase()===SUPER_ADMIN_EMAIL)return json({error:"Akaunti ya Super Admin haiwezi kufutwa."},403);
   const {data:existing,error:existingError}=await admin.from("amwemari_delete_pending").select("id").eq("user_id",body.user_id).eq("status","pending").maybeSingle();
   if(existingError)throw existingError;
   if(existing)return json({error:"Akaunti tayari ipo kwenye Delete Pending."},409);
   const {data:owned,error:ownedError}=await admin.from("stores").select("id,name").eq("owner_id",body.user_id);
   if(ownedError)throw ownedError;
   const store=(owned||[]).find((s:any)=>s.id===body.store_id)||(owned||[])[0]||null;
   const scheduled=new Date(Date.now()+90*24*60*60*1000).toISOString();
   const {error:insertError}=await admin.from("amwemari_delete_pending").insert({user_id:body.user_id,store_id:store?.id||null,owner_email:target.user.email,store_name:store?.name||"Akaunti bila biashara",scheduled_delete_at:scheduled,requested_by:user.id});
   if(insertError)throw insertError;
   if(owned?.length){const {error:updateError}=await admin.from("stores").update({is_active:false,updated_at:new Date().toISOString()}).eq("owner_id",body.user_id);if(updateError)throw updateError;}
   const {error:auditError}=await admin.from("amwemari_admin_audit").insert({target_user_id:body.user_id,target_store_id:store?.id||null,action:"mark_delete",details:{scheduled_delete_at:scheduled},performed_by:user.id});
   if(auditError)throw auditError;
   return json({ok:true,scheduled_delete_at:scheduled});
  }
  if(body.action==="restore_delete"){
   if(typeof body.user_id!=="string")return json({error:"Akaunti haijachaguliwa."},400);
   const {error}=await admin.from("amwemari_delete_pending").update({status:"cancelled"}).eq("user_id",body.user_id).eq("status","pending");
   if(error)throw error;
   const {error:storeError}=await admin.from("stores").update({is_active:true,updated_at:new Date().toISOString()}).eq("owner_id",body.user_id);
   if(storeError)throw storeError;
   const {error:auditError}=await admin.from("amwemari_admin_audit").insert({target_user_id:body.user_id,action:"restore_delete",details:{},performed_by:user.id});
   if(auditError)throw auditError;
   return json({ok:true});
  }
  if(body.action==="approve"){
   if(typeof body.store_id!=="string")return json({error:"Biashara haijachaguliwa."},400);
   const {data:store,error:storeErr}=await admin.from("stores").select("owner_id").eq("id",body.store_id).maybeSingle();
   if(storeErr||!store)return json({error:"Biashara haipo."},404);
   const {error:restoreErr}=await admin.from("amwemari_delete_pending").update({status:"cancelled"}).eq("user_id",store.owner_id).eq("status","pending");
   if(restoreErr)throw restoreErr;
   const {error:activeErr}=await admin.from("stores").update({is_active:true,updated_at:new Date().toISOString()}).eq("owner_id",store.owner_id);
   if(activeErr)throw activeErr;
   const {data:sub,error:subErr}=await admin.from("store_subscriptions").select("id").eq("store_id",body.store_id).maybeSingle();
   if(subErr||!sub)return json({error:"Subscription haipo."},404);
   const txRef="MANUAL-"+crypto.randomUUID();
   const {data:payment,error:payErr}=await admin.from("subscription_payments").insert({store_id:body.store_id,subscription_id:sub.id,amount:5000,currency:"TZS",provider:"manual",payment_method:"manual",admin_note:typeof body.note==="string"?body.note.slice(0,500):"Malipo yamethibitishwa na Super Admin",approved_by:user.id,tx_ref:txRef,status:"pending"}).select("id").single();
   if(payErr||!payment)throw payErr||new Error("Imeshindikana kurekodi malipo.");
   const {data:activated,error:activateErr}=await admin.rpc("activate_subscription_payment",{p_tx_ref:txRef,p_transaction_id:"MANUAL-APPROVAL-"+payment.id,p_paid_at:new Date().toISOString()});
   if(activateErr)throw activateErr;
   const {error:auditError}=await admin.from("amwemari_admin_audit").insert({target_user_id:store.owner_id,target_store_id:body.store_id,action:"approve_payment",details:{amount:5000,tx_ref:txRef},performed_by:user.id});
   if(auditError)throw auditError;
   return json({ok:true,activated});
  }
  return json({error:"Action haijulikani."},400);
 }catch(e){console.error("amwemari-admin-subscriptions",e);return json({error:e instanceof Error?e.message:"Hitilafu ya ndani."},500)}
});