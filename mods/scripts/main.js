
var sortMethod = "activity";
var engineFilter = "any";
var categoryFilter = "any";

var featuredFilter = false;
var unapprovedFilter = false;
var likedFilter = false;
var filterCount = 0;
var sortBackwards = false;
var isAdmin = false;

function toggleLikedFilter() {
    likedFilter = !likedFilter;
    reloadModList();
    if (likedFilter) filterCount ++;
    else filterCount --;
    document.getElementById("filter-text").textContent = 'FILTERS - ' + filterCount;
}

function toggleFeaturedFilter() {
    featuredFilter = !featuredFilter;
    reloadModList();
    if (featuredFilter) filterCount ++;
    else filterCount --;
    document.getElementById("filter-text").textContent = 'FILTERS - ' + filterCount;
}

function toggleUnapprovedFilter() {
    unapprovedFilter = !unapprovedFilter;
    reloadModList();
    if (unapprovedFilter) filterCount ++;
    else filterCount --;
    document.getElementById("filter-text").textContent = 'FILTERS - ' + filterCount;
}

function changeSort(element) {
    sortMethod = `${element.textContent}`.toLowerCase();
    document.getElementById("sort-text").textContent = " SORT - " + sortMethod;
    reloadModList();
    toggleBox(document.getElementById('sort-arrow'), 'mod-box-sort');
}

function changeEngineFilter(element) {
    engineFilter = `${element.textContent}`.toLowerCase();
    document.getElementById("engine-text").textContent = "ENGINE - " + engineFilter;
    engineFilter = engineFilter.replace(' ', '-');
    reloadModList();
    toggleBox(document.getElementById('engine-arrow'), 'mod-box-2');
}

function changeCategoryFilter(element) {
    categoryFilter = `${element.textContent}`.toLowerCase();
    document.getElementById("category-text").textContent = "CATEGORY - " + categoryFilter;
    categoryFilter = categoryFilter.replace(' ', '-');
    reloadModList();
    toggleBox(document.getElementById('category-arrow'), 'mod-box-1');
}

function escapeHTML(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function firstImageThumb(thumbnails) {
    return thumbnails.find(t => !/\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(t)) || thumbnails[0];
}

function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

function relTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 2592000) return Math.floor(s / 86400) + 'd';
    if (s < 31536000) return Math.floor(s / 2592000) + 'mo';
    return Math.floor(s / 31536000) + 'y';
}

async function toggleLike(id, pieceEl) {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '../login'; return; }
    const res = await fetch(`${API}/submissions/${id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    pieceEl.querySelector('img').src = data.liked ? 'assets/icon-heart-filled.png' : 'assets/icon-heart.png';
    pieceEl.querySelector('h1').textContent = fmtNum(data.likes);
    reloadModList();
}

async function reloadModList() {
    const token = localStorage.getItem('token');
    let likedSubmissions = [];
    if (token) {
        const meRes = await fetch(`${API}/me`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({})
        });
        if (meRes.ok) {
            const me = await meRes.json();
            likedSubmissions = me.likedSubmissions ?? [];
            isAdmin = me.isAdmin ?? false;
        } else if (meRes.status === 401) {
            localStorage.removeItem('token');
            window.location.reload();
        }
    }

    const files = await fetch(`${API}/submissions`).then(r => r.json()).catch(() => []);
    if (!files.length) return;
    var filesArray = Array.from(files);
    var modDatas = [];
    for (const id of files) {
        const meta = await fetch(`${API}/submissions/${id}/meta.json`, { cache: 'no-store' }).then(r => r.json());
        if (!meta.live) continue;
        meta.storageID = id;
        modDatas.push(meta);
    }

    if (engineFilter != "any") {
        modDatas = modDatas.filter(_ => { return _.parent == engineFilter });
    }
    if (categoryFilter != "any") {
        modDatas = modDatas.filter(_ => { return _.child == categoryFilter });
    }

    if (sortBackwards) {
        switch (sortMethod) {
            case "activity":
                modDatas.sort((a, b) => {
                    const aDate = new Date(a.updateDate || a.uploadDate);
                    const bDate = new Date(b.updateDate || b.uploadDate);
                    return aDate - bDate;
                });
                break;
            case "downloads":
                modDatas.sort((a, b) => (a.downloads ?? 0) - (b.downloads ?? 0));
                break;
            case "likes":
                modDatas.sort((a, b) => (a.likes ?? 0) - (b.likes ?? 0));
                break;
            case "views":
                modDatas.sort((a, b) => (a.views ?? 0) - (b.views ?? 0));
                break;
            case "date added":
                modDatas.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
                break;
            case "stars":
                modDatas.sort((a, b) => (a.stars ?? 0) - (b.stars ?? 0));
                break;
        }
    } else {
        switch (sortMethod) {
            case "activity":
                modDatas.sort((a, b) => {
                    const aDate = new Date(a.updateDate || a.uploadDate);
                    const bDate = new Date(b.updateDate || b.uploadDate);
                    return bDate - aDate;
                });
                break;
            case "downloads":
                modDatas.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
                break;
            case "likes":
                modDatas.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
                break;
            case "views":
                modDatas.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
                break;
            case "date added":
                modDatas.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
                break;
            case "stars":
                modDatas.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
                break;
        }
    }

    var htmlOut = "";
    const parentElement = document.getElementById("mod-grid");

    for (const meta of modDatas) {
        if (featuredFilter && meta.stars == 0) continue;
        if (unapprovedFilter) {
            if (meta.approved) continue;
        } else {
            if (!meta.approved) continue;
        }
        const id = meta.storageID;
        const isLiked = likedSubmissions.includes(id);
        if (likedFilter && !isLiked) continue;
        const heartIcon = isLiked ? 'assets/icon-heart-filled.png' : 'assets/icon-heart.png';
        htmlOut += `
            <div style="position:relative;">
                <a class="mod-card" onclick="sessionStorage.setItem('modId','${id}');window.location.href='/mods/view/';" tabindex="-1" onkeydown="return false;" style="cursor:pointer;display:block;text-decoration:none;color:#E1E1E1;">
                    <img draggable="false" src="${firstImageThumb(meta.thumbnails)}" class="mod-thumbnail" style="display:block;">
                    <img draggable="false" src="${API}/avatars/${meta.submitter}.png" class="mod-topleft">
                    <img draggable="false" src="assets/mod capsule.png" class="mod-capsule">
                    <div class="mod-label" style="margin-top:0;padding-top:0.3rem;">
                        <h1 style="font-size: 3vh; margin:0; line-height:1.1; color:#E1E1E1;">${escapeHTML(meta.title)}</h1>
                        <h1 style="font-size: 2vh; color: #C7C7C7; margin:0; line-height:1.1;">${escapeHTML(meta.blurb)}</h1>
                    </div>
                    <div class="mod-footer">
                        <div class="mod-footer-left">
                            <div class="footer-piece">
                                <img draggable="false" src="assets/icon-download.png" style="height: 1.8vh;">
                                <h1 style="font-size: 2vh;">${fmtNum(meta.downloads ?? 0)}</h1>
                            </div>
                            <div class="footer-piece" style="cursor: ${token ? 'pointer' : 'default'};" onclick="event.stopPropagation();toggleLike('${id}', this)">
                                <img draggable="false" src="${heartIcon}" style="height: 1.8vh;">
                                <h1 style="font-size: 2vh;">${fmtNum(meta.likes ?? 0)}</h1>
                            </div>
                            <div class="footer-piece">
                                <img draggable="false" src="assets/icon-views.png" style="height: 1.8vh;">
                                <h1 style="font-size: 2vh;">${fmtNum(meta.views ?? 0)}</h1>
                            </div>
                        </div>
                        <div class="mod-footer-right">
                            ${meta.stars > 0 ? `
                            <div class="footer-piece" style="gap:0.15vw;margin-top:-0.1vh;margin-right:0.5vw;">
                                ${'<img draggable="false" src="assets/icon-featured.png" style="height:1.8vh;">'.repeat(meta.stars)}
                            </div>` : ``}
                            ${meta.updateDate == "" ? `
                            <div class="footer-piece">
                                <img draggable="false" src="assets/icon-plus.png" style="height: 1.8vh;">
                                <h1 style="font-size: 2vh;">${relTime(meta.uploadDate)}</h1>
                            </div>` : `
                            <div class="footer-piece">
                                <img draggable="false" src="assets/icon-updated.png" style="height: 1.8vh;">
                                <h1 style="font-size: 2vh;">${relTime(meta.updateDate)}</h1>
                            </div>`}
                        </div>
                    </div>
                </a>
                ${isAdmin ? `<div class="mod-admin-btns"><div class="mod-star-btn" data-stars="${meta.stars ?? 0}" onclick="setStars('${id}',${meta.stars ?? 0},this)"><img draggable="false" src="assets/feature-button.png" style="width:100%;height:100%;object-fit:contain;"></div><div class="mod-delete-btn" onclick="deleteSubmission('${id}',this.parentElement.parentElement)"><img draggable="false" src="assets/trash-button.png" style="width:100%;height:100%;object-fit:contain;"></div></div>` : ''}
            </div>
        `;
    }
    parentElement.innerHTML = htmlOut;
}
reloadModList();

const modUpdateStream = new EventSource(`${API}/mods/update-stream`);
modUpdateStream.onmessage = () => reloadModList();


function adminDialog({ title, inputDefault, confirmOnly, onConfirm }) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#2a1a2e;border:2px solid #6a3a6a;border-radius:12px;padding:1.5rem;display:flex;flex-direction:column;gap:1rem;min-width:280px;font-family:FunkinOptions,sans-serif;color:#E1E1E1;';

    const label = document.createElement('p');
    label.style.cssText = 'margin:0;font-size:1.1rem;';
    label.textContent = title;
    box.appendChild(label);

    let inputEl = null;
    if (!confirmOnly) {
        inputEl = document.createElement('input');
        inputEl.type = 'number';
        inputEl.min = 0; inputEl.max = 5;
        inputEl.value = inputDefault ?? '';
        inputEl.style.cssText = 'background:#1a0d1e;border:1px solid #6a3a6a;border-radius:6px;padding:0.4rem 0.6rem;color:#E1E1E1;font-size:1.1rem;font-family:inherit;width:100%;box-sizing:border-box;';
        box.appendChild(inputEl);
    }

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'background:#4a2a4a;border:none;border-radius:6px;padding:0.4rem 1rem;color:#E1E1E1;cursor:pointer;font-family:inherit;font-size:1rem;';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = confirmOnly ? 'Delete' : 'OK';
    okBtn.style.cssText = `background:${confirmOnly ? '#8b1a1a' : '#4a2a8b'};border:none;border-radius:6px;padding:0.4rem 1rem;color:#E1E1E1;cursor:pointer;font-family:inherit;font-size:1rem;`;

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    if (inputEl) setTimeout(() => { inputEl.focus(); inputEl.select(); }, 0);

    const close = () => overlay.remove();

    cancelBtn.onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };

    okBtn.onclick = () => {
        close();
        onConfirm(inputEl ? inputEl.value : true);
    };

    if (inputEl) {
        inputEl.onkeydown = e => {
            if (e.key === 'Enter') { close(); onConfirm(inputEl.value); }
            if (e.key === 'Escape') close();
        };
    }
}

async function setStars(id, current, btn) {
    adminDialog({
        title: `Stars for mod #${id} (0–5):`,
        inputDefault: btn.dataset.stars ?? current,
        confirmOnly: false,
        onConfirm: async value => {
            const stars = parseInt(value, 10);
            if (isNaN(stars) || stars < 0 || stars > 5) {
                adminDialog({ title: 'Enter a number 0–5', confirmOnly: true, onConfirm: () => {} });
                return;
            }
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/submissions/${id}/stars`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ stars })
            });
            if (res.ok) { btn.dataset.stars = stars; btn.textContent = `★ ${stars}`; }
            else {
                const d = await res.json().catch(() => ({}));
                adminDialog({ title: 'Failed: ' + (d.message || 'Unknown error'), confirmOnly: true, onConfirm: () => {} });
            }
        }
    });
}

async function deleteSubmission(id, wrapperEl) {
    adminDialog({
        title: `Delete mod #${id}? This cannot be undone.`,
        confirmOnly: true,
        onConfirm: async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/submissions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                wrapperEl.remove();
            } else {
                const data = await res.json().catch(() => ({}));
                adminDialog({ title: 'Delete failed: ' + (data.message || 'Unknown error'), confirmOnly: true, onConfirm: () => {} });
            }
        }
    });
}

function toggleTick(img) {
    img.classList.toggle('selected');
    img.src = img.classList.contains('selected') ? 'assets/checkbox-filled.png' : 'assets/checkbox-empty.png';
}

function toggleBox(btn, boxId) {
    const box = document.getElementById(boxId);
    const isExpanding = !box.classList.contains('expanded');

    document.querySelectorAll('.mod-box.expanded').forEach(b => {
        b.classList.remove('expanded');
        b.style.height = '';
        b.querySelector('.dropdown-arrow').classList.remove('flipped');
    });

    if (isExpanding) {
        box.style.height = box.scrollHeight + 'px'; 
        box.classList.add('expanded');
        btn.classList.add('flipped');
    }
}

function toggleDirection(btn) {
    const flipped = btn.classList.contains('flipped');

    if (flipped) {
        btn.classList.remove('flipped');
        sortBackwards = false;
    } else {
        btn.classList.add('flipped');
        sortBackwards = true;
    }
    reloadModList();
}