# Screen Share

Injects the screen shared image into the chat context, when the user sends a message.

Can be used directly with multimodal chat models.

Or by utilizing the "Image Captioning" Extension. (Ensure this is set up and functioning correctly beforehand)

## How to install

Open the SillyTavern "Extensions" tab and click "Install extension".

Enter the url below, and click "Save".

```txt
https://github.com/Sorkan72/Extension-ScreenShare
```

## Prerequisites

The latest staging version of SillyTavern is preferred.

Your browser must support ImageCapture API. (See [ImageCapture API](https://caniuse.com/imagecapture))

## How to use

**Note** If using Chat Completion APIs, ensure "Send inline images" enabled.

0. A multimodal model OR functioning "Image Captioning" extension is required.
1. Enable Screenshare in the extensions tab. Choose your preferred mode/method.
2. Initialize the screen-sharing session by choosing "Screen Share" from the "wand" menu.
3. Start chatting! Every last user message will include the screen image as an inline attachment, or have the information injected into the message context.
4. When you're done, choose "Stop Screen Share" from the "wand" menu. Changing a chat or stopping the track via the browser also stops sharing.

**Important!** Images are not saved and are not posted anywhere besides your API backend provider.

## Help Resources

[ImageCapture API](https://caniuse.com/imagecapture)

[How to use Image Captioning](https://youtu.be/X2sgNeCTer8)

## License

AGPLv3
