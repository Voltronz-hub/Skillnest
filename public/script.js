// Carousel functionality for featured freelancers
document.addEventListener('DOMContentLoaded', function() {
  const carousel = document.querySelector('#freelancerCarousel');
  if (carousel) {
    const carouselInstance = new bootstrap.Carousel(carousel, {
      interval: 5000,
      wrap: true
    });
  }
});

// Multi-step form navigation for post-job.ejs
function showStep(step) {
  const steps = document.querySelectorAll('.form-step');
  const indicators = document.querySelectorAll('.step-indicator');

  steps.forEach(s => s.classList.remove('active'));
  indicators.forEach(i => i.classList.remove('active'));

  document.getElementById(`step${step}`).classList.add('active');
  indicators[step - 1].classList.add('active');
}

function nextStep(currentStep) {
  if (validateStep(currentStep)) {
    showStep(currentStep + 1);
  }
}

function prevStep(currentStep) {
  showStep(currentStep - 1);
}

function validateStep(step) {
  // Basic validation - can be enhanced
  const currentStepEl = document.getElementById(`step${step}`);
  const requiredFields = currentStepEl.querySelectorAll('[required]');
  let valid = true;

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      field.classList.add('is-invalid');
      valid = false;
    } else {
      field.classList.remove('is-invalid');
    }
  });

  return valid;
}

// Kanban drag and drop (basic implementation)
function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  ev.dataTransfer.setData("text", ev.target.id);
}

function drop(ev) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("text");
  const draggedElement = document.getElementById(data);

  // Check if dropping on a card or column
  if (ev.target.classList.contains('kanban-card')) {
    ev.target.parentNode.insertBefore(draggedElement, ev.target.nextSibling);
  } else if (ev.target.classList.contains('kanban-column')) {
    ev.target.appendChild(draggedElement);
  }
}

// Freelancer suggestions (placeholder)
function loadFreelancerSuggestions() {
  // This would typically fetch from API
  const suggestions = [
    { name: 'Alice Johnson', skills: 'Web Development', rating: 4.8 },
    { name: 'Bob Smith', skills: 'Graphic Design', rating: 4.6 },
    { name: 'Carol Davis', skills: 'Content Writing', rating: 4.9 }
  ];

  const container = document.querySelector('.freelancer-suggestions');
  if (container) {
    container.innerHTML = suggestions.map(freelancer => `
      <div class="freelancer-suggestion">
        <div class="d-flex align-items-center">
          <img src="https://via.placeholder.com/50" alt="${freelancer.name}" class="rounded-circle me-3" style="width: 50px; height: 50px;">
          <div>
            <h6 class="mb-0">${freelancer.name}</h6>
            <p class="mb-0 text-muted">${freelancer.skills}</p>
            <div class="rating">
              ${'★'.repeat(Math.floor(freelancer.rating))}${'☆'.repeat(5 - Math.floor(freelancer.rating))} ${freelancer.rating}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-primary mt-2">Invite</button>
      </div>
    `).join('');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  loadFreelancerSuggestions();

  // Add fade-in animation to cards
  const cards = document.querySelectorAll('.card-soft');
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
    card.classList.add('fade-in-up');
  });
  
  // Testimonials carousel rotation
  const testimonials = document.querySelectorAll('#testimonials .testimonial-item');
  if (testimonials && testimonials.length) {
    let ti = 0;
    setInterval(() => {
      testimonials[ti].classList.remove('active');
      ti = (ti + 1) % testimonials.length;
      testimonials[ti].classList.add('active');
    }, 4500);
  }
});

// Calendar functionality (basic)
function initCalendar() {
  // Placeholder for calendar initialization
  console.log('Calendar initialized');
}

// Call init functions
document.addEventListener('DOMContentLoaded', function() {
  initCalendar();
});
