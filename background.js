// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  {urls: ["<all_urls>"]},
  ["blocking"]
);

function handleRequest(details) {
  // Implement request interception logic here
  // This is where you'd intercept the page content before it's displayed
}

// Handle messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeComment") {
    analyzeSentiment(message.comment)
      .then(sentiment => sendResponse({sentiment}));
    return true; // Indicates we'll send a response asynchronously
  }
});

async function analyzeSentiment(comment) {
  const { apiKey, apiChoice } = await browser.storage.sync.get(['apiKey', 'apiChoice']);

  if (apiChoice === 'openai' && apiKey) {
    return analyzeWithOpenAI(comment, apiKey);
  } else if (apiChoice === 'anthropic' && apiKey) {
    return analyzeWithAnthropic(comment, apiKey);
  } else {
    // Fallback to a simple sentiment analysis if API is not available
    return comment.length % 2 === 0 ? 0.7 : 0.3; // Dummy implementation
  }
}

async function analyzeWithOpenAI(comment, apiKey) {
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
  return parseFloat(data.choices[0].message.content);
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