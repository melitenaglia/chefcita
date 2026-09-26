import React from 'react';
export default class ErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={error:null};}
 static getDerivedStateFromError(error){return {error};}
 componentDidCatch(error,info){console.error('Chef Cita render error',error,info);}
 render(){if(this.state.error)return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui'}}><section><h1>Chef Cita tuvo un problema</h1><p>La aplicación no pudo cargar correctamente. Recargá la página.</p><details><summary>Detalle técnico</summary><pre>{String(this.state.error)}</pre></details></section></main>;return this.props.children;}
}
