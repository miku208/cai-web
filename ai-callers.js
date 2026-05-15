// ============================================
// AI CALLERS - Universal untuk text (fetch ke URL package) + Google Gemini Vision
// Auto-switch ke Vision hanya saat ada gambar
// ============================================

// ============ GOOGLE GEMINI VISION (Butuh API Key dari Google AI Studio) ============
async function callGoogleGeminiVision(systemPrompt, userMessage, imageUrl, apiKey, modelName) {
    console.log('🔮 Calling Google Gemini Vision...');
    console.log(`   Model: ${modelName}`);
    
    if (!apiKey || !apiKey.startsWith('AIzaSy')) {
        throw new Error('Google Vision membutuhkan API key yang valid (AIzaSy...)');
    }
    
    try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
        
        console.log(`   Image: ${mimeType}, ${Math.round(imageBuffer.byteLength / 1024)}KB`);
        
        const contents = [
            {
                role: "user",
                parts: [
                    { text: systemPrompt + "\n\n" + (userMessage || "Deskripsikan gambar ini secara detail dalam bahasa Indonesia.") },
                    { inline_data: { mime_type: mimeType, data: base64Image } }
                ]
            }
        ];
        
        const visionModel = modelName || 'gemini-2.0-flash-exp';
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048, topP: 0.95, topK: 40 },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini Vision API: ${errorData.error?.message || response.status}`);
        }
        
        const data = await response.json();
        
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.log('✅ Google Gemini Vision success!');
            return data.candidates[0].content.parts[0].text;
        }
        
        return "Maaf, saya tidak bisa menganalisis gambar ini.";
    } catch (error) {
        console.error('❌ Google Gemini Vision error:', error.message);
        throw error;
    }
}

// ============ UNIVERSAL API CALL (Untuk text biasa - fetch ke URL package) ============
async function callUniversalAPI(systemPrompt, historyMessages, userMessage, apiUrl, apiKey, modelName) {
    console.log(`🌐 Calling Universal API: ${apiUrl}`);
    console.log(`   API Key: ${apiKey ? 'ada' : 'null'}`);
    console.log(`   Model: ${modelName || 'default'}`);
    
    // Build context dari history
    let contextHistory = '';
    if (historyMessages && historyMessages.length > 0) {
        const recentHistory = historyMessages.slice(-6);
        contextHistory = recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    }
    
    // Gabungkan system prompt + context + user message
    let fullText = systemPrompt;
    if (contextHistory) {
        fullText += '\n\n' + contextHistory;
    }
    fullText += '\n\nUser: ' + userMessage + '\n\nAssistant:';
    
    const encodedText = encodeURIComponent(fullText);
    
    // Coba dengan method GET dulu
    try {
        const getResponse = await fetch(`${apiUrl}?text=${encodedText}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            }
        });
        
        if (getResponse.ok) {
            const data = await getResponse.json();
            // Parse berbagai format response
            if (data.result) return data.result;
            if (data.response) return data.response;
            if (data.message) return data.message;
            if (data.text) return data.text;
            if (data.content) return data.content;
            if (typeof data === 'string') return data;
            return JSON.stringify(data);
        }
    } catch (e) {
        console.log('   GET method failed, trying POST...');
    }
    
    // Coba dengan method POST
    try {
        const postResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            },
            body: JSON.stringify({
                text: userMessage,
                messages: historyMessages,
                prompt: systemPrompt,
                model: modelName || 'gemini-2.5-flash'
            })
        });
        
        if (postResponse.ok) {
            const data = await postResponse.json();
            if (data.result) return data.result;
            if (data.response) return data.response;
            if (data.message) return data.message;
            if (data.text) return data.text;
            if (data.content) return data.content;
            if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
            if (typeof data === 'string') return data;
            return JSON.stringify(data);
        }
    } catch (e) {
        console.log('   POST method failed:', e.message);
    }
    
    throw new Error(`Universal API failed for URL: ${apiUrl}`);
}

// ============ FALLBACK: ChatEverywhere ============
async function callChatEverywhere(systemPrompt, historyMessages, userMessage) {
    console.log('🔄 Final fallback to ChatEverywhere...');
    
    const messages = [{ role: 'system', content: systemPrompt }];
    if (historyMessages?.length) {
        for (const msg of historyMessages) {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
        }
    }
    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('https://chateverywhere.app/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
            model: { id: 'gpt-4', name: 'GPT-4', maxLength: 32000, tokenLimit: 8000, completionTokenLimit: 5000, deploymentName: 'gpt-4' },
            messages,
            prompt: systemPrompt,
            temperature: 0.55
        })
    });
    
    if (!response.ok) throw new Error(`ChatEverywhere ${response.status}`);
    
    const text = await response.text();
    if (text?.trim()) return text;
    throw new Error('ChatEverywhere empty');
}

// ============ GET PACKAGE BY ID ============
async function getPackageById(supabase, packageId) {
    if (!packageId) return null;
    
    try {
        const { data, error } = await supabase
            .from('ai_packages')
            .select('*')
            .eq('id', packageId)
            .single();
        
        if (error) return null;
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📦 PACKAGE: ${data.name}`);
        console.log(`   URL: ${data.url}`);
        console.log(`   Model: ${data.model_name || 'default'}`);
        console.log(`   API Key: ${data.api_key ? 'ada' : 'null (tanpa auth)'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return data;
    } catch (e) {
        return null;
    }
}

// ============ GET VISION PACKAGE ============
async function getVisionPackage(supabase) {
    const { data, error } = await supabase
        .from('ai_packages')
        .select('*')
        .eq('name', 'gemini-vision')
        .single();
    
    if (error || !data) {
        console.log('⚠️ Package "gemini-vision" tidak ditemukan');
        return null;
    }
    
    if (!data.api_key) {
        console.log('⚠️ Package "gemini-vision" tidak memiliki API key');
        return null;
    }
    
    console.log(`📦 VISION PACKAGE: ${data.name}`);
    return data;
}

// ============ MAIN CALL AI FUNCTION ============
async function callAI(supabase, systemPrompt, historyMessages, userMessage, characterEndpoint, packageId, charModelName, hasImage = false, imageUrl = null) {
    console.log('\n🎯 callAI CALLED');
    console.log(`   hasImage: ${hasImage}`);
    console.log(`   packageId: ${packageId}`);
    
    // ============ JIKA ADA GAMBAR, PAKAI GOOGLE GEMINI VISION ============
    if (hasImage && imageUrl) {
        console.log('\n📷 IMAGE DETECTED - Switching to Google Gemini Vision...');
        
        const visionPackage = await getVisionPackage(supabase);
        
        if (visionPackage && visionPackage.api_key) {
            try {
                const visionResult = await callGoogleGeminiVision(
                    systemPrompt, 
                    userMessage, 
                    imageUrl, 
                    visionPackage.api_key, 
                    visionPackage.model_name || 'gemini-2.0-flash-exp'
                );
                if (visionResult?.trim()) {
                    console.log('✅ Google Gemini Vision SUCCESS!');
                    return { 
                        response: visionResult.trim(), 
                        source: `Gemini Vision (${visionPackage.name})` 
                    };
                }
            } catch (e) {
                console.log('❌ Vision failed:', e.message);
            }
        } else {
            console.log('⚠️ Package "gemini-vision" tidak ditemukan atau tidak memiliki API key');
        }
        
        return {
            response: "Maaf, saya tidak bisa menganalisis gambar saat ini. Silakan buat package 'gemini-vision' dengan API key dari Google AI Studio. 📷",
            source: 'Vision Failed'
        };
    }
    
    // ============ TEXT MODE - PAKAI URL DARI PACKAGE ============
    console.log('\n📝 TEXT MODE - Using package URL...');
    
    const pkg = await getPackageById(supabase, packageId);
    
    if (!pkg || !pkg.url) {
        console.log('⚠️ Package tidak ditemukan atau tidak memiliki URL');
        const fallbackResult = await callChatEverywhere(systemPrompt, historyMessages, userMessage);
        return { response: fallbackResult, source: 'ChatEverywhere (fallback)' };
    }
    
    const apiUrl = pkg.url;
    const apiKey = pkg.api_key || null;
    const modelName = pkg.model_name || charModelName || 'gemini-2.5-flash';
    
    console.log(`   URL: ${apiUrl}`);
    console.log(`   API Key: ${apiKey ? 'ada' : 'null'}`);
    console.log(`   Model: ${modelName}`);
    
    // Panggil universal API sesuai URL package
    try {
        const result = await callUniversalAPI(systemPrompt, historyMessages, userMessage, apiUrl, apiKey, modelName);
        if (result?.trim()) {
            console.log('✅ Universal API SUCCESS!');
            return { response: result.trim(), source: `${pkg.name}` };
        }
    } catch (e) {
        console.log('❌ Universal API failed:', e.message);
    }
    
    // Fallback ke ChatEverywhere
    console.log('🔄 Fallback to ChatEverywhere...');
    const fallbackResult = await callChatEverywhere(systemPrompt, historyMessages, userMessage);
    return { response: fallbackResult, source: 'ChatEverywhere (final)' };
}

module.exports = { callAI };
