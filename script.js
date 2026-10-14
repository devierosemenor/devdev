
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const STORAGE_KEY = "dearDiary.entries.v1";
  const GRATITUDE_KEY = "dearDiary.gratitude.v1";

  const prompts = [
    "What is one small thing that made you smile recently?",
    "What would you tell your younger self today?",
    "When did you feel most like yourself this week?",
    "What is something you are learning to let go of?",
    "Describe a place where your mind feels quiet.",
    "What is one thing your body helped you do today?",
    "What does a gentle day look like for you?",
    "What is something you are proud of, even if it feels small?",
    "Who made your day a little brighter?",
    "What would you like to give yourself permission to do?"
  ];

  const moodEmoji = {
    peaceful: "☁️",
    happy: "🌷",
    tired: "🌙",
    anxious: "🫧",
    grateful: "💗"
  };

  let entries = readStorage(STORAGE_KEY, []);
  let currentMood = "peaceful";
  let currentView = "home";
  let editingId = null;
  let promptIndex = 0;
  let toastTimeout;

  function readStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("Unable to save. Check your browser storage.");
      return false;
    }
  }

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateFrom(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }

  function prettyDate(value, options = {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) {
    return dateFrom(value).toLocaleDateString(undefined, options);
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function countWords(text) {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  function updateDateLabels() {
    const now = new Date();

    $("#today-label").textContent = now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

    $("#entry-date").textContent = prettyDate(localDate());

    const greeting = now.getHours() < 12
      ? "A soft start"
      : now.getHours() < 18
        ? "A little pause"
        : "A quiet moment";

    document.querySelector("h1").innerHTML =
      `${greeting}<br>just for <em>you.</em>`;
  }

  function updateWordCount() {
    const count = countWords($("#entry-body").value);
    $("#word-count").textContent =
      `${count} word${count === 1 ? "" : "s"}`;
  }

  function setMood(mood) {
    currentMood = mood;

    $$(".mood").forEach((button) => {
      const active = button.dataset.mood === mood;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const datesWithEntries = new Set(entries.map((entry) => entry.date));
    const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

    let html = `<div class="calendar-title">${
      now.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric"
      })
    }</div>`;

    html += dayNames
      .map((day) => `<span class="calendar-day">${day}</span>`)
      .join("");

    for (let i = 0; i < firstDay; i++) {
      html += `<span class="calendar-day"></span>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = [
        year,
        String(month + 1).padStart(2, "0"),
        String(day).padStart(2, "0")
      ].join("-");

      const classes = [
        "calendar-day",
        day === now.getDate() ? "today" : "",
        datesWithEntries.has(date) ? "has-entry" : ""
      ].filter(Boolean).join(" ");

      html += `<button type="button"
        class="${classes}"
        data-date="${date}"
        aria-label="${date}">
        ${day}
      </button>`;
    }

    $("#calendar").innerHTML = html;
  }

  function updateStats() {
    $("#entry-count").textContent = entries.length;
    $("#total-entries").textContent = entries.length;

    $("#total-words").textContent = entries.reduce(
      (total, entry) => total + countWords(entry.body),
      0
    );

    $("#total-favorites").textContent =
      entries.filter((entry) => entry.favorite).length;
  }

  function entryCard(entry) {
    const date = dateFrom(entry.date);
    const snippet = entry.body.replace(/\s+/g, " ").trim();

    return `
      <article class="entry-card">
        <div class="entry-date">
          <strong>${date.getDate()}</strong>
          <small>${date.toLocaleDateString(undefined, {
            month: "short"
          })}</small>
        </div>

        <div class="entry-info">
          <h3>${escapeHTML(entry.title || "A little moment")}</h3>
          <p>${escapeHTML(snippet.slice(0, 180))}${
            snippet.length > 180 ? "…" : ""
          }</p>
          <div class="entry-meta">
            ${moodEmoji[entry.mood] || "♡"}
            ${escapeHTML(entry.mood || "peaceful")}
            · ${countWords(entry.body)} words
          </div>
        </div>

        <div class="entry-actions">
          <button type="button"
            class="icon-button ${entry.favorite ? "favorited" : ""}"
            data-favorite="${entry.id}"
            aria-label="Toggle favorite">
            ${entry.favorite ? "♥" : "♡"}
          </button>

          <button type="button"
            class="icon-button"
            data-edit="${entry.id}"
            aria-label="Edit entry">✎</button>

          <button type="button"
            class="icon-button"
            data-delete="${entry.id}"
            aria-label="Delete entry">×</button>
        </div>
      </article>
    `;
  }

  function renderEntries(dateFilter = null) {
    let visible = [...entries].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    if (currentView === "favorites") {
      visible = visible.filter((entry) => entry.favorite);
    }

    if (dateFilter) {
      visible = visible.filter((entry) => entry.date === dateFilter);
    } else if (currentView === "home") {
      visible = visible.slice(0, 5);
    }

    const container = $("#entries-list");

    if (visible.length) {
      container.innerHTML = visible.map(entryCard).join("");
    } else {
      const message = currentView === "favorites"
        ? "Your favorite moments will feel right at home here."
        : "Your story is still unfolding. Save your first little moment above.";

      container.innerHTML =
        `<div class="empty-state">♡<br>${message}</div>`;
    }

    $("#list-heading").textContent = dateFilter
      ? prettyDate(dateFilter)
      : currentView === "favorites"
        ? "Favorite memories ♡"
        : currentView === "entries"
          ? "All your memories ♡"
          : "Recent memories ♡";

    $("#show-all").hidden = currentView === "entries";

    container.querySelectorAll("[data-favorite]").forEach((button) => {
      button.addEventListener("click", () => {
        toggleFavorite(button.dataset.favorite);
      });
    });

    container.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        editEntry(button.dataset.edit);
      });
    });

    container.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        deleteEntry(button.dataset.delete);
      });
    });
  }

  function renderAll() {
    updateStats();
    renderCalendar();
    renderEntries();
  }

  function resetEditor() {
    editingId = null;
    $("#entry-form").reset();
    setMood("peaceful");
    updateWordCount();
    $("#editor-heading").textContent = "Today's pages ✧";
    $("#entry-date").textContent = prettyDate(localDate());
  }

  function saveEntry(event) {
    event.preventDefault();

    const body = $("#entry-body").value.trim();

    if (!body) {
      showToast("Write a few words before saving ♡");
      $("#entry-body").focus();
      return;
    }

    const now = Date.now();
    const existing = entries.find((entry) => entry.id === editingId);

    const entry = {
      id: editingId || makeId(),
      title: $("#entry-title").value.trim() || "A little untitled moment",
      body,
      mood: currentMood,
      date: existing?.date || localDate(),
      favorite: existing?.favorite || false,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    const updatedEntries = [
      entry,
      ...entries.filter((item) => item.id !== entry.id)
    ];

    if (!writeStorage(STORAGE_KEY, updatedEntries)) return;

    entries = updatedEntries;
    resetEditor();
    setView("home");
    renderAll();
    showToast("Your little moment has been saved ♡");
  }

  function editEntry(id) {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;

    editingId = id;
    $("#entry-title").value = entry.title;
    $("#entry-body").value = entry.body;
    setMood(entry.mood || "peaceful");
    updateWordCount();

    $("#editor-heading").textContent = "A page to revisit ✧";
    $("#entry-date").textContent = prettyDate(entry.date);

    $("#entry-form").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    $("#entry-title").focus();
  }

  function deleteEntry(id) {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;

    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) {
      return;
    }

    const updatedEntries = entries.filter((item) => item.id !== id);
    if (!writeStorage(STORAGE_KEY, updatedEntries)) return;

    entries = updatedEntries;
    renderAll();
    showToast("Entry deleted.");
  }

  function toggleFavorite(id) {
    const updatedEntries = entries.map((entry) =>
      entry.id === id
        ? { ...entry, favorite: !entry.favorite }
        : entry
    );

    if (!writeStorage(STORAGE_KEY, updatedEntries)) return;

    entries = updatedEntries;
    renderAll();

    const entry = entries.find((item) => item.id === id);
    showToast(entry?.favorite
      ? "Saved to your favorites ♥"
      : "Removed from your favorites.");
  }

  function setView(view) {
    currentView = view;

    const titles = {
      home: "My journal",
      entries: "All entries",
      favorites: "Favorites"
    };

    $("#page-name").textContent = titles[view] || "My journal";

    $$(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    $("#sidebar").classList.remove("open");
    renderEntries();
  }

  function nextPrompt() {
    promptIndex = (promptIndex + 1) % prompts.length;
    $("#prompt-text").textContent = prompts[promptIndex];
  }

  function loadGratitude() {
    const saved = readStorage(GRATITUDE_KEY, {});

    $("#good-one").value = saved.one || "";
    $("#good-two").value = saved.two || "";
    $("#good-three").value = saved.three || "";

    if (saved.date === localDate() && (saved.one || saved.two || saved.three)) {
      $("#gratitude-status").textContent = "Your good things are saved ♡";
    }
  }

  function saveGratitude(event) {
    event.preventDefault();

    const value = {
      one: $("#good-one").value.trim(),
      two: $("#good-two").value.trim(),
      three: $("#good-three").value.trim(),
      date: localDate()
    };

    if (!value.one && !value.two && !value.three) {
      showToast("Add one tiny good thing first.");
      return;
    }

    if (!writeStorage(GRATITUDE_KEY, value)) return;

    $("#gratitude-status").textContent = "Saved for a rainy day ♡";
    showToast("Your good things are tucked away.");
  }

  // Journal events
  $("#entry-form").addEventListener("submit", saveEntry);
  $("#entry-body").addEventListener("input", updateWordCount);

  $("#clear-button").addEventListener("click", () => {
    const hasText = $("#entry-title").value || $("#entry-body").value;

    if (hasText && !window.confirm("Clear this page and start fresh?")) {
      return;
    }

    resetEditor();
    showToast("A fresh page, whenever you're ready.");
  });

  $$(".mood").forEach((button) => {
    button.addEventListener("click", () => setMood(button.dataset.mood));
  });

  // Navigation
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    setView("home");
  });

  $("#show-all").addEventListener("click", () => setView("entries"));

  // Calendar entry lookup
  $("#calendar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;

    const date = button.dataset.date;
    const matchingEntries = entries.filter((entry) => entry.date === date);

    if (matchingEntries.length) {
      currentView = "entries";
      $$(".nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.view === "entries");
      });
      $("#page-name").textContent = "All entries";
      renderEntries(date);
    } else {
      $("#entry-date").textContent = prettyDate(date);
      $("#entry-title").focus();
      showToast("A lovely day to start a new page.");
    }
  });

  // Writing prompts
  $("#use-prompt").addEventListener("click", () => {
    $("#entry-title").value = "A little reflection";
    $("#entry-body").value = `${$("#prompt-text").textContent}\n\n`;
    updateWordCount();
    $("#entry-body").focus();
    showToast("A little inspiration for your next page.");
  });

  $("#next-prompt").addEventListener("click", nextPrompt);

  // Gratitude notes
  $("#gratitude-form").addEventListener("submit", saveGratitude);

  // Theme and mobile menu
  $("#theme-toggle").addEventListener("click", () => {
    document.body.classList.toggle("cozy-mode");
  });

  $("#menu-toggle").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });

  // Ctrl/Cmd + Enter saves the current entry.
  $("#entry-body").addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      $("#entry-form").requestSubmit();
    }
  });

  // Start the journal.
  updateDateLabels();
  updateWordCount();
  loadGratitude();
  renderAll();
})();
