// Add this function for logging
function debugLog(message) {
  console.log(`[OnlyLikes Debug] ${message}`);
}

// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  {urls: ["<all_urls>"]},
  ["blocking"]
);

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
  debugLog(`Received message: ${JSON.stringify(message)}`);
  if (message.action === "analyzeComments") {
    debugLog(`Analyzing comments: ${message.comments.length} comments`);
    analyzeSentiment(message.comments)
      .then(sentiments => {
        debugLog(`Sentiment analysis complete: ${sentiments}`);
        sendResponse({sentiments});
      })
      .catch(error => {
        debugLog(`Error in sentiment analysis: ${error}`);
        sendResponse({error: error.message});
      });
    return true; // Indicates we'll send a response asynchronously
  }
});

async function analyzeSentiment(comments) {
  try {
    const { apiKey, apiChoice } = await browser.storage.sync.get(['apiKey', 'apiChoice']);
    debugLog(`Using API: ${apiChoice}`);
    debugLog(`API Key available: ${apiKey ? 'Yes' : 'No'}`);

    if (apiChoice === 'openai' && apiKey) {
      return await analyzeWithOpenAI(comments, apiKey);
    } else if (apiChoice === 'anthropic' && apiKey) {
      return await analyzeWithAnthropic(comments, apiKey);
    } else {
      debugLog('No API key available or invalid choice, using fallback sentiment analysis');
      return comments.map(comment => comment.length % 2 === 0 ? 0.7 : 0.3);
    }
  } catch (error) {
    debugLog(`Error accessing storage or analyzing sentiment: ${error.message}`);
    return comments.map(comment => comment.length % 2 === 0 ? 0.7 : 0.3);
  }
}

async function analyzeWithOpenAI(comments, apiKey) {
  debugLog('Sending batch request to OpenAI API');
  const requestBody = {
    model: "gpt-3.5-turbo",
    messages: [
      {role: "system", content: "You are a sentiment analysis tool. For each comment, respond with a single number between 0 and 1, where 0 is extremely negative and 1 is extremely positive. Separate each sentiment score with a newline."},
      {role: "user", content: `Analyze the sentiment of these comments:\n${comments.join('\n')}`}
    ]
  };
  
  debugLog(`OpenAI API request body: ${JSON.stringify(requestBody, null, 2)}`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    debugLog(`OpenAI API response: ${JSON.stringify(data, null, 2)}`);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const sentiments = data.choices[0].message.content.split('\n').map(parseFloat);
      debugLog(`Parsed sentiments: ${sentiments.join(', ')}`);
      return sentiments;
    } else {
      debugLog('Unexpected response format from OpenAI API');
      return comments.map(() => 0.5); // Neutral fallback
    }
  } catch (error) {
    debugLog(`Error in OpenAI API call: ${error.message}`);
    return comments.map(() => 0.5); // Neutral fallback
  }
}

async function analyzeWithAnthropic(comments, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      model: "claude-v1",
      prompt: `Human: You are a sentiment analysis tool. Analyze the sentiment of these comments and respond with a single number between 0 and 1, where 0 is extremely negative and 1 is extremely positive. The comments are: "${comments.join('\n')}"`
    })
  });

  const data = await response.json();
  return parseFloat(data.completion.content);
}