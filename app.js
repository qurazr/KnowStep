const state = {
  languages: [], levels: [], topics: [], history: [], currentUser: null,
  currentLanguage: null, currentLevel: null
};

const $main = document.getElementById('main');
const $title = document.getElementById('title');
const $backBtn = document.getElementById('backBtn');
const $navHeader = document.getElementById('nav-header');
const $googleWidget = document.querySelector('.g_id_signin');
const $loginBtn = document.getElementById('loginBtn');
const $userProfile = document.getElementById('user-profile');

function hideGoogleWidget() {
  if ($googleWidget) {
    $googleWidget.style.setProperty('display', 'none', 'important');
    $googleWidget.style.setProperty('visibility', 'hidden', 'important');
    $googleWidget.style.setProperty('height', '0', 'important');
  }
}
function showGoogleWidget() {
  if ($googleWidget) {
    $googleWidget.style.setProperty('display', 'block', 'important');
    $googleWidget.style.setProperty('visibility', 'visible', 'important');
    $googleWidget.style.setProperty('height', 'auto', 'important');
  }
}

function handleCredentialResponse(response) {
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  state.currentUser = payload.sub;
  localStorage.setItem('knowstep_user', JSON.stringify({
    id: payload.sub, name: payload.name, picture: payload.picture
  }));
  document.getElementById('user-avatar').src = payload.picture;
  $userProfile.classList.remove('hidden');
  $loginBtn.style.display = 'none';
  hideGoogleWidget();
  goHome(false);
}

function checkAuth() {
  const savedUser = localStorage.getItem('knowstep_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    state.currentUser = user.id;
    document.getElementById('user-avatar').src = user.picture;
    $userProfile.classList.remove('hidden');
    $loginBtn.style.display = 'none';
    hideGoogleWidget();
  } else {
    $userProfile.classList.add('hidden');
    $loginBtn.style.display = 'block';
    showGoogleWidget();
  }
}

$loginBtn.onclick = () => alert("Кнопка Google не загрузилась. Проверьте Client ID.");

document.getElementById('logoutBtn').onclick = () => {
  localStorage.removeItem('knowstep_user');
  state.currentUser = null;
  $userProfile.classList.add('hidden');
  $loginBtn.style.display = 'block';
  showGoogleWidget();
  goHome(false);
};

const db = {
  key: 'knowstep_db',
  loadAll() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } },
  saveAll(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  getUserProgress(userId) {
    if (!userId) return {};
    return this.loadAll()[userId] || {};
  },
  saveUserProgress(userId, progress) {
    if (!userId) return;
    const all = this.loadAll();
    all[userId] = progress;
    this.saveAll(all);
  },
  markDone(userId, topicId) {
    if (!userId) return;
    const progress = this.getUserProgress(userId);
    progress[topicId] = true;
    this.saveUserProgress(userId, progress);
  },
  isDone(userId, topicId) {
    if (!userId) return false;
    return !!this.getUserProgress(userId)[topicId];
  }
};

let voices = [];
function loadVoices() { voices = window.speechSynthesis.getVoices(); }
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

let keepAliveTimer = null;
function speakText(text) {
  if (!text) return;
  const cleanText = text.replace(/<[^>]*>?/gm, '').trim();
  if (!cleanText) return;
  window.speechSynthesis.cancel();
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  let selectedVoice = voices.find(v =>
    v.name.includes('Google UK English Male') ||
    v.name.includes('Microsoft David') ||
    v.name.includes('Male')
  );
  if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
  if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('en'));
  if (selectedVoice) utterance.voice = selectedVoice;

  keepAliveTimer = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else {
      clearInterval(keepAliveTimer);
    }
  }, 10000);
  window.speechSynthesis.speak(utterance);
  utterance.onend = () => { if (keepAliveTimer) clearInterval(keepAliveTimer); };
}

function normalizeQuotes(text) {
  if (!text) return '';
  return text.replace(/[’‘`´]/g, "'");
}

function makeWordsClickable(htmlString) {
  return htmlString.replace(/(<[^>]+>)|([A-Za-z][A-Za-z']{0,})/g, (match, tag, word) => {
    if (tag) return tag;
    if (word) return `<span class="clickable-word">${word}</span>`;
  });
}

function updateUI(showBack = true) {
  $navHeader.classList.toggle('hidden', !showBack);
}

// ✅ ИСПРАВЛЕНО: корректная навигация "назад" с учётом типов 'topics' / 'levels' / 'home'
$backBtn.onclick = () => {
  const prev = state.history.pop();
  if (!prev) return;
  if (prev.type === 'topics') {
    renderTopics(prev.data.level, prev.data.language, false);
  } else if (prev.type === 'levels') {
    goLevel(prev.data.language, false);
  } else {
    goHome(false);
  }
};

async function goHome(addHistory = true) {
  if (addHistory) state.history = [];
  updateUI(false);
  $main.innerHTML = '<p class="stats">Выберите язык:</p>';
  try {
    const res = await fetch('data/languages.json');
    const data = await res.json();
    // ✅ ИСПРАВЛЕНО: в JSON ключ "subjects", а не "languages"
    state.languages = data.subjects || [];
    state.languages.forEach((lang) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div><h2>${lang.title}</h2></div><div style="font-size:20px;">→</div>`;
      card.onclick = () => {
        if (addHistory) state.history.push({ type: 'home' });
        goLevel(lang);
      };
      $main.appendChild(card);
    });
  } catch (e) {
    $main.innerHTML = '<p class="feedback err">Ошибка загрузки языков.</p>';
  }
}

async function goLevel(language, addHistory = true) {
  state.currentLanguage = language;
  updateUI(true);
  $title.textContent = language.title;
  $main.innerHTML = '<p class="stats">Загрузка...</p>';
  try {
    const res = await fetch(`data/${language.folder}/syllabus.json`);
    const data = await res.json();
    state.levels = data.levels || [];
    $main.innerHTML = '';
    if (!state.levels.length) {
      $main.innerHTML = '<p class="stats">Уровней пока нет</p>';
      return;
    }
    state.levels.forEach((level) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div><h2>${level.title}</h2></div><div style="font-size:20px;">→</div>`;
      card.onclick = async () => {
        state.currentLevel = level;
        $main.innerHTML = '<p class="stats">Загрузка уроков...</p>';
        try {
          const levelRes = await fetch(`data/${language.folder}/${level.file}`);
          const levelData = await levelRes.json();
          state.topics = levelData.topics || [];
          // ✅ ИСПРАВЛЕНО: тип 'levels' (раньше был 'language')
          if (addHistory) state.history.push({ type: 'levels', data: { language } });
          renderTopics(level, language, addHistory);
        } catch (e) {
          $main.innerHTML = '<p class="feedback err">Ошибка загрузки уроков.</p>';
        }
      };
      $main.appendChild(card);
    });
  } catch (e) {
    $main.innerHTML = '<p class="feedback err">Ошибка загрузки уровней.</p>';
  }
}

function renderTopics(level, language, addHistory = true) {
  state.currentLanguage = language;
  state.currentLevel = level;
  $title.textContent = level.title;
  $main.innerHTML = '';
  if (!state.topics.length) {
    $main.innerHTML = '<p class="stats">Уроков пока нет</p>';
    return;
  }
  state.topics.forEach((topic) => {
    const done = db.isDone(state.currentUser, topic.id);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div><h2>${topic.title}</h2></div><div style="font-size:20px;">${done ? '✓' : '→'}</div>`;
    card.onclick = async () => {
      $main.innerHTML = '<p class="stats">Загрузка урока...</p>';
      try {
        const lessonRes = await fetch(`data/${language.folder}/${topic.file}`);
        const lessonData = await lessonRes.json();
        const fullTopic = lessonData.topics[0];
        // ✅ ИСПРАВЛЕНО: тип 'topics' (раньше был 'level') + сохраняем level и language
        if (addHistory) state.history.push({ type: 'topics', data: { language, level } });
        goTopic(fullTopic);
      } catch (e) {
        $main.innerHTML = '<p class="feedback err">Ошибка загрузки урока.</p>';
      }
    };
    $main.appendChild(card);
  });
}

function goTopic(topic) {
  updateUI(true);
  $title.textContent = topic.title;
  if (topic.theory_pages && topic.theory_pages.length > 0) {
    renderPaginatedTheory(topic);
  } else {
    $main.innerHTML = `<div class="theory">${makeWordsClickable(topic.theory || 'Теория не найдена')}</div>`;
    renderExercises(topic, $main);
  }
}

function renderPaginatedTheory(topic) {
  let currentPage = 0;
  const totalPages = topic.theory_pages.length;
  function drawPage() {
    const clickableTheory = makeWordsClickable(topic.theory_pages[currentPage]);
    $main.innerHTML = `
      <div class="theory">${clickableTheory}</div>
      <div class="theory-nav">
        <button id="prevBtn" ${currentPage === 0 ? 'disabled' : ''}>← Назад</button>
        <span>${currentPage + 1} / ${totalPages}</span>
        <button id="nextBtn">${currentPage === totalPages - 1 ? 'К упражнениям →' : 'Вперед →'}</button>
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
  let finished = false; // ✅ ИСПРАВЛЕНО: защита от дублирования

  const checkFinish = () => {
    if (!finished && correctCount === topic.exercises.length) {
      finished = true;
      db.markDone(state.currentUser, topic.id);
      // ✅ ИСПРАВЛЕНО: используем appendChild вместо innerHTML +=
      const msg = document.createElement('p');
      msg.className = 'feedback ok';
      msg.style.marginTop = '20px';
      msg.style.fontSize = '18px';
      msg.style.textAlign = 'center';
      msg.textContent = '✓ Урок пройден!';
      container.appendChild(msg);
    }
  };

  topic.exercises.forEach((ex, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'exercise';
    wrap.innerHTML = `<p>${idx + 1}. ${makeWordsClickable(ex.question)}</p>`;
    const fb = document.createElement('div');
    fb.className = 'feedback';

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
            fb.className = 'feedback ok';
            fb.textContent = 'Верно';
            correctCount++;
            checkFinish();
          } else {
            btn.classList.add('wrong');
            fb.className = 'feedback err';
            fb.textContent = 'Правильный ответ: ' + ex.answer;
            buttons.forEach(b => {
              if (b.textContent === ex.answer) b.classList.add('correct');
            });
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
        input.disabled = true;
        btn.disabled = true;
        const val = normalizeQuotes(input.value.trim().toLowerCase());
        const answer = normalizeQuotes(String(ex.answer).toLowerCase());
        if (val === answer) {
          fb.className = 'feedback ok';
          fb.textContent = 'Верно';
          correctCount++;
          checkFinish();
        } else {
          fb.className = 'feedback err';
          fb.textContent = 'Правильный ответ: ' + ex.answer;
        }
      };
      wrap.appendChild(btn);
      wrap.appendChild(fb);
    }
    container.appendChild(wrap);
  });
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('clickable-word')) {
    speakText(e.target.textContent);
  }
});

checkAuth();
goHome();