'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const browser=fs.readFileSync('web/index.html','utf8');
const android=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const moduleWeb=fs.readFileSync('web/assistant.js','utf8');
const moduleAndroid=fs.readFileSync('app/src/main/assets/web/assistant.js','utf8');
const native=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
assert.equal(browser,android,'Browser and Android WebView HTML must stay identical');
assert.equal(moduleWeb,moduleAndroid,'Browser and Android assistant modules must stay identical');
new Function(browser.split('<script>')[1].split('</script>')[0]);
new Function(moduleWeb);
assert(browser.includes('window.BoreLabAssistantBridge={state:'),'Core API bridge missing');
assert(browser.includes('<script src="./assistant.js"></script>'),'Assistant script not loaded');
for(const phrase of ['Morning Briefing','Do I have enough pipe?','What needs attention?', "What's on the agenda?",'Quick glance at mud inventory',"What's the closest shot to me?",'End with the shortest shot','End with the shot closest to shop','Show me the next job site']){
 assert(moduleWeb.includes(phrase), 'Missing assistant workflow: '+phrase);
}
for(const phrase of ['api().getPosition()','api().orderedShots()','api().pipeOnTruck()','api().mudConfig()','api().mudAvailable','state.askMyCrewId','s.askNextJobId','window.borelabVoiceResult','window.borelabHandleBack']){
 assert(moduleWeb.includes(phrase),'Missing feature: '+phrase);
}
assert(native.includes('RecognizerIntent.ACTION_RECOGNIZE_SPEECH'));
assert(native.includes('@JavascriptInterface public void startVoiceCommand()'));
assert(native.includes('JSONObject.quote(transcript)'));
console.log('Ask BoreLab assistant integration and voice checks passed');
