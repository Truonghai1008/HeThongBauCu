let contract;
let signer;
let timerInterval;
const contractAddress = "0x69B917d3ff3fd9E26d37743Fe7EF2Ac36Fc369e5";
const THEME_KEY = "bauCuTheme";

// --- QUẢN LÝ GIAO DIỆN (THEME) ---
function applyTheme(theme) {
    const root = document.documentElement;
    const themeToggle = document.getElementById("themeToggle");
    const themeName = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", themeName);
    localStorage.setItem(THEME_KEY, themeName);

    if (themeToggle) {
        themeToggle.innerHTML = themeName === "dark"
            ? '<i class="fas fa-sun"></i><span>Chế độ sáng</span>'
            : '<i class="fas fa-moon"></i><span>Chế độ tối</span>';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
            applyTheme(current === "dark" ? "light" : "dark");
        });
    }
}

// --- KHỞI TẠO HỆ THỐNG ---
async function init() {
    initTheme();

    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            window.ethereum.on("accountsChanged", () => location.reload());
            window.ethereum.on("chainChanged", () => location.reload());

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await setupContract();
                const userAddress = await signer.getAddress();
                await updateAuthUI(userAddress);
            }
        } catch (error) {
            console.error("Lỗi khởi tạo:", error);
        }
    } else {
        alert("Vui lòng cài đặt MetaMask!");
    }
}

async function setupContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
}

async function updateAuthUI(address) {
    try {
        const registeredName = await contract.voterNames(address);
        if (registeredName && registeredName.trim() !== "") {
            showDashboard(address, registeredName);
        }
    } catch (err) {
        console.error("Lỗi kiểm tra đăng ký:", err);
    }
}

async function handleAuth() {
    await setupContract();
    const nameInput = document.getElementById("voterNameInput");
    const inputName = nameInput.value.trim();
    if (!inputName) return alert("Vui lòng nhập tên!");
    
    try {
        const tx = await contract.registerVoter(inputName);
        alert("Đang xác thực danh tính trên Blockchain...");
        await tx.wait();
        location.reload();
    } catch (e) {
        alert("Lỗi đăng ký: " + (e.reason || e.message));
    }
}

// --- DASHBOARD CHÍNH ---
async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    const isAdmin = address.toLowerCase() === adminAddr.toLowerCase();

    // Hiển thị vai trò
    const roleLabel = document.getElementById("userRole");
    if (roleLabel) {
        roleLabel.innerText = isAdmin ? "Quản trị viên" : "Người bầu chọn";
        roleLabel.style.background = isAdmin 
            ? "linear-gradient(135deg, #cf5e64, #b85059)" 
            : "linear-gradient(135deg, #2d8a72, #4da88f)";
        roleLabel.style.color = "white";
    }

    // Hiển thị Panel Admin
    if (isAdmin) {
        const adminBtn = document.getElementById("adminQuickBtn");
        const startBtn = document.getElementById("startElectionBtn");
        if (adminBtn) adminBtn.style.display = "inline-flex";
        if (startBtn) startBtn.style.display = "inline-flex";
        
        // Load cấu hình chế độ bầu cử
        const isPrivateMode = await contract.isPrivate();
        const modeSelect = document.getElementById("electionModeSelect");
        if (modeSelect) modeSelect.value = isPrivateMode.toString();
        
        const whitelistMgmt = document.getElementById("whitelistManager");
        if (whitelistMgmt) whitelistMgmt.style.display = isPrivateMode ? "block" : "none";
        
        if (isPrivateMode) loadWhitelist();
    }

    document.getElementById("displayName").innerText = `Xin chào: ${name}`;
    
    // Tải dữ liệu ban đầu
    loadCandidates(isAdmin);
    loadVoteHistory();
    runCountdown();
}

// --- QUẢN LÝ ỨNG CỬ VIÊN ---
async function loadCandidates(isAdmin) {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    try {
        const count = await contract.candidatesCount();
        const totalCandidates = Number(count);
        let totalVotes = 0;
        const candidatesData = [];

        for (let i = 1; i <= totalCandidates; i++) {
            const c = await contract.getCandidate(i);
            if (c[4]) { // c[4] là field 'active'
                totalVotes += Number(c[2]);
                candidatesData.push(c);
            }
        }

        listDiv.innerHTML = "";
        resultsDiv.innerHTML = "";

        if (candidatesData.length === 0) {
            listDiv.innerHTML = '<p class="section-note">Chưa có ứng cử viên nào.</p>';
            resultsDiv.innerHTML = '<p class="section-note">Chưa có dữ liệu.</p>';
            return;
        }

        candidatesData.forEach(candidate => {
            const id = Number(candidate[0]);
            const name = candidate[1];
            const votes = Number(candidate[2]);
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            const safeName = name.replace(/'/g, "\\'").replace(/"/g, "&quot;");

            // Render danh sách bầu chọn
            const item = document.createElement("div");
            item.className = "candidate-item";
            item.innerHTML = `
                <div class="candidate-main">
                    <div class="candidate-avatar">${name.charAt(0).toUpperCase()}</div>
                    <div class="candidate-text">
                        <strong>${name}</strong>
                        <small>ID: #${id}</small>
                    </div>
                </div>
                <div class="candidate-actions">
                    <button onclick="vote(${id})" class="vote-btn">Bầu chọn</button>
                    ${isAdmin ? `
                        <button onclick="openEditModal(${id}, '${safeName}')" class="icon-btn edit-btn"><i class="fas fa-pen"></i></button>
                        <button onclick="deleteCandidate(${id})" class="icon-btn delete-btn"><i class="fas fa-trash"></i></button>
                    ` : ""}
                </div>`;
            listDiv.appendChild(item);

            // Render biểu đồ kết quả
            const resultRow = document.createElement("div");
            resultRow.className = "result-row";
            resultRow.innerHTML = `
                <div class="result-head">
                    <span>${name}</span>
                    <span>${votes} phiếu (${percentage.toFixed(1)}%)</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percentage}%;"></div>
                </div>`;
            resultsDiv.appendChild(resultRow);
        });
    } catch (err) {
        console.error("Lỗi tải ứng viên:", err);
    }
}

async function addNewCandidate() {
    const nameInput = document.getElementById("candidateNameInput");
    if (!nameInput.value.trim()) return alert("Nhập tên ứng viên!");
    try {
        const tx = await contract.addCandidate(nameInput.value.trim(), "");
        await tx.wait();
        nameInput.value = "";
        loadCandidates(true);
    } catch (e) { alert(e.reason || "Lỗi thêm ứng viên!"); }
}

async function deleteCandidate(id) {
    if (!confirm("Xóa ứng viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi xóa!"); }
}

// --- QUẢN LÝ BẦU CỬ & WHITELIST ---
async function vote(id) {
    try {
        const tx = await contract.vote(id);
        alert("Giao dịch đã gửi, vui lòng chờ...");
        await tx.wait();
        alert("Bầu chọn thành công!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi: Bạn không có quyền hoặc đã bầu rồi!"); }
}

async function loadWhitelist() {
    const table = document.getElementById("whitelistTable");
    if (!table) return;
    try {
        const addresses = await contract.getWhitelist();
        document.getElementById("whitelistCount").innerText = addresses.length;
        table.innerHTML = addresses.map(addr => `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee; font-size:0.8rem;">
                <span>${addr}</span>
                <i class="fas fa-times" style="color:red; cursor:pointer;" onclick="removeFromWhitelist('${addr}')"></i>
            </div>`).join('');
    } catch (e) { console.error(e); }
}

async function addVoterToWhitelist() {
    const addr = document.getElementById("whitelistAddressInput").value.trim();
    if (!ethers.isAddress(addr)) return alert("Địa chỉ ví không hợp lệ!");
    try {
        const tx = await contract.addToWhitelist(addr);
        await tx.wait();
        loadWhitelist();
    } catch (e) { alert(e.reason || "Lỗi thêm whitelist!"); }
}

async function changeElectionMode() {
    const isPrivate = document.getElementById("electionModeSelect").value === "true";
    try {
        const tx = await contract.setElectionMode(isPrivate);
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi chuyển chế độ!"); }
}

// --- ĐẾM NGƯỢC THỜI GIAN ---
async function runCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    const updateUI = async () => {
        const timerLabel = document.getElementById("timerDisplay");
        if (!timerLabel) return;
        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;

            if (!isStarted || timeLeft <= 0) {
                timerLabel.innerHTML = isStarted ? "Đã kết thúc" : "Chờ khởi tạo...";
                return;
            }
            const min = Math.floor(timeLeft / 60);
            const sec = timeLeft % 60;
            timerLabel.innerHTML = `Thời gian còn lại: ${min}ph : ${sec}s`;
        } catch (e) { console.error(e); }
    };
    updateUI();
    timerInterval = setInterval(updateUI, 1000);
}

// --- LỊCH SỬ GIAO DỊCH (HASH) ---
async function loadVoteHistory() {
    const historyDiv = document.getElementById("voteHistoryList");
    if (!historyDiv) return;
    try {
        const count = await contract.getVoteHistoryCount();
        const total = Number(count);
        historyDiv.innerHTML = "";
        for (let i = total - 1; i >= Math.max(0, total - 5); i--) {
            const record = await contract.voteHistory(i);
            const fakeHash = ethers.keccak256(ethers.toUtf8Bytes(record[0] + record[2].toString()));
            const row = document.createElement("div");
            row.style = "font-size:0.75rem; padding:10px; border-bottom:1px solid #eee; background:#fff;";
            row.innerHTML = `<strong>Hash:</strong> ${fakeHash.substring(0, 32)}...<br>
                             <small>Ví: ${record[0].substring(0, 10)}... | ID: ${record[1]}</small>`;
            historyDiv.appendChild(row);
        }
    } catch (e) { historyDiv.innerHTML = "Không thể tải lịch sử."; }
}

// --- MODAL CHỈNH SỬA ---
function openEditModal(id, currentName) {
    document.getElementById("editCandidateId").value = id;
    document.getElementById("editCandidateName").value = currentName;
    document.getElementById("editCandidateSection").style.display = "block";
}

async function saveCandidateEdit() {
    const id = document.getElementById("editCandidateId").value;
    const newName = document.getElementById("editCandidateName").value.trim();
    try {
        const tx = await contract.updateCandidate(id, newName, "");
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi cập nhật!"); }
}

// --- EXPORT CÁC HÀM RA WINDOW ---
window.handleAuth = handleAuth;
window.vote = vote;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.openEditModal = openEditModal;
window.saveCandidateEdit = saveCandidateEdit;
window.changeElectionMode = changeElectionMode;
window.addVoterToWhitelist = addVoterToWhitelist;
window.handleStartElection = async () => {
    const min = prompt("Số phút:", "10");
    if (!min) return;
    try {
        const tx = await contract.startElection(min);
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi bắt đầu!"); }
};
window.handleEndElection = async () => {
    if (confirm("Dừng ngay?")) {
        try {
            const tx = await contract.endElection();
            await tx.wait();
            location.reload();
        } catch (e) { alert(e.reason || "Lỗi dừng!"); }
    }
};
window.toggleAdminPanel = () => {
    const p = document.getElementById("adminSection");
    p.style.display = p.style.display === "none" ? "block" : "none";
};

init();