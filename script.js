(() => {
  "use strict";

  const STORAGE_KEY = "studentPortfolio.activities.v1";
  const THEME_KEY = "studentPortfolio.theme.v1";
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_STORAGE_BYTES = 4 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  const CATEGORIES = [
    "HTML and CSS Activities",
    "JavaScript Activities",
    "Python Activities",
    "Database Activities",
    "Networking Activities",
    "System Development Projects",
    "Other School Activities"
  ];
  const EXAMPLES = [
    {
      id: "example-html-portfolio",
      title: "Personal Portfolio Layout",
      subject: "Web Design Fundamentals",
      category: "HTML and CSS Activities",
      description: "A sample responsive portfolio page exploring semantic HTML, layout systems, and a consistent visual style. Replace or remove this example.",
      date: "2026-03-12",
      status: "Completed",
      tools: ["HTML", "CSS", "VS Code"],
      url: "",
      image: "",
      example: true
    },
    {
      id: "example-js-quiz",
      title: "Interactive Quiz App",
      subject: "JavaScript Programming",
      category: "JavaScript Activities",
      description: "A sample browser-based quiz with question navigation, answer feedback, and a final score. Replace or remove this example.",
      date: "2026-04-08",
      status: "Completed",
      tools: ["JavaScript", "HTML", "CSS"],
      url: "",
      image: "",
      example: true
    },
    {
      id: "example-database",
      title: "Library Database Design",
      subject: "Database Management",
      category: "Database Activities",
      description: "A sample relational database exercise covering tables, relationships, and queries for a small library system. Replace or remove this example.",
      date: "2026-05-16",
      status: "In Progress",
      tools: ["SQL", "ERD"],
      url: "",
      image: "",
      example: true
    }
  ];
  const $ = (selector) => document.querySelector(selector);
  const activityGrid = $("#activity-grid");
  const activityDialog = $("#activity-dialog");
  const activityForm = $("#activity-form");
  const detailsDialog = $("#details-dialog");
  const imageDialog = $("#image-dialog");
  let activities = loadActivities();
  let pendingImage = "";
  let currentImage = "";
  let toastTimer = 0;

  function loadActivities() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(EXAMPLES));
        return EXAMPLES.map((activity) => ({ ...activity }));
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Saved activity data has an unexpected format.");
      return parsed.filter(isActivity);
    } catch (error) {
      showToast("Your saved activities could not be read. Check browser storage settings.", true);
      console.error("Unable to load portfolio activities:", error);
      return EXAMPLES.map((activity) => ({ ...activity }));
    }
  }

  function safeProjectFile(value) {
    return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.zip$/.test(value) ? value : "";
  }

  function isActivity(value) {
    return value && typeof value.id === "string" && typeof value.title === "string" &&
      typeof value.subject === "string" && CATEGORIES.includes(value.category) &&
      typeof value.description === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
      ["Completed", "In Progress"].includes(value.status) && Array.isArray(value.tools) &&
      (!value.projectFile || safeProjectFile(value.projectFile) !== "");
  }

  function saveActivities(nextActivities) {
    try {
      const serialized = JSON.stringify(nextActivities);
      const bytes = new Blob([serialized]).size;
      if (bytes > MAX_STORAGE_BYTES) {
        throw new Error("Your activities use too much browser storage. Remove an image or use a smaller screenshot.");
      }
      localStorage.setItem(STORAGE_KEY, serialized);
      activities = nextActivities;
      return true;
    } catch (error) {
      const message = error instanceof Error && error.message.includes("too much browser storage")
        ? error.message
        : "Could not save to browser storage. Remove a screenshot or free up browser storage and try again.";
      showToast(message, true);
      console.error("Unable to save portfolio activities:", error);
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeURL(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
  }

  function showToast(message, isError = false) {
    const region = $("#toast-region");
    region.replaceChildren();
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.setAttribute("role", isError ? "alert" : "status");
    toast.textContent = message;
    region.append(toast);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.remove(), 4200);
  }

  function populateCategoryOptions() {
    const categoryFilter = $("#category-filter");
    const activityCategory = $("#activity-category");
    CATEGORIES.forEach((category) => {
      categoryFilter.add(new Option(category, category));
      activityCategory.add(new Option(category, category));
    });
  }

  function render() {
    const search = $("#search-input").value.trim().toLocaleLowerCase();
    const category = $("#category-filter").value;
    const status = $("#status-filter").value;
    const direction = $("#sort-order").value === "oldest" ? 1 : -1;
    const portfolioActivities = activities.filter((item) => !item.projectFile);
    const visible = portfolioActivities.filter((item) =>
      item.title.toLocaleLowerCase().includes(search) &&
      (!category || item.category === category) &&
      (!status || item.status === status)
    ).sort((a, b) => direction * a.date.localeCompare(b.date));

    activityGrid.innerHTML = visible.map(cardMarkup).join("");
    $("#empty-state").hidden = visible.length > 0;
    $("#results-count").textContent = `${visible.length} ${visible.length === 1 ? "activity" : "activities"}`;
    $("#stat-activities").textContent = portfolioActivities.length;
    $("#stat-projects").textContent = document.querySelectorAll(".project-tile").length;
    $("#stat-completed").textContent = portfolioActivities.filter((item) => item.status === "Completed").length;
    renderGallery();
  }

  function cardMarkup(item) {
    const image = item.image
      ? `<img src="${escapeHTML(item.image)}" alt="" loading="lazy" onerror="this.remove()">`
      : `<div class="image-placeholder" aria-hidden="true"><span>${escapeHTML(categoryMark(item.category))}</span></div>`;
    const tools = item.tools.slice(0, 4).map((tool) => `<span class="tool-chip">${escapeHTML(tool)}</span>`).join("");
    const projectFile = safeProjectFile(item.projectFile);
    return `<article class="activity-card" data-id="${escapeHTML(item.id)}">
      <div class="card-image">${image}${item.example ? '<span class="sample-pill">Example</span>' : ""}</div>
      <div class="card-body"><div class="card-topline"><span class="category-label">${escapeHTML(item.category)}</span><span class="status-pill${item.status === "In Progress" ? " in-progress" : ""}">${escapeHTML(item.status)}</span></div>
        <h3 title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</h3><p class="card-subject">${escapeHTML(item.subject)}</p>
        <p class="card-description">${escapeHTML(item.description)}</p><div class="tool-chips">${tools}</div>
        <div class="card-footer"><span class="card-date">${escapeHTML(formatDate(item.date))}</span><div class="card-actions">
          <button class="card-link details-trigger" type="button" data-action="details" data-id="${escapeHTML(item.id)}">View details ↗</button>
          ${projectFile ? `<a class="card-link card-download" href="${escapeHTML(projectFile)}" download="${escapeHTML(projectFile.slice(projectFile.lastIndexOf("/") + 1))}">Download ZIP ↓</a>` : ""}
          <button class="card-icon-button" type="button" data-action="edit" data-id="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.title)}">✎</button>
          <button class="card-icon-button delete" type="button" data-action="delete" data-id="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.title)}">×</button>
        </div></div>
      </div></article>`;
  }

  function categoryMark(category) {
    const marks = {
      "HTML and CSS Activities": "</>",
      "JavaScript Activities": "JS",
      "Python Activities": "Py",
      "Database Activities": "DB",
      "Networking Activities": "↗",
      "System Development Projects": "✳",
      "Other School Activities": "✦"
    };
    return marks[category] || "✳";
  }

  function renderGallery() {
    const withImages = activities.filter((item) => item.image);
    $("#gallery-empty").hidden = withImages.length > 0;
    $("#gallery-grid").innerHTML = withImages.slice(0, 8).map((item) =>
      `<button class="gallery-item" type="button" data-image="${escapeHTML(item.id)}" aria-label="View screenshot: ${escapeHTML(item.title)}"><img src="${escapeHTML(item.image)}" alt="" loading="lazy" onerror="this.closest('.gallery-item').remove()"><span class="gallery-caption">${escapeHTML(item.title)}</span></button>`
    ).join("");
  }

  function openForm(item = null) {
    activityForm.reset();
    $("#form-message").textContent = "";
    $("#activity-id").value = item?.id || "";
    $("#form-heading").textContent = item ? "Edit activity" : "Add an activity";
    $("#save-activity").textContent = item ? "Save changes" : "Save activity";
    $("#activity-title").value = item?.title || "";
    $("#activity-subject").value = item?.subject || "";
    $("#activity-category").value = item?.category || CATEGORIES[0];
    $("#activity-description").value = item?.description || "";
    $("#activity-date").value = item?.date || new Date().toISOString().slice(0, 10);
    $("#activity-status").value = item?.status || "Completed";
    $("#activity-tools").value = item?.tools?.join(", ") || "";
    $("#activity-url").value = item?.url || "";
    pendingImage = item?.image || "";
    updateUploadPreview(pendingImage);
    activityDialog.showModal();
    $("#activity-title").focus();
  }

  function updateUploadPreview(source) {
    const preview = $("#upload-preview");
    preview.hidden = !source;
    preview.src = source || "";
    $("#remove-image").hidden = !source;
  }

  function openDetails(id) {
    const item = activities.find((activity) => activity.id === id);
    if (!item) return;
    const validURL = safeURL(item.url);
    const projectFile = safeProjectFile(item.projectFile);
    const image = item.image
      ? `<img class="detail-hero-image" src="${escapeHTML(item.image)}" alt="Screenshot for ${escapeHTML(item.title)}" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className:'detail-no-image',textContent:'✳'}))">`
      : '<div class="detail-no-image" aria-hidden="true">✳</div>';
    $("#details-content").innerHTML = `
      <p class="eyebrow">${item.example ? "SAMPLE ACTIVITY · EXAMPLE" : escapeHTML(item.category)}</p>
      <h2 id="details-title">${escapeHTML(item.title)}</h2>
      <p class="details-meta">${escapeHTML(item.subject)} · ${escapeHTML(formatDate(item.date))} · ${escapeHTML(item.status)}</p>
      ${image}<p class="details-description">${escapeHTML(item.description)}</p>
      <div class="detail-facts"><div><h3>Category</h3><p>${escapeHTML(item.category)}</p></div><div><h3>Tools &amp; technologies</h3><p>${escapeHTML(item.tools.join(", ") || "Not specified")}</p></div></div>
      ${projectFile ? `<a class="details-project-link project-archive-link" href="${escapeHTML(projectFile)}" download="${escapeHTML(projectFile.slice(projectFile.lastIndexOf("/") + 1))}">Download original project ZIP ↓</a>` : ""}
      ${validURL ? `<a class="details-project-link" href="${escapeHTML(validURL)}" target="_blank" rel="noopener noreferrer">Open project or repository ↗</a>` : ""}`;
    detailsDialog.showModal();
  }

  function openImage(id) {
    const item = activities.find((activity) => activity.id === id);
    if (!item?.image) return;
    currentImage = item.image;
    $("#large-image").src = item.image;
    $("#large-image").alt = `Screenshot for ${item.title}`;
    $("#large-image-caption").textContent = item.title;
    imageDialog.showModal();
  }

  function closeImage() {
    imageDialog.close();
    $("#large-image").src = "";
    currentImage = "";
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        reject(new Error("Choose a JPG, PNG, GIF, or WebP image."));
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        reject(new Error("Image must be 8 MB or smaller."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("The selected image could not be read."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("The selected image could not be decoded."));
        image.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Your browser could not prepare this image."));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          } catch {
            reject(new Error("This image could not be prepared for local storage."));
          }
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    $("#form-message").textContent = "";
    if (!activityForm.reportValidity()) return;
    const urlInput = $("#activity-url").value.trim();
    if (urlInput && !safeURL(urlInput)) {
      $("#form-message").textContent = "Enter a valid project URL beginning with https:// or http://.";
      $("#activity-url").focus();
      return;
    }
    const id = $("#activity-id").value;
    const previous = activities.find((item) => item.id === id);
    const activity = {
      id: id || `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: $("#activity-title").value.trim(),
      subject: $("#activity-subject").value.trim(),
      category: $("#activity-category").value,
      description: $("#activity-description").value.trim(),
      date: $("#activity-date").value,
      status: $("#activity-status").value,
      tools: $("#activity-tools").value.split(",").map((tool) => tool.trim()).filter(Boolean).slice(0, 12),
      url: urlInput ? safeURL(urlInput) : "",
      image: pendingImage,
      projectFile: previous?.projectFile || "",
      example: false
    };
    const next = previous
      ? activities.map((item) => item.id === id ? activity : item)
      : [activity, ...activities];
    if (!saveActivities(next)) return;
    activityDialog.close();
    render();
    showToast(previous ? "Activity updated and saved on this device." : "Activity added and saved on this device.");
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    resizeImage(file).then((dataURL) => {
      pendingImage = dataURL;
      updateUploadPreview(dataURL);
      $("#form-message").textContent = "";
    }).catch((error) => {
      $("#form-message").textContent = error.message;
      event.target.value = "";
    });
  }

  function handleCardAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    const item = activities.find((activity) => activity.id === id);
    if (!item) return;
    if (action === "details") openDetails(id);
    if (action === "edit") openForm(item);
    if (action === "delete" && window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
      if (saveActivities(activities.filter((activity) => activity.id !== id))) {
        render();
        showToast("Activity deleted.");
      }
    }
  }

  function initTheme() {
    let theme = "dark";
    try {
      theme = localStorage.getItem(THEME_KEY) || "dark";
    } catch (error) {
      console.error("Unable to read the saved theme preference:", error);
    }
    applyTheme(theme === "light" ? "light" : "dark", false);
  }

  function applyTheme(theme, persist = true) {
    document.body.classList.toggle("light-theme", theme === "light");
    $("#theme-icon").textContent = theme === "light" ? "☾" : "☼";
    $(".theme-label").textContent = theme === "light" ? "Dark mode" : "Light mode";
    $("#theme-toggle").setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} theme`);
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        console.error("Unable to save the theme preference:", error);
        showToast("Theme changed, but the preference could not be saved.", true);
      }
    }
  }

  function initNavigation() {
    const menuToggle = $("#menu-toggle");
    const nav = $("#site-nav");
    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        nav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
      }
    });
    const sections = [...nav.querySelectorAll("a")].map((link) => document.querySelector(link.getAttribute("href")));
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            nav.querySelectorAll("a").forEach((link) => {
              const active = link.getAttribute("href") === `#${entry.target.id}`;
              if (active) link.setAttribute("aria-current", "location");
              else link.removeAttribute("aria-current");
              link.classList.toggle("active", active);
            });
          }
        });
      }, { rootMargin: "-25% 0px -65% 0px" });
      sections.filter(Boolean).forEach((section) => observer.observe(section));
    }
  }

  populateCategoryOptions();
  initTheme();
  initNavigation();
  $("#footer-year").textContent = new Date().getFullYear();
  render();

  $("#add-activity").addEventListener("click", () => openForm());
  $("#empty-add").addEventListener("click", () => openForm());
  $("#search-input").addEventListener("input", render);
  $("#category-filter").addEventListener("change", render);
  $("#status-filter").addEventListener("change", render);
  $("#sort-order").addEventListener("change", render);
  activityGrid.addEventListener("click", handleCardAction);
  $("#gallery-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-image]");
    if (button) openImage(button.dataset.image);
  });
  activityForm.addEventListener("submit", handleSubmit);
  $("#activity-image").addEventListener("change", handleImageChange);
  $("#remove-image").addEventListener("click", () => {
    pendingImage = "";
    $("#activity-image").value = "";
    updateUploadPreview("");
  });
  $("#theme-toggle").addEventListener("click", () => applyTheme(document.body.classList.contains("light-theme") ? "dark" : "light"));
  $(".cancel-dialog").addEventListener("click", () => activityDialog.close());
  $(".dialog-close").addEventListener("click", () => activityDialog.close());
  $(".details-close").addEventListener("click", () => detailsDialog.close());
  $(".image-close").addEventListener("click", closeImage);
  imageDialog.addEventListener("close", () => {
    if (currentImage) {
      $("#large-image").src = "";
      currentImage = "";
    }
  });
  [activityDialog, detailsDialog, imageDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  $("#back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", () => $("#back-to-top").classList.toggle("visible", window.scrollY > 520), { passive: true });

  document.querySelectorAll("[data-contact-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const placeholder = /your\.email@example\.com|yourusername/i.test(link.href);
      if (placeholder) {
        event.preventDefault();
        showToast("Replace this example contact link with your own details.");
      }
    });
  });
})();
