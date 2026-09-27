import {supabase} from './supabase.js';

export async function loadSharedLibraries(userId){
 const {data:memberships,error:membershipError}=await supabase
  .from('household_members')
  .select('household_id,role,joined_at')
  .eq('user_id',userId)
  .order('joined_at',{ascending:true});

 if(membershipError)return {data:[],error:membershipError};
 if(!memberships?.length)return {data:[],error:null};

 const ids=memberships.map(x=>x.household_id);
 const {data:households,error:householdError}=await supabase
  .from('households')
  .select('id,name,created_by')
  .in('id',ids);

 if(householdError)return {data:[],error:householdError};

 const byId=new Map((households||[]).map(x=>[x.id,x]));
 return {
  data:memberships.map(m=>({...byId.get(m.household_id),household_id:m.household_id,role:m.role,joined_at:m.joined_at})).filter(x=>x.id),
  error:null
 };
}
