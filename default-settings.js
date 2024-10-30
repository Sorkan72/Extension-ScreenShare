/**
 * @typedef {Object} Config
 * @property {boolean} enabled - Indicates if the feature is enabled.
 * @property {string} captionPrompt - The prompt for describing images.
 * @property {'mode-inline' | 'mode-caption'} mode - The mode of operation.
 * @property {string} captionTemplate - Wraps the generated caption so the ai can understand it better. Ensure to use {{caption}}
 * @property {number} captionTimeout - The maximum allowed time for caption generation (In seconds).
 */

/** @type {Config} */
const defaultSettings = {
  enabled: false,
  captionPrompt: "What is this screencapped image?",
  mode: "mode-caption",
  captionTemplate:
    "[{{user}} sent {{char}} an image via screen share: {{caption}}]",
  captionTimeout: 30,
};

// Export the configuration
export default defaultSettings;
