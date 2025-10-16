// Small enhancements for login page
document.addEventListener('DOMContentLoaded', function(){
  var toggle = document.getElementById('togglePwd');
  var pwd = document.getElementById('passwordInput');
  if(toggle && pwd){
    toggle.addEventListener('click', function(){
      if(pwd.type === 'password'){
        pwd.type = 'text';
        toggle.textContent = 'Hide';
        toggle.classList.remove('btn-outline-secondary');
        toggle.classList.add('btn-outline-primary');
      } else {
        pwd.type = 'password';
        toggle.textContent = 'Show';
        toggle.classList.remove('btn-outline-primary');
        toggle.classList.add('btn-outline-secondary');
      }
    });
  }
});
