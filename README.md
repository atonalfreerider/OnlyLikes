# OnlyLikes

![plot](./icons/icon-96.png)  

A browser extension that filters out negative comments on social media platforms, using on-device sentiment analysis

*Supported Browsers*:
- Chrome (v131)
- Firefox (v134)

*How it works*:

 Social Media comments are completely blocked when the user loads a post that they authored. Each comment under the post is selectively unblocked after it undergoes a sentiment analysis, ranking the comment from 0 (negative) to 1 (positive).

 Sentiment inference is only run when it is a user post. It does not run otherwise.
 
 Chrome:
 On-device Gemini Nano, provided by the browser:  
 https://developer.chrome.com/docs/ai/built-in-apis

 Firefox:
 On-device Xenova, provided by the browser:  
 https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions.html  
 https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions-api-example/README.html#trial-inference-api-extension-example  

 The models are downloaded and cached on the user device. They require a few hundred MB of storage and will run with GPU acceleration automatically, and will defauly to quantized CPU inference, so it should run on a mobile device.

*Supported Sites*
- Instagram
- X
- Reddit
- YouTube
- Facebook

## Chrome Installation

1. Run:
```
npm install
npm run build
```
2. In Chrome (min version 131) Extensions > Manage Extensions > Load unpacked:
- load OnlyLikes/dist


## Firefox Installation

1. Clone the repository
2. Open Firefox (min version 134.0)
3. Go to about:config
4. Set these preferences to true:
    - browser.ml.enable → true
    - extensions.ml.enabled → true
5. Open about:debugging#/runtime/this-firefox
6. Click "Load Temporary Add-on" and select manifest.json
7. Once the extension is loaded, go into about:addons and enable the optional permission.


## Usage

1. Open the extension by clicking on the icon in the toolbar.
2. Adjust the settings as needed.
3. Refresh the page or wait a few seconds for the extension to filter out negative comments.


