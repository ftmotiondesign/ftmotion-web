/* FTMotion analytics helper: opt-in via FTMAnalytics.track(db, {...}).
   No direct table writes; the RPC must be installed first. */
window.FTMAnalytics = Object.freeze({
 track(db,{businessKey,source,eventType,target=''}) {
   if (!db || !businessKey || !['qr','cebimde','dijiyesor','sponsor'].includes(source)) return;
   if (!['view','impression','click','save'].includes(eventType)) return;
   const key='ftm_visitor_v1';
   let visitor='';
   try {
     visitor=localStorage.getItem(key)||'';
     if(!visitor){visitor=crypto.randomUUID();localStorage.setItem(key,visitor);}
   } catch (_) {}
   // Random browser identifier only; no IP address, email or fingerprint collected.
   return db.rpc('ftm_track_event',{
     p_business_key:String(businessKey).slice(0,160),
     p_source:source,p_event_type:eventType,
     p_target:String(target).slice(0,100),
     p_visitor_hash:visitor
   }).then(({error})=>{if(error) console.warn('Analytics:',error.message)})
     .catch(()=>{});
 }
});
