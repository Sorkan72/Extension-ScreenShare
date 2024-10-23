# Screen Share

Provides the screen image for multimodal models when you send a message.

Works only if the last chat message is from a user.

## How to install

Open the SillyTavern "Extensions" tab and click "Install extension".

Enter the url below, and click "Save".

```txt
https://github.com/Sorkan72/Extension-ScreenShare
```

## Prerequisites

The latest staging version of SillyTavern is preferred.

Your browser must support ImageCapture API.

See: <https://caniuse.com/imagecapture>

## How to use

**Note** If using Chat Completion APIs, ensure "Send inline images" enabled.

0. A multimodal model for your chat, or functioning "Image Captioning" extension is required.
1. Initialize the screen-sharing session by choosing "Screen Share" from the "wand" menu.
2. Start chatting! Every last user message will include the screen image as an inline attachment.
3. When you're done, choose "Stop Screen Share" from the "wand" menu. Changing a chat or stopping the track via the browser also stops sharing.

**Important!** Images are not saved and are not posted anywhere besides your API backend provider.

## License

AGPLv3
