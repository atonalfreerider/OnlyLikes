// Determine runtime environment
const runtimeEnv = (() => {
    if (typeof browser !== 'undefined' && browser.runtime) {
        return { type: 'firefox', api: browser };
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return { type: 'chrome', api: chrome };
    }
    return { type: 'standalone', api: null };
})();

let testResults = {
    browser: null,
    aiApi: null,
    backgroundScript: null,
    sentimentTests: [],
    overall: 'pending'
};

let currentProgress = 0;
const totalSteps = 8;
const FALLBACK_SOURCES = new Set(['heuristics']);

function updateProgress(step, message) {
    currentProgress = step;
    const percentage = (step / totalSteps) * 100;
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressText').textContent = message;
    document.getElementById('progressSection').style.display = 'block';
}

function updateSummary() {
    const summarySection = document.getElementById('summarySection');
    const summaryBox = document.getElementById('summaryBox');
    const summaryTitle = document.getElementById('summaryTitle');
    const summaryText = document.getElementById('summaryText');
    
    summarySection.style.display = 'block';
    
    const passCount = Object.values(testResults).filter(r => r === 'pass').length;
    const failCount = Object.values(testResults).filter(r => r === 'fail').length;
    const sentimentPassCount = testResults.sentimentTests.filter(t => t.status === 'pass').length;
    
    if (testResults.browser === 'pass' && testResults.aiApi === 'pass' && testResults.backgroundScript === 'pass' && sentimentPassCount >= 2) {
        testResults.overall = 'pass';
        summaryBox.className = 'summary-box summary-pass';
        summaryTitle.textContent = '✅ ALL TESTS PASSED';
        summaryText.textContent = 'OnlyLikes is fully functional on your browser!';
    } else if ((testResults.browser === 'pass' || testResults.browser === 'warn') && (testResults.aiApi === 'pass' || testResults.backgroundScript === 'pass')) {
        testResults.overall = 'partial';
        summaryBox.className = 'summary-box summary-partial';
        summaryTitle.textContent = '⚠️ PARTIAL FUNCTIONALITY';
        summaryText.textContent = 'Some features may work, but full functionality is not guaranteed.';
    } else {
        testResults.overall = 'fail';
        summaryBox.className = 'summary-box summary-fail';
        summaryTitle.textContent = '❌ TESTS FAILED';
        summaryText.textContent = 'OnlyLikes may not work properly on your browser. Check requirements.';
    }
}

function log(message, type = 'info') {
    const results = document.getElementById('results');
    const timestamp = new Date().toLocaleTimeString();
    
    let prefix;
    switch (type) {
        case 'pass': prefix = '✅'; break;
        case 'fail': prefix = '❌'; break;
        case 'warn': prefix = '⚠️'; break;
        case 'info': prefix = 'ℹ️'; break;
        default: prefix = '•';
    }
    
    results.textContent += `[${timestamp}] ${prefix} ${message}\n`;
    results.scrollTop = results.scrollHeight;
}

function clearLog() {
  document.getElementById('results').textContent = 'Test results cleared.\n\n';
  document.getElementById('progressSection').style.display = 'none';
  document.getElementById('summarySection').style.display = 'none';
  testResults = { browser: null, aiApi: null, backgroundScript: null, sentimentTests: [], overall: 'pending' };
}

async function detectBrowser() {
    updateProgress(1, 'Detecting browser and version...');
    log('=== BROWSER DETECTION ===');
    
    const userAgent = navigator.userAgent;
    log(`User Agent: ${userAgent}`);
    log(`Runtime Environment: ${runtimeEnv.type}`);
    
    const isFirefox = userAgent.toLowerCase().includes('firefox');
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
    
    if (isFirefox) {
        const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
        const version = firefoxMatch ? parseInt(firefoxMatch[1]) : 0;
        log(`Firefox version ${version} detected`);
        
        if (version >= 134) {
            log('Firefox version meets requirements (134+)', 'pass');
            
            // Check if running as extension
            if (runtimeEnv.type === 'firefox') {
                log('Firefox extension runtime detected', 'pass');
                testResults.browser = 'pass';
                return 'firefox';
            } else {
                log('Warning: Not running as Firefox extension', 'warn');
                log('Load this page from the extension or use about:debugging', 'info');
                testResults.browser = 'warn';
                return 'firefox-standalone';
            }
        } else {
            log(`Firefox version ${version} is below required version 134`, 'fail');
            testResults.browser = 'fail';
            return null;
        }
    } else if (isChrome) {
        const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
        const version = chromeMatch ? parseInt(chromeMatch[1]) : 0;
        log(`Chrome version ${version} detected`);
        
        if (version >= 139) {
            log('Chrome version meets requirements (139+)', 'pass');
            
            // Check if running as extension
            if (runtimeEnv.type === 'chrome') {
                log('Chrome extension runtime detected', 'pass');
                testResults.browser = 'pass';
                return 'chrome';
            } else {
                log('Warning: Not running as Chrome extension', 'warn');
                log('Load this page from the extension', 'info');
                testResults.browser = 'warn';
                return 'chrome-standalone';
            }
        } else {
            log(`Chrome version ${version} is below required version 139`, 'fail');
            testResults.browser = 'fail';
            return null;
        }
    } else {
        log('Unsupported browser detected', 'fail');
        testResults.browser = 'fail';
        return null;
    }
}

async function testChromeAI() {
    updateProgress(2, 'Testing Chrome LanguageModel API...');
    log('\n=== CHROME LANGUAGEMODEL API TEST ===');
    
    if (typeof globalThis.LanguageModel === 'undefined') {
        log('LanguageModel API not available', 'fail');
        log('This may be due to:', 'info');
        log('- Chrome version below 139', 'info');
        log('- Hardware requirements not met', 'info');
        log('- Not running as extension', 'info');
        testResults.aiApi = 'fail';
        return false;
    }
    
    log('LanguageModel API found', 'pass');
    
    try {
        log('Checking model availability...');
        const availability = await LanguageModel.availability();
        log(`Model availability: ${availability}`);
        
        if (availability === 'unavailable') {
            log('Model is unavailable - check system requirements', 'fail');
            testResults.aiApi = 'fail';
            return false;
        }
        
        if (availability === 'downloadable') {
            log('Model needs to be downloaded (this may take time)', 'warn');
        }
        
        log('Creating LanguageModel session...');
        const session = await LanguageModel.create({
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    log(`Download progress: ${Math.round(e.loaded * 100)}%`);
                });
            }
        });
        
        log('Session created successfully', 'pass');
        
        // Quick test
        const testPrompt = 'Rate sentiment 0-1: "This is great!"';
        const response = await session.prompt(testPrompt, { outputLanguage: 'en' });
        log(`Test response: "${response}"`);
        
        session.destroy();
        log('Session destroyed', 'pass');
        log('Chrome LanguageModel API is functional', 'pass');
        testResults.aiApi = 'pass';
        return true;
        
    } catch (error) {
        log(`LanguageModel API error: ${error.message}`, 'fail');
        testResults.aiApi = 'fail';
        return false;
    }
}

async function testFirefoxAI() {
    updateProgress(2, 'Testing Firefox ML API...');
    log('\n=== FIREFOX ML API TEST ===');
    
    if (runtimeEnv.type !== 'firefox') {
        log('Not running as Firefox extension', 'fail');
        log('Firefox ML API requires extension context', 'info');
        testResults.aiApi = 'fail';
        return false;
    }
    
    if (!runtimeEnv.api.trial || !runtimeEnv.api.trial.ml) {
        log('Firefox ML API not available', 'fail');
        log('To enable Firefox ML API:', 'info');
        log('1. Go to about:config', 'info');
        log('2. Set browser.ml.enable = true', 'info');
        log('3. Set extensions.ml.enabled = true', 'info');
        log('4. Restart Firefox', 'info');
        testResults.aiApi = 'fail';
        return false;
    }
    
    log('Firefox ML API found', 'pass');
    
    try {
        log('Creating ML engine...');
        const engine = await runtimeEnv.api.trial.ml.createEngine({
            modelHub: "huggingface",
            taskName: "text-classification"
        });
        
        log('ML engine created successfully', 'pass');
        
        // Quick test
        log('Testing sentiment analysis...');
        const testResult = await runtimeEnv.api.trial.ml.runEngine({
            args: ["This is a great test comment!"]
        });
        
        log(`Test result: ${JSON.stringify(testResult)}`, 'pass');
        log('Firefox ML API is functional', 'pass');
        testResults.aiApi = 'pass';
        return true;
        
    } catch (error) {
        log(`Firefox ML API error: ${error.message}`, 'fail');
        log('Common issues:', 'info');
        log('- ML preferences not enabled', 'info');
        log('- Network connection required for model download', 'info');
        log('- Insufficient storage space', 'info');
        testResults.aiApi = 'fail';
        return false;
    }
}

async function testBackgroundScript() {
    updateProgress(3, 'Testing background script communication...');
    log('\n=== BACKGROUND SCRIPT TEST ===');
    
    if (runtimeEnv.type === 'standalone') {
        log('Not running as browser extension', 'fail');
        log('Background script requires extension context', 'info');
        testResults.backgroundScript = 'fail';
        return false;
    }
    
    const api = runtimeEnv.api;
    const testComment = "This is a test comment for background script communication.";
    log(`Sending test comment: "${testComment}"`);
    log(`Using ${runtimeEnv.type} extension API`);
    
    try {
        let response;
        
        if (runtimeEnv.type === 'firefox') {
            // Firefox uses Promise-based API
            response = await api.runtime.sendMessage({
                action: "analyzeComment",
                comment: testComment,
                hash: "background_test"
            });
        } else {
            // Chrome uses callback-based API
            response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Background script communication timeout'));
                }, 10000);
                
                api.runtime.sendMessage({
                    action: "analyzeComment",
                    comment: testComment,
                    hash: "background_test"
                }, (response) => {
                    clearTimeout(timeout);
                    
                    if (api.runtime.lastError) {
                        reject(new Error(api.runtime.lastError.message));
                        return;
                    }
                    resolve(response);
                });
            });
        }
        
        if (response && typeof response.sentiment === 'number') {
            log(`Background script response: sentiment=${response.sentiment}`, 'pass');
            log('Background script communication successful', 'pass');
            testResults.backgroundScript = 'pass';
            return true;
        } else if (response && response.error) {
            log(`Background script error: ${response.error}`, 'fail');
            testResults.backgroundScript = 'fail';
            return false;
        } else {
            log(`Invalid background script response: ${JSON.stringify(response)}`, 'fail');
            testResults.backgroundScript = 'fail';
            return false;
        }
        
    } catch (error) {
        log(`Background script communication error: ${error.message}`, 'fail');
        log('Common issues:', 'info');
        log('- Background script not loaded', 'info');
        log('- Extension permissions insufficient', 'info');
        log('- Background script errors', 'info');
        testResults.backgroundScript = 'fail';
        return false;
    }
}

async function testSentimentAnalysis() {
    updateProgress(4, 'Testing sentiment analysis...');
    log('\n=== SENTIMENT ANALYSIS TESTS ===');
    
    const testComments = [
        { text: "This is absolutely amazing! Great work everyone, I love it!", expected: 'positive', id: 'positive' },
        { text: "This is terrible garbage. You're stupid and this sucks.", expected: 'negative', id: 'negative' },
        { text: "This is a comment about the weather today.", expected: 'neutral', id: 'neutral' }
    ];
    
    testResults.sentimentTests = [];
    const api = runtimeEnv.api;
    
    for (let i = 0; i < testComments.length; i++) {
        const comment = testComments[i];
        updateProgress(5 + i, `Testing ${comment.expected} sentiment...`);
        
        await new Promise((resolve) => {
            log(`Testing ${comment.expected}: "${comment.text}"`);
            
            const timeout = setTimeout(() => {
                log(`Timeout for ${comment.expected} test`, 'fail');
                testResults.sentimentTests.push({ 
                    comment: comment.text, 
                    expected: comment.expected, 
                    sentiment: null, 
                    status: 'fail' 
                });
                document.getElementById(`${comment.id}-result`).innerHTML = '❌ Timeout';
                resolve();
            }, 15000);
            
            const handleResponse = (response) => {
                clearTimeout(timeout);
                
                if (response && typeof response.sentiment === 'number') {
                    const sentiment = response.sentiment;
                    const source = response.source || 'unknown';
                    log(`${comment.expected} sentiment: ${sentiment} (source: ${source})`);
                    
                    const isModelSource = !FALLBACK_SOURCES.has(source);
                    const isDefaultValue = sentiment === 0.5 || sentiment === 0 || sentiment === 1;
                    const isNonDefault = isModelSource || !isDefaultValue;
                    
                    if (!isNonDefault) {
                        log(`Warning: Sentiment ${sentiment} appears to be a fallback/default value (${source})`, 'warn');
                    }
                    
                    let status = 'pass';
                    let statusIcon = '✅';
                    
                    if (comment.expected === 'positive' && sentiment < 0.6) {
                        status = 'warn';
                        statusIcon = '⚠️';
                    } else if (comment.expected === 'negative' && sentiment > 0.4) {
                        status = 'warn';
                        statusIcon = '⚠️';
                    } else if (comment.expected === 'neutral' && (sentiment < 0.3 || sentiment > 0.7)) {
                        status = 'warn';
                        statusIcon = '⚠️';
                    }
                    
                    if (!isNonDefault) {
                        status = 'warn';
                        statusIcon = '⚠️';
                    }
                    
                    testResults.sentimentTests.push({ 
                        comment: comment.text, 
                        expected: comment.expected, 
                        sentiment: sentiment, 
                        status: status,
                        isNonDefault: isNonDefault,
                        source
                    });
                    
                    document.getElementById(`${comment.id}-result`).innerHTML = 
                        `${statusIcon} Sentiment: ${sentiment.toFixed(3)} • Source: ${source}`;
                    
                    log(`${comment.expected} test: ${status.toUpperCase()}`, status);
                } else {
                    log(`Invalid response for ${comment.expected}: ${JSON.stringify(response)}`, 'fail');
                    testResults.sentimentTests.push({ 
                        comment: comment.text, 
                        expected: comment.expected, 
                        sentiment: null, 
                        status: 'fail' 
                    });
                    document.getElementById(`${comment.id}-result`).innerHTML = '❌ Invalid response';
                }
                
                resolve();
            };
            
            const handleError = (error) => {
                clearTimeout(timeout);
                log(`Error testing ${comment.expected}: ${error.message}`, 'fail');
                testResults.sentimentTests.push({ 
                    comment: comment.text, 
                    expected: comment.expected, 
                    sentiment: null, 
                    status: 'fail' 
                });
                document.getElementById(`${comment.id}-result`).innerHTML = '❌ Error';
                resolve();
            };
            
            try {
                if (runtimeEnv.type === 'firefox') {
                    // Firefox Promise-based
                    api.runtime.sendMessage({
                        action: "analyzeComment",
                        comment: comment.text,
                        hash: `test_${comment.id}`
                    }).then(handleResponse).catch(handleError);
                } else {
                    // Chrome callback-based
                    api.runtime.sendMessage({
                        action: "analyzeComment",
                        comment: comment.text,
                        hash: `test_${comment.id}`
                    }, (response) => {
                        if (api.runtime.lastError) {
                            handleError(new Error(api.runtime.lastError.message));
                        } else {
                            handleResponse(response);
                        }
                    });
                }
            } catch (error) {
                handleError(error);
            }
        });
    }
}

async function runFullTest() {
    clearLog();
    log('🚀 Starting OnlyLikes Comprehensive Test Suite...\n');
    
    try {
        // Step 1: Browser Detection
        const browserType = await detectBrowser();
        if (!browserType || browserType.includes('fail')) {
            log('❌ Browser compatibility test failed. Cannot continue.', 'fail');
            updateSummary();
            return;
        }
        
        // Step 2: AI API Test
        let aiResult = false;
        if (browserType === 'chrome' || browserType === 'chrome-standalone') {
            aiResult = await testChromeAI();
        } else if (browserType === 'firefox' || browserType === 'firefox-standalone') {
            aiResult = await testFirefoxAI();
        }
        
        // Step 3: Background Script Test
        const backgroundResult = await testBackgroundScript();
        
        // Step 4-7: Sentiment Analysis Tests
        if (backgroundResult) {
            await testSentimentAnalysis();
        } else {
            log('Skipping sentiment tests due to background script failure', 'warn');
        }
        
        // Final Summary
        updateProgress(8, 'Generating final report...');
        log('\n=== FINAL REPORT ===');
        
        const passedTests = testResults.sentimentTests.filter(t => t.status === 'pass').length;
        const nonDefaultCount = testResults.sentimentTests.filter(t => t.isNonDefault).length;
        
        log(`Runtime Environment: ${runtimeEnv.type.toUpperCase()}`);
        log(`Browser Compatibility: ${testResults.browser === 'pass' ? 'PASS' : testResults.browser === 'warn' ? 'WARN' : 'FAIL'}`);
        log(`AI API Availability: ${testResults.aiApi === 'pass' ? 'PASS' : 'FAIL'}`);
        log(`Background Script: ${testResults.backgroundScript === 'pass' ? 'PASS' : 'FAIL'}`);
        log(`Sentiment Tests Passed: ${passedTests}/${testResults.sentimentTests.length}`);
        log(`Non-default Sentiment Values: ${nonDefaultCount}/${testResults.sentimentTests.length}`);
        
        updateSummary();
        
        if (testResults.overall === 'pass') {
            log('\n🎉 ALL TESTS PASSED! OnlyLikes is ready to use.', 'pass');
        } else if (testResults.overall === 'partial') {
            log('\n⚠️ PARTIAL SUCCESS. Some functionality may be limited.', 'warn');
        } else {
            log('\n❌ TESTS FAILED. OnlyLikes may not function properly.', 'fail');
        }
        
        // Provide specific guidance based on runtime environment
        if (runtimeEnv.type === 'standalone') {
            log('\n💡 TROUBLESHOOTING:', 'info');
            log('• Load this page from within the browser extension', 'info');
            log('• Or access via chrome-extension://[ext-id]/comprehensive-test.html', 'info');
            log('• Or access via moz-extension://[ext-id]/comprehensive-test.html', 'info');
        }
        
    } catch (error) {
        log(`❌ Test suite error: ${error.message}`, 'fail');
        updateSummary();
    }
}

async function runQuickTest() {
    clearLog();
    log('⚡ Running Quick Sentiment Test...\n');
    
    const browserType = await detectBrowser();
    if (!browserType) return;
    
    const backgroundResult = await testBackgroundScript();
    if (!backgroundResult) return;
    
    await testSentimentAnalysis();
    updateSummary();
}

function exportResults() {
    const results = document.getElementById('results').textContent;
    const blob = new Blob([results], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onlylikes-test-results-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Event listeners
    document.getElementById('runFullTest').onclick = runFullTest;
    document.getElementById('runQuickTest').onclick = runQuickTest;
    document.getElementById('clearResults').onclick = clearLog;
    document.getElementById('exportResults').onclick = exportResults;
    
    // Auto-run quick test on load
    log('🔍 OnlyLikes Comprehensive Test Suite loaded');
    log(`Runtime Environment: ${runtimeEnv.type}`);
    if (runtimeEnv.type === 'standalone') {
        log('⚠️ Not running as extension - some tests may fail', 'warn');
    }
    log('💡 Click "Run Full Test Suite" for complete validation');
    log('⚡ Click "Quick Sentiment Test" for fast sentiment analysis check\n');
    const testPageUrl = runtimeEnv.api?.runtime?.getURL?.('comprehensive-test.html');
    if (testPageUrl) {
        log(`🔗 Direct URL: ${testPageUrl}`, 'info');
    } else {
        log('🔒 Load this page from the extension options menu for full access.', 'info');
    }
});
