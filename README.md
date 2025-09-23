# OnlyLikes

![plot](./icons/icon-96.png)  

A browser extension that filters out negative comments on social media platforms, using on-device sentiment analysis

*Supported Browsers*:
- Chrome (v139)
- Firefox (v134)

*How it works*:

 All Social Media replies are completely blocked when the user loads a post or comment that they authored, or if user is mentioned in another comment. Each reply under the comment is selectively unblocked after it undergoes a sentiment analysis, ranking the comment from 0 (negative) to 1 (positive).

 Sentiment inference is only run when it is a user submission. It does not run otherwise. The sentiment inference is run in-browser, on your device, and does not use any API calls. It only uses electricity.
 
 Chrome:
 On-device Gemini Nano, provided by the browser:  
 https://developer.chrome.com/docs/ai/built-in-apis

 Firefox:
 On-device Xenova, provided by the browser:  
 https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions.html  
 https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions-api-example/README.html#trial-inference-api-extension-example  

 The models are downloaded and cached on the user device. They require a few hundred MB of storage and will run with GPU acceleration automatically, and will default to quantized CPU inference, so it should run on a mobile device.

*Supported Sites*
- Instagram
- X
- Reddit
- YouTube
- Facebook
- HackerNews

## Chrome Installation

1. Run:
```
npm install
npm run build
```
2. In Chrome (min version 139) Extensions > Manage Extensions > Load unpacked:
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

## Publish instructions
https://developer.chrome.com/docs/webstore/publish
https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- zip project contents into flat zip (exclude git, node_modules, dist)

## Why I Made This Tool

I have never, ever, once in my entire life, read a negative reply to one of my internet submissions and received some kind of value from it. No self-improvement. No deep reflection.  

Quite the opposite. These comments sit in my mind and haunt me. I never forget them.  

I think I'm like most people. I'm going through life, living it the way that I think is best for me. I keep my negative thoughts to myself. I don't blast them out all over the place.  

Contrary to what a troll will tell you: "Oh, I'm holding you accountable blah-blah-blah", this is nothing more than bullying, and I think in most cases it is projection.  

Moreover, it is apparent that the Internet economy is fueled on bullying, triggering, vitriol. OnlyLikes and on-device sentiment analysis are the first step in making the Internet a better place.   

If you are a troll and you are reading this, and you feel an urge to post something mean, you are wasting your time because now I'll never see it.  
