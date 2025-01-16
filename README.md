# OnlyLikes

A browser extension that filters out negative comments on social media platforms.

## Chrome Installation

1. Run:
```
npm install
npm run build
```
2. In Chrome (min version 131) Extensions > Manage Extensions > Load unpacked:
- load OnlyLikes/dist


## Firefox Installation (WIP)

1. Clone the repository
2. Open Firefox Nightly (min version 136.0a1)
3. Go to about:config
4. Set these preferences to true:
   - extensions.experiments.enabled
   - browser.ml.enable
   - xpinstall.signatures.required (set to false)
5. Open about:debugging#/runtime/this-firefox
6. Click "Load Temporary Add-on" and select manifest.json
7. Once the extension is loaded, go into about:addons and enable the optional permission.


## Usage

1. Open the extension by clicking on the icon in the toolbar.
2. Adjust the settings as needed.
3. Refresh the page or wait a few seconds for the extension to filter out negative comments.


