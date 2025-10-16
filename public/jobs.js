// Simple client-side filtering for jobs page
document.addEventListener('DOMContentLoaded', function(){
  // Show skeleton briefly for perceived performance
  try {
    const sk = document.getElementById('jobsSkeleton');
    const grid = document.getElementById('jobsGrid');
    if (sk && grid) {
      sk.classList.remove('d-none');
      grid.style.display = 'none';
      setTimeout(() => { sk.classList.add('d-none'); grid.style.display = ''; }, 300);
    }
  } catch(e) { /* ignore */ }

  const search = document.getElementById('searchInput');
  const role = document.getElementById('roleFilter');
  const clearBtn = document.getElementById('clearFilters');
  const grid = document.getElementById('jobsGrid');
  const items = grid ? Array.from(grid.querySelectorAll('.job-card-item')) : [];

  function applyFilters(){
    const q = (search.value || '').toLowerCase().trim();
    const r = (role.value || '').toLowerCase().trim();
    items.forEach(item => {
      const title = item.dataset.title || '';
      const tags = item.dataset.tags || '';
      const itemRole = (item.dataset.role || '').toLowerCase();
      const matchesQ = !q || title.includes(q) || tags.includes(q);
      const matchesR = !r || itemRole === r;
      item.style.display = (matchesQ && matchesR) ? '' : 'none';
    });
  }

  if(search) search.addEventListener('input', applyFilters);
  if(role) role.addEventListener('change', applyFilters);
  if(clearBtn) clearBtn.addEventListener('click', function(){ search.value=''; role.value=''; applyFilters(); });
  
  // Saved searches UI handlers
  const saveBtn = document.getElementById('saveSearchBtn');
  const manageBtn = document.getElementById('manageSearchesBtn');
  const savedPanel = document.getElementById('savedSearchesPanel');
  const savedList = document.getElementById('savedList');
  const closeSavedPanel = document.getElementById('closeSavedPanel');

  async function fetchSaved() {
    try {
      const res = await fetch('/saved-searches');
      if (!res.ok) throw new Error('Failed');
      const list = await res.json();
      if (!list || !list.length) { savedList.innerHTML = '<div class="small text-muted">No saved searches</div>'; return; }
      savedList.innerHTML = '';
      list.forEach(s => {
        const el = document.createElement('div');
        el.className = 'd-flex align-items-center justify-content-between mb-1';
        el.innerHTML = `<div>${s.name}</div><div class="d-flex gap-1"><button class="btn btn-sm btn-light run-search" data-query='${encodeURIComponent(JSON.stringify(s.query))}'>Run</button><button class="btn btn-sm btn-outline-danger delete-search" data-id="${s._id}">Delete</button></div>`;
        savedList.appendChild(el);
      });
    } catch (err) {
      savedList.innerHTML = '<div class="small text-muted">Failed loading</div>';
    }
  }

  saveBtn && saveBtn.addEventListener('click', async function(){
    const q = { q: search.value, role: role.value };
    const name = prompt('Name this search');
    if (!name) return;
    try {
      const res = await fetch('/saved-searches', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name, query: JSON.stringify(q) }) });
      if (!res.ok) throw new Error('Save failed');
      alert('Search saved');
    } catch (err) { alert('Failed to save search'); }
  });

  manageBtn && manageBtn.addEventListener('click', function(){ savedPanel.classList.remove('d-none'); fetchSaved(); });
  closeSavedPanel && closeSavedPanel.addEventListener('click', function(){ savedPanel.classList.add('d-none'); });

  // delegated events for saved list
  savedList && savedList.addEventListener('click', async function(e){
    const run = e.target.closest('.run-search');
    const del = e.target.closest('.delete-search');
    if (run) {
      const q = JSON.parse(decodeURIComponent(run.getAttribute('data-query')));
      search.value = q.q || '';
      role.value = q.role || '';
      applyFilters();
      savedPanel.classList.add('d-none');
      return;
    }
    if (del) {
      const id = del.getAttribute('data-id');
      if (!confirm('Delete this saved search?')) return;
      const res = await fetch('/saved-searches/' + id, { method: 'DELETE' });
      if (res.ok) { fetchSaved(); } else alert('Failed to delete');
    }
  });
  
  // Floating contact bubble behavior
  const bubble = document.getElementById('jobContactBubble');
  const bubbleName = bubble && bubble.querySelector('.bubble-name');
  const bubbleSub = bubble && bubble.querySelector('.bubble-sub');
  const bubbleAvatar = bubble && bubble.querySelector('.bubble-avatar');
  const bubbleAction = document.getElementById('bubbleAction');
  let selectedJob = null;

  items.forEach(item => {
    // click handler: open bubble or follow job link
    item.addEventListener('click', function(e){
      // if a link/button or the username/profile link was clicked, let it handle
      if (e.target.closest('a,button') || e.target.closest('.user-link')) return;
      const href = item.getAttribute('data-href');
      if (href) {
        // if modifier key or ctrl/cmd pressed, open new tab
        if (e.metaKey || e.ctrlKey) return window.open(href, '_blank');
        return window.location.href = href;
      }
    });

    // keyboard handler: Enter/Space opens job link
    item.addEventListener('keydown', function(e){
      const href = item.getAttribute('data-href');
      if (!href) return;
      // if the focused element is the username/profile link, don't navigate here
      if (e.target && e.target.closest && e.target.closest('.user-link')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = href;
      }
    });
  });

  // Action: open compact chat popup for selected job (no redirect)
  bubbleAction && bubbleAction.addEventListener('click', function(){
    if (!selectedJob || !selectedJob.id) return;
    // Open the compact chat panel and join the job room
    if (typeof window.openCompactChatForJob === 'function') {
      window.openCompactChatForJob(selectedJob);
    } else {
      // fallback to previous behavior: try open job page
      const openEvent = new CustomEvent('openJobFromList', { detail: selectedJob });
      window.dispatchEvent(openEvent);
      setTimeout(() => { window.location.href = '/jobs/' + selectedJob.id; }, 300);
    }
  });

  // Allow pressing Enter on bubble to act
  if (bubble) bubble.addEventListener('keydown', function(e){ if (e.key === 'Enter') bubbleAction.click(); });
});

// Global handler: if compact chat pill is clicked and we have a job drawer on page, open it
window.addEventListener('compactChatClicked', function(){
  // if job drawer open function exists on the page, call it and mark handled
  if (typeof window.openChatDrawer === 'function') {
    window.openChatDrawer();
    window.__handledCompactChat = true;
  }
});

// Click handler for username links to open profile modal
document.addEventListener('click', async function(e){
  const el = e.target.closest('.user-link');
  if (!el) return;
  // Prevent the click from bubbling to the parent job-card which would navigate away
  try { e.preventDefault(); e.stopPropagation(); } catch (err) { /* ignore */ }
  const id = el.getAttribute('data-user-id');
  if (!id) return;
  try {
    const res = await fetch('/profile/jsonExtended/' + encodeURIComponent(id));
    if (!res.ok) throw new Error('Failed to fetch profile');
    const payload = await res.json();
    const data = payload.profile || payload;
    const avg = payload.avgRating || payload.avgRating === 0 ? payload.avgRating : null;
    const reviews = payload.reviews || [];
    // populate modal with richer UI
    const title = document.getElementById('userProfileTitle');
    const body = document.getElementById('userProfileBody');
    title.textContent = data.username || 'Profile';
    let stars = '';
    if (avg) {
      const rounded = Math.round(avg * 10) / 10;
      stars = `<div class="mb-2 text-center small">Rating: <strong>${rounded}</strong> / 5</div>`;
    }
  const portfolioHtml = (data.portfolio || []).slice(0,4).map(p => `<a href="#" class="portfolio-thumb" data-src="/uploads/${p}"><img src="/uploads/${p}" style="width:64px;height:64px;object-fit:cover;border-radius:.4rem;margin-right:.25rem"/></a>`).join('');
    body.innerHTML = `
      <div class="text-center mb-2"><img src="${data.profileImage ? '/uploads/' + data.profileImage : '/Skillnest logo.png'}" style="width:72px;height:72px;border-radius:50%;object-fit:cover"/></div>
      <div class="fw-semibold text-center mb-1">${data.username || ''}</div>
      <div class="text-muted small text-center mb-2">${data.location || ''}</div>
      ${stars}
      <div class="mb-2">${data.bio || ''}</div>
      <div class="mb-2 small text-muted">Skills: ${(data.skills || []).join(', ')}</div>
      <div class="mb-2">${portfolioHtml || '<div class="small text-muted">No portfolio items</div>'}</div>
      <div class="mb-2">${reviews.length ? '<strong class="small">Recent reviews</strong>' : ''}</div>
      <div class="small text-muted">${reviews.slice(0,3).map(r => `<div class="mb-1"><strong>${r.reviewer ? r.reviewer.username : 'User'}</strong>: ${r.comment || ''} <span class="text-muted small">(${r.rating}/5)</span></div>`).join('')}</div>
      <div class="d-flex gap-2 mt-3">
        <a href="/profile/view/${encodeURIComponent(data._id)}" class="btn btn-sm btn-outline-secondary flex-fill">View full profile</a>
        <button id="modalMessageBtn" class="btn btn-sm btn-primary">Message</button>
        <button id="modalProposalBtn" class="btn btn-sm btn-success">Send Proposal</button>
      </div>
    `;
    // attach actions
    const modalEl = document.getElementById('userProfileModal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
    document.getElementById('modalMessageBtn').addEventListener('click', function(){
      // try opening compact chat; if job context exists pick it, else open panel
      if (payload.relevantJobId) {
        if (typeof window.openCompactChatForJob === 'function') window.openCompactChatForJob({ id: payload.relevantJobId, title: data.username });
      } else {
        if (typeof window.openCompactChatForJob === 'function') window.openCompactChatForJob({ id: '', title: data.username });
        else alert('Open a job page to start a direct chat with this user.');
      }
      bsModal.hide();
    });
    document.getElementById('modalProposalBtn').addEventListener('click', function(){
      // if a relevant job is present, go to that job; otherwise go to jobs listing
      if (payload.relevantJobId) window.location.href = '/jobs/' + payload.relevantJobId;
      else window.location.href = '/jobs';
    });

    // Hire button behavior (may exist on full profile pages or extended modal)
    const hireBtn = document.getElementById('hireBtn');
    if (hireBtn) {
      hireBtn.addEventListener('click', function(){
        if (typeof window.openCompactChatForJob === 'function') window.openCompactChatForJob({ id: payload.relevantJobId || '', title: data.username });
        bsModal.hide();
      });
    }

    // portfolio thumbnails inside modal -> open lightbox
    modalEl.querySelectorAll('.portfolio-thumb').forEach(function(a){
      a.addEventListener('click', function(ev){
        ev.preventDefault();
        const src = a.getAttribute('data-src') || (a.querySelector('img') && a.querySelector('img').src);
        if (!src) return;
        const lightboxImg = document.getElementById('lightboxImg');
        if (lightboxImg) lightboxImg.src = src;
        const lb = new bootstrap.Modal(document.getElementById('portfolioLightbox'));
        lb.show();
      });
    });
  } catch (err) {
    console.error('profile fetch', err);
    alert('Failed to load profile');
  }
});

// Also handle keyboard activation on focused .user-link elements to prevent parent navigation
document.addEventListener('keydown', function(e){
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.user-link') : null;
  if (!el) return;
  e.preventDefault(); e.stopPropagation();
  // trigger click handler programmatically
  el.click();
});
