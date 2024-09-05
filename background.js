// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  {urls: ["<all_urls>"]},
  ["blocking"]
);

// Add this function for logging
function debugLog(message) {
  console.log(`[OnlyLikes Debug] ${message}`);
}

function handleRequest(details) {
  const supportedPlatforms = [
    "youtube.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "reddit.com"
  ];

  const url = new URL(details.url);
  const domain = url.hostname.replace('www.', '');

  if (supportedPlatforms.some(platform => domain.includes(platform))) {
    debugLog(`Intercepted request for supported platform: ${domain}`);
    return { cancel: false };
  }

  debugLog(`Intercepted request for unsupported platform: ${domain}`);
  return { cancel: false };
}

// Handle messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeComment") {
    debugLog(`Received comment for analysis: "${message.comment.substring(0, 50)}..."`);
    analyzeSentiment(message.comment)
      .then(sentiment => {
        debugLog(`Sentiment analysis result: ${sentiment}`);
        sendResponse({sentiment});
      });
    return true;
  }
});

async function analyzeSentiment(comment) {
  const { apiKey, apiChoice } = await browser.storage.sync.get(['apiKey', 'apiChoice']);
  debugLog(`Using API: ${apiChoice}`);
  debugLog(`API Key available: ${apiKey ? 'Yes' : 'No'}`);

  if (apiChoice === 'openai' && apiKey) {
    return analyzeWithOpenAI(comment, apiKey);
  } else if (apiChoice === 'anthropic' && apiKey) {
    return analyzeWithAnthropic(comment, apiKey);
  } else {
    debugLog('No API key available or invalid choice, using fallback sentiment analysis');
    return comment.length % 2 === 0 ? 0.7 : 0.3;
  }
}

async function analyzeWithOpenAI(comment, apiKey) {
  debugLog('Sending request to OpenAI API');
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {role: "system", content: "You are a sentiment analysis tool. Respond with a single number between 0 and 1, where 0 is extremely negative and 1 is extremely positive."},
          {role: "user", content: `Analyze the sentiment of this comment: "${comment}"`}
        ]
      })
    });

    const data = await response.json();
    debugLog(`OpenAI API response: ${JSON.stringify(data)}`);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const sentiment = parseFloat(data.choices[0].message.content);
      debugLog(`Parsed sentiment: ${sentiment}`);
      return sentiment;
    } else {
      debugLog('Unexpected response format from OpenAI API');
      return 0.5; // Neutral fallback
    }
  } catch (error) {
    debugLog(`Error in OpenAI API call: ${error.message}`);
    return 0.5; // Neutral fallback
  }
}

async function analyzeWithAnthropic(comment, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      model: "claude-v1",
      prompt: `Human: You are a sentiment analysis tool. Analyze the sentiment of this comment and respond with a single number between 0 and 1, where 0 is extremely negative and 1 is extremely positive. The comment is: "${comment}"`
    })
  });

  const data = await response.json();
  return parseFloat(data.completion.content);
}