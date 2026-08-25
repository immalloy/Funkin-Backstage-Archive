
    let currentUser = null;
    (async () => {
        const profileButton = document.getElementById('profile-icon-btn');
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API}/me`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({}) }).catch(() => null);
        if (res?.ok) {
            currentUser = await res.json();
            profileButton.src = `${API}/avatars/${currentUser.id}.png`;
            profileButton.onload = () => {
                profileButton.style.borderRadius = '50%';
                profileButton.style.objectFit = 'cover';
                profileButton.style.border = '2px solid #E1E1E1';
            };
            profileButton.onerror = () => {
                profileButton.onerror = null;
                profileButton.src = '../icon-profile-out.png';
            };
            document.getElementById('notif-wrap').style.display = 'block';
            loadNotifs();
        }
    })();

    const avatarCache = new Map();
    const userCache   = new Map();

    async function getUser(userId) {
        if (!userCache.has(userId)) {
            const userRequest = fetch(`${API}/users/${userId}`)
                .then(r => {
                    if (!r.ok) throw new Error(`User lookup failed: ${r.status}`);
                    return r.json();
                })
                .then(user => user?.id != null && user.username ? user : { id: userId, username: '?' })
                .catch(() => ({ id: userId, username: '?' }));
            const avatarRequest = fetch(`${API}/avatars/${userId}.png`, { method: 'HEAD' }).catch(() => ({ ok: false }));
            const [u, avatar] = await Promise.all([userRequest, avatarRequest]);
            userCache.set(userId, u);
            avatarCache.set(userId, avatar.ok);
        }
        return userCache.get(userId);
    }

    function getAvatarSrc(userId) {
        return avatarCache.get(userId) ? `${API}/avatars/${userId}.png` : '../icon-profile-out.png';
    }

    let stickerListPromise = null;
    const modMetaCache = new Map();

    function getModMeta(id) {
        if (!modMetaCache.has(id)) {
            modMetaCache.set(id, fetch(`${API}/submissions/${id}/meta.json`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null));
        }
        return modMetaCache.get(id);
    }

    async function renderModLinks(content) {
        const linkPattern = /https?:\/\/(?:www\.)?funkinbackstage\.com\/mods\/(\d+)/gi;
        const matches = [...content.matchAll(linkPattern)];
        if (!matches.length) return content;

        const metas = await Promise.all(matches.map(match => getModMeta(match[1])));
        let output = '';
        let lastIndex = 0;
        matches.forEach((match, index) => {
            const meta = metas[index];
            output += content.slice(lastIndex, match.index);
            if (!meta) {
                output += match[0];
            } else {
                const icon = /^https?:\/\//i.test(meta.icon || '')
                    ? `<img class="chat-mod-link-icon" src="${escapeHTML(meta.icon)}" alt="">`
                    : '';
                output += `<a class="chat-mod-link" href="https://funkinbackstage.com/mods/${match[1]}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHTML(meta.title || `Mod #${match[1]}`)}">${icon}<span>${escapeHTML(meta.title || `Mod #${match[1]}`)}</span></a>`;
            }
            lastIndex = match.index + match[0].length;
        });
        return output + content.slice(lastIndex);
    }

    function getStickers() {
        if (!stickerListPromise) {
            stickerListPromise = fetch(`${API}/stickers`)
                .then(r => {
                    if (!r.ok) throw new Error(`Sticker lookup failed: ${r.status}`);
                    return r.json();
                })
                .then(files => (Array.isArray(files) ? files : []).map(f => `${f}`.replace('.png', ''))
            ).catch(error => {
                stickerListPromise = null;
                console.warn('Stickers unavailable:', error);
                return [];
            });
        }
        return stickerListPromise;
    }

    const scrollEl = document.getElementById('chat-scroll');
    const track = document.getElementById('scroll-track');
    const thumb = document.getElementById('scroll-thumb');

    let thumbFrame = 0;
    function updateThumb() {
        if (thumbFrame) return;
        thumbFrame = requestAnimationFrame(() => {
            thumbFrame = 0;
            const trackH = track.clientHeight;
            const thumbH = thumb.offsetHeight;
            const scrollRange = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 0);
            const thumbRange = Math.max(trackH - thumbH, 0);
            const thumbTop = scrollRange ? (scrollEl.scrollTop / scrollRange) * thumbRange : 0;
            thumb.style.top = Math.min(thumbRange, Math.max(0, thumbTop)) + 'px';
        });
    }

    scrollEl.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);

    let dragging = false, startY = 0, startScrollTop = 0;

    function startDrag(e) {
        if (e.button !== undefined && e.button !== 0) return;
        dragging = true;
        startY = e.clientY;
        startScrollTop = scrollEl.scrollTop;
        thumb.setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function moveDrag(e) {
        if (!dragging) return;
        const thumbRange = Math.max(track.clientHeight - thumb.offsetHeight, 1);
        const scrollRange = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 0);
        const nextScrollTop = startScrollTop + ((e.clientY - startY) / thumbRange) * scrollRange;
        scrollEl.scrollTop = Math.max(0, Math.min(scrollRange, nextScrollTop));
        e.preventDefault();
    }

    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        if (thumb.hasPointerCapture(e.pointerId)) thumb.releasePointerCapture(e.pointerId);
    }

    thumb.addEventListener('pointerdown', startDrag);
    thumb.addEventListener('pointermove', moveDrag);
    thumb.addEventListener('pointerup', endDrag);
    thumb.addEventListener('pointercancel', endDrag);

    track.addEventListener('click', e => {
        if (e.target === thumb) return;
        const rect = track.getBoundingClientRect();
        const thumbRange = Math.max(track.clientHeight - thumb.offsetHeight, 1);
        const scrollRange = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 0);
        const ratio = (e.clientY - rect.top - thumb.offsetHeight / 2) / thumbRange;
        scrollEl.scrollTop = Math.max(0, Math.min(1, ratio)) * scrollRange;
    });

    function escapeHTML(text) {
        return String(text ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }

    function normalize(str) {
        return str.toLowerCase()
            .replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e')
            .replace(/4/g,'a').replace(/5/g,'s').replace(/8/g,'b')
            .replace(/@/g,'a').replace(/\$/g,'s').replace(/[^a-z]/g,'');
    }

    async function buildMessageHTML(message, grouped = false) {
        const stickerList = await getStickers();
        const user = await getUser(message.poster);
        const hasAvatar = avatarCache.get(user.id);
        const avatarSrc = getAvatarSrc(user.id);
        let content = escapeHTML(`${message.contents}`.trim());
        const stickerOnly = content.startsWith(':') && content.endsWith(':');
        for (const sticker of stickerList) {
            content = content.replaceAll(`:${sticker}:`, `<img src="${API}/stickers/${sticker}.png" style="height:${stickerOnly ? '13' : '5'}vh;vertical-align:middle;${stickerOnly ? '' : 'margin:1vh;margin-top:0.5vh;'}"/>`);
        }
        content = await renderModLinks(content);
        content = content.replace(/@([A-Za-z0-9_]{1,32})/gi, (match, username) => {
            const uid = getUserIdByName(username);
            if (uid) return `<span style="color:#5082ff;cursor:pointer;" onclick="goToUserProfile(${uid})" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">@${username}</span>`;
            return match;
        });
        const isMentioned = currentUser && new RegExp(`@${currentUser.username}`, 'i').test(message.contents);
        const hasMention = /@[A-Za-z0-9_]+/.test(message.contents);
        const highlightStyle = isMentioned
            ? 'background:rgba(80,130,255,0.15);border-left:3px solid #5082ff;border-radius:0.4rem;padding:0.3rem 0.6rem;margin:-0.3rem -0.6rem;'
            : hasMention
                ? 'background:rgba(150,150,150,0.18);border-left:3px solid #999;border-radius:0.4rem;padding:0.3rem 0.6rem;margin:-0.3rem -0.6rem;'
                : '';

        if (grouped) {
            return `<div data-poster="${message.poster}" style="display:flex;flex-direction:column;align-items:flex-start;justify-content:start;margin-top:calc(-2vh + 0.2vh);${highlightStyle}">
                <h1 style="font-family:'FunkinOptions',sans-serif;font-size:4vh;margin:0;display:flex;align-items:center;font-weight:normal">${content}</h1>
            </div>`;
        }

        const chatBadges = [];
        if (user.id === 2) chatBadges.push({ src: 'https://files.funkinbackstage.com/badges/owner-badge.png', tip: 'Site Owner' });
        else if (user.isAdmin) chatBadges.push({ src: 'https://files.funkinbackstage.com/badges/mod-badge.png', tip: 'Site Moderator' });
        if (user.ogMember) chatBadges.push({ src: 'https://files.funkinbackstage.com/badges/og-badge.png', tip: 'Pre-Release Member' });
        if (user.verified) chatBadges.push({ src: 'https://files.funkinbackstage.com/badges/verified-badge.png', tip: 'Verified' });
        const badgeHTML = chatBadges.map(b => `<span class="badge-wrap" data-tip="${b.tip}" style="margin-top:0; position:relative; top: 0.4vh;"><img src="${b.src}" style="height:2.5vh;display:block;" draggable="false"></span>`).join('');
        return `<div data-poster="${message.poster}" style="display:flex;flex-direction:column;align-items:flex-start;gap:0rem;justify-content:start;${highlightStyle}">
            <div style="display:flex;justify-content:flex-start;align-items:center;gap:0.5vw">
                <div style="position:relative;height:4vh;width:4vh;flex-shrink:0;">
                    <img src="${avatarSrc}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:${hasAvatar ? '3.5' : '4'}vh;width:${hasAvatar ? '3.5' : '4'}vh;border-radius:50%;object-fit:cover;"/>
                    ${hasAvatar ? `<img src="../icon-profile-in.png" style="position:absolute;top:0;left:0;height:4vh;width:4vh;"/>` : ''}
                </div>
                <div style="display:flex;align-items:baseline;gap:0.5vw">
                    <button class="chat-username" onclick="goToUserProfile(${user.id})" style="margin:0;">${escapeHTML(user.username)}</button>
                    ${badgeHTML}
                    ${message.timestamp ? `<h1 style="font-family:'FunkinOptions',sans-serif;font-size:2vh;margin:0;color:#999;white-space:nowrap;">• ${new Date(message.timestamp).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',hour12:true}).toLowerCase()}</h1>` : ''}
                </div>
            </div>
            <h1 style="font-family:'FunkinOptions',sans-serif;font-size:4vh;margin:0;display:flex;align-items:center;font-weight:normal">${content}</h1>
        </div>`;
    }

    function scrollToBottom(box, andWaitForImages = false) {
        if (!andWaitForImages) { box.scrollTop = box.scrollHeight; updateThumb(); return; }
        const imgs = Array.from(box.querySelectorAll('img'));
        const pending = imgs.filter(img => !img.complete);
        if (!pending.length) { box.scrollTop = box.scrollHeight; updateThumb(); return; }
        let done = 0;
        const settle = () => { if (++done >= pending.length) { box.scrollTop = box.scrollHeight; updateThumb(); } };
        pending.forEach(img => { img.addEventListener('load', settle); img.addEventListener('error', settle); });
    }

    let updating = false;
    let historyLoaded = false;
    let historyRetryTimer = 0;

    function retryHistory() {
        if (historyLoaded || historyRetryTimer) return;
        historyRetryTimer = setTimeout(() => {
            historyRetryTimer = 0;
            updateTheMessages(true);
        }, 5000);
    }

    async function updateTheMessages(doScroll = false) {
        if (updating) return;
        updating = true;
        try {
            const response = await fetch(`${API}/chat/read`);
            if (!response.ok) throw new Error(`Chat history failed: ${response.status}`);
            const all = await response.json();
            if (!Array.isArray(all)) throw new Error('Chat history was not an array');
            const messages = all;
            const posterIds = [...new Set(messages.map(msg => msg.poster))];
            await Promise.all([getStickers(), ...posterIds.map(getUser)]);
            let out = '';
            let prevPoster = null;
            for (const msg of messages) {
                out += await buildMessageHTML(msg, msg.poster === prevPoster);
                prevPoster = msg.poster;
            }
            const box = document.getElementById('chat-scroll');
            box.innerHTML = out;
            historyLoaded = true;
            if (doScroll) scrollToBottom(box, true); else updateThumb();
        } catch (error) {
            console.error('Could not load chat history:', error);
            const loading = document.getElementById('chat-loading');
            if (loading) loading.textContent = 'Unable to load chat history. Retrying…';
            retryHistory();
        } finally { updating = false; }
    }

    async function appendMessage(message) {
        const box = document.getElementById('chat-scroll');
        const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
        const lastPoster = box.lastElementChild ? Number(box.lastElementChild.dataset.poster) : null;
        const html = await buildMessageHTML(message, lastPoster === message.poster);
        const div = document.createElement('div');
        div.innerHTML = html;
        const node = div.firstElementChild;
        box.appendChild(node);
        if (atBottom) scrollToBottom(box, true); else updateThumb();
    }

    if (!sessionStorage.getItem('chatSessionId'))
        sessionStorage.setItem('chatSessionId', Math.random().toString(36).slice(2));
    const chatSessionId = sessionStorage.getItem('chatSessionId');

    function pingServer() {
        fetch(`${API}/chat/ping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: chatSessionId }) });
    }
    pingServer();
    setInterval(pingServer, 5000);

    const countStream = new EventSource(`${API}/chat/count-stream`);
    countStream.onmessage = e => {
        document.getElementById('active-count').innerHTML = `<a style="color:#00FF00;">•</a> ${e.data} active`;
    };

    let ws = null;
    let wsReady = false;

    function connectWS() {
        const token = localStorage.getItem('token');
        const wsBase = API.replace(/^https?/, m => m === 'https' ? 'wss' : 'ws');
        const url = token ? `${wsBase}/chat/ws?token=${encodeURIComponent(token)}` : `${wsBase}/chat/ws`;
        ws = new WebSocket(url);

        ws.addEventListener('open', () => { wsReady = true; });
        ws.addEventListener('close', () => {
            wsReady = false;
            setTimeout(connectWS, 3000);
        });
        ws.addEventListener('error', () => ws.close());
        ws.addEventListener('message', e => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'message') appendMessage(msg.data);
            } catch {}
        });
    }

    function goToUserProfile(userId) {
        window.open(`https://funkinbackstage.com/users/${userId}`, '_blank');
    }

    function getUserIdByName(name) {
        name = name.toLowerCase();
        for (const user of userCache.values()) {
            if (user && user.username && user.username.toLowerCase() === name) return user.id;
        }
        return null;
    }

    async function goToOwnProfile() {
        const t = localStorage.getItem('token');
        if (!t) { window.location.href = '../login'; return; }
        const me = await fetch(`${API}/me`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }, body: JSON.stringify({}) }).then(r => r.ok ? r.json() : null).catch(() => null);
        if (me?.id) goToUserProfile(me.id);
    }

    function addSticker(id) {
        document.getElementById('chat-bar').value += `:${id}: `;
        toggleStickerBubble();
        document.getElementById('chat-bar').focus();
    }

    function toggleStickerBubble() {
        const bubble = document.getElementById('sticker-bubble');
        const isHidden = window.getComputedStyle(bubble).display === 'none';
        bubble.style.display = isHidden ? 'grid' : 'none';
    }

    document.addEventListener('click', e => {
        const bubble = document.getElementById('sticker-bubble');
        if (window.getComputedStyle(bubble).display === 'none') return;
        if (!bubble.contains(e.target) && !e.target.closest('[onclick="toggleStickerBubble()"]')) {
            bubble.style.display = 'none';
        }
    });

    let blacklistPromise = null;
    function getBlacklist() {
        if (!blacklistPromise) {
            blacklistPromise = fetch(`${API}/word-blacklist`).then(r => r.text()).then(raw =>
                raw.split('\n').map(w => normalize(w.trim())).filter(Boolean)
            ).catch(error => {
                blacklistPromise = null;
                throw error;
            });
        }
        return blacklistPromise;
    }

    const allowedChatChar = /[\x20-\x7E\p{Extended_Pictographic}\p{Emoji_Component}\p{Regional_Indicator}\u200D\uFE0E\uFE0F]/u;

    function filterChatText(text) {
        return [...String(text)].filter(char => allowedChatChar.test(char)).join('');
    }

    function filterChatInput(input) {
        const filtered = filterChatText(input.value);
        if (filtered !== input.value) input.value = filtered;
    }

    const chatInput = document.getElementById('chat-bar');
    const mentionSuggestions = document.getElementById('mention-suggestions');
    let mentionCandidates = [];
    let mentionIndex = 0;
    let mentionQuery = null;

    function getMentionContext() {
        const cursor = chatInput.selectionStart ?? chatInput.value.length;
        const beforeCursor = chatInput.value.slice(0, cursor);
        const match = beforeCursor.match(/(^|\s)@([A-Za-z0-9_]{0,32})$/);
        if (!match) return null;
        return {
            start: cursor - match[0].length + match[1].length,
            end: cursor,
            query: match[2].toLowerCase()
        };
    }

    function hideMentionSuggestions() {
        mentionCandidates = [];
        mentionIndex = 0;
        mentionQuery = null;
        mentionSuggestions.replaceChildren();
        mentionSuggestions.classList.remove('open');
    }

    function insertMention(username) {
        const context = getMentionContext();
        if (!context || !username) return;
        const replacement = `@${username} `;
        chatInput.value = chatInput.value.slice(0, context.start) + replacement + chatInput.value.slice(context.end);
        const cursor = context.start + replacement.length;
        chatInput.focus();
        chatInput.setSelectionRange(cursor, cursor);
        hideMentionSuggestions();
    }

    function updateMentionSuggestions() {
        const context = getMentionContext();
        if (!context) { hideMentionSuggestions(); return; }
        if (context.query !== mentionQuery) {
            mentionQuery = context.query;
            mentionIndex = 0;
        }

        const users = new Map();
        for (const user of userCache.values()) {
            if (user?.id && user.username) users.set(user.id, user);
        }
        if (currentUser?.id && currentUser.username) users.set(currentUser.id, currentUser);

        mentionCandidates = [...users.values()]
            .filter(user => user.username.toLowerCase().startsWith(context.query))
            .sort((a, b) => a.username.localeCompare(b.username))
            .slice(0, 8);
        if (!mentionCandidates.length) { hideMentionSuggestions(); return; }
        mentionIndex = Math.min(mentionIndex, mentionCandidates.length - 1);

        mentionSuggestions.replaceChildren();
        mentionCandidates.forEach((user, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = `mention-option${index === mentionIndex ? ' selected' : ''}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', index === mentionIndex ? 'true' : 'false');
            option.textContent = `@${user.username}`;
            option.onpointerdown = event => { event.preventDefault(); insertMention(user.username); };
            mentionSuggestions.append(option);
        });
        mentionSuggestions.classList.add('open');
        mentionSuggestions.children[mentionIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function handleChatKeydown(event) {
        if (mentionSuggestions.classList.contains('open')) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                mentionIndex = (mentionIndex + 1) % mentionCandidates.length;
                updateMentionSuggestions();
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                mentionIndex = (mentionIndex - 1 + mentionCandidates.length) % mentionCandidates.length;
                updateMentionSuggestions();
                return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insertMention(mentionCandidates[mentionIndex]?.username);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                hideMentionSuggestions();
                return;
            }
        }
        if (event.key === 'Enter') sendMessage();
    }

    document.addEventListener('mousedown', event => {
        if (event.target !== chatInput && !mentionSuggestions.contains(event.target)) hideMentionSuggestions();
    });

    async function isBlacklisted(text) {
        const words = await getBlacklist();
        const htmlRegex = /<\/?[a-z][\s\S]*>/i;
        if (htmlRegex.test(text)) return true;
        return words.some(w => normalize(text).includes(w));
    }

    let _sending = false;
    async function sendMessage() {
        if (_sending) return;
        const input = document.getElementById('chat-bar');
        filterChatInput(input);
        hideMentionSuggestions();
        const contents = input.value.trim();
        if (!contents) return;
        _sending = true;
        input.value = '';
        if (await isBlacklisted(contents)) { _sending = false; return; }
        const token = localStorage.getItem('token');
        if (!token) { _sending = false; window.location.href = '../login'; return; }

        try {
            if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'send', contents }));
            } else {
                await fetch(`${API}/chat/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ contents })
                });
                await updateTheMessages(true);
            }
        } finally {
            _sending = false;
        }
    }

    async function populateStickerBubble() {
        const stickers = await getStickers();
        const bubble = document.getElementById('sticker-bubble');
        stickers.filter(name => !['true', 'false', 'perhaps', 'trey', 'krue'].includes(name)).forEach(name => {
            const img = document.createElement('img');
            img.id = name;
            img.className = 'sticker-in-bubble smooth-btn';
            img.src = `${API}/stickers/${name}.png`;
            img.onclick = () => addSticker(name);
            bubble.insertBefore(img, bubble.firstChild);
        });
    }

    updateTheMessages(true);
    connectWS();
    populateStickerBubble();
    setInterval(() => { if (!historyLoaded && !wsReady) updateTheMessages(true); else if (!wsReady) updateTheMessages(false); }, 30000);

    let _notifs = [];

    async function loadNotifs() {
        const t = localStorage.getItem('token');
        if (!t) return;
        const data = await fetch(`${API}/notifications`, { headers: { 'Authorization': `Bearer ${t}` } }).then(r => r.ok ? r.json() : []).catch(() => []);
        _notifs = data;
        const unread = data.filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge');
        if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.style.display = 'flex'; }
        else { badge.style.display = 'none'; }
    }

    function renderNotifs() {
        const list = document.getElementById('notif-list');
        list.innerHTML = '';
        if (!_notifs.length) {
            const empty = document.createElement('p');
            empty.style.cssText = "font-family:'FunkinOptions',sans-serif;font-size:2vh;color:#999;text-align:center;padding:2vh;margin:0;";
            empty.textContent = 'No notifications yet.';
            list.appendChild(empty);
            return;
        }
        _notifs.forEach(n => {
            const row = document.createElement('div');
            row.style.cssText = `display:flex;align-items:center;gap:1.2vh;padding:1.2vh 1.5vh;cursor:pointer;border-bottom:1px solid #2a2a3a;background:${n.read ? 'transparent' : 'rgba(173,0,84,0.08)'};`;
            row.onmouseover = () => row.style.background = n.read ? '#1f1d2e' : 'rgba(173,0,84,0.15)';
            row.onmouseout = () => row.style.background = n.read ? 'transparent' : 'rgba(173,0,84,0.08)';
            const img = document.createElement('img');
            img.src = `${API}/avatars/${n.fromId}.png`;
            img.onerror = () => { img.src = 'https://funkinbackstage.com/icon-profile-out.png'; };
            img.style.cssText = 'height:4.5vh;width:4.5vh;border-radius:50%;object-fit:cover;border:0.4vh solid #E1E1E1;flex-shrink:0;';
            const text = document.createElement('span');
            text.style.cssText = "font-family:'FunkinOptions',sans-serif;font-size:1.9vh;color:#ccc;line-height:1.4;";
            if (n.type === 'follow') {
                text.innerHTML = `<strong style="color:#E1E1E1;">${n.fromUsername}</strong> followed you`;
                row.onclick = () => { window.location.href = `https://funkinbackstage.com/users/${n.fromId}`; };
            } else if (n.type === 'upload') {
                text.innerHTML = `<strong style="color:#E1E1E1;">${n.fromUsername}</strong> uploaded <strong style="color:#E1E1E1;">${n.title}</strong>`;
                row.onclick = () => { window.location.href = `https://funkinbackstage.com/mods/${n.submissionId}`; };
            }
            row.appendChild(img);
            row.appendChild(text);
            list.appendChild(row);
        });
    }

    function toggleNotifs() {
        const dd = document.getElementById('notif-dropdown');
        const open = dd.style.display === 'flex';
        dd.style.display = open ? 'none' : 'flex';
        dd.style.flexDirection = 'column';
        if (!open) { renderNotifs(); markNotifsRead(); }
    }

    async function markNotifsRead() {
        const t = localStorage.getItem('token');
        if (!t) return;
        await fetch(`${API}/notifications/read`, { method: 'POST', headers: { 'Authorization': `Bearer ${t}` } }).catch(() => {});
        _notifs = _notifs.map(n => ({ ...n, read: true }));
        document.getElementById('notif-badge').style.display = 'none';
    }

    document.addEventListener('click', e => {
        const wrap = document.getElementById('notif-wrap');
        if (wrap && !wrap.contains(e.target)) document.getElementById('notif-dropdown').style.display = 'none';
    });

