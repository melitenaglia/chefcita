import {supabase} from './supabase.js';
// Activate only after the reviewed library_playlists migration is approved/applied.
export const collaborativePlaylistsEnabled=false;
export const canOrganizeRecipe=(ownerId,userId)=>collaborativePlaylistsEnabled||ownerId===userId;
export async function setLibraryRecipe({recipeId,libraryId,added,ownerId,userId}){
 if(!canOrganizeRecipe(ownerId,userId))return {error:new Error('Esta receta puede añadirla su creadora.')};
 return collaborativePlaylistsEnabled
  ?supabase.rpc('set_library_recipe',{p_recipe_id:recipeId,p_household_id:libraryId,p_added:added})
  :supabase.rpc('set_recipe_library_share',{p_recipe_id:recipeId,p_household_id:libraryId,p_shared:added});
}
