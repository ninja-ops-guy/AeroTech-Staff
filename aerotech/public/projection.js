(function(root){
  'use strict';
  const phases = {
    proposed:['Dispatch','Queued','neutral'],triaging:['Dispatch','Triaging','active'],ready:['Dispatch','Ready','neutral'],
    running:['Engineering','Running','active'],repair_required:['Repair','Repair required','danger'],blocked:['Repair','Blocked','danger'],
    local_verified:['Quality','Local checks passed','review'],review_ready:['Quality','Review ready','review'],
    approved:['Release','Approved','review'],integrated:['Release','Integrated','success']
  };
  function taskView(t) {
    const p=phases[t.state] || ['Dispatch','Unknown state','neutral'];
    return {...t,area:p[0],label:p[1],tone:p[2],working:['running','triaging'].includes(t.state),
      accepted:false, hostIntegrated:t.state==='integrated'};
  }
  function projectView(p) {
    if(!p || !Array.isArray(p.tasks)) throw new Error('Invalid project');
    return {...p,tasks:p.tasks.map(taskView)};
  }
  const api={taskView,projectView};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AeroProjection=api;
})(typeof globalThis!=='undefined'?globalThis:this);
