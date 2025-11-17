document.addEventListener('DOMContentLoaded', function(){
  const nav = document.querySelector('header nav');
  const toggle = document.getElementById('navToggle');
  if(!nav || !toggle) return;
  toggle.addEventListener('click', function(e){
    e.preventDefault();
    nav.classList.toggle('open');
    // accessible label
    const expanded = nav.classList.contains('open');
    toggle.setAttribute('aria-expanded', expanded);
  });
  // close on outside click
  document.addEventListener('click', (e)=>{
    if(!nav.classList.contains('open')) return;
    if(e.target.closest('header')) return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
  });
});