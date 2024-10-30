export class ScreenShareSession {
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
