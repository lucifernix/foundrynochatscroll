const MODULE_ID = "chat-no-autoscroll";

/**
 * Threshold in pixels — if the user is within this distance of the bottom,
 * we treat them as "at the bottom" and allow auto-scroll.
 */
const SCROLL_THRESHOLD = 40;

let userScrolledUp = false;
let unreadCount = 0;
let jumpButton = null;
let chatLog = null;

/**
 * Check whether the chat log element is scrolled near the bottom.
 */
function isNearBottom(el) {
  if (!el) return true;
  return (el.scrollHeight - el.scrollTop - el.clientHeight) < SCROLL_THRESHOLD;
}

/**
 * Create and inject the "Jump to Bottom" button into the chat sidebar.
 */
function createJumpButton() {
  if (jumpButton) return;

  jumpButton = document.createElement("button");
  jumpButton.classList.add("chat-jump-bottom");
  jumpButton.innerHTML = `<i class="fas fa-chevron-down"></i> <span class="jump-label">New messages</span>`;
  jumpButton.style.display = "none";

  jumpButton.addEventListener("click", () => {
    if (chatLog) {
      chatLog.scrollTop = chatLog.scrollHeight;
    }
    hideJumpButton();
  });

  // Insert relative to the chat log's parent so it floats above the log.
  const parent = chatLog?.parentElement;
  if (parent) {
    parent.style.position = "relative";
    parent.appendChild(jumpButton);
  }
}

function showJumpButton() {
  if (!jumpButton) return;
  const label = jumpButton.querySelector(".jump-label");
  if (label) {
    label.textContent = unreadCount === 1 ? "1 new message" : `${unreadCount} new messages`;
  }
  jumpButton.style.display = "";
}

function hideJumpButton() {
  unreadCount = 0;
  userScrolledUp = false;
  if (jumpButton) jumpButton.style.display = "none";
}

/**
 * Attach the scroll listener to the chat log element.
 */
function attachScrollListener() {
  if (!chatLog) return;

  chatLog.addEventListener("scroll", () => {
    if (isNearBottom(chatLog)) {
      hideJumpButton();
    } else {
      userScrolledUp = true;
    }
  });
}

/**
 * Find the scrollable chat log element. Foundry v13 uses #chat-log
 * inside the sidebar, but we also handle the element being inside
 * a popout or the new App V2 structure.
 */
function findChatLogElement() {
  return document.querySelector("#chat-log") ?? document.querySelector(".chat-log");
}

// --- Hooks ---

Hooks.once("ready", () => {
  // Wrap ChatLog.prototype.scrollBottom to conditionally suppress scrolling.
  const original = ChatLog.prototype.scrollBottom;

  ChatLog.prototype.scrollBottom = function ({ popout = false, waitImages = false } = {}) {
    // Always allow explicit popout scrolls or the very first render.
    if (popout) {
      return original.call(this, { popout, waitImages });
    }

    // Lazily grab the element reference once the DOM is ready.
    if (!chatLog) {
      chatLog = findChatLogElement();
      if (chatLog) {
        attachScrollListener();
        createJumpButton();
      }
    }

    if (userScrolledUp) {
      // Don't scroll — just update the unread indicator.
      unreadCount++;
      showJumpButton();
      return;
    }

    return original.call(this, { popout, waitImages });
  };

  // Grab the element on first ready as well.
  chatLog = findChatLogElement();
  if (chatLog) {
    attachScrollListener();
    createJumpButton();
  }

  console.log(`${MODULE_ID} | Loaded — chat auto-scroll suppressed when scrolled up.`);
});

// If the sidebar re-renders we need to re-acquire the element.
Hooks.on("renderChatLog", (_app, _html, _data) => {
  // Small delay to let the DOM settle.
  requestAnimationFrame(() => {
    const el = findChatLogElement();
    if (el && el !== chatLog) {
      chatLog = el;
      attachScrollListener();
      jumpButton = null; // recreate in new parent
      createJumpButton();
    }
  });
});
