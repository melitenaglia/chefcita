export function userErrorMessage(error,fallback='Algo salió mal. Probá de nuevo.'){
 const raw=String(error?.message||error||'').trim().toLowerCase();
 if(!raw)return fallback;
 if(raw.includes('jwt')||raw.includes('unauthorized')||raw.includes('auth session')||raw.includes('not authenticated')) return 'Tu sesión venció o necesita renovarse. Volvé a entrar a Chefcita.';
 if(raw.includes('network')||raw.includes('fetch')||raw.includes('failed to send')||raw.includes('load failed')) return 'No pude conectar con Chefcita. Revisá tu conexión y probá de nuevo.';
 if(raw.includes('duplicate')||raw.includes('unique')) return 'Esto ya parece estar guardado en Chefcita.';
 if(raw.includes('timeout')||raw.includes('timed out')) return 'El proceso tardó demasiado. Podés reintentarlo sin volver a cargar todo.';
 return fallback;
}
