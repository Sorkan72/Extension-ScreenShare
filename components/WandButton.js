// This is separated because I hate looking at it inside of index.js
// DEV: A better method of making this button is much preferred
import { ScreenShareSession } from "../lib/screenShareSessionClass.js";

/**
 * The button that sits in the bottom left wand section
 * @param {ScreenShareSession|null} screenshareSession - The session for screen sharing.
 * @param {function(string): void} updateXUI - Function to update UI, expects a string argument.
 * @param {function(): Promise<void>} launchScreenShare - Async function to initiate screen sharing.
 * @returns {HTMLDivElement} - The created button element.
 */
function CreateWandButton(screenshareSession, updateXUI, launchScreenShare) {
  const menu =
    document.getElementById("screen_share_wand_container") ??
    document.getElementById("extensionsMenu");
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
    if (screenshareSession) {
      screenshareSession.videoTrack.stop();
      screenshareSession = null;
      updateXUI("wand");
      return console.log("Screen sharing stopped.");
    }

    await launchScreenShare();
    updateXUI("wand");

    return console.log("Screen sharing started.");
  }

  if (!menu) {
    console.warn("wandButton: menu not found");
    return extensionButton;
  }

  menu.appendChild(extensionButton);
  return extensionButton;
}

export default CreateWandButton;
