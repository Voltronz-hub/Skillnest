// Shared ChatClient for SkillNest
(function(window){
  if (window.ChatClient) return;
  let socket = null;
  const handlers = {};

  function init(){
    if (socket) return socket;
    if (typeof io === 'undefined') {
      console.error('Socket.IO client not found. Include /socket.io/socket.io.js before chat.js');
      return null;
    }
    socket = io();

    // forward common events
    const forward = ['recentMessages','chatMessage','typing','notification','messageRead','presenceUpdate','unreadUpdate'];
    forward.forEach(ev => {
      socket.on(ev, function(payload){
        if (handlers[ev]) handlers[ev].forEach(h => { try { h(payload); } catch(e){} });
      });
    });

    socket.on('connect_error', function(err){ console.error('socket connect error', err); });
    return socket;
  }

  function on(event, fn){ if (!handlers[event]) handlers[event]=[]; handlers[event].push(fn); }
  function off(event, fn){ if (!handlers[event]) return; handlers[event]=handlers[event].filter(f=>f!==fn); }

  function joinRoom(opts){
    init();
    try { socket.emit('joinRoom', opts || {}); } catch(e){}
  }
  function sendMessage(payload){ init(); try { socket.emit('chatMessage', payload); } catch(e){} }
  function markRead(jobId){ init(); try { socket.emit('markRead', { jobId }); } catch(e){} }
  function emitTyping(jobId){ init(); try { socket.emit('typing', { jobId }); } catch(e){} }

  // expose
  window.ChatClient = {
    init, on, off, joinRoom, sendMessage, markRead, emitTyping, getSocket: ()=>socket
  };

})(window);
