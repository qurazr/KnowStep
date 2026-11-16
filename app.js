const state = { 
  categories: [], subjects: [], levels: [], topics: [], 
  history: []
};

const $main = document.getElementById('main');
const $title = document.getElementById('title');
const $backBtn = document.getElementById('backBtn');
const $navHeader = document.getElementById('nav-header');

// --- АВТОРИЗАЦИЯ (Заглушка) ---
function handleCredentialResponse(response) {
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  document.getElementById('user-avatar').src = payload.picture;
  document.getElementById('user-profile').classList.remove('hidden');
  document.getElementById('loginBtn').style.display = 'none';
  alert(`Привет, ${payload.name}!`);
}

document.getElementById('loginBtn').onclick = () => alert("Авторизация отключена для теста.");
document.getElementById('logoutBtn').onclick = () => {
  document.getElementById('user-profile').classList.add('hidden');
  document.getElementById('loginBtn').style.display = 'block';
};

// --- ПРОГРЕСС ---
const progress = {
  load() { try { return JSON.parse(localStorage.getItem('knowstep_progress') || '{}'); } catch { return {}; } },
  save(p) { localStorage.setItem('knowstep_progress', JSON.stringify(p)); },
  isDone(topicId) { return !!this.load()[topicId]; },
  markDone(topicId) { const p = this.load(); p[topicId] = true; this.save(p); }
};

// --- НАВИГАЦИЯ ---
function updateUI(showBack = true) {
  $navHeader.classList.toggle('hidden', !showBack);
}

$backBtn.onclick = () => {
  const prev = state.history.pop();
  if (prev) {
    if (prev.type === 'category') goCategory(prev.data, false);
    else if (prev.type === 'subject') goSubject(prev.data, false);
    else if (prev.type === 'level') goLevel(prev.data.level, prev.data.sub, false);
    else goHome(false);
  }
};

// --- ЭКРАНЫ ---
async function goHome(addHistory = true) {
  if (addHistory) state.history = [];
  updateUI(false);
  $main.innerHTML = '<p class="stats">Выберите категорию:</p>';
  
  try {
    const res = await fetch('data/categories.json');
    const data = await res.json();
    state.categories = data.categories;
    
    data.categories.forEach((cat) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div><h2>${cat.title}</h2></div><div style="font-size:20px;">→</div>`;
      card.onclick = () => { if(addHistory) state.history.push({type: 'home'}); goCategory(cat); };
      $main.appendChild(card);
    });
  } catch (e) { $main.innerHTML = '<p class="feedback err">Ошибка загрузки категорий.</p>'; }
}

async function goCategory(cat, addHistory = true) {
  updateUI(true);
  $title.textContent = cat.title;
  $main.innerHTML = '<p class="stats">Загрузка...</p>';
  
  try {
    const res = await fetch(`data/${cat.file}`);
    const data = await res.json();
    state.subjects = data.subjects || [];
    $main.innerHTML = '';
    
    state.subjects.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div><h2>${sub.title}</h2></div><div style="font-size:20px;">→</div>`;
      card.onclick = () => { if(addHistory) state.history.push({type: 'category', data: cat}); goSubject(sub); };
      $main.appendChild(card);
    });
  } catch (e) { $main.innerHTML = '<p class="feedback err">Ошибка загрузки предметов.</p>'; }
}

async function goSubject(sub, addHistory = true) {
  updateUI(true);
  $title.textContent = sub.title;
  $main.innerHTML = '<p class="stats">Загрузка...</p>';
  
  try {
    const res = await fetch(`data/${sub.folder}/syllabus.json`);
    const data = await res.json();
    state.levels = data.levels || [];
    $main.innerHTML = '';
    
    state.levels.forEach(level => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div><h2>${level.title}</h2></div><div style="font-size:20px;">→</div>`;
      card.onclick = () => { if(addHistory) state.history.push({type: 'subject', data: sub}); goLevel(level, sub); };
      $main.appendChild(card);
    });
  } catch (e) { $main.innerHTML = '<p class="feedback err">Ошибка загрузки уровней.</p>'; }
}

async function goLevel(level, sub, addHistory = true) {
  updateUI(true);
  $title.textContent = level.title;
  $main.innerHTML = '<p class="stats">Загрузка...</p>';
  
  try {
    const res = await fetch(`data/${sub.folder}/${level.file}`);
    const data = await res.json();
    state.topics = data.topics || []; 
    $main.innerHTML = '';
    
    if (!state.topics.length) {
      $main.innerHTML = '<p class="stats">Уроков пока нет</p>';
      return;
    }

    state.topics.forEach((topic) => {
      const done = progress.isDone(topic.id);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div><h2>${topic.title}</h2></div><div style="font-size:20px;">${done ? '✓' : '→'}</div>`;
      
      card.onclick = async () => {
        $main.innerHTML = '<p class="stats">Загрузка урока...</p>';
        try {
          const lessonRes = await fetch(`data/${sub.folder}/${topic.file}`);
          const lessonData = await lessonRes.json();
          const fullTopic = lessonData.topics[0]; 
          
          if(addHistory) state.history.push({type: 'level', data: {level, sub}});
          goTopic(fullTopic);
        } catch (e) {
          $main.innerHTML = '<p class="feedback err">Ошибка загрузки урока.</p>';
        }
      };
      $main.appendChild(card);
    });
  } catch (e) { $main.innerHTML = '<p class="feedback err">Ошибка загрузки списка уроков.</p>'; }
}

// --- УРОК ---
function goTopic(topic) {
  updateUI(true);
  $title.textContent = topic.title;
  
  if (topic.theory_pages && topic.theory_pages.length > 0) {
    renderPaginatedTheory(topic);
  } else {
    $main.innerHTML = `<div class="theory">${topic.theory || 'Теория не найдена'}</div>`;
    renderExercises(topic, $main);
  }
}

function renderPaginatedTheory(topic) {
  let currentPage = 0;
  const totalPages = topic.theory_pages.length;

  function drawPage() {
    // Меняем структуру: сначала кнопки, потом текст страницы
    $main.innerHTML = `
      <div class="theory">${topic.theory_pages[currentPage]}</div>
      <div class="theory-nav">
        <button id="prevBtn" ${currentPage === 0 ? 'disabled' : ''}>← Назад</button>
        <span>${currentPage + 1} / ${totalPages}</span>
        <button id="nextBtn">Вперед →</button>
      </div>
      <div id="exercises-container" class="hidden"></div>
    `;

    document.getElementById('prevBtn').onclick = () => { 
      if (currentPage > 0) { currentPage--; drawPage(); } 
    };
    
    document.getElementById('nextBtn').onclick = () => { 
      if (currentPage < totalPages - 1) { 
        currentPage++; 
        drawPage(); 
      } else {
        document.querySelector('.theory').classList.add('hidden');
        document.querySelector('.theory-nav').classList.add('hidden');
        
        const exContainer = document.getElementById('exercises-container');
        exContainer.classList.remove('hidden');
        
        if (!exContainer.hasChildNodes()) {
          renderExercises(topic, exContainer);
        }
      }
    };
  }
  drawPage();
}

function renderExercises(topic, container) {
  let correctCount = 0;

  topic.exercises.forEach((ex, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'exercise';
    wrap.innerHTML = `<p>${idx + 1}. ${ex.question}</p>`;
    const fb = document.createElement('div');
    fb.className = 'feedback';

    const checkFinish = () => {
      if (correctCount === topic.exercises.length) {
        progress.markDone(topic.id);
        container.innerHTML += '<p class="feedback ok" style="margin-top:20px; font-size:18px; text-align:center;">✓ Урок пройден!</p>';
      }
    };

    if (ex.type === 'choice') {
      const buttons = [];
      ex.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.textContent = opt;
        btn.onclick = () => {
          buttons.forEach(b => b.disabled = true);
          if (opt === ex.answer) {
            btn.classList.add('correct');
            fb.className = 'feedback ok'; fb.textContent = 'Верно';
            correctCount++;
            checkFinish();
          } else {
            btn.classList.add('wrong');
            fb.className = 'feedback err'; fb.textContent = 'Правильный ответ: ' + ex.answer;
            buttons.forEach(b => { if(b.textContent === ex.answer) b.classList.add('correct'); });
          }
        };
        buttons.push(btn);
        wrap.appendChild(btn);
      });
      wrap.appendChild(fb);
    } else if (ex.type === 'input') {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Введите ответ';
      wrap.appendChild(input);
      
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Проверить';
      btn.onclick = () => {
        if (input.disabled) return;
        input.disabled = true; btn.disabled = true;
        const val = input.value.trim().toLowerCase();
        if (val === String(ex.answer).toLowerCase()) {
          fb.className = 'feedback ok'; fb.textContent = 'Верно';
          correctCount++;
          checkFinish();
        } else {
          fb.className = 'feedback err'; fb.textContent = 'Правильный ответ: ' + ex.answer;
        }
      };
      wrap.appendChild(btn);
      wrap.appendChild(fb);
    }
    container.appendChild(wrap);
  });
}

// Запуск приложения
goHome();