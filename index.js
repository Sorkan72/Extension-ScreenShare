import { saveSettingsDebounced, substituteParams } from "../../../../script.js";
import { debounce } from "../../../utils.js";
import {
  extension_settings,
  getContext,
  renderExtensionTemplate,
} from "../../../extensions.js";
import {
  promptQuietForLoudResponse,
  sendMessageAs,
  sendNarratorMessage,
} from "../../../slash-commands.js";
import { registerSlashCommand } from "../../../slash-commands.js";

// === Initializes the Extension, and its settings/settings functionality === //
const extensionName = "third-party/Extension-Screenshare";

// The default settings of the extension
let defaultSettings = {
  enabled: false,
  captionPrompt: ["Describe what you see in this screencap image."],
  mode: "mode-inline",
};

// Associates the html elements with the extension settings
function populateUIWithSettings() {
  $("#screenshare_enabled")
    .prop("checked", extension_settings.screenshare.enabled)
    .trigger("input");
  $("#screenshare_caption_prompt")
    .val(extension_settings.screenshare.captionPrompt)
    .trigger("input");
  $("#screenshare_mode")
    .val(extension_settings.screenshare.mode)
    .trigger("input");
}

/**
 * Loads the extension settings and set defaults if they don't exist.
 */
async function loadSettings() {
  if (!extension_settings.screenshare) {
    console.log("Creating extension_settings.screenshare");
    extension_settings.screenshare = {};
  }
  for (const [key, value] of Object.entries(defaultSettings)) {
    if (!extension_settings.screenshare.hasOwnProperty(key)) {
      console.log(`Setting default for: ${key}`);
      extension_settings.screenshare[key] = value;
    }
  }
  populateUIWithSettings();
}

/**
 * Load the settings HTML and append to the designated area.
 */
async function loadSettingsHTML() {
  const settingsHtml = renderExtensionTemplate(extensionName, "dropdown");
  $("#extensions_settings2").append(settingsHtml);
}

/**
 * Update a specific setting based on user input.
 * @param {string} elementId - The HTML element ID tied to the setting.
 * @param {string} property - The property name in the settings object.
 * @param {boolean} [isCheckbox=false] - Whether the setting is a checkbox.
 */
function updateSetting(elementId, property, isCheckbox = false) {
  let value = $(`#${elementId}`).val();
  if (isCheckbox) {
    value = $(`#${elementId}`).prop("checked");
  }
  extension_settings.screenshare[property] = value;
  saveSettingsDebounced();
}

/**
 * Attach an input listener to a UI component to update the corresponding setting.
 * @param {string} elementId - The HTML element ID tied to the setting.
 * @param {string} property - The property name in the settings object.
 * @param {boolean} [isCheckbox=false] - Whether the setting is a checkbox.
 */
function attachUpdateListener(elementId, property, isCheckbox = false) {
  $(`#${elementId}`).on(
    "input",
    debounce(() => {
      updateSetting(elementId, property, isCheckbox);
    }, 250)
  );
}

/**
 * Setup input listeners for the various settings and actions related to the idle extension.
 */
function setupListeners() {
  // Settings update listener
  const settingsToWatch = [
    ["screenshare_enabled", "enabled", true],
    ["screenshare_prompt", "captionPrompt"],
    ["screenshare_mode", "mode"],
  ];
  settingsToWatch.forEach((setting) => {
    attachUpdateListener(...setting);
  });

  /* 
  FOR CONDITIONAL SETTINGS
  $("#idle_include_prompt").on("input", function () {
    if ($(this).prop("checked")) {
      $('#idle_sendAs option[value="raw"]').hide();
    } else {
      $('#idle_sendAs option[value="raw"]').show();
    }
  });
  */
}

/*
 * A function to set screenshare to enabled.
 * This does not activate the wand. (This commit still uses wand)
 */
function toggleScreenshare() {
  extension_settings.screenshare.enabled =
    !extension_settings.screenshare.enabled;
  $("#screenshare_enabled").prop(
    "checked",
    extension_settings.screenshare.enabled
  );
  $("#screenshare_enabled").trigger("input");
  toastr.info(
    `Screenshare mode ${
      extension_settings.screenshare.enabled ? "enabled" : "disabled"
    }.`
  );
}

jQuery(async () => {
  await loadSettingsHTML();
  loadSettings();
  setupListeners();
});

// Screensharing

// A temp method to have the wand for screenshare show only if enabled in extension settings
let show_wand = extension_settings.screenshare.enabled || false;

class ScreenShareSession {
  /**
   * @type {ImageCapture}
   */
  imageCapture = null;
  /**
   * @type {MediaStream}
   */
  stream = null;
  /**
   * @type {MediaStreamTrack}
   */
  videoTrack = null;

  /**
   * Creates a new Stream object.
   * @param {MediaStream} stream Stream object
   * @param {ImageCapture} imageCapture ImageCapture object
   * @param {MediaStreamTrack} videoTrack Video track object
   */
  constructor(stream, imageCapture, videoTrack) {
    this.stream = stream;
    this.imageCapture = imageCapture;
    this.videoTrack = videoTrack;
  }
}

/**
 * @type {ScreenShareSession}
 */
let session = null;

const { eventSource, event_types } = SillyTavern.getContext();
const canvas = new OffscreenCanvas(window.screen.width, window.screen.height);

const button = createButton();

function updateUI() {
  const icon = button.querySelector("i");
  const text = button.querySelector("span");
  const isSessionActive = !!session;
  icon.classList.toggle("fa-desktop", !isSessionActive);
  icon.classList.toggle("fa-hand", isSessionActive);
  text.innerText = isSessionActive ? "Stop Screen Share" : "Screen Share";
}

function createButton() {
  const menu =
    document.getElementById("screen_share_wand_container") ??
    document.getElementById("extensionsMenu");

  if (!show_wand) {
    console.log("Screen share wand is disabled. Button will not be shown.");
    return null; // Don't create or append the button if wand is disabled
  }

  menu.classList.add("interactable");
  menu.tabIndex = 0;
  const extensionButton = document.createElement("div");
  extensionButton.classList.add(
    "list-group-item",
    "flex-container",
    "flexGap5",
    "interactable"
  );
  extensionButton.tabIndex = 0;
  const icon = document.createElement("i");
  icon.classList.add("fa-solid", "fa-desktop");
  const text = document.createElement("span");
  text.innerText = "Screen Share";
  extensionButton.appendChild(icon);
  extensionButton.appendChild(text);
  extensionButton.onclick = handleClick;

  async function handleClick() {
    if (session) {
      session.videoTrack.stop();
      session = null;
      updateUI();
      return console.log("Screen sharing stopped.");
    }

    await launchScreenShare();
    updateUI();
    return console.log("Screen sharing started.");
  }

  if (!menu) {
    console.warn("createButton: menu not found");
    return extensionButton;
  }

  menu.appendChild(extensionButton);
  return extensionButton;
}

// Dynamically update UI when the setting changes
function updateShowWandSetting(newSetting) {
  show_wand = newSetting;

  const menu =
    document.getElementById("screen_share_wand_container") ??
    document.getElementById("extensionsMenu");

  // If the wand is now enabled, and the button doesn't already exist, add it.
  if (show_wand && !menu.contains(button)) {
    menu.appendChild(button);
    console.log("Screen share wand enabled and button shown.");
  }
  // If the wand is now disabled, and the button exists, remove it.
  else if (!show_wand && menu.contains(button)) {
    menu.removeChild(button);
    console.log("Screen share wand disabled and button hidden.");
  }
}

// Simulate toggling the setting
extension_settings.screenshare.toggle = function () {
  const currentSetting = extension_settings.screenshare.enabled;
  extension_settings.screenshare.enabled = !currentSetting;
  updateShowWandSetting(extension_settings.screenshare.enabled);
};

async function grabFrame(chat) {
  if (!Array.isArray(chat) || chat.length === 0) {
    console.debug("grabFrame: chat is empty");
    return;
  }

  if (!session) {
    console.debug("grabFrame: stream is not initialized");
    return;
  }

  if (!session.stream.active) {
    console.warn("grabFrame: stream is not active");
    return;
  }

  // We don't want to modify the original message object
  // Since it's saved in the chat history
  const lastChatMessage = structuredClone(chat[chat.length - 1]);

  if (!lastChatMessage) {
    console.warn("grabFrame: message is gone??");
    return;
  }

  if (!lastChatMessage.is_user) {
    console.debug("grabFrame: message is not from user");
    return;
  }

  if (!lastChatMessage.extra) {
    lastChatMessage.extra = {};
  }

  if (lastChatMessage.extra.image) {
    console.debug("grabFrame: image already exists");
    return;
  }

  // Do a little bamboozle to hack the message
  chat[chat.length - 1] = lastChatMessage;

  // Grab frame
  const bitmap = await session.imageCapture.grabFrame();

  // Draw frame to canvas
  console.debug("launchScreenShare: drawing frame to canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // Convert to base64 JPEG string
  console.debug("launchScreenShare: converting canvas to base64");
  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.95,
  });
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject();
    reader.readAsDataURL(blob);
  });

  console.log("launchScreenShare: sending frame to chat");
  lastChatMessage.extra.image = base64;
}

async function launchScreenShare() {
  try {
    if (!window.ImageCapture) {
      toastr.error(
        "Your browser does not support ImageCapture API. Please use a different browser."
      );
      return;
    }

    // Get permission to capture the screen
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });

    if (!stream) {
      toastr.error("Failed to start screen sharing. Please try again.");
      return;
    }

    const context = SillyTavern.getContext();

    if (context.mainApi !== "openai") {
      toastr.warning(
        "Screen sharing is only supported in Chat Completions.",
        "Unsupported API"
      );
      return;
    }

    const imageInliningCheckbox = document.getElementById(
      "openai_image_inlining"
    );

    if (imageInliningCheckbox instanceof HTMLInputElement) {
      if (!imageInliningCheckbox.checked) {
        toastr.warning(
          "Image inlining is turned off. The screen share feature will not work."
        );
      }
    }

    // Get the video track
    const [videoTrack] = stream.getVideoTracks();

    if (!videoTrack) {
      throw new Error("Failed to get the video track.");
    }

    // Create an image capture object
    const imageCapture = new ImageCapture(videoTrack);

    // If the video track is ended, stop the worker
    videoTrack.addEventListener("ended", () => {
      console.log("launchScreenShare: video ended, stopping session.");
      session = null;
      updateUI();
    });

    // If the chat is changed, stop the worker
    eventSource.once(event_types.CHAT_CHANGED, () => {
      console.log("launchScreenShare: chat changed, stopping session.");
      videoTrack.stop();
      session = null;
      updateUI();
    });

    // Create a new session object
    session = new ScreenShareSession(stream, imageCapture, videoTrack);
  } catch (error) {
    console.error("Failed to start screen sharing.", error);
    toastr.error(
      "Failed to start screen sharing. Check debug console for more details."
    );
  }
}

window["extension_ScreenShare_interceptor"] = grabFrame;
