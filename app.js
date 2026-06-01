// --- Constants & State ---
const MEMBERS_COUNT = 20;
const STORAGE_KEY = 'fire_fighter_attendance';

let historyData = [];
let currentRecordId = null;
let currentAttendance = {}; // { 1: true, 2: false, ... }

// --- DOM Elements ---
const viewHome = document.getElementById('view-home');
const viewForm = document.getElementById('view-form');
const historyList = document.getElementById('history-list');
const membersList = document.getElementById('members-list');
const attendCountSpan = document.getElementById('attend-count');
const formTitle = document.getElementById('form-title');

// Buttons & Inputs
const btnNew = document.getElementById('btn-new');
const btnBack = document.getElementById('btn-back');
const btnExport = document.getElementById('btn-export');
const inputImport = document.getElementById('import-file');
const btnAllAttend = document.getElementById('btn-all-attend');
const btnAllAbsent = document.getElementById('btn-all-absent');
const btnDelete = document.getElementById('btn-delete');
const form = document.getElementById('attendance-form');

const dateInput = document.getElementById('date-input');
const contentInput = document.getElementById('content-input');
const recordIdInput = document.getElementById('record-id');

// --- Initialization ---
function init() {
    loadData();
    renderHistory();
    setupEventListeners();
    generateMembersList();
}

// --- Data Management ---
function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            historyData = JSON.parse(data);
            // Sort by date descending
            historyData.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
            console.error('Failed to parse local storage data', e);
            historyData = [];
        }
    } else {
        historyData = [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData));
}

// --- View Management ---
function switchView(viewName) {
    if (viewName === 'home') {
        viewForm.classList.remove('active');
        viewHome.classList.add('active');
        renderHistory();
    } else if (viewName === 'form') {
        viewHome.classList.remove('active');
        viewForm.classList.add('active');
    }
    window.scrollTo(0, 0);
}

// --- Render History ---
function renderHistory() {
    historyList.innerHTML = '';
    
    if (historyData.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <p>登録された履歴がありません。<br>「新規活動を登録」から追加してください。</p>
            </div>
        `;
        return;
    }

    historyData.forEach(record => {
        const attendCount = Object.values(record.attendance).filter(v => v).length;
        
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <div class="history-info">
                <span class="history-date">${formatDate(record.date)}</span>
                <span class="history-content">${record.content}</span>
            </div>
            <div class="history-stats">
                ${attendCount}/${MEMBERS_COUNT}名
            </div>
        `;
        
        card.addEventListener('click', () => openEditForm(record.id));
        historyList.appendChild(card);
    });
}

function formatDate(dateString) {
    const d = new Date(dateString);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
}

// --- Form Management ---
function generateMembersList() {
    membersList.innerHTML = '';
    for (let i = 1; i <= MEMBERS_COUNT; i++) {
        const item = document.createElement('div');
        item.className = 'member-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-name';
        nameSpan.textContent = `団員${i}`;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toggle-btn';
        toggleBtn.dataset.id = i;
        
        toggleBtn.addEventListener('click', () => {
            currentAttendance[i] = !currentAttendance[i];
            updateMemberToggle(toggleBtn, currentAttendance[i]);
            updateAttendCount();
        });
        
        item.appendChild(nameSpan);
        item.appendChild(toggleBtn);
        membersList.appendChild(item);
    }
}

function updateMemberToggle(btn, isAttend) {
    if (isAttend) {
        btn.classList.add('attend');
    } else {
        btn.classList.remove('attend');
    }
}

function updateAttendCount() {
    const count = Object.values(currentAttendance).filter(v => v).length;
    attendCountSpan.textContent = `出席: ${count}名 / ${MEMBERS_COUNT}名`;
}

function resetForm() {
    currentRecordId = null;
    formTitle.textContent = '新規登録';
    
    // Set today's date as default
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    
    contentInput.value = '';
    btnDelete.classList.add('hidden');
    
    // Default all to absent
    for (let i = 1; i <= MEMBERS_COUNT; i++) {
        currentAttendance[i] = false;
    }
    refreshMembersUI();
}

function refreshMembersUI() {
    const btns = membersList.querySelectorAll('.toggle-btn');
    btns.forEach(btn => {
        const id = btn.dataset.id;
        updateMemberToggle(btn, currentAttendance[id]);
    });
    updateAttendCount();
}

function openEditForm(id) {
    const record = historyData.find(r => r.id === id);
    if (!record) return;
    
    currentRecordId = record.id;
    formTitle.textContent = '活動の編集';
    
    dateInput.value = record.date;
    contentInput.value = record.content;
    currentAttendance = { ...record.attendance };
    
    btnDelete.classList.remove('hidden');
    refreshMembersUI();
    
    switchView('form');
}

function saveRecord(e) {
    e.preventDefault();
    
    const date = dateInput.value;
    const content = contentInput.value.trim();
    
    if (!date || !content) {
        showToast('日付と内容を入力してください。');
        return;
    }
    
    const newRecord = {
        id: currentRecordId || Date.now().toString(),
        date,
        content,
        attendance: { ...currentAttendance }
    };
    
    if (currentRecordId) {
        // Update
        const index = historyData.findIndex(r => r.id === currentRecordId);
        if (index !== -1) historyData[index] = newRecord;
    } else {
        // Create
        historyData.push(newRecord);
    }
    
    saveData();
    showToast('保存しました。');
    switchView('home');
}

function deleteRecord() {
    if (!currentRecordId) return;
    
    if (confirm('この記録を削除してもよろしいですか？')) {
        historyData = historyData.filter(r => r.id !== currentRecordId);
        saveData();
        showToast('削除しました。');
        switchView('home');
    }
}

// --- Bulk Actions ---
function setAllAttend(attend) {
    for (let i = 1; i <= MEMBERS_COUNT; i++) {
        currentAttendance[i] = attend;
    }
    refreshMembersUI();
}

// --- Export & Import ---
function exportData() {
    if (historyData.length === 0) {
        showToast('エクスポートするデータがありません。');
        return;
    }
    
    const dataStr = JSON.stringify(historyData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `消防団出席データ_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('データをエクスポートしました。');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Basic validation
            if (!Array.isArray(importedData)) throw new Error('Invalid format');
            
            if (confirm('既存のデータと結合（上書き）しますか？')) {
                // Merge logic (upsert based on ID)
                importedData.forEach(newRec => {
                    const existingIndex = historyData.findIndex(r => r.id === newRec.id);
                    if (existingIndex !== -1) {
                        historyData[existingIndex] = newRec; // Overwrite
                    } else {
                        historyData.push(newRec); // Add new
                    }
                });
                
                saveData();
                loadData(); // Reload to sort
                renderHistory();
                showToast('データをインポートしました。');
            }
        } catch (err) {
            console.error(err);
            showToast('ファイルの読み込みに失敗しました。形式を確認してください。');
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// --- UI Helpers ---
let toastTimeout;
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    btnNew.addEventListener('click', () => {
        resetForm();
        switchView('form');
    });
    
    btnBack.addEventListener('click', () => switchView('home'));
    
    form.addEventListener('submit', saveRecord);
    btnDelete.addEventListener('click', deleteRecord);
    
    btnAllAttend.addEventListener('click', () => setAllAttend(true));
    btnAllAbsent.addEventListener('click', () => setAllAttend(false));
    
    btnExport.addEventListener('click', exportData);
    inputImport.addEventListener('change', importData);
}

// --- Run ---
init();
