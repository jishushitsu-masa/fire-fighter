// --- Constants & State ---
const MEMBERS_COUNT = 20;
const STORAGE_KEY_HISTORY = 'fire_fighter_history_v2';
const STORAGE_KEY_MEMBERS = 'fire_fighter_members_v2';

let historyData = []; // [{ id, date, content, attendance: { memberId: 'attend' | 'absent' | '' } }]
let memberNames = {}; // { 1: '団員1', 2: '団員2', ... }

// --- DOM Elements ---
const rowDates = document.getElementById('row-dates');
const rowContents = document.getElementById('row-contents');
const tableBody = document.getElementById('table-body');
const btnExport = document.getElementById('btn-export');
const inputImport = document.getElementById('import-file');

// --- Initialization ---
function init() {
    loadData();
    renderTable();
    setupEventListeners();
}

// --- Data Management ---
function loadData() {
    // Load Members
    const savedMembers = localStorage.getItem(STORAGE_KEY_MEMBERS);
    if (savedMembers) {
        try {
            memberNames = JSON.parse(savedMembers);
        } catch(e) { console.error(e); }
    }
    // Ensure all 20 members exist
    for (let i = 1; i <= MEMBERS_COUNT; i++) {
        if (!memberNames[i]) {
            memberNames[i] = `団員${i}`;
        }
    }

    // Load History
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
        try {
            historyData = JSON.parse(savedHistory);
        } catch(e) { console.error(e); historyData = []; }
    } else {
        historyData = [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(memberNames));
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyData));
}

// --- Render Table ---
function renderTable() {
    // 1. Render Dates Row
    let datesHtml = `<th>日程</th>`;
    historyData.forEach(col => {
        const formattedDate = col.date ? new Date(col.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '未設定';
        datesHtml += `<th class="editable" onclick="editDate('${col.id}')">${formattedDate}</th>`;
    });
    // Add Column Button (rowspan=2)
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
function toggleAttendance(memberId, colId) {
    const colIndex = historyData.findIndex(col => col.id === colId);
    if (colIndex === -1) return;

    const currentStatus = historyData[colIndex].attendance[memberId] || '';
    let nextStatus = '';

    if (currentStatus === '') nextStatus = 'attend';
    else if (currentStatus === 'attend') nextStatus = 'absent';
    else nextStatus = '';

    historyData[colIndex].attendance[memberId] = nextStatus;
    saveData();
    renderTable(); // Re-render to show changes
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
    saveData();
    renderTable();
    showToast('新しい列を追加しました。日付と内容をタップして編集してください。');
};

window.editDate = function(colId) {
    const col = historyData.find(c => c.id === colId);
    if (!col) return;
    
    const newDate = prompt('日程を入力してください (例: 2026-04-15)', col.date);
    if (newDate !== null && newDate.trim() !== '') {
        col.date = newDate.trim();
        saveData();
        renderTable();
    } else if (newDate !== null && newDate.trim() === '') {
        if(confirm('この列を削除しますか？')) {
            historyData = historyData.filter(c => c.id !== colId);
            saveData();
            renderTable();
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
        saveData();
        renderTable();
    }
};

window.editMemberName = function(memberId) {
    const currentName = memberNames[memberId];
    const newName = prompt('団員の名前を入力してください', currentName);
    
    if (newName !== null && newName.trim() !== '') {
        memberNames[memberId] = newName.trim();
        saveData();
        renderTable();
    }
};

// --- Export & Import ---
function exportData() {
    const dataToExport = {
        memberNames,
        historyData
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
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
            
            if (!importedData.memberNames || !importedData.historyData) {
                throw new Error('Invalid format (v2)');
            }
            
            if (confirm('既存のデータを上書きしますか？')) {
                memberNames = importedData.memberNames;
                historyData = importedData.historyData;
                
                saveData();
                renderTable();
                showToast('データをインポートしました。');
            }
        } catch (err) {
            console.error(err);
            
            // Try to import v1 data as fallback
            try {
                const importedV1 = JSON.parse(e.target.result);
                if (Array.isArray(importedV1)) {
                    if (confirm('古い形式のデータが検出されました。変換してインポートしますか？')) {
                        // Convert v1 to v2
                        historyData = importedV1.map(v1 => {
                            const newAtt = {};
                            Object.keys(v1.attendance).forEach(k => {
                                newAtt[k] = v1.attendance[k] ? 'attend' : 'absent';
                            });
                            return {
                                id: v1.id,
                                date: v1.date,
                                content: v1.content,
                                attendance: newAtt
                            };
                        });
                        saveData();
                        renderTable();
                        showToast('古い形式のデータを変換してインポートしました。');
                        return;
                    }
                } else {
                    showToast('ファイルの読み込みに失敗しました。形式を確認してください。');
                }
            } catch(e2) {
                showToast('ファイルの読み込みに失敗しました。形式を確認してください。');
            }
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
    
    // Attach window functions to global scope since they are used in onclick inline handlers
    // (Already attached as window.xxx = function...)
}

// --- Run ---
init();
