function $(selector) {
    return document.querySelector(selector);
}

const STORAGE_KEY = "dearDiary.entries.v1";

let entries = loadEntries();
let editingId = null;
let currentView = "home";

const prompts = [
    "What is one little thing that made you smile today?",
    "What would you tell your younger self?",
    "What is something you are proud of?",
    "Describe your perfect peaceful day.",
    "What are three things you are grateful for?",
    "What is something you want to let go of?",
    "When did you feel most like yourself?",
    "What is one thing you love about yourself?"
];

function loadEntries() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        return true;
    } catch {
        alert("Storage is full. Please export your journal backup.");
        return false;
    }
}

function today() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatDate(date) {
    return new Date(date + "T12:00:00").toLocaleDateString(
        undefined,
        { month: "short", day: "numeric" }
    );
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function updateStats() {
    $("#total").textContent = entries.length;
    $("#favorites-count").textContent =
        entries.filter(entry => entry.favorite).length;
}

function updateWordCount() {
    const text = $("#body").value.trim();
    const count = text ? text.split(/\s+/).length : 0;

    $("#word-count").textContent =
        `${count} word${count === 1 ? "" : "s"}`;
}

function renderEntries() {
    let visible = [...entries].sort(
        (a, b) => b.updatedAt - a.updatedAt
    );

    if (currentView === "favorites") {
        visible = visible.filter(entry => entry.favorite);
        $("#list-title").textContent = "Favorite memories ♥";
    } else if (currentView === "entries") {
        $("#list-title").textContent = "All your memories ♡";
    } else {
        visible = visible.slice(0, 5);
        $("#list-title").textContent = "Recent memories ♡";
    }

    const container = $("#entries-list");

    if (!visible.length) {
        container.innerHTML = `
      <div class="empty">
        <div style="font-size:28px">♡</div>
        Your story is still unfolding.<br>
        Save your first little moment above.
      </div>`;
        return;
    }

    container.innerHTML = visible.map(entry => `
    <article class="entry-card">
      <div class="entry-date">
        <strong>${formatDate(entry.date).split(" ")[1]}</strong>
        ${formatDate(entry.date).split(" ")[0]}
      </div>

      <div class="entry-info">
        <h3>${escapeHTML(entry.title || "A little moment")}</h3>
        <p>${escapeHTML(entry.body)}</p>
        <small>${escapeHTML(entry.mood)} · ${entry.words} words</small>
      </div>

      <div class="entry-actions">
        <button class="icon-btn"
          data-action="favorite" data-id="${entry.id}"
          aria-label="Toggle favorite">
          ${entry.favorite ? "♥" : "♡"}
        </button>

        <button class="icon-btn"
          data-action="edit" data-id="${entry.id}"
          aria-label="Edit entry">✎</button>

        <button class="icon-btn"
          data-action="delete" data-id="${entry.id}"
          aria-label="Delete entry">×</button>
      </div>
    </article>
  `).join("");
}

function renderAll() {
    updateStats();
    renderEntries();
}

function resetForm() {
    editingId = null;
    $("#journal-form").reset();
    updateWordCount();
}

$("#journal-form").addEventListener("submit", event => {
    event.preventDefault();

    const body = $("#body").value.trim();

    if (!body) {
        showToast("Write a few words before saving ♡");
        return;
    }

    const now = Date.now();
    const existing = entries.find(entry => entry.id === editingId);

    const entry = {
        id: editingId || (
            window.crypto?.randomUUID?.() ||
            `${now}-${Math.random().toString(36).slice(2)}`
        ),
        title: $("#title").value.trim() || "A little moment",
        body,
        mood: $("#mood").value,
        date: existing?.date || today(),
        words: body.split(/\s+/).length,
        favorite: existing?.favorite || false,
        updatedAt: now
    };

    entries = [
        entry,
        ...entries.filter(item => item.id !== entry.id)
    ];

    if (!saveStorage()) return;

    resetForm();
    currentView = "home";
    renderAll();
    showToast("Your little moment is saved ♡");
});

$("#body").addEventListener("input", updateWordCount);

$("#clear").addEventListener("click", () => {
    if ($("#title").value || $("#body").value) {
        if (!confirm("Clear this page and start fresh?")) return;
    }

    resetForm();
    showToast("A fresh page awaits 🌷");
});

$("#entries-list").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;
    const entry = entries.find(item => item.id === id);
    if (!entry) return;

    if (action === "favorite") {
        entry.favorite = !entry.favorite;
        if (!saveStorage()) return;
        renderAll();
        showToast(entry.favorite
            ? "Added to your favorites ♥"
            : "Removed from favorites");
    }

    if (action === "edit") {
        editingId = id;
        $("#title").value = entry.title;
        $("#body").value = entry.body;
        $("#mood").value = entry.mood;
        updateWordCount();

        $("#editor-section").scrollIntoView({
            behavior: "smooth"
        });

        $("#title").focus();
        showToast("Edit your memory, then save ♡");
    }

    if (action === "delete") {
        if (!confirm(`Delete "${entry.title}"?`)) return;

        entries = entries.filter(item => item.id !== id);
        if (!saveStorage()) return;

        renderAll();
        showToast("Entry deleted");
    }
});

document.querySelectorAll(".nav").forEach(button => {
    button.addEventListener("click", () => {
        currentView = button.dataset.view;

        document.querySelectorAll(".nav").forEach(nav => {
            nav.classList.toggle("active", nav === button);
        });

        const names = {
            home: "My Journal",
            entries: "All Entries",
            favorites: "Favorites"
        };

        $("#page-name").textContent = names[currentView];
        renderEntries();

        if (currentView === "home") {
            $("#editor-section").scrollIntoView({ behavior: "smooth" });
        } else {
            $("#entries-list").scrollIntoView({ behavior: "smooth" });
        }
    });
});

$("#today").textContent = new Date().toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" }
);

$("#next-prompt").addEventListener("click", () => {
    const current = $("#prompt-text").textContent;
    const options = prompts.filter(prompt => prompt !== current);
    $("#prompt-text").textContent =
        options[Math.floor(Math.random() * options.length)];
});

$("#use-prompt").addEventListener("click", () => {
    $("#title").value = "A little reflection";
    $("#body").value = $("#prompt-text").textContent + "\n\n";
    updateWordCount();
    $("#body").focus();
    $("#editor-section").scrollIntoView({ behavior: "smooth" });
});

$("#export").addEventListener("click", () => {
    const backup = {
        exportedAt: new Date().toISOString(),
        entries
    };

    const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `dear-diary-${today()}.json`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Your journal backup is ready ♡");
});

renderAll();
updateWordCount();
