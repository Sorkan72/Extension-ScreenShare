// DEV: Please just add an alias
import {
  saveSettingsDebounced,
  eventSource,
  event_types,
  substituteParamsExtended,
} from "../../../../script.js";
import { debounce } from "../../../utils.js";
import {
  extension_settings,
  renderExtensionTemplate,
} from "../../../extensions.js";
import { getMultimodalCaption } from "../../shared.js";

import CreateWandButton from "./components/WandButton.js";
import defaultSettings from "./default-settings.js";
import { ScreenShareSession } from "./lib/screenShareSessionClass.js";

// === Globals (Should be removed at some point) === //

/** @type {ScreenShareSession|null} */
let screenshareSession = null;

let wandButton;

// === Extension setup === //

// The name/association of the Extension
const extensionName = "third-party/Extension-Screenshare";

// Loads the HTML file (dropdown.html) into the designated extensions area
async function loadSettingsHTML() {
  const settingsHtml = renderExtensionTemplate(
    extensionName,
    "./components/dropdown"
  );
  $("#extensions_settings2").append(settingsHtml);
}

// Initializes the extension settings and its UI
async function initializeSettings() {
  extension_settings.screenshare = {
    ...defaultSettings,
    ...extension_settings.screenshare,
  };

  // Setup screenshare button component in the wand section
  wandButton = CreateWandButton(
    screenshareSession,
    updateXUI,
    launchScreenShare
  );

  const screenshareSettings = { ...extension_settings.screenshare };

  // Aligns the ui to the extension settings
  $("#screenshare_enabled").prop("checked", screenshareSettings.enabled);
  $("#screenshare_mode").val(screenshareSettings.mode);
  $("#screenshare_caption_prompt").val(screenshareSettings.captionPrompt);
  $("#screenshare_caption_template").val(screenshareSettings.captionTemplate);
  $("#screenshare_caption_timeout").val(screenshareSettings.captionTimeout);

  updateXUI(); // Extension UI boot up + bandaid fix
}

// Allows the user to update specific extension settings through UI input
function setupListeners() {
  const elements = [
    { id: "screenshare_enabled", property: "enabled", isCheckbox: true },
    { id: "screenshare_mode", property: "mode", isCheckbox: false },
    {
      id: "screenshare_caption_prompt",
      property: "captionPrompt",
      isCheckbox: false,
    },
    {
      id: "screenshare_caption_template",
      property: "captionTemplate",
      isCheckbox: false,
    },
    {
      id: "screenshare_caption_timeout",
      property: "captionTimeout",
      isCheckbox: false,
    },
  ];

  elements.forEach(({ id, property, isCheckbox }) => {
    const eventType = isCheckbox ? "change" : "input"; // Change event for checkboxes, input for others
    $(`#${id}`).on(eventType, function () {
      const newValue = isCheckbox ? $(this).prop("checked") : $(this).val();
      updateScreenshareSetting(property, newValue);
    });
  });
}

// Function to update the extension setting and it's corresponding UI elements
function updateScreenshareSetting(property, value) {
  const currentValue = extension_settings.screenshare[property];

  // Only update if the new value differs from the current value
  if (currentValue !== value) {
    if (property === "enabled") {
      // Checks and warns if trying to disable screenshare while its running
      if (!screenshareSession) {
        extension_settings.screenshare[property] = value;
      } else {
        toastr.warning("Screen share is running. Cannot disable.");
      }
      updateXUI("enabled");
    } else if (property === "mode") {
      extension_settings.screenshare[property] = value;
      updateXUI("mode");
      // For all other properties
    } else {
      extension_settings.screenshare[property] = value;
    }

    saveSettingsDebounced(); // Saves the settings
  }
}

/**
 * Updates UI related to this extension
 * Can be used to update specific sections
 * @param {'all' | 'enabled' | 'mode' | 'wand'} section The UI section related to it's setting
 */
function updateXUI(section = "all") {
  switch (section) {
    // Related to "extension_settings.screenshare.enabled"
    case "enabled":
      setTimeout(() => {
        $("#screenshare_enabled").prop(
          "checked",
          extension_settings.screenshare.enabled
        );
      }, 0);
      updateXUI("wand"); // 'wand' is updated based on 'enabled', but not vise versa
      break;

    // Related to "extension_settings.screenshare.mode"
    case "mode":
      if (extension_settings.screenshare.mode === "mode-caption") {
        $(".screenshare_prompt_section").show();
      } else {
        $(".screenshare_prompt_section").hide();
      }
      break;

    // Related to the wand section specifically
    case "wand":
      if (extension_settings.screenshare.enabled) {
        // DEV: The method of the wand button could be more modular
        wandButton.style.display = "";
        const buttonIcon = wandButton.querySelector("i");
        const buttonText = wandButton.querySelector("span");
        const isSessionActive = !!screenshareSession;
        buttonIcon.classList.toggle("fa-desktop", !isSessionActive);
        buttonIcon.classList.toggle("fa-hand", isSessionActive);
        buttonText.innerText = isSessionActive
          ? "Stop Screen Share"
          : "Screen Share";
      } else {
        wandButton.style.display = "none";
      }
      break;

    default:
      // If no specific section is given, update all UI elements
      updateXUI("enabled");
      updateXUI("mode");
      updateXUI("wand");
      break;
  }
}

// === Screensharing === //

const canvas = new OffscreenCanvas(window.screen.width, window.screen.height);

// DEV This function could be improved
// DEV TODO (1): handle different mode types better
/**
 * Launches the screenshare session
 */
async function launchScreenShare() {
  try {
    // Browser compatibilty check
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

    const context = SillyTavern.getContext(); // Get info from sillytavern

    // If using inline mode, ensure user's api supports inline images
    if (extension_settings.screenshare.mode === "mode-inline") {
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
      screenshareSession = null;
      updateXUI("wand");
    });

    // If the chat is changed, stop the worker
    eventSource.once(event_types.CHAT_CHANGED, () => {
      console.log("launchScreenShare: chat changed, stopping session.");
      videoTrack.stop();
      screenshareSession = null;
      updateXUI("wand");
    });

    // Create a new session object
    screenshareSession = new ScreenShareSession(
      stream,
      imageCapture,
      videoTrack
    );
  } catch (error) {
    console.error("Failed to start screen sharing. Error:", error);
    toastr.error(
      "Failed to start screen sharing. Check debug console for more details."
    );
  }
}

/**
 * Grabs the current frame from a screenshare session and appends it to the user's last chat message as a base64 JPEG image.
 * @function grabFrame
 * @param {Array} chat - The chat history array with each entry being a message object. The function targets the last message.
 */
async function grabFrame(chat) {
  if (!Array.isArray(chat) || chat.length === 0) {
    console.debug("grabFrame: chat is empty");
    return;
  }
  if (!screenshareSession) {
    console.debug("grabFrame: stream is not initialized");
    return;
  }
  if (!screenshareSession.stream.active) {
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
  const bitmap = await screenshareSession.imageCapture.grabFrame();

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

  // If Multimodal Inline mode
  if (extension_settings.screenshare.mode === "mode-inline") {
    lastChatMessage.extra.image = base64; // Multimodal model auto interacts with it's inline image
  }

  // If Caption mode
  else if (extension_settings.screenshare.mode === "mode-caption") {
    // Use extension setting or "unlimited" if 0 -> default setting -> function default
    const timeout_in_seconds =
      extension_settings.screenshare.captionTimeout === 0
        ? 3600 // 1 hr
        : extension_settings.screenshare.captionTimeout ||
          defaultSettings.captionTimeout;

    // Generate caption
    const caption = await generateCaption(base64, timeout_in_seconds);
    if (!caption) return; // If captioning error, cancel

    // Wrap the caption in the template and inject it into the last user message
    const wrappedCaption = await wrapCaptionTemplate(caption);
    if (lastChatMessage.mes?.trim()) {
      lastChatMessage.mes = `${wrappedCaption}\n\n${lastChatMessage.mes}`;
    }
  }
  // If using undefined mode
  else {
    toastr.error("Invalid Screenshare mode detected.");
  }

  /* DEV DEBUG LOGS
  console.debug("BASE64", base64);
  console.debug("launchScreenShare: sending frame to chat");
  console.debug("chat type", typeof chat);
  console.debug("chat", chat);
  console.debug("CHAT DATA VAR:", data);
  console.debug("LAST CHAT MESSAGE:", lastChatMessage);
  console.debug("Wrapped generated caption:", wrappedCaption);
  */
}

window["extension_ScreenShare_interceptor"] = grabFrame;

// === Image Captioning === //

/**
 * Generates a caption with a timeout for stillness checks.
 * @param {string} base64Img Base64-encoded image
 * @param {number} timeout Duration in seconds for the timeout.
 * @returns {Promise<string|null>} The string caption, or null if caption generation fails.
 *
 * @example
 * (async () => {
 *   const base64Img = 'data:image/png;base64,...'; // Example base64 image
 *   const timeout = 45; // Optional timeout value
 *   const caption = await generateCaption(base64Img, timeout);
 *   console.log(caption);
 * })();
 */
async function generateCaption(base64Img, timeout = 30) {
  // Convert timeout from seconds to milliseconds
  const timeoutMs = timeout * 1000;

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error("Timeout: caption generation took too long")),
      timeoutMs
    )
  );

  // Race between caption generation and the timeout
  try {
    console.log("Screenshare: Generating image caption..");

    const caption = await Promise.race([
      getMultimodalCaption(
        base64Img,
        extension_settings.screenshare.captionPrompt?.trim() ||
          defaultSettings.captionPrompt
      ),
      timeoutPromise,
    ]);

    return caption; // If success
  } catch (error) {
    toastr.error("Cannot generate caption. Reason: Took too long.");
    return null; // If error
  }
}

/**
 * Wraps a caption with the captionTemplate
 * @param {string} caption Raw caption
 * @returns {Promise<string>} Wrapped caption
 */
async function wrapCaptionTemplate(caption) {
  let template =
    extension_settings.screenshare.captionTemplate?.trim() ||
    defaultSettings.captionTemplate;

  if (!/{{caption}}/i.test(template)) {
    console.warn(
      "Poka-yoke: Caption template does not contain {{caption}}. Appending it."
    );
    template += " {{caption}}";
  }

  let messageText = substituteParamsExtended(template, { caption: caption });

  return messageText;
}

// === DEV Features === //

function restoreFactoryDefault() {
  delete extension_settings.screenshare;
}

// Init
jQuery(async () => {
  /* restoreFactoryDefault(); */ // Uncomment if you wish to reset settings to default

  await loadSettingsHTML(); // Load the HTML
  await initializeSettings(); // Initialize the extension settings
  setupListeners(); // Give UI input functionality
});
