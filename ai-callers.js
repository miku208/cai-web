// ============================================
// AI CALLERS - ChatEverywhere, Gemini, Neosantara, Ryuu, Custom
// ============================================

async function callRyuuAPI(systemPrompt, historyMessages, userMessage, apiKey, modelName, packageUrl) {
    let contextHistory = '';
    if (historyMessages && historyMessages.length > 0) {
        const recentHistory = historyMessages.slice(-6);
        contextHistory = recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    }
    const textWithContext = contextHistory ? `${contextHistory}\nUser: ${userMessage}` : userMessage;
    const apiUrl = packageUrl || 'https://api.ryuu-dev.my.id/ai/gemini/chat';

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-RYUU-APIKEY': apiKey },
        body: JSON.stringify({ text: textWithContext, prompt: systemPrompt, model: modelName || 'gemini-2.5-flash' })
    });
    if (!response.ok) { const err = await response.text(); throw new Error(`Ryuu ${response.status}: ${err.substring(0, 200)}`); }
    const data = await response.json();
    if (data.result?.response) return data.result.response;
    if (data.result?.text) return data.result.text;
    if (data.response) return data.response;
    if (data.text) return data.text;
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
}

async function callChatEverywhere(systemPrompt, historyMessages, userMessage, packageUrl) {
    const messages = [{ role: 'system', content: systemPrompt }];
    if (historyMessages?.length) { for (const msg of historyMessages) { messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }); } }
    messages.push({ role: 'user', content: userMessage });
    const apiUrl = packageUrl || 'https://chateverywhere.app/api/chat/';

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ model: { id: 'gpt-4', name: 'GPT-4', maxLength: 32000, tokenLimit: 8000, completionTokenLimit: 5000, deploymentName: 'gpt-4' }, messages, prompt: systemPrompt, temperature: 0.55 })
    });
    if (!response.ok) { const err = await response.text(); throw new Error(`ChatEverywhere ${response.status}`); }
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) { try { const d = await response.json(); if (d.choices?.[0]?.message?.content) return d.choices[0].message.content; if (d.response) return d.response; if (d.result) return d.result; } catch (e) {} }
    const text = await response.text(); if (text?.trim()) return text;
    throw new Error('ChatEverywhere empty');
}

async function callGeminiAPI(systemPrompt, historyMessages, userMessage, apiKey) {
    const contents = [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: 'Understood.' }] }];
    if (historyMessages?.length) { for (const msg of historyMessages) { contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }); } }
    contents.push({ role: 'user', parts: [{ text: userMessage }] });
    for (let a = 1; a <= 3; a++) {
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1000, topP: 0.95, topK: 40 } }) });
            if (r.status === 429) { const ed = await r.json().catch(() => ({})); if (ed?.error?.message?.includes('quota')) throw new Error('Gemini quota'); await new Promise(r => setTimeout(r, a * 3000)); continue; }
            if (!r.ok) { if (a < 3) { await new Promise(r => setTimeout(r, 2000)); continue; } throw new Error(`Gemini ${r.status}`); }
            const d = await r.json(); if (d.error) throw new Error(d.error.message);
            if (d.candidates?.[0]?.content?.parts?.[0]?.text) return d.candidates[0].content.parts[0].text;
            return 'Sorry, could not generate.';
        } catch (e) { if (a === 3 || e.message?.includes('quota')) throw e; await new Promise(r => setTimeout(r, 2000)); }
    }
    throw new Error('Gemini failed');
}

async function callNeosantara(systemPrompt, historyMessages, userMessage, apiKey, modelName) {
    const messages = [{ role: 'system', content: systemPrompt }];
    if (historyMessages?.length) { for (const msg of historyMessages) { messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }); } }
    messages.push({ role: 'user', content: userMessage });
    const r = await fetch('https://api.neosantara.xyz/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model: modelName || 'gemini-3-flash', messages, temperature: 0.5, max_tokens: 1300 }) });
    if (!r.ok) { const e = await r.text(); throw new Error(`Neosantara ${r.status}`); }
    const d = await r.json(); if (d.choices?.[0]?.message?.content) return d.choices[0].message.content; if (d.response) return d.response;
    return JSON.stringify(d);
}

async function callGenericURL(url, systemPrompt, historyMessages, userMessage, apiKey) {
    const messages = [{ role: 'system', content: systemPrompt }];
    if (historyMessages?.length) { for (const msg of historyMessages) { messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }); } }
    messages.push({ role: 'user', content: userMessage });
    const fp = systemPrompt + '\n\n' + (historyMessages || []).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\nUser: ' + userMessage + '\nAssistant:';
    const h = { 'Content-Type': 'application/json', 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' }; if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    try { const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({ messages, prompt: systemPrompt, text: fp, message: userMessage, model: 'gpt-3.5-turbo' }) }); if (r.ok) { const ct = r.headers.get('content-type') || ''; if (ct.includes('application/json')) { const d = await r.json(); if (d.choices?.[0]?.message?.content) return d.choices[0].message.content; if (d.result) return d.result; } return await r.text(); } } catch (e) {}
    const gr = await fetch(`${url}?text=${encodeURIComponent(fp)}`); if (!gr.ok) throw new Error(`GET ${gr.status}`);
    const ct = gr.headers.get('content-type') || ''; if (ct.includes('application/json')) { const d = await gr.json(); return d.result || d.response || d.message || JSON.stringify(d); } return await gr.text();
}

async function getPackageById(supabase, packageId) {
    if (!packageId) return null;
    try { const { data, error } = await supabase.from('ai_packages').select('*').eq('id', packageId).single(); if (error) return null; return data; } catch (e) { return null; }
}

async function callAI(supabase, systemPrompt, historyMessages, userMessage, characterEndpoint, packageId, charModelName) {
    const pkg = await getPackageById(supabase, packageId);
    let endpoint = characterEndpoint, apiKey = null;
    if (pkg) { endpoint = pkg.url || endpoint; apiKey = pkg.api_key || null; }

    if (endpoint?.includes('neosantara')) { try { const r = await callNeosantara(systemPrompt, historyMessages, userMessage, apiKey, charModelName || 'gpt-3.5-turbo'); if (r?.trim()) return { response: r.trim(), source: 'Neosantara' }; } catch (e) { try { const r = await callChatEverywhere(systemPrompt, historyMessages, userMessage); if (r?.trim()) return { response: r.trim(), source: 'ChatEverywhere (fallback)' }; } catch (fb) {} throw e; } }
    if (endpoint === 'gemini' || endpoint?.includes('generativelanguage')) { const k = apiKey || (endpoint?.includes(':') ? endpoint.split(':')[1] : null); if (!k) throw new Error('Gemini key required'); try { const r = await callGeminiAPI(systemPrompt, historyMessages, userMessage, k); if (r?.trim()) return { response: r.trim(), source: 'Gemini' }; } catch (e) { if (!e.message?.includes('quota')) { try { const r = await callChatEverywhere(systemPrompt, historyMessages, userMessage); if (r?.trim()) return { response: r.trim(), source: 'ChatEverywhere (fallback)' }; } catch (fb) {} } throw e; } }
    if (endpoint?.includes('ryuu')) { const k = apiKey || (endpoint?.includes(':') ? endpoint.split(':')[1] : null); if (!k) throw new Error('Ryuu key required'); try { const r = await callRyuuAPI(systemPrompt, historyMessages, userMessage, k, charModelName || pkg?.model_name || 'gemini-2.5-flash', pkg?.url || null); if (r?.trim()) return { response: r.trim(), source: 'Ryuu Gemini' }; } catch (e) { try { const r = await callChatEverywhere(systemPrompt, historyMessages, userMessage); if (r?.trim()) return { response: r.trim(), source: 'ChatEverywhere (fallback)' }; } catch (fb) {} throw e; } }
    if (!endpoint || endpoint === 'chateverywhere' || endpoint?.includes('chateverywhere')) { try { const r = await callChatEverywhere(systemPrompt, historyMessages, userMessage, pkg?.url || null); if (r?.trim()) return { response: r.trim(), source: 'ChatEverywhere' }; } catch (e) { if (apiKey) { try { const r = await callGeminiAPI(systemPrompt, historyMessages, userMessage, apiKey); if (r?.trim()) return { response: r.trim(), source: 'Gemini (fallback)' }; } catch (fb) {} } throw e; } }
    try { const r = await callGenericURL(endpoint, systemPrompt, historyMessages, userMessage, apiKey); if (r?.trim()) return { response: r.trim(), source: 'Custom' }; } catch (e) {}
    try { const r = await callChatEverywhere(systemPrompt, historyMessages, userMessage); if (r?.trim()) return { response: r.trim(), source: 'ChatEverywhere (final)' }; } catch (e) {}
    throw new Error('All AI endpoints failed.');
}

module.exports = { callAI };