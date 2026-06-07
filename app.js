// --- Constants & State ---
const MEMBERS_COUNT = 20;

// 【重要】ここにGASで発行された「ウェブアプリのURL」を貼り付けてください
const GAS_WEBAPP_URL = "";

let historyData = []; // [{ id, date, content, attendance: { memberId: 'attend' | 'absent' | '' } }]
let memberNames = {}; // { 1: '団員1', 2: '団員2', ... }
let isSyncing = false;

// --- DOM Elements ---
const rowDates = document.getElementById('row-dates');
const rowContents = document.getElementById('row-contents');
const tableBody = document.getElementById('table-body');
const btnExport = document.getElementById('btn-export');
const inputImport = document.getElementById('import-file');
const syncStatusEl = document.getElementById('sync-status');

// --- Initialization ---
async function init() {
    if (!GAS_WEBAPP_URL) {
        showToast("GASのURLが設定されていません。コード内の GAS_WEBAPP_URL を設定してください。");
        // URLがない場合はローカルでダミーデータとして動かすための初期化
        initializeDefaultMembers();
        renderTable();
        return;
    }

    updateSyncStatus("読込中...");
    await loadData();
    renderTable();
    setupEventListeners();
    
    // 定期ポーリング（5秒ごと）
    setInterval(pollData, 5000);
}

function initializeDefaultMembers() {
    for (let i = 1; i <= MEMBERS_COUNT; i++) {
        if (!memberNames[i]) {
            memberNames[i] = `団員${i}`;
        }
    }
}

// --- Data Management (GAS Sync) ---
function updateSyncStatus(text, isError = false) {
    if (!syncStatusEl) return;
    syncStatusEl.textContent = text;
    if (isError) {
        syncStatusEl.className = "sync-status error";
    } else if (text) {
        syncStatusEl.className = "sync-status syncing";
    } else {
        syncStatusEl.className = "sync-status";
    }
}

async function loadData() {
    if (!GAS_WEBAPP_URL) return;
    try {
        isSyncing = true;
        const response = await fetch(GAS_WEBAPP_URL);
        const data = await response.json();
        
        if (data && data.memberNames && data.historyData) {
            memberNames = data.memberNames;
            historyData = data.historyData;
        } else {
            initializeDefaultMembers();
        }
        updateSyncStatus("");
    } catch(err) {
        console.error("Load Error:", err);
        updateSyncStatus("通信エラー", true);
        initializeDefaultMembers();
    } finally {
        isSyncing = false;
    }
}

async function saveData() {
    if (!GAS_WEBAPP_URL) return;
    try {
        isSyncing = true;
        updateSyncStatus("保存中...");
        
        const dataToSave = {
            memberNames,
            historyData
        };

        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain', // CORS回避のために text/plain を使用
            },
            body: JSON.stringify(dataToSave)
        });
        
        const result = await response.json();
        if (result.status === "success") {
            updateSyncStatus("");
        } else {
            updateSyncStatus("保存エラー", true);
            console.error(result.message);
        }
    } catch(err) {
        console.error("Save Error:", err);
        updateSyncStatus("通信エラー", true);
    } finally {
        isSyncing = false;
    }
}

async function pollData() {
    if (isSyncing || !GAS_WEBAPP_URL) return; // 保存中や読み込み中はスキップ
    
    try {
        const response = await fetch(GAS_WEBAPP_URL);
        const data = await response.json();
        
        if (data && data.memberNames && data.historyData) {
            // 現在のデータと比較し、差分があれば更新する
            const currentStr = JSON.stringify({ memberNames, historyData });
            const fetchStr = JSON.stringify(data);
            
            if (currentStr !== fetchStr) {
                memberNames = data.memberNames;
                historyData = data.historyData;
                renderTable();
            }
        }
        updateSyncStatus("");
    } catch(err) {
        console.error("Poll Error:", err);
        updateSyncStatus("通信エラー", true);
    }
}

// --- Render Table ---
function renderTable() {
    // 1. Render Dates Row
    let datesHtml = `<th>日程</th>`;
    historyData.forEach(col => {
        const formattedDate = col.date ? new Date(col.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '未設定';
        datesHtml += `<th class="editable" onclick="editDate('${col.id}')">${formattedDate}</th>`;
    });
    datesHtml += `<th rowspan="2" style="width: 60px;"><button class="add-col-btn" onclick="addColumn()">+</button></th>`;
    rowDates.innerHTML = datesHtml;

    // 2. Render Contents Row
    let contentsHtml = `<th>内容</th>`;
    historyData.forEach(col => {
        contentsHtml += `<th class="editable" onclick="editContent('${col.id}')">${col.content || '未設定'}</th>`;
    });
    rowContents.innerHTML = contentsHtml;

    // 3. Render Body (Members and Attendance)
    let bodyHtml = '';
    for (let i = 1; i <= MEMBERS_COUNT; i++) {
        bodyHtml += `<tr>`;
        bodyHtml += `<th class="editable" onclick="editMemberName(${i})">${memberNames[i]}</th>`;
        
        historyData.forEach(col => {
            const status = col.attendance[i] || ''; // 'attend', 'absent', ''
            let displayChar = '';
            let btnClass = 'cell-btn';
            
            if (status === 'attend') {
                displayChar = '〇';
                btnClass += ' attend';
            } else if (status === 'absent') {
                displayChar = '×';
                btnClass += ' absent';
            }

            bodyHtml += `<td><button class="${btnClass}" onclick="toggleAttendance(${i}, '${col.id}')">${displayChar}</button></td>`;
        });
        
        bodyHtml += `</tr>`;
    }
    tableBody.innerHTML = bodyHtml;
}

// --- Interactions ---
window.toggleAttendance = function(memberId, colId) {
    const colIndex = historyData.findIndex(col => col.id === colId);
    if (colIndex === -1) return;

    const currentStatus = historyData[colIndex].attendance[memberId] || '';
    let nextStatus = '';

    if (currentStatus === '') nextStatus = 'attend';
    else if (currentStatus === 'attend') nextStatus = 'absent';
    else nextStatus = '';

    historyData[colIndex].attendance[memberId] = nextStatus;
    renderTable(); // すぐに画面に反映
    saveData();    // 裏で非同期保存
}

window.addColumn = function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${yyyy}-${mm}-${dd}`;

    const newCol = {
        id: Date.now().toString(),
        date: defaultDate,
        content: '活動内容',
        attendance: {}
    };
    
    historyData.push(newCol);
    renderTable();
    saveData();
    showToast('新しい列を追加しました。日付と内容をタップして編集してください。');
};

window.editDate = function(colId) {
    const col = historyData.find(c => c.id === colId);
    if (!col) return;
    
    const newDate = prompt('日程を入力してください (例: 2026-04-15)', col.date);
    if (newDate !== null && newDate.trim() !== '') {
        col.date = newDate.trim();
        renderTable();
        saveData();
    } else if (newDate !== null && newDate.trim() === '') {
        if(confirm('この列を削除しますか？')) {
            historyData = historyData.filter(c => c.id !== colId);
            renderTable();
            saveData();
            showToast('列を削除しました。');
        }
    }
};

window.editContent = function(colId) {
    const col = historyData.find(c => c.id === colId);
    if (!col) return;
    
    const newContent = prompt('活動内容を入力してください', col.content);
    if (newContent !== null) {
        col.content = newContent.trim();
        renderTable();
        saveData();
    }
};

window.editMemberName = function(memberId) {
    const currentName = memberNames[memberId];
    const newName = prompt('団員の名前を入力してください', currentName);
    
    if (newName !== null && newName.trim() !== '') {
        memberNames[memberId] = newName.trim();
        renderTable();
        saveData();
    }
};

// --- Export & Import (バックアップ用) ---
function exportData() {
    const dataToExport = { memberNames, historyData };
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `消防団出席データ_backup_${new Date().toISOString().split('T')[0]}.json`;
    
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
            if (!importedData.memberNames || !importedData.historyData) throw new Error('Invalid format');
            
            if (confirm('既存のデータを上書きしますか？（サーバー上のデータも上書きされます）')) {
                memberNames = importedData.memberNames;
                historyData = importedData.historyData;
                renderTable();
                saveData(); // サーバーにも反映
                showToast('データをインポートしました。');
            }
        } catch (err) {
            console.error(err);
            showToast('ファイルの読み込みに失敗しました。形式を確認してください。');
        }
    };
    reader.readAsText(file);
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
    btnExport.addEventListener('click', exportData);
    inputImport.addEventListener('change', importData);
}

// --- Run ---
init();
